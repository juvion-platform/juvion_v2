# Fee Configuration — API Reference

**Spec:** `.captain/specs/fee-configuration/spec.md`
**Plan:** `.captain/specs/fee-configuration/plan.md`
**Tasks:** `.captain/specs/fee-configuration/tasks.md`

This document describes the HTTP API for the Fee Configuration feature — a programme-level fee pinning system that locks a student's `FeeStructureInstance` at enrollment/promotion time, reads it first for invoice generation, and surfaces per-pin Fee Commitment Sheet PDFs.

Complements the companion QA / deploy checklist: `./fee-configuration-qa-checklist.md`.

---

## Table of contents

1. [Concepts](#concepts)
2. [Data model](#data-model)
3. [Pin lifecycle](#pin-lifecycle)
4. [Endpoints](#endpoints)
   - [Pins](#pins)
   - [Commitment sheet](#commitment-sheet)
   - [Programme transfer](#programme-transfer)
   - [Component template](#component-template)
   - [Audit](#audit)
5. [Error codes](#error-codes)
6. [RBAC mapping](#rbac-mapping)
7. [Request/response shapes](#requestresponse-shapes)
8. [Integration behaviour](#integration-behaviour)
9. [Open questions](#open-questions)

---

## Concepts

### Pin
An entry on `Student.feePins[]` that **freezes** which `FeeStructureInstance` applies to a specific year-of-study for that student. Pins are immutable — any "change" archives the old pin and creates a new one. The pin is the source of truth for fee amounts; invoice generation reads it before falling back to live resolution.

### FeeStructureInstance (FSI)
The existing approved fee structure scoped to `(collegeId, programmeId, branchId?, academicYearId, quota, category)`. A pin references an FSI by `_id`.

### Fee Commitment Sheet
A PDF generated on every successful pin. Contains the student's name, programme, component-wise breakdown, and signature blocks. Stored in M02 Documents; referenced from the pin's `commitmentSheetDocumentId`.

### Component Template
A per-college seed set of 33 canonical fee components (tuition, lab, caution deposits, conditional hostel/transport, etc.). Colleges can edit default labels + order; they can add/remove custom components. Provides scaffolding when drafting a new FSI.

---

## Data model

### `Student.feePins[]` (embedded subdoc)

```ts
interface FeePin {
  _id: ObjectId;
  yearOfStudy: number;              // 1..8 (min=1, max=8)
  feeStructureInstanceId: ObjectId; // ref FeeStructureInstance
  pinnedAt: Date;
  pinnedBy: string;                 // userId | 'system:admission' | 'system:promotion'
                                    //         | 'system:backfill'  | 'system:invoice-lazy'
  reason: 'initial'
        | 'branch_change'
        | 'quota_change'
        | 'programme_transfer'
        | 'admin_override'
        | 'data_correction'
        | 'year_back_carryforward';
  remarks?: string;
  staleSince?: Date | null;         // set when attribute-drift detection flags the pin
  archivedAt?: Date | null;         // null = active pin
  archiveReason?: string;           // 'replaced' | 'branch_change' | ...
  commitmentSheetDocumentId?: ObjectId;     // ref Document (M02 ExitDocument)
  commitmentSheetStatus?: 'queued' | 'generated' | 'failed';
}
```

**Invariant (enforced at service layer):** at most one pin per `(studentId, yearOfStudy)` has `archivedAt === null`.

### `FeeComponentTemplate` (new collection)

```ts
interface FeeComponentTemplateDoc {
  _id: ObjectId;
  collegeId: ObjectId;
  componentKey: string;             // /^[a-z][a-z0-9_]*$/; unique per college
  displayLabel: string;
  category: 'academic' | 'admission_oneoff' | 'lab' | 'infrastructure'
          | 'student_life' | 'regulatory' | 'caution' | 'conditional';
  isRefundable: boolean;
  defaultOneTime: boolean;
  applicableToYears: number[];      // [] = all years
  displayOrder: number;
  isDefault: boolean;               // true = shipped canonical
  createdAt: Date;
  updatedAt: Date;
}
```

### `InvoiceLineItem.sourcePinId` (optional)

Audit-trace field populated by `generateSemesterInvoice` on every line item it creates. Pre-existing records have it null.

### `Student.studyYearAtAdmission` (new, optional)

Integer 1..8, default 1. Set to `2+` for lateral-entry students so `resolveStudentYearOfStudy` computes their current year correctly.

### `FeePinAuditSnapshot` (new collection, nightly)

Per-college daily snapshot persisted by the `fee-pin-audit` BullMQ worker. Retained 90 days. Used by the Finance dashboard.

---

## Pin lifecycle

```
(student admitted)  ────► provision_m04 → pinYear(y=1) ────► PIN Y1 (active)
                                                               │
                                                               │  end of academic year
                                                               ▼
(student promoted)  ────► promoteStudents loop → pinYear(y=N+1) ──► PIN Y(N+1) (active)
                                                               │
                                                               │  branch/quota/category change
                                                               ▼
                                             staleSince populated on active pin
                                             admin prompted in UI → Re-pin dialog
                                                               │
                                                               ▼
                          rePin(newFsi, reason) ────► old pin archived; new pin active

(programme transfer)  ──► transferProgramme → archive old Y(N); new Y(N) on new programme
                                              (prior-year pins untouched, historical)

(student exits / graduates) ─► pins preserved (audit / reissue invoices if needed)
```

### When each lifecycle event happens

| Event | Trigger | Reason value |
|---|---|---|
| **Year-1 pin** | Admission workflow `provision_m04` | `'initial'` |
| **Year-N+1 pin** | `promoteStudents` decision=`promoted` | `'initial'` |
| **Lazy-pin** | `generateSemesterInvoice` without an existing pin | `'initial'` (via `pinYear` `pinnedBy='system:invoice-lazy'`) |
| **Re-pin (stale)** | Admin clicks Re-pin in the Fee Pins UI after `staleSince` detection | `'branch_change'` \| `'quota_change'` \| `'admin_override'` |
| **Programme transfer** | `transferProgramme` service | `'programme_transfer'` |
| **Admin override** | Direct re-pin without attribute drift | `'admin_override'` \| `'data_correction'` |
| **Backfill** | One-shot `backfill-fee-pins.ts` script | `'initial'` (via `pinYear` `pinnedBy='system:backfill'`) |

---

## Endpoints

All endpoints are prefixed with `/api/finance`. All are behind:
- `authenticate` middleware (JWT, college scoping)
- `authorize(resource, action)` middleware per the RBAC mapping below
- `createUserRateLimit({ max: 60, windowMs: 60_000 })` — per-user rate limit

### Pins

#### `GET /students/:id/pins`

List all pins (active + archived) for a student.

- **Role:** `people:read`
- **Path:** `id` — Student ObjectId
- **Response 200:**
  ```json
  {
    "pins": [
      {
        "_id": "...",
        "yearOfStudy": 1,
        "feeStructureInstanceId": { "_id": "...", "name": "BTech CSE Y1 2024", "totalAmount": 123456, "approvedAt": "2024-06-01T00:00:00Z" },
        "pinnedAt": "2024-07-15T10:30:00Z",
        "pinnedBy": "system:admission",
        "reason": "initial",
        "archivedAt": null,
        "commitmentSheetDocumentId": "...",
        "commitmentSheetStatus": "generated"
      }
    ]
  }
  ```
- **Errors:** 401 · 403 · 404 (student not found)

#### `POST /students/:id/pins/re-pin`

Manually re-pin a student to a different FSI. Requires Principal authority.

- **Role:** `finance:approve` (→ Principal / super_admin)
- **Body:**
  ```json
  {
    "yearOfStudy": 2,
    "targetFeeStructureInstanceId": "...",
    "reason": "admin_override",
    "remarks": "Data correction — admission used wrong quota"
  }
  ```
- **Response 200:** `{ "pin": FeePin }` (the new active pin)
- **Errors:** 401 · 403 · 404 · 422 (target FSI not found, wrong college)

### Commitment sheet

#### `POST /students/:id/commitment-sheet/regenerate`

Regenerate the commitment sheet PDF for a specific pin (or the active one).

- **Role:** `finance:update`
- **Body:** `{ "pinId": "..." }` (optional — uses active pin when absent)
- **Response 200:** `{ "documentId": "..." }`
- **Errors:** 401 · 403 · 404 · 500 (PDF generation failure)

### Programme transfer

#### `POST /students/:id/transfer-programme`

Transfer a student to a different programme and automatically re-pin for the effective year.

- **Role:** `finance:approve`
- **Body:**
  ```json
  {
    "newProgrammeId": "...",
    "newBranchId": "...",
    "newRegulationId": "...",
    "effectiveYearOfStudy": 2,
    "academicYearId": "...",
    "reason": "Student-initiated transfer with academic committee approval",
    "remarks": "Approved 2025-04-15 by AY-Registrar"
  }
  ```
- **Response 200:**
  ```json
  {
    "student": { ... updated student ... },
    "oldPin": { ... archived pin ... },
    "newPin": { ... new active pin against new programme ... }
  }
  ```
- **Errors:**
  - 404 — student or old pin not found
  - 422 — no active FSI matches the new `(programmeId, branchId?, quota, category, academicYearId, yearOfStudy)` combo. Snapshot is restored; transfer is NOT committed.

Prior-year pins (year < `effectiveYearOfStudy`) are **untouched** — they remain as the historical record of what the student owed under the old programme.

### Component template

#### `GET /component-template`

List the college's fee component template.

- **Role:** `finance:read`
- **Query params:** `category?`, `applicableToYear?`
- **Response 200:** `{ "items": FeeComponentTemplateDoc[] }` (sorted by `displayOrder`)

#### `POST /component-template/components`

Add a custom component.

- **Role:** `finance:update`
- **Body:** `CreateComponentInput` (componentKey required, must match `/^[a-z][a-z0-9_]*$/`)
- **Response 201:** `{ "component": FeeComponentTemplateDoc }`
- **Errors:** 400 (invalid key) · 409 (duplicate key for this college)

#### `PUT /component-template/components/:componentId`

Update a component. Defaults allow only `displayLabel` + `displayOrder` mutations; other fields return 403. Customs allow all fields except `componentKey`.

- **Role:** `finance:update`
- **Body:** `UpdateComponentInput`
- **Response 200:** `{ "component": FeeComponentTemplateDoc }`
- **Errors:** 403 (locked field mutation attempt) · 404

#### `DELETE /component-template/components/:componentId`

Delete a custom component. Defaults cannot be deleted (use the displayOrder to hide from UI instead).

- **Role:** `finance:update`
- **Response 204**
- **Errors:** 403 (attempt to delete default) · 404

### Audit

#### `GET /pin-audit/coverage`

Percentage of active students with an active pin for their current year-of-study. Drives the dashboard "pin coverage" gauge.

- **Role:** `finance:read`
- **Query params:** `collegeId?` (only honored for `super_admin`; others scoped by JWT)
- **Response 200:**
  ```json
  {
    "collegeId": "...",
    "totalActiveStudents": 2450,
    "studentsWithActivePinForCurrentYear": 2450,
    "coveragePercent": 100,
    "studentsMissingPin": [ /* first 500 for dashboard */ ]
  }
  ```

#### `GET /pin-audit/invariants`

Detects invoice-total mismatches against pinned FSI totals (drift indicator).

- **Role:** `finance:read`
- **Query params:** `collegeId?`
- **Response 200:**
  ```json
  {
    "collegeId": "...",
    "totalInvoicesChecked": 487,
    "mismatches": [
      { "invoiceId": "...", "studentId": "...", "pinId": "...", "pinnedTotal": 120000, "invoiceTotal": 119500, "delta": -500 }
    ]
  }
  ```

Checks latest 500 non-FeeAgreement invoices per college. `mismatches` should be empty in steady state; non-zero requires investigation.

---

## Error codes

| Status | Meaning |
|---|---|
| 400 | Zod validation failure (malformed body / invalid componentKey / invalid enum value) |
| 401 | Missing/invalid JWT |
| 403 | Role mismatch · Mutation of locked default-component field · Attempt to delete a default component · PATCH `Student.programmeId` (must use `/transfer-programme`) |
| 404 | Student / pin / FSI / component / college not found |
| 409 | Duplicate `componentKey` in same college |
| 422 | Admission or transferProgramme blocked: no matching FSI for the combo. Response `message` names the exact combo. |
| 429 | Per-user rate limit (60/min) exceeded |
| 500 | Unexpected internal error (PDF generation failure, DB error, etc.) |

---

## RBAC mapping

| Action | Authorize call | Default roles |
|---|---|---|
| Read pins / template / audit | `authorize('finance', 'read')` or `authorize('people', 'read')` for pins list | finance_officer, principal, super_admin |
| Create/update/delete custom component · regenerate sheet | `authorize('finance', 'update')` | finance_officer, principal, super_admin |
| Re-pin · programme transfer | `authorize('finance', 'approve')` | principal, super_admin |

`authorize('finance', 'approve')` grants the action to `principal` (per the default RBAC policy) and to any role that inherits via wildcard (`super_admin`). Confirm with your RBAC owner before production deployment — the policy set can be customized per install.

---

## Request/response shapes

See `backend/src/modules/finance/validation.ts` for Zod schemas:
- `feePinRePinSchema`
- `commitmentSheetRegenerateSchema`
- `programmeTransferSchema`
- `feeComponentCreateSchema` / `feeComponentUpdateSchema`
- `feeComponentTemplateListQuerySchema`
- `pinAuditQuerySchema`

Response shapes match the TypeScript interfaces defined in:
- `backend/src/models/people/Student.ts` → `IFeePin`
- `backend/src/models/finance/FeeComponentTemplate.ts` → `IFeeComponentTemplate`
- `backend/src/models/finance/FeePinAuditSnapshot.ts` → `IFeePinAuditSnapshot`
- `backend/src/modules/finance/fee-pin-audit-service.ts` → `CoverageReport`, `InvariantReport`

---

## Integration behaviour

### Admission (`provision_m04`)
1. Student is created (upstream in `provision_m02`).
2. `feePinService.pinYear(student._id, entryPoint.studyYear, { pinnedBy: 'system:admission', ... })`.
3. If `FeeStructureNotFoundError` → admission fails 422 with the exact missing-combo message. Student is rolled back via `rollbackProvisionedStudent()` (compensating delete; Person preserved).
4. `StudentFeeAccount` totals populated from the pinned FSI.

### Promotion (`promoteStudents`)
1. For each student whose decision is `promoted`, `feePinService.pinYear(studentId, yearOfStudy + 1, ...)`.
2. If `FeeStructureNotFoundError` → student goes into `summary.deferredPins[]`. Promotion succeeds for that student's status change; pin is deferred until Finance publishes the missing structure.
3. `detained` and `year_back` students: no pin change (existing Year-N pin carries forward).

### Invoice generation (`generateSemesterInvoice`)
1. Resolve `yearOfStudy` via the canonical `resolveStudentYearOfStudy(studentId, { academicYearId })` helper.
2. `feePinService.resolveActivePin(studentId, yearOfStudy)`:
   - **Pin exists** → use pinned FSI's components + rules.
   - **No pin** → fall back to live `FeeStructureInstance.findOne({ status: 'active', ... })`. Log warn. Commit back as lazy-pin (`pinnedBy='system:invoice-lazy'`).
3. Existing `evaluateFeeComponentRules` for hostel/transport opt-ins is preserved.
4. Existing concession/scholarship stacking preserved.
5. Each `InvoiceLineItem` stores `sourcePinId` for audit traceability.

### Attribute-drift detection (`updateStudent`)
- On PATCH `branchId` / `quota` / `category`:
  - `feePinService.checkPinValidity` runs post-update.
  - If stale → sets `staleSince` on active pin; admin UI surfaces a yellow banner.
- On PATCH `programmeId`:
  - **Rejected with 403.** Caller must use `POST /students/:id/transfer-programme`.

---

## Open questions

Tracked in `.captain/specs/fee-configuration/spec.md` changelog:

| OQ | Summary | Status |
|---|---|---|
| OQ-6 | `FeeStructureInstance` has no `yearOfStudy` field; resolver doesn't filter on it server-side | Accepted (pin-per-year invariant held at `Student.feePins[]` level) |
| OQ-7 | `Batch` has no `academicYearId`; consumers must supply from their own context | Documented in T8/T9 integrations |
| OQ-8 | No generic M02 `createDocument` service; T7 shipped a pragmatic workaround using `ExitDocument` + `metadata.documentType` | Follow-up spec needed for proper Documents subsystem |
| OQ-9 | `ExitDocument` has no `superseded` status; uses `revoked=true, revokedReason='superseded'` | Accepted |
| OQ-10 | `Student` lacks `hostelOptIn` / `transportRequired`; `generateSheet` accepts optional `studentOptIns` arg | T8/T9 callers supply from hostel module |
| OQ-11 | Year-of-study derivation was an unfinished seam across 4 tasks | **Closed** by T20 (`resolveStudentYearOfStudy`) |
| OQ-12 | `FeeStructure` vs `FeeStructureInstance` schema divergence (totalAmount vs components[]) | Consolidation follow-up |
| OQ-13 | `FeeLineItem` (T1 target) vs `InvoiceLineItem` (T10 actual) collection divergence | Consolidation follow-up |
| OQ-14 | No Mongoose session/transaction abstraction; T8 + T11 use compensating-rollback | Separate SRE task |
| OQ-15 | FeeAgreement override **not in scope** for v1 (spec §NOT-For) | **Resolved** |
| OQ-16 | Promotion `academicYearId` convention (finishing vs incoming AY) | Documented — see QA checklist |
| T18-followup | 3 e2e scenarios skipped pending fixture investigation | Non-blocking; unit tests cover the underlying behaviour |

---

## Version history

- **2026-04-21** — v1 shipped: T1–T21 (21 tasks, 5 PRs, ~240 tests). `npm test` passes 441/441 backend units + 7 T18 e2e scenarios passing (3 skipped, documented).
