# Tasks: Fee Configuration

**Spec:** `./spec.md` · **Plan:** `./plan.md` · **Created:** 2026-04-21
**Total tasks:** 19 (17 Code, 2 Doc)

---

## Task DAG

```
Foundation (parallel, no deps)
  ┌─ T1 Schema + sourcePinId field ────────────────┐
  ├─ T2 Seed FeeComponentTemplate (30 components) ─┤
  ├─ T3 pdfkit + PdfRenderer utility ──────────────┤
  └─ T4 FEE_COMMITMENT BullMQ queue registration ──┘
                         │
                         ▼
                 Core Services
  ┌─ T5 fee-pin-service.ts (pinYear, rePin,   ◄── T1
  │    archivePin, resolveActivePin,
  │    checkPinValidity)                          ─┐
  ├─ T6 fee-component-template-service.ts ◄── T1   │
  └─ T7 fee-commitment-sheet-service.ts   ◄── T3,4,5
                         │
                ┌────────┼────────┬─────────────┐
                ▼        ▼        ▼             ▼
        Integration   API       Backfill    Observability
  T8 Admission     T11 HTTP  T15 backfill  T16 audit job
  T9 Promotion        routes    script     T17 dashboard
  T10 Invoice         (→5,6,7) (→5)         metrics
      (pin-first)
  T11a Rebind hooks
       (→5)
                            │
                            ▼
                       Frontend
                  T12 Student Fee Pins tab  ◄── T11
                  T13 Component Template UI ◄── T11
                  T14 Promotion UI (pin)    ◄── T11, T9
                            │
                            ▼
                     E2E & Docs
                  T18 E2E tests             ◄── T8,9,10,11,12
                  T19 API docs + QA cklist  ◄── T11, T18
```

### Parallelism opportunities
- **Foundation (T1–T4):** all four can run in parallel.
- **Core Services (T5–T7):** T5 and T6 parallel after T1. T7 depends on T3, T4, T5.
- **Integration (T8, T9, T10, T11a):** all four parallel after T5.
- **Frontend (T12–T14):** parallel after T11 (API). Each touches a different screen.
- **Backfill (T15) + Observability (T16):** parallel with integration.
- **T18 + T19:** serialized last.

### Front-loaded risks (per plan §4.1)
- **T15 backfill** is the hardest part. DRY-RUN mode + audit CSV + Finance sign-off are baked into its ACs.
- **T8 admission integration** hard-fails admission if no active FeeStructure exists (R-1). AC includes the exact error message + dashboard warning mechanism.

---

## Task List

| # | Task | Type | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Student.feePins schema + FeeComponentTemplate collection + FeeLineItem.sourcePinId field | Code | — | Done |
| 2 | Seed canonical 33-component template per college (idempotent script + hook into onboarding) | Code | 1 | Done |
| 3 | pdfkit dependency + shared PdfRenderer utility wrapper | Code | — | Done |
| 4 | FEE_COMMITMENT BullMQ queue registration + worker skeleton | Code | — | Done |
| 5 | fee-pin-service.ts: pinYear, rePin, archivePin, resolveActivePin, checkPinValidity | Code | 1 | Done |
| 6 | fee-component-template-service.ts: CRUD + admin-approval gate on edits | Code | 1 | Done |
| 7 | fee-commitment-sheet-service.ts: PDF generation via PdfRenderer + M02 Document attach + worker implementation | Code | 3, 4, 5 | Done |
| 8 | Admission integration: provision_m04 calls pinYear(N=1); hard-fail if no active structure | Code | 5 | Done |
| 9 | Promotion integration: promoteStudents calls pinYear(N+1); per-student deferred-pin reporting | Code | 5 | Done |
| 10 | Invoice generation pin-first: generateSemesterInvoice reads Student.feePins before live resolution | Code | 5 | Done |
| 11 | Rebind hooks: stale-pin detection on Student attribute change; auto-rebind on programme transfer | Code | 5 | Done |
| 12 | HTTP API: /pins GET, /pins/re-pin POST, /commitment-sheet/regenerate POST, /component-template GET/PUT, /pin-audit endpoints + validation | Code | 5, 6, 7 | Done |
| 13 | Admin UI: Fee Pins tab on StudentDetailPage (active pin + history + Principal-gated re-pin action) | Code | 12 | Done |
| 14 | Admin UI: FeeComponentTemplatePage (CRUD editor with approval workflow) | Code | 12 | Done |
| 15 | Admin UI: Promotion page pin-progress + deferred-pin error list | Code | 12, 9 | Done |
| 16 | Backfill script for existing students — DRY-RUN mode + audit CSV + --commit flag + --rollback | Code | 5 | Pending |
| 17 | Nightly audit job (BullMQ) + Finance dashboard metrics (coverage, invariants, PDF failure rate, deferred-pin count) | Code | 5, 10 | Pending |
| 18 | E2E integration tests covering admission→pin→invoice, promotion→pin, rebind, commitment sheet, invoice pin-first fallback | Code | 8, 9, 10, 11, 12 | Pending |
| 19 | API reference docs + QA / deploy checklist | Doc | 12, 18 | Pending |
| 20 | **(new, blocking T16)** `resolveStudentYearOfStudy` canonical helper from Student → Batch → AcademicYear math; consume from T8/T9/T10/T11; remove placeholders | Code | 5 | Done |
| 21 | **(new)** Add `Student.studyYearAtAdmission` field for lateral-entry support; backfill existing students to 1 | Code | 1 | Pending |

---

## Task Details

### Task 1: Student.feePins schema + FeeComponentTemplate collection + FeeLineItem.sourcePinId field
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** —

**Acceptance Criteria (maps to plan §2.1, §2.2, §2.3):**
- New `FeePin` subdoc schema in `backend/src/models/people/Student.ts` with fields: `_id`, `yearOfStudy: number`, `feeStructureInstanceId: ObjectId ref FeeStructureInstance`, `pinnedAt: Date`, `pinnedBy: string`, `reason: enum`, `remarks?: string`, `archivedAt?: Date | null`, `archiveReason?: string`, `commitmentSheetDocumentId?: ObjectId`, `commitmentSheetStatus?: enum`.
- `Student` document gains `feePins: Array<FeePin>` with `default: []`.
- Sparse index added: `{ 'feePins.feeStructureInstanceId': 1 }` for audit queries.
- New collection `FeeComponentTemplate` in `backend/src/models/finance/FeeComponentTemplate.ts` with fields from plan §2.2. Unique compound index `(collegeId, componentKey)`.
- Existing `FeeLineItem` schema gains optional `sourcePinId?: ObjectId` field (backward compatible; default undefined).
- Unit tests (vitest, in-memory):
  - FeePin subdoc accepts valid input
  - Student allows multiple pins with different yearOfStudy values
  - FeeComponentTemplate enforces unique (collegeId, componentKey)
  - FeeLineItem without sourcePinId still validates (backward compat)

**Context:** Additive schema changes only. No migrations needed — Mongoose populates on next write. FeeLineItem field is optional to avoid needing a migration for existing records.

**Testing reuse:** `backend/src/__tests__/helpers/mongoMemory.ts` for in-memory DB.

---

### Task 2: Seed canonical 33-component template per college
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 1

**Acceptance Criteria (maps to spec §Template, plan §2.4 Migration 2):**
- New script `backend/src/scripts/seed-fee-component-template.ts` that upserts 33 canonical components per college (8 categories: 4+4+5+5+5+3+3+4 = 33):
  - Academic (4): tuition_fee, development_fee, examination_fee, internal_assessment_fee
  - Admission one-offs (4): admission_fee, registration_fee, id_card_fee, orientation_fee
  - Lab & Practical (5): laboratory_fee, computer_lab_fee, workshop_fee, project_fee, internship_fee
  - Infrastructure (5): library_fee, digital_resources_fee, sports_fee, medical_fee, insurance_premium
  - Student Life (5): student_activity_fee, nss_fee, placement_service_fee, alumni_fee, convocation_fee
  - Regulatory (3): university_affiliation_fee, aicte_ugc_fee, pta_fee
  - Caution (3): caution_deposit_general, caution_deposit_library, caution_deposit_lab
  - Conditional (4): hostel_fee, mess_fee, transport_fee, caution_deposit_hostel
- Each seeded component carries: componentKey, displayLabel, category, isRefundable, defaultOneTime, applicableToYears, displayOrder, `isDefault: true`.
- Script is **idempotent** — running twice does not duplicate; it upserts by (collegeId, componentKey).
- Script accepts `--college-id=<id>` for a single-college seed OR runs for all colleges if omitted.
- Onboarding hook: when a new College is created (in `modules/colleges/service.ts#createCollege`), auto-seed the template.
- Unit tests:
  - Seeds 30 components for a new college
  - Second run is a no-op (upsert semantics)
  - College-specific customization (labels) is preserved on re-seed
  - Adding a new `isDefault: true` component via code change gets picked up on next seed

**Context:** The componentKey is the stable identifier; colleges can edit displayLabel + displayOrder + add custom components (with `isDefault: false`), but cannot edit default componentKeys. Re-seed must preserve customizations.

---

### Task 3: pdfkit dependency + shared PdfRenderer utility wrapper
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** —

**Acceptance Criteria (maps to plan §1.8, §3.1):**
- `pdfkit` ^0.15 added to `backend/package.json` (runtime dep) and `@types/pdfkit` ^0.13 (dev).
- New utility `backend/src/shared/pdf/PdfRenderer.ts` exports:
  - `class PdfRenderer` with a streaming `render(sections, out)` method
  - Section primitives: `header({ logo?, title, subtitle })`, `keyValueBlock({ ... })`, `table({ headers, rows })`, `totals({ label, amount, style })`, `footer({ left, right })`
  - Produces a `Buffer` or writes to a `Writable` stream
- Unit tests: snapshot tests of PDF buffer → parsed-back text assertions (using `pdfkit`'s internal stream or a fixture-based comparison).
- No reference to any business domain (commitment sheet etc.) — pure presentation primitives.

**Context:** Commitment sheet service (T7) composes these primitives. Keeping this layer dumb means future PDFs (transcript, certificate, receipts if needed) reuse the same utility. Do NOT couple to student/fee logic here.

---

### Task 4: FEE_COMMITMENT BullMQ queue registration + worker skeleton
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** —

**Acceptance Criteria (maps to plan §3.3, §1.8):**
- New queue name `FEE_COMMITMENT` added to `backend/src/shared/queue/QueueManager.ts` queue registry.
- Worker skeleton file `backend/src/workers/fee-commitment.worker.ts` — receives `{ studentId, pinId }` jobs.
- Worker concurrency capped at 4 (per plan §4 R-4).
- Retry policy: 3 attempts with exponential backoff (5s, 30s, 2min).
- Unit tests:
  - Queue registration picked up by QueueManager
  - Worker signature matches `(job) => Promise<void>`
  - Retry config persisted on job addition

**Context:** Worker is a skeleton in this task; actual PDF rendering + M02 Document attach logic lives in T7's fee-commitment-sheet-service and is called from within the worker.

---

### Task 5: fee-pin-service.ts
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 1

**Acceptance Criteria (maps to spec §AC pin schema/lifecycle, plan §1.4–1.7):**

Public API:
- `pinYear(studentId, yearOfStudy, opts: { pinnedBy, reason?, remarks? }): Promise<FeePin>`
  - Resolves active FeeStructureInstance for student's attributes
  - Archives any existing active pin for same `yearOfStudy` first
  - Pushes new pin to Student.feePins[]
  - Enqueues `FEE_COMMITMENT` job (from T4 queue)
  - Throws `FeeStructureNotFoundError` if no active structure matches
- `rePin(studentId, yearOfStudy, opts: { targetFeeStructureInstanceId, reason, remarks, pinnedBy }): Promise<FeePin>`
  - Used by admin for manual overrides
  - Archives current pin for yearOfStudy
  - Creates new pin referencing target instance
  - Auth-gated at controller level (Principal/super_admin)
- `archivePin(studentId, pinId, reason): Promise<void>` — sets archivedAt + archiveReason
- `resolveActivePin(studentId, yearOfStudy): Promise<FeePin | null>` — convenience read for invoice generation
- `checkPinValidity(studentId, yearOfStudy): Promise<{ valid: boolean, reason?: string }>` — returns false if attributes drifted from pinned structure
- `resolveMatchingFeeStructureInstance(student, yearOfStudy): Promise<FeeStructureInstance | null>` — factored from existing `resolveFeeStructure`; preference rules: exact branch > null branch; category exact match; quota exact match; latest `approvedAt` tie-breaker

Unit tests:
1. Pin Year-1 with matching structure → new pin pushed, commitment job enqueued
2. Pin Year-1 with NO matching structure → throws FeeStructureNotFoundError
3. Re-pin archives the current active pin and adds a new one (prior pin's archivedAt populated)
4. resolveActivePin returns latest non-archived entry for that yearOfStudy
5. checkPinValidity detects branch mismatch after student.branchId change
6. resolveMatchingFeeStructureInstance prefers exact-branch over null-branch structure
7. Cross-year pins don't interfere (pin Y1 does not affect pin Y2 entry)
8. Quota mismatch drops a candidate from consideration
9. Preference tie-break by most recent approvedAt works
10. Two concurrent pinYear calls for same (student, year) → second attempt archives the first's pin (optimistic last-writer-wins; logged)

**Context:** This is the central service. It's the hardest task conceptually. Preference-matching logic must match the existing `resolveFeeStructure` helper's semantics so legacy behavior is preserved — reuse it where practical rather than reimplementing.

---

### Task 6: fee-component-template-service.ts
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 1

**Acceptance Criteria:**
- Public API:
  - `listComponents(collegeId, opts?: { category?, applicableToYear? }): Promise<FeeComponentTemplateDoc[]>`
  - `createComponent(collegeId, data, performedBy): Promise<FeeComponentTemplateDoc>` — custom (non-default) component
  - `updateComponent(collegeId, componentId, data, performedBy): Promise<FeeComponentTemplateDoc>` — defaults can only edit `displayLabel` + `displayOrder`; customs can edit anything except `componentKey`
  - `deleteComponent(collegeId, componentId, performedBy): Promise<void>` — only allowed for `isDefault: false` components
  - `applyTemplateToStructure(feeStructureInstanceId): Promise<FeeComponent[]>` — pre-populates a new FeeStructureInstance's components with zero amounts (called by the existing FeeStructureInstance create flow)
- Audit log entry on every mutation
- Unit tests: 8 tests covering list/create/update/delete/apply happy paths + 4 edge cases (edit default componentKey blocked, delete default blocked, duplicate componentKey rejected, applyTemplate preserves `applicableToYears` filter)

**Context:** `applyTemplateToStructure` is the integration point — when a Finance Officer creates a new FeeStructureInstance, they call this to get a zero-amount skeleton that they then populate. The existing FeeStructureInstance creation flow gets a new option `{ seedFromTemplate: true }`.

---

### Task 7: fee-commitment-sheet-service.ts
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 3, 4, 5

**Acceptance Criteria (maps to spec §AC Commitment Sheet, plan §1.8):**
- Public API:
  - `generateSheet(studentId, pinId): Promise<{ documentId, pdfBuffer }>` — synchronous-capable entry for non-queued use
  - Worker integration: called from `fee-commitment.worker.ts` (T4 skeleton) with retry
- Sheet contents (per spec AC):
  - College logo + name (read from College)
  - Student block: name, roll, programme, branch, batch, quota, category, academic year, year-of-study
  - Components table grouped by category: name, base amount, refundable flag
  - Conditional components (hostel/transport) included only if student opted in (evaluated via existing FeeComponentRule logic)
  - Totals: gross, concessions applied (if any at time of generation), net payable
  - Payment schedule from PaymentPlan if linked (otherwise omitted)
  - FeeAgreement reference block if active
  - Footer: generation date, pin id, signature lines (student, parent, admissions officer)
- Persistence: uploads to M02 Documents via existing `createDocument({ personId, documentType: 'fee_commitment_sheet', ... })` flow
- Updates `Student.feePins[matching-pin].commitmentSheetDocumentId` + `commitmentSheetStatus: 'generated'`
- On failure: sets `commitmentSheetStatus: 'failed'`, BullMQ retries per T4 policy
- Auto-regeneration: exposes `regenerateForPin(studentId, pinId)` for concession/scholarship approval triggers (R-9 mitigation)
- Unit tests: 8 tests covering basic sheet, conditional components, FeeAgreement override, no-PaymentPlan case, failure logging, retry, regenerate produces a new document (old one marked superseded via DocumentVersion), PDF byte-check (buffer > 0, PDF header signature present)

**Context:** Does NOT submit a new FeeAgreement; only reads existing. The sheet represents a snapshot-in-time of what the student owes based on current pin + current concessions/FeeAgreement. Historical sheets are preserved as superseded when regenerated.

---

### Task 8: Admission integration
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 5

**Acceptance Criteria (maps to spec §Journey 2, §AC Year-1 pin, plan §1.4):**
- `modules/admissions/workflow.handlers.ts#provision_m04` is modified:
  - After `Student.create(...)` succeeds, call `feePinService.pinYear(student._id, 1, { pinnedBy: 'system:admission', reason: 'initial' })`
  - Pin call MUST succeed before `StudentFeeAccount` is created; if it throws FeeStructureNotFoundError, the entire provisioning step fails cleanly with an actionable error message naming the missing combo: e.g., `"No approved fee structure for programme='BTech CSE', branch='Electronics', quota='convener', category='OC', year=1, academicYear='2024-25'"`
  - Any subsequent operations in `provision_m04` that previously called `resolveFeeStructure` directly are updated to read from the newly created pin
- Proactive warning: dashboard metric `fee_pins.unpublished_combos.count` exposed, alerts Finance Officer 30 days before academic year start
- Integration tests:
  - Admission finalization with matching active structure → student has 1 pin, SFA total matches structure total
  - Admission with NO matching active structure → provision fails, student is NOT created (transaction rollback), error message includes programme/branch/quota/year
  - Admission with matching structure BUT in `draft` status → treated as "no active structure", fails
  - Multi-attempt retry of admission after Finance approves structure → succeeds
- No change to `Applicant → Offer` flow; only the `provision_m04` step.

**Context:** This task introduces a HARD dependency that didn't exist before. Finance must have approved structures before admissions start. Dashboard warning + error message wording are critical for rollout UX.

---

### Task 9: Promotion integration
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 5

**Acceptance Criteria (maps to spec §Journey 3, plan §1.5):**
- `modules/academics/academic-delivery-service.ts#promoteStudents` modified:
  - After each student's status is updated to `promoted`, call `feePinService.pinYear(student._id, N+1, { pinnedBy: 'system:promotion', reason: 'initial' })`
  - If FeeStructureNotFoundError thrown → **DO NOT fail promotion**. Log as deferred-pin; promotion of that student still succeeds with their status change
  - Returned summary includes `deferredPins: Array<{ studentId, reason, targetYear }>`
  - `detained` students: no pin change
  - `year_back` students: no pin change (existing year-N pin continues)
- Lazy-pin behavior: the lazy-pin logic lives in T10 (invoice generation). This task only ensures the eager-pin happens when possible and records deferred ones.
- Integration tests:
  - Batch of 10 students, all Year-1→Year-2 with active Year-2 structure → 10 pins created, 0 deferred
  - Batch where Year-2 structure not yet approved → 0 pins, 10 deferred (promotion still succeeds)
  - Mix of `promoted`/`detained`/`year_back` → only `promoted` get pin calls
  - Pin for an already-pinned student (re-run) is a no-op (archives + creates a fresh one, OR skips if same instance id — decide at implementation time and document)

**Context:** Current `promoteStudents` returns a summary object; extend it with `deferredPins` field without breaking existing consumers. The promotion UI (T15) reads this new field.

---

### Task 10: Invoice generation pin-first
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 5

**Acceptance Criteria (maps to spec §Journey 8, §AC Invoice reads pin, plan §1.6):**
- `modules/finance/fee-lifecycle-service.ts#generateSemesterInvoice(studentId, semesterId)` is modified:
  - Determine student's current `yearOfStudy` from the semester → batch → academic-year arithmetic (existing logic)
  - Call `feePinService.resolveActivePin(studentId, yearOfStudy)`
  - If pin found → use `pin.feeStructureInstanceId` to load FeeStructureInstance + components + rules
  - If pin NOT found → fall back to live `FeeStructureInstance.findOne({ collegeId, programmeId, ..., status: 'active' })`
  - On fallback, log at WARN: `"fee-invoice: no pin for student X year Y; falling back to live resolution"`
  - **Lazy-pin:** if fallback produced a structure, call `feePinService.pinYear(...)` to commit the pin before creating invoice. Record `pinnedBy: 'system:invoice-lazy'`.
  - Set `FeeLineItem.sourcePinId = pin._id` on each line item created
  - Existing logic (component-rule evaluation, concession stacking, scholarship, FeeAgreement override) **unchanged**
- Integration tests:
  - Student with active Year-2 pin → invoice line items all carry sourcePinId = that pin's id
  - Student with NO pin + matching active structure → fallback resolves, lazy-pin commits a new pin, invoice created with sourcePinId set
  - Student with NO pin + NO active structure → invoice generation fails with clear error; no partial invoice created
  - Student with pin on SUPERSEDED structure → invoice uses superseded structure's totals (by design); log entry captures this
  - Student with FeeAgreement override → invoice uses FeeAgreement.negotiatedTotal regardless of pin (existing behavior preserved); sourcePinId still set
  - Component-rule evaluation (hostel-opt-in) still works when reading from pinned instance

**Context:** Narrow change. Most test value is in confirming existing behavior is preserved. Do NOT change the component-rule evaluator or the stacking engine.

---

### Task 11: Rebind hooks
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 5

**Acceptance Criteria (maps to spec §Journey 4, §AC Rebind rules, plan §1.7):**
- When `Student.branchId` or `Student.quota` or `Student.category` is updated (via controller layer, not Mongoose middleware), the patch handler calls `feePinService.checkPinValidity(studentId, currentYearOfStudy)`.
- If stale → set `Student.feePins[matching].staleSince = now` (new optional field on FeePin subdoc) and log an event.
- `Student.programmeId` change triggers **automatic re-pin** of current year: archive current pin, create new pin against new programme's structure. If no matching structure in new programme → emit error; admin must resolve manually before further enrollment actions.
- New service `programme-transfer-service.ts` wraps the programme change + rebind in a single transaction.
- Unit tests: 6 scenarios covering branch change / quota change / category change / programme transfer / rollback on error / concurrent rebinds

**Context:** Why explicit-call-not-middleware: Mongoose middleware on nested fields is unreliable; we want the rebind behavior to be obvious at the call site in the controller.

---

### Task 12: HTTP API
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 5, 6, 7

**Acceptance Criteria (maps to plan §1.9):**
- Routes added in `modules/finance/routes.ts`:
  - `GET /api/finance/students/:id/pins` — `people:read`
  - `POST /api/finance/students/:id/pins/re-pin` — `principal` or `super_admin`; body validated via Zod: `{ yearOfStudy, targetFeeStructureInstanceId, reason, remarks }`
  - `POST /api/finance/students/:id/commitment-sheet/regenerate` — `finance:update`
  - `GET /api/finance/component-template` — `finance:read`
  - `PUT /api/finance/component-template` — `finance:update` (principal approval audit recorded)
  - `POST /api/finance/component-template/components` — `finance:update`
  - `DELETE /api/finance/component-template/components/:componentId` — `finance:update`
  - `GET /api/finance/pin-audit/coverage` — `finance:read`
  - `GET /api/finance/pin-audit/invariants` — `finance:read`
- All routes behind existing `authenticate` + `authorize()` + existing per-user rate limit
- Controller delegates entirely to services; no business logic
- E2E HTTP tests: 200 happy paths for each route, 400 on validation, 401 without auth, 403 on role mismatch, 404 on missing student/component

**Testing reuse:** `backend/src/__e2e__/helpers/request.ts` + `seedBase()`.

---

### Task 13: Admin UI — Student Fee Pins tab
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 12

**Acceptance Criteria (maps to spec §Journey 6):**
- New tab on `admin-portal/src/pages/people/StudentDetailPage.tsx` titled "Fee Pins"
- Displays active pin per year-of-study: FeeStructureInstance name, approved date, total, sourcePinId, commitment sheet link
- Lists archived pins below with archive reason and timestamp
- "Re-pin" action (Principal-role-gated via existing usePermission hook): opens modal with year-of-study selector, target-structure dropdown (populated from API), reason enum, remarks textarea
- On submission, POSTs to `/api/finance/students/:id/pins/re-pin`, refreshes list
- Stale-pin banner rendered above the tab if any active pin has `staleSince` set
- Commitment sheet download link opens existing M02 Document viewer in new tab
- "Regenerate Sheet" button triggers `POST /commitment-sheet/regenerate`; shows toast on success
- Basic visual tests: active pin rendered, re-pin dialog submits correctly, non-Principal sees Re-pin disabled with tooltip

**Context:** Follows the existing DetailView primitives (section + field + bool) already used across detail pages.

---

### Task 14: Admin UI — Fee Component Template page
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 12

**Acceptance Criteria:**
- New route `/finance/component-template`, registered in `admin-portal/src/pages/Finance.tsx`
- Page displays components grouped by category (collapsible sections)
- Each default component row: read-only componentKey + category + refundable/one-time/year-applicable flags; editable displayLabel and displayOrder
- Custom component rows: fully editable; delete action available
- "Add Custom Component" CTA: opens dialog for new component creation (componentKey required, must be unique, lowercase+snake_case validated)
- Admin-role-gated (finance_officer or principal)
- Uses existing useViewEditMode pattern (view → edit transition on click)

**Context:** Consistent with the 179 list pages migrated earlier. Keep the structure familiar.

---

### Task 15: Admin UI — Promotion page pin progress
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 12, 9

**Acceptance Criteria:**
- On the existing `admin-portal/src/pages/academics/PromotionPage.tsx` (or wherever the promotion UI lives), add a post-promotion summary:
  - `X pinned, Y deferred, Z detained, W year-back`
  - Table of deferred students with their reason + a "Pin now" action (opens modal to select target structure, requires Principal)
  - Retry-all button: enqueues pin attempts for all deferred students (useful after Finance approves the missing structures)

**Context:** Uses the `deferredPins[]` field added by T9. UI should make the "why is this student not pinned?" question trivial to answer.

---

### Task 16: Backfill script
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 5

**Acceptance Criteria (maps to plan §2.4 Migration 3, §4.1 hardest part):**
- New script `backend/src/scripts/backfill-fee-pins.ts` with flags:
  - `--college-id=<id>` — scope to one college (required in v1)
  - `--dry-run` (default) — produces an audit CSV without DB writes
  - `--commit` — actually writes pins
  - `--rollback-pins-created-by=<label> --since=<date>` — archives matching pins (e.g., undo a botched backfill)
- Logic:
  - For every student with status ∈ {active, year_back, detained}, determine current yearOfStudy from batch + academicYear
  - Skip if student already has an active pin for that yearOfStudy
  - Resolve matching FeeStructureInstance
  - If found → log "would-pin: studentId, yearOfStudy, instanceId, total" to CSV; in --commit, call pinYear
  - If not found → log "unpinnable: studentId, yearOfStudy, reason=missing-instance" to CSV; never fail the whole run
  - Batched (100 students per iteration) to avoid memory spikes
- Output CSV: `backfill-audit-<collegeId>-<timestamp>.csv`
- Idempotent — running twice is safe (skips already-pinned students)
- Unit tests: 6 scenarios — 100 students one college / mix of scenarios / --commit / --dry-run / --rollback / partial failure tolerance

**Context:** This task is the highest-risk single task. Front-loaded testing. Finance must sign off on the audit CSV from --dry-run before --commit is run in production. Document the procedure in T19.

---

### Task 17: Nightly audit job + Finance dashboard metrics
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 5, 10

**Acceptance Criteria (maps to plan §5):**
- New BullMQ scheduler entry: `fee-pin-audit` at daily 02:00
- Worker file `backend/src/workers/fee-pin-audit.worker.ts`:
  - Computes per-college:
    - `fee_pins.coverage.current_year` — % of active students with an active pin
    - `fee_pins.deferred.count` — count of deferred pins from recent promotions
    - `fee_pins.stale.count` — count of pins with `staleSince` set
    - `fee_invoice.pin_vs_invoice_mismatch.count` — aggregation comparing invoice totals to pinned-structure totals (accounting for FeeAgreement)
    - `fee_pins.commitment_sheet.failure_rate` — % of pins with `commitmentSheetStatus === 'failed'`
  - Writes a `FeePinAuditSnapshot` document per college per day (new collection)
- GET endpoints (from T12) read latest snapshots
- Alerting: if coverage < 100% → queue an email to Principal + Finance Officer via existing EMAIL queue; if invariant mismatch > 0 → same but immediate (not daily aggregate)
- Unit tests for each metric computation + one integration test running the worker end-to-end

**Context:** Snapshots collection keeps a historical trail (useful for trend dashboards later). Dashboard UI is out of scope — this task exposes the data; Finance dashboard polling is added separately or by the Finance team.

---

### Task 18: E2E integration tests
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 8, 9, 10, 11, 12

**Acceptance Criteria:**
- New test file `backend/src/__e2e__/modules/fee-configuration.test.ts` covering:
  1. Admission → pin Y1 → commitment sheet generated → invoice Y1 uses pin
  2. Promotion Y1→Y2 with active structure → Y2 pin created → invoice Y2 uses Y2 pin
  3. Promotion Y1→Y2 without structure → deferred pin → subsequent Finance approval + retry-pin works
  4. Branch change → stale-pin flagged → Principal re-pins → new pin active
  5. Programme transfer → auto-rebind
  6. Supersede mid-year → existing student's invoice unchanged (uses pinned superseded version)
  7. Concession approval mid-year → commitment sheet regenerated; invoice total reduced
  8. Admin manual re-pin → audit trail captures reason
  9. Backfill DRY-RUN followed by --commit → pins match audit CSV
  10. Invoice-pin mismatch invariant detection
- All tests use `seedBase()` + factory helpers; one college scope; real MongoDB (via memory server)

**Testing reuse:** existing e2e harness in `backend/src/__e2e__/`.

---

### Task 19: API reference docs + QA / deploy checklist
**Type:** Doc → captain-spec direct
**Status:** Pending
**Depends on:** 12, 18

**Expected state:**
- New file `backend/docs/api/fee-configuration.md`:
  - Audience: backend devs + frontend integrators + Finance admin operators
  - Endpoint reference for all T12 routes (request/response/errors)
  - Pin lifecycle diagram (view / edit / archive states)
  - Commitment sheet PDF structure description
  - Template canonical components table
- New file `backend/docs/api/fee-configuration-qa-checklist.md`:
  - Pre-deploy:
    - Backfill dry-run for each college → Finance sign-off → --commit
    - Seed component template for new colleges
    - Verify active FeeStructureInstance exists for upcoming academic year for every programme/year combo
    - Verify BullMQ queue registered + worker running
    - Verify pdfkit install + PDF generation smoke test
  - Post-deploy:
    - First admission → manually verify pin + sheet generated
    - First promotion batch → verify pin + deferred-pin reporting
    - First invoice → verify sourcePinId populated
    - Nightly audit run → verify snapshot collection populated
  - Known-limitations section documenting out-of-scope items from spec §NOT-For

---

## Spec-to-task traceability

| Spec section | Covered by |
|---|---|
| §Journey 1 FeeStructure drafting | T2, T6, T14 |
| §Journey 2 Year-1 pin at admission | T5, T7, T8 |
| §Journey 3 Year-N pin on promotion | T5, T9, T15 |
| §Journey 4 branch/quota rebind | T11, T13 |
| §Journey 5 year-repeat | T5 (no-op path), T11 |
| §Journey 6 admin manual re-pin | T5, T12, T13 |
| §Journey 7 mid-year supersede | T10 (preserved behavior) |
| §Journey 8 invoice pin-first | T10 |
| §AC pin schema | T1 |
| §AC Year-1 pin | T5, T8 |
| §AC Year-N pin | T5, T9 |
| §AC rebind rules | T11 |
| §AC invoice reads pin | T10 |
| §AC fee component template | T2, T6, T14 |
| §AC mid-year revision | T10 |
| §AC Commitment Sheet PDF | T3, T4, T7, T13 |
| §AC roles & approvals | T8, T9, T12 |
| §AC audit & observability | T17 |
| §Edge cases EC-1 to EC-12 | Distributed across T5, T8, T9, T10, T11, T16 |
| §Success metrics | T17 |

All 40+ ACs trace to ≥1 task; all 12 edge cases have a home; all NOT-For items are explicitly NOT in any task.

---

## Changelog

- **2026-04-21** — Initial task list drafted from spec + plan. 19 tasks, 4 parallel starters (T1, T2, T3, T4). Front-loaded risks: T15 (backfill, hardest part) has DRY-RUN + audit CSV + --commit gate; T8 (admission pin) has hard-fail + proactive dashboard warning.
- **2026-04-21** — T1–T4 (foundation) completed in parallel. 51 new tests (19 schema + 11 seed + 13 pdfkit + 8 queue). Full backend suite 326/326 passing. Spec typo "30-component" → "33-component" fixed in same session. Completion signals in `./completions/task-1..4.md`.
- **2026-04-21** — T5, T6, T7 (core services) completed. 45 new tests (10 pin + 24 template + 11 commitment-sheet). Full backend suite 372/372 passing. Five new open questions logged in spec.md changelog: OQ-6 (FSI yearOfStudy), OQ-7 (Batch academicYearId), OQ-8 (M02 generic Document), OQ-9 (ExitDocument supersede), OQ-10 (Student opt-in flags). OQ-8 is the significant one — M02 lacks a generic document service; T7 shipped a pragmatic workaround with a test-overridable seam. Completion signals in `./completions/task-5..7.md`.
- **2026-04-21** — T8, T9, T10, T11 (integration) completed in parallel. 26 new tests (5 + 5 + 6 + 10). Full backend suite 398/398 passing. Six new open questions logged (OQ-11..OQ-16). **OQ-11 is the significant one**: year-of-study derivation is an unfinished seam across 4 tasks. New task **T20** added: canonical `resolveStudentYearOfStudy` helper, blocking T16 (backfill). Completion signals in `./completions/task-8..11.md`.
- **2026-04-21** — T12, T13, T14, T15, T20 (API + UI + helper) completed in parallel. ~58 new tests (36 HTTP + 12 helper + 10 frontend validation). Backend suite 410/410; E2E suite 187/187; admin-portal build green. OQ-15 resolved (FeeAgreement override moved to explicit §NOT-For). T20's canonical helper swapped in 4 consumer sites (invoice, promotion, student-update stale-pin, audit coverage). **T21 (new)** added for the lateral-entry schema field gap (`Student.studyYearAtAdmission`) surfaced by T20. Completion signals in `./completions/task-12..15,20.md`.
