# Plan: Fee Configuration

**Stack:** MERN TypeScript — Node 20 + Express 4 + Mongoose 8 + React 19 + Vite + BullMQ 5 + ioredis 5
**Test runner:** Vitest + mongodb-memory-server
**Created:** 2026-04-21

---

## 1. Architecture

The feature adds a thin **pinning layer** between admission/promotion events and invoice generation, plus a **template catalog** for fee-component scaffolding and a **PDF commitment sheet** generator. Invoice logic, component-rule evaluation, concessions/scholarships stacking, and FeeAgreement override chain are all unchanged — we only change the *input* to `generateSemesterInvoice` so it prefers a pinned FeeStructure over live resolution.

### 1.1 Component overview

```
┌────────────────────────────┐
│ Admission workflow          │  ──┐
│ (workflow.handlers.ts       │    │
│  provision_m04)             │    │
└────────────────────────────┘    │
                                   ▼
┌────────────────────────────┐  ┌────────────────────────────┐
│ Promotion workflow          │  │ NEW: fee-pin-service.ts    │
│ (academic-delivery-service  │─▶│ pinYear(student, N, …)     │
│  .promoteStudents)          │  │ rePin(student, year, …)    │
└────────────────────────────┘  │ resolveActivePin(student,N)│
                                   │ backfillPins(collegeId)    │
┌────────────────────────────┐  └────────────┬───────────────┘
│ Admin UI / API              │──┘            │
│ (manual re-pin)             │               │ writes Student.feePins[]
└────────────────────────────┘               │ enqueues commitment-sheet
                                               │
                                               ▼
                                ┌────────────────────────────┐
                                │ NEW: FEE_COMMITMENT BullMQ │
                                │ worker → PDF generation     │
                                │ → attach Document           │
                                │ → optional email parent     │
                                └────────────────────────────┘

┌────────────────────────────┐
│ Invoice generation          │
│ (fee-lifecycle-service      │
│  .generateSemesterInvoice)  │◀── reads Student.feePins[] (pin-first)
└────────────────────────────┘     falls back to live resolution
                                    only if pin absent (fresh promotion /
                                    legacy unpinned student)
```

### 1.2 New modules

| Module | Location | Purpose |
|---|---|---|
| `fee-pin-service.ts` | `backend/src/modules/finance/` | Core pinning business logic. Pure functions; no HTTP. |
| `fee-commitment-sheet-service.ts` | `backend/src/modules/finance/` | Generates PDF + attaches to M02 Documents via `createDocument()`. |
| `fee-component-template-service.ts` | `backend/src/modules/finance/` | Seed-data CRUD for the canonical component template. |
| `fee-pin-audit-job.ts` | `backend/src/workers/` | Nightly BullMQ job; audits pin coverage + invariants. |
| `PdfRenderer` utility | `backend/src/shared/pdf/PdfRenderer.ts` | Thin `pdfkit` wrapper (new dependency — see §3). |
| Admin UI: **Fee Pins** tab on student detail page | `admin-portal/src/pages/people/StudentDetailPage.tsx` | Show active pin, history, re-pin action (Principal-gated). |
| Admin UI: **Fee Component Template** page | `admin-portal/src/pages/finance/FeeComponentTemplatePage.tsx` | Edit the college's component seed/template. |
| Admin UI: **Bulk Pin during Promotion** | `admin-portal/src/pages/academics/PromotionPage.tsx` | Pin progress indicator, deferred-pin error list. |

### 1.3 Modified modules

| Module | Change | Risk |
|---|---|---|
| `models/people/Student.ts` | Add `feePins: Array<FeePin>` | **Schema migration** — must be backward compatible |
| `modules/admissions/workflow.handlers.ts` (`provision_m04`) | Call `feePinService.pinYear(student, 1)` AFTER student is created, BEFORE `StudentFeeAccount` is populated. Fail the admission step if pin fails. | Introduces hard dependency on an approved FeeStructure at admission time. |
| `modules/academics/academic-delivery-service.ts` (`promoteStudents`) | For each promoted student, call `feePinService.pinYear(student, N+1)`. If structure not yet approved, mark pin as deferred. | Promotion must handle per-student pin failures gracefully (report per-student status, not batch-fail). |
| `modules/finance/fee-lifecycle-service.ts` (`generateSemesterInvoice`) | Read `Student.feePins[N-1]` first; use that `feeStructureInstanceId` as source of truth. Fall back to live `FeeStructureInstance.findOne({ status: 'active' })` only if no pin. Log a warning on fallback. | Backward compatible — legacy students without pins behave as before. |
| `modules/finance/service.ts` | Add `createFeeStructure` handler option to pre-populate from template (optional). | Low risk; additive. |

### 1.4 Data flow: admission pin

1. `provision_m04` handler finalizes the Student document.
2. Handler calls `feePinService.pinYear(student, 1, { pinnedBy: 'system:admission' })`.
3. Service queries `FeeStructureInstance.findOne({ collegeId, programmeId, branchId?, category, quota, academicYearId, yearOfStudy: 1, status: 'active' })`, with preference rules (exact branch match > null branch).
4. If no active instance exists → throws `FeeStructureNotFoundError` → admission step fails cleanly.
5. Otherwise, pushes a new entry onto `Student.feePins[]` with `{ yearOfStudy: 1, feeStructureInstanceId, pinnedAt: now, pinnedBy: 'system:admission', reason: 'initial', archivedAt: null }`.
6. Enqueues a job on the `FEE_COMMITMENT` queue to generate the PDF commitment sheet async.
7. Returns control to `provision_m04`, which proceeds with `StudentFeeAccount` seeding (now reading the pin).

### 1.5 Data flow: promotion pin

1. `promoteStudents(collegeId, { batchIds, ... })` returns a PromotionDecision list.
2. For each decision with status `promoted`, service calls `feePinService.pinYear(student, N+1, { pinnedBy: 'system:promotion' })`.
3. If active structure exists → pin. Enqueue commitment sheet generation.
4. If NOT → skip pin, record `deferredPins[]` in the promotion result. Admin sees list in UI.
5. `detained` and `year_back` students: NO pin change. Existing Year-N pin continues to apply.
6. Batch-level summary emitted: `{ pinned: N, deferred: M, skipped: K }`.

### 1.6 Data flow: invoice generation (pin-first)

1. `generateSemesterInvoice(studentId, semesterId)` called.
2. Determine student's current year-of-study from semester → batch → academic-year arithmetic.
3. Query `Student.feePins[]`, find entry where `yearOfStudy === currentYear` AND `archivedAt === null`.
4. **If pin found:** use `feeStructureInstanceId` as source. Load the FeeStructureInstance + FeeComponent[] + FeeComponentRule[].
5. **If pin missing:** fall back to live `FeeStructureInstance.findOne({ status: 'active', ... })`. Log warning. (Lazy-pin: optionally commit the resolved instance back as a pin here.)
6. Continue with existing logic: evaluate rules, sum components, apply concessions/scholarships, check FeeAgreement override, create invoice + line items.
7. `FeeLineItem.sourcePinId` optional field (new) captures which pin produced this line item — for the nightly invariant audit.

### 1.7 Data flow: re-pin (branch / quota / programme change)

1. Admin edits `Student.branchId` / `quota` / `programmeId` via the existing student edit form.
2. A Mongoose post-update hook (or explicit service call in the patch handler) fires `feePinService.checkPinValidity(studentId)`.
3. If the current active pin's underlying FeeStructureInstance no longer matches the student's attributes (evaluated against the same preference logic), the service **does NOT auto-re-pin** — it emits an admin notification + returns a "stale pin detected" flag.
4. Admin sees a banner on the student's Fee Pins tab: *"This pin no longer matches the student's attributes. [Re-pin now]"*.
5. Click → opens a Principal-gated confirmation dialog → if approved, archives the current pin (`archivedAt: now`, `archiveReason: 'branch_change'`) and creates a new pin.
6. Programme transfer is the single case where auto-re-pin happens (spec §AC — automatic for programmeId change). Handled in the programme-transfer service, not generic student patch.

### 1.8 Commitment sheet PDF

1. BullMQ worker on `FEE_COMMITMENT` queue receives `{ studentId, pinId }`.
2. Worker loads: student (with person), programme, batch, the FeeStructureInstance + components + rules, matching PaymentPlan if any, FeeAgreement if any.
3. Evaluates rules (for conditional components like hostel/transport based on student's opt-in flags).
4. Renders PDF via `PdfRenderer` (pdfkit):
   - Header: college logo + name
   - Student block: name, roll, programme, branch, batch, quota, category, academic year, year-of-study
   - Components table: name | base amount | refundable flag | category grouping
   - Totals: gross, concessions applied (if any), net payable
   - Payment schedule (from PaymentPlan), if present
   - Footer: generation date, pin id, signature lines (student, parent, admissions officer)
5. Uploads PDF to the existing M02 Documents store (`createDocument({ personId, documentType: 'fee_commitment_sheet', ...file })`).
6. Updates `Student.feePins[i].commitmentSheetDocumentId`.
7. Optionally emails parent via existing `EMAIL` queue.

### 1.9 API design

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET` | `/api/finance/students/:id/pins` | `people:read` | List all pins (active + archived) for a student. |
| `POST` | `/api/finance/students/:id/pins/re-pin` | `principal`/`super_admin` | Manual re-pin. Body: `{ yearOfStudy, targetFeeStructureInstanceId, reason, remarks }`. |
| `POST` | `/api/finance/students/:id/commitment-sheet/regenerate` | `finance_officer` | Regenerate sheet for active pin. Enqueues PDF job. |
| `GET` | `/api/finance/component-template` | `finance:read` | List college's component template. |
| `PUT` | `/api/finance/component-template` | `finance:update` + `principal` approval | Replace/edit the college's component template. |
| `GET` | `/api/finance/pin-audit/coverage` | `finance:read` | Audit metric: count of students without active pin for current year. |
| `GET` | `/api/finance/pin-audit/invariants` | `finance:read` | Audit metric: count of invoice-total mismatches with pinned structure. |

All routes behind `authenticate` + `authorize()` + the standard per-user rate limit.

---

## 2. Database

### 2.1 Schema additions — `Student.feePins[]`

```ts
// Embedded subdocument in models/people/Student.ts
interface FeePin {
  _id: ObjectId;
  yearOfStudy: number;                    // 1–8 typical
  feeStructureInstanceId: ObjectId;       // ref FeeStructureInstance
  pinnedAt: Date;
  pinnedBy: string;                       // userId | 'system:admission' | 'system:promotion' | 'system:backfill'
  reason: 'initial' | 'branch_change' | 'quota_change' | 'programme_transfer' | 'admin_override' | 'data_correction' | 'year_back_carryforward';
  remarks?: string;
  archivedAt?: Date | null;               // null = active pin
  archiveReason?: string;
  commitmentSheetDocumentId?: ObjectId;   // link to M02 Document
  commitmentSheetStatus?: 'queued' | 'generated' | 'failed';
}

// Student schema:
feePins: { type: [FeePinSchema], default: [] }
```

**Invariant (enforced at service layer, NOT by DB):** for any `(studentId, yearOfStudy)`, at most one pin has `archivedAt === null`. Service functions that insert always archive the prior active pin first.

**Index:** `Student.feePins.feeStructureInstanceId` sparse index, to speed up nightly audit queries that join pins to structures.

### 2.2 New collection — `FeeComponentTemplate`

```ts
interface FeeComponentTemplateDoc {
  _id: ObjectId;
  collegeId: ObjectId;
  componentKey: string;                   // 'tuition_fee', 'library_fee', etc.
  displayLabel: string;
  category: 'academic' | 'admission_oneoff' | 'lab' | 'infrastructure' | 'student_life' | 'regulatory' | 'caution' | 'conditional';
  isRefundable: boolean;
  defaultOneTime: boolean;
  applicableToYears: number[];            // empty = all years
  displayOrder: number;
  isDefault: boolean;                     // true = shipped seed, false = college-added
  createdAt: Date;
  updatedAt: Date;
}
```

**Unique index:** `(collegeId, componentKey)`.
**Seed:** the 30 canonical components from spec §Template are inserted on college-onboarding via existing seed script; `isDefault = true`. Colleges can edit display labels but not `componentKey` of defaults; they can add/remove custom components freely.

### 2.3 New optional field on `FeeLineItem`

```ts
sourcePinId?: ObjectId;  // which Student.feePin._id produced this line item
```

Purely for audit traceability. Set by `generateSemesterInvoice`. Existing line items have it null; no migration needed.

### 2.4 Migrations & backfill

- **Migration 1 (schema):** add `feePins[]` to Student model. Additive, default `[]`. No explicit migration script needed — Mongoose populates on next write.
- **Migration 2 (seed template):** insert 30 canonical components for each existing college. One-shot script: `scripts/seed-fee-component-template.ts`. Idempotent (upsert by `(collegeId, componentKey)`).
- **Migration 3 (backfill pins):** for every existing active student, compute their current year-of-study and pin them to the currently-active FeeStructureInstance. One-shot script: `scripts/backfill-fee-pins.ts`. Idempotent (skip students with an existing active pin). Runs per-college with batching (100 students per batch to avoid memory spikes). On failure for a student, log and continue.

**Rollback strategy:** if the backfill produces wrong pins (e.g., an unexpected attribute combo), an admin can re-pin individual students manually via the UI (Principal-gated). For batch rollback, the backfill script supports a `--rollback-pins-created-by 'system:backfill' --since <date>` mode that archives all pins matching those filters.

---

## 3. Dependencies

### 3.1 New npm dependencies

| Package | Version | Purpose | Justification |
|---|---|---|---|
| `pdfkit` | ^0.15 | PDF generation for commitment sheets | No existing PDF service. `pdfkit` is the most battle-tested Node PDF library with no headless-Chrome overhead (vs. `puppeteer`). Small footprint (~300KB). |
| `@types/pdfkit` | ^0.13 | TypeScript types | DevDependency. |

No new runtime infrastructure (BullMQ + Redis already in use).

### 3.2 External services

None. Email sending reuses the existing `EMAIL` BullMQ queue. PDF storage reuses the existing M02 Documents blob store.

### 3.3 Infrastructure

- **New BullMQ queue:** `FEE_COMMITMENT` (add to QueueManager's registered queues list).
- **New BullMQ job:** `fee-pin-audit` on the existing scheduler (cron: daily 02:00).

---

## 4. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | **No approved FeeStructure at admission** — admission hard-fails. Could block all admissions if Finance hasn't published rates. | Medium | High | Admission error message names the exact missing combo. Admissions and Finance leads get a proactive dashboard warning 30 days before academic-year start showing unpublished combos. Superadmin can create a provisional structure to unblock. |
| R-2 | **Backfill miscalculates year-of-study** — e.g., a Year-3 student gets pinned to Year-2 structure. | Medium | High | Backfill script runs in DRY-RUN mode first, outputs a per-student audit CSV for finance review. Only runs in write mode with `--commit` flag. |
| R-3 | **Supersede race** — two admins approve new structures simultaneously for the same scope. | Low | Medium | Service uses `findOneAndUpdate` with optimistic locking on `FeeStructureInstance.priorVersionId`. Second approval fails cleanly with "conflicting revision detected". |
| R-4 | **PDF generation at scale** — bulk promotion of 200 students → 200 PDF jobs. Queue saturation or worker OOM. | Low | Medium | PDF worker concurrency capped at 4. Batch promotion enqueues jobs with staggered delays. Each PDF is streaming-written (pdfkit's built-in). |
| R-5 | **Rebind rules subtle and error-prone** — branch change with matching structure vs. non-matching is a 2-way decision tree. | Medium | Medium | Rebind logic unit-tested with a matrix of 20+ scenarios (cartesian of: has-matching-structure × branch-change × quota-change × programme-change × year-back-flag). Service raises clear errors for ambiguous cases and routes through admin UI. |
| R-6 | **Invoice-pin mismatch** — pinned structure is `superseded`; student's invoice shows old amounts but active version is different. User confusion. | High | Low | UI banner on invoice/student pages: "Pinned to superseded v2 of this fee structure; active version is v3." Finance officer can propose a re-pin via UI (requires Principal approval; creates audit entry). |
| R-7 | **Nested-array query performance** — `Student.feePins[]` is queried often. | Low | Low | Pins capped at ~8 entries per student (one per year-of-study, plus archived). Queries use dot-notation projections. Nightly audit uses aggregation pipeline, not per-student queries. |
| R-8 | **FeeComponentTemplate drift between colleges** — different colleges customize differently, confusing cross-college reporting. | Low | Low | Component KEYS are enforced stable (can't edit); only labels customizable. Audit reports aggregate by key, not label. |
| R-9 | **Commitment sheet content becomes stale after concession/scholarship approval** — original sheet shows gross amount but student later gets 40% concession. | Medium | Low | On concession/scholarship approval event, enqueue a regenerate-sheet job. Old sheet marked `superseded`, new sheet attached to pin. Document library shows both. |
| R-10 | **Existing `StudentFeeAccount` seeding** reads dynamically today; after pin introduction, drift between pin and SFA totals. | Medium | Medium | `StudentFeeAccount` seeding (in `provision_m04`) reads the pin (same source). A migration step updates existing SFAs to reconcile against pins (DRY-RUN + audit CSV). |

### 4.1 Hardest part (per planning principle #4)

**The backfill + coexistence window.** The feature is simple in isolation but the *transition* is where most bugs hide:

- After deploying the schema change, there's a gap between "students exist without pins" and "backfill completes" where invoice generation falls back to live resolution. During that gap, invoices behave as they do today.
- If backfill produces wrong pins and they're not caught before next invoice run, affected students get wrong invoices.
- Front-load: DRY-RUN mode, per-student audit CSV, Finance sign-off before `--commit`, and a manual re-pin flow for any outliers.

---

## 5. Observability

- **Metrics** (add to existing Finance dashboard):
  - `fee_pins.coverage.current_year` — % of active students with an active pin for their current year-of-study. Target: 100%.
  - `fee_pins.deferred.count` — count of students whose most recent promotion left a deferred pin. Target: < 5 at any time.
  - `fee_pins.stale.count` — count of students with stale pins (attributes drifted). Target: < 10 at any time.
  - `fee_pins.commitment_sheet.failure_rate` — % of pin events where PDF generation failed. Target: < 1%.
  - `fee_invoice.pin_vs_invoice_mismatch.count` — invariant breaches from nightly audit. Target: 0.
- **Logs:**
  - Every pin event logged at INFO with `{ studentId, yearOfStudy, feeStructureInstanceId, pinnedBy, reason }`.
  - Invoice fallback (no pin) logged at WARN with `{ studentId, yearOfStudy }`.
  - PDF generation failures logged at ERROR.
- **Alerts:**
  - Principal + Finance Officer on `fee_pins.coverage < 100%` (daily).
  - Principal on `fee_invoice.pin_vs_invoice_mismatch > 0` (immediate).
  - On-call SRE on `fee_pins.commitment_sheet.failure_rate > 5%` over a 1-hour window.

---

## 6. Open Questions

These are deliberately left for implementation-time discovery (per captain-spec convention — "things to discover during tasks"):

- **OQ-1:** Should the PDF include the student's photo? Photo rendering adds complexity to pdfkit layout. Default: no photo in v1; revisit if requested.
- **OQ-2:** Internationalization of PDF labels — English default. Regional language (Telugu/Tamil/Hindi) support is deferred to a separate i18n effort.
- **OQ-3:** Commitment sheet regeneration when concession / scholarship is approved — enqueue automatically, or require manual trigger? Default: automatic (covered by R-9 mitigation), but flag for review during T7 implementation.
- **OQ-4:** When a student with an existing FeeAgreement gets a fresh pin (e.g., at promotion), does the FeeAgreement automatically carry forward, or does it need re-approval? Depends on FeeAgreement.validityPeriodYears — check during T4 implementation.
- **OQ-5:** Bulk operations UX — do we show a progress bar with per-student success/failure list, or just an end summary? Depends on frontend team preferences; finalize during T10 UI task.

---

## 7. Plan-review sanity check

- ✅ Fits existing architecture: Mongoose 8 subdoc pattern, BullMQ queues, existing finance service layout.
- ✅ New dependencies justified: only `pdfkit`. No existing PDF service.
- ✅ Hardest part identified (§4.1): backfill + coexistence window; front-loaded via DRY-RUN.
- ✅ Observability planned (§5): coverage %, invariant alerts, PDF failure rate.
- ✅ Every spec AC has a home in the plan:
  - Pin schema → §2.1
  - Year-1 pin at admission → §1.4
  - Year-N promotion pin → §1.5
  - Rebind rules → §1.7
  - Invoice reads pin → §1.6
  - Template → §2.2
  - Supersede → §1.6 + R-6
  - Commitment sheet → §1.8
  - Roles → §1.9
  - Audit → §5
- ✅ NOT-for items not addressed (intentional): course-level fees, hostel/transport logic, govt reimbursement, FeeAgreement UI redesign, tax/GST, refund processing.
