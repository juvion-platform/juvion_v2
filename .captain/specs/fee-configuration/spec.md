# Spec: Fee Configuration

**Created:** 2026-04-21 · **Last updated:** 2026-04-21 · **Status:** specifying

## What & Why

Juvion v2 already has a programme-level `FeeStructureInstance` entity with approval workflow, a rich `FeeComponent` / `FeeComponentRule` system for conditional inclusion, and per-student `FeeAgreement` overrides. What's missing is the **binding layer**: a student's fee commitment is currently *re-resolved at every invoice run*. If the college approves a rate revision mid-year, it silently affects existing students' future invoices. Parents and admissions staff expect the opposite: "the fee you accepted at admission is what you owe for this year."

This feature introduces a **per-student-per-year snapshot (pin)** of the applicable `FeeStructureInstance`, plus a **formal Fee Commitment Sheet** (PDF) that captures the locked amounts and is produced on admission. It closes the loop between academic programme, admission finalization, and parent-facing financial commitment — without touching the invoice/payment engine.

It also formalizes the **fee component taxonomy** so colleges drafting a FeeStructure for the first time have a template of standard components rather than typing them from scratch (33 canonical components across 8 categories — see §Template below).

## User Journeys

### Journey 1 — Finance Officer drafts a new FeeStructure for a programme/year
1. Finance Officer opens the **Fee Configuration** page for a Programme + Branch + Academic Year + Year-of-study + Category + Quota.
2. System pre-loads the **standard component template** (tuition, lab, library, exam, caution, etc.) with zero amounts. Officer can remove components that don't apply and add bespoke ones.
3. Officer enters amounts per component. System auto-computes total.
4. Officer saves as `draft`. Can iterate.
5. Officer clicks **Submit for Approval** → status `submitted`.
6. Principal opens the submitted structure, reviews component-by-component delta vs prior version (if any), adds remarks, and clicks **Approve** → status `approved` with `approvedBy` + `approvedAt` stamped.
7. On the `effectiveDate`, system auto-activates (status `active`) and supersedes any prior version for the same (programme, branch, year-of-study, category, quota).

### Journey 2 — Student is admitted; Year-1 pin happens automatically
1. Applicant is finalized in Admissions module.
2. Admission service resolves the matching `FeeStructureInstance` based on the new student's attributes (programmeId, branchId, quota, category, academicYearId, year=1).
3. System **pins** the instance id on the Student record (`Student.feePins[0] = { yearOfStudy: 1, feeStructureInstanceId, pinnedAt, pinnedBy }`).
4. System generates a **Fee Commitment Sheet (PDF)** containing: student name, programme, quota, academic year, a component-wise breakdown, total, payment-plan summary (read from any linked PaymentPlan), and signature lines for student + parent + admissions officer.
5. Commitment sheet is attached to the student's document set and optionally emailed to the parent's registered contact.

### Journey 3 — Student is promoted to Year 2 (3, 4)
1. Academic office runs the **semester/year promotion** workflow for a batch.
2. For each promoted student, system queries the currently-active `FeeStructureInstance` for their (programmeId, branchId, quota, category, academicYearId=new, year=N).
3. System **pins** that instance: `Student.feePins[N-1] = { yearOfStudy: N, feeStructureInstanceId, pinnedAt, pinnedBy: 'system:promotion' }`.
4. A fresh Fee Commitment Sheet for Year N is generated and attached.
5. If no active structure exists for Year N yet (college hasn't finalized rates), promotion succeeds but the pin is deferred; **lazy fallback** pins on the first semester-invoice run for that student.

### Journey 4 — Student changes attributes (branch transfer, quota change)
1. Admin changes `Student.branchId` (e.g., CSE → ECE transfer) or `Student.quota` (court order).
2. System flags the current Year's pin as **stale**.
3. Admin is prompted: "this student's pinned fee structure no longer matches their current attributes. Re-pin to the matching active structure?" → Yes / No.
4. If Yes: system re-pins for the current year; old pin is archived (with reason) in an audit trail on the student record. A delta sheet is generated showing what changed.
5. Prior years' pins are NOT touched (historical record).

### Journey 5 — Student repeats a year (detention)
1. Academic office marks student status as `year_back` for the year in question.
2. System retains the student's **existing Year-N pin** unchanged — they owe what they originally committed to for that year.
3. Invoice regeneration uses the existing pin.

### Journey 6 — Admin overrides a pin manually
1. Rare: admin discovers a student was pinned to the wrong structure (data entry error, etc.).
2. Admin clicks **Re-pin** on the student's fee page, selects a reason (`DATA_CORRECTION` / `POLICY_EXCEPTION` / `ADMIN_OVERRIDE`), chooses a target FeeStructureInstance.
3. Action requires Principal role; logged as a separate pin-change event.

### Journey 7 — Mid-year rate revision (supersede)
1. College committee revises fees for a programme (e.g., tuition up 5%).
2. Finance Officer drafts a new version, references `priorVersionId`, submits for approval.
3. Principal approves; new instance activates on `effectiveDate`; prior version's status → `superseded`.
4. **Existing pinned students are UNAFFECTED** — their invoices continue to resolve via their pin.
5. Only new enrollees (admissions or promotions) after `effectiveDate` pin to the new version.

### Journey 8 — Invoice generation reads the pin
1. `generateSemesterInvoice(studentId, semesterId)` — existing function — is modified:
   - Before: queries `FeeStructureInstance.findOne({ programmeId, status: 'active' })` live
   - After: reads `Student.feePins[yearOfStudy-1].feeStructureInstanceId` and uses it as source of truth
   - Falls back to live resolution only if pin is absent (fresh promotion where Year-N rates weren't finalized)
2. `FeeComponentRule` evaluation (conditional inclusion of hostel, transport, lab variants) runs on the **pinned** instance's components — unchanged.
3. Concessions, scholarships, FeeAgreement overrides stack on top as before.

## Acceptance Criteria

### AC — Snapshot / Pin schema
- [ ] `Student` schema gains `feePins: Array<{ yearOfStudy, feeStructureInstanceId, pinnedAt, pinnedBy, reason? }>`. Unique on `(studentId, yearOfStudy)`.
- [ ] Each pin has an audit record (stored inline or in a shared `PinAuditLog` collection) of every change, including original admission pin.
- [ ] Pins are immutable after creation; any "change" creates a NEW pin record marked active and sets the prior to `archived`.

### AC — Year-1 pin at admission
- [ ] When `workflow.handlers.ts#provision_m04` runs, it pins Year-1 on the Student record before creating `StudentFeeAccount`.
- [ ] If no active FeeStructureInstance matches the student's attributes at admission time, the admission fails with a clear error ("No approved fee structure exists for ${programme} / ${branch} / ${quota} / ${category} Year-1 in ${academicYear}"). Admissions cannot finalize without a valid pin.
- [ ] Pin resolution considers: programmeId (required), branchId (optional match), quota, category, academicYearId, yearOfStudy=1. Preference logic matches the existing `resolveFeeStructure` helper.

### AC — Year-N pin on promotion (N ∈ {2, 3, 4, …})
- [ ] Academic office's promotion workflow pins Year-N for each promoted student automatically.
- [ ] If no active Year-N structure exists, promotion succeeds but the student's `feePins[N-1]` is omitted. The system logs a deferred-pin event.
- [ ] On first `generateSemesterInvoice` call for a student whose current year-of-study has no pin, the invoice generation attempts lazy pinning. If still no active structure, invoice generation raises a clear error and is skipped for that student (batch-level error reporting).

### AC — Rebind rules
- [ ] On `Student.branchId` change: current-year pin is re-evaluated. If a different structure matches, re-pin is suggested via admin UI prompt (not automatic).
- [ ] On `Student.quota` change: same as branch.
- [ ] On `Student.programmeId` change (programme transfer): automatic re-pin of current year; prior years archived.
- [ ] On `Student.status = 'year_back'`: no pin change.
- [ ] On `Student.status = 'exited'` then re-admitted (new enrollment): treated as fresh admission; new Year-1 pin.
- [ ] Admin manual re-pin: requires Principal role, reason field (enum), full audit log.

### AC — Invoice generation reads the pin
- [ ] `generateSemesterInvoice(studentId, semesterId)` reads `Student.feePins[yearOfStudy-1].feeStructureInstanceId` as the first-choice source.
- [ ] Falls back to `FeeStructureInstance.findOne({ ..., status: 'active' })` only if no pin exists. If fallback fires, log a warning.
- [ ] Existing `FeeComponentRule` evaluation, concession/scholarship stacking, and `FeeAgreement` override logic is unchanged.

### AC — Fee component template
- [ ] System ships a canonical template of recommended fee components (see §Template below). When drafting a new FeeStructure, Finance Officer sees the template pre-populated with zero amounts.
- [ ] Template is **seed data**, not hard-coded — colleges can edit the template per installation.
- [ ] Each component has: `componentKey`, `displayLabel`, `category` (academic/infrastructure/student-life/caution/conditional), `isRefundable`, `defaultOneTime` (true for admission/registration one-shots), `applicableToYears` (array of applicable year-of-study values; empty = all).

### AC — Mid-year revision (supersede)
- [ ] When a new FeeStructureInstance is approved + activated, prior versions with same scope are marked `superseded`.
- [ ] Existing students with a pin on the superseded version continue to resolve against the superseded version for invoicing — this is explicitly the intended behavior, not a bug.
- [ ] Future invoice runs for those students show a UI banner: "This student is pinned to v2 of this programme's Year-2 fee (superseded). Active version is v3."

### AC — Fee Commitment Sheet PDF
- [ ] Generated on every successful pin (admission + promotion).
- [ ] Contents: student name, roll number, programme, branch, batch, quota, category, academic year, year-of-study, component-wise table (name, amount, refundable flag), total, payment-plan schedule (if any), FeeAgreement reference (if any), generation date, signature blocks.
- [ ] Persisted to the student's document set (via M02 People Documents); retrievable by document type `fee_commitment_sheet`.
- [ ] Versioned — if a re-pin happens, a new sheet is generated and linked to the new pin; old sheet is kept but marked `superseded`.
- [ ] Optionally emailed to the parent's registered email on admission finalization.

### AC — Roles & approvals
- [ ] Draft / Submit: `finance_officer`
- [ ] Approve / Reject: `principal` or `super_admin`
- [ ] Automatic activation at `effectiveDate`: system
- [ ] Automatic pinning at admission / promotion: system (logged as `pinnedBy: 'system:admission'` or `'system:promotion'`)
- [ ] Manual re-pin: `principal` (or `super_admin`); reason + remarks required

### AC — Audit & observability
- [ ] Every pin event (create, re-pin, archive) generates an AuditLog entry.
- [ ] Nightly job runs a sanity check: count students without a pin for their current year-of-study. Metric exposed.
- [ ] Nightly job runs a sanity check: count students whose pinned structure's approved total ≠ their latest invoice total (accounting for documented concessions/scholarships/agreement). Metric alerts.

## Edge Cases

- **EC-1** No active FeeStructureInstance at admission → admission blocks with clear error. Admissions office must coordinate with Finance before admitting.
- **EC-2** Two `active` FeeStructureInstances match the same scope (shouldn't happen post-activation logic, but defend): pick the most recent by `approvedAt`; log a warning.
- **EC-3** FeeStructureInstance is deleted (should be disallowed if any pins reference it) — enforce a DB-level guard / service-level check.
- **EC-4** Student withdraws before Year-1 pin was committed (mid-admission) → no pin, no commitment sheet; rollback transaction.
- **EC-5** Bulk promotion of 200 students, Year-2 structure exists for only some programmes → per-student error list surfaced; promotion succeeds for students with pins, defers for others.
- **EC-6** Student transfers programmes mid-year (BTech CSE → BTech ECE Year 2 start) → Year 1 pin archived, Year 2 pin against new programme's Year-2 structure.
- **EC-7** Rate revision happens BEFORE a Year 1 student is promoted to Year 2 → student's Year 2 pin uses the new (revised) structure. This is by design; annual lock is per-year-of-study, not per-programme-lifetime.
- **EC-8** FeeAgreement exists for a student covering their full programme → still pin the standard structure for recordkeeping, but invoice generation reads FeeAgreement.negotiatedTotal first. The pin serves as the "standard rate this student would owe" baseline for comparison.
- **EC-9** Component template is customized per-college → seed data is idempotent; a college's customizations survive re-seeding.
- **EC-10** Commitment sheet generation fails (PDF service down) → admission/promotion does NOT fail. Sheet is queued for async retry via BullMQ; sheet-generation status tracked on the pin record.
- **EC-11** Parent email on admission bounces → logged in existing FeeReminder / communication-log tables; does not block admission.
- **EC-12** Super-admin edits a component on an `active` FeeStructureInstance directly (shouldn't be possible via UI) → DB-level guard or service-level 403.

## NOT For

- **Course-level / per-subject fees** — individual CourseOffering surcharges are explicitly out of scope. If the college needs a "DBMS Lab ₹2K surcharge" pattern in the future, it's a separate feature with its own spec.
- **Hostel & transport fee logic** — owned by the `optional-hostel-transport-allotment` spec (already in `.captain/specs/`). This feature leaves those as conditional components via existing `FeeComponentRule`.
- **Government scholarship reimbursement workflow** — out of scope. Govt scholarships are recorded in `ScholarshipAllocation` but do not affect invoice amounts in this feature.
- **Per-semester fees** — existing system generates per-semester invoices from annual structures; this feature does NOT introduce semester-specific FeeStructures.
- **Redesign of FeeAgreement UI** — existing entity and CRUD page kept as-is. Integration touches only the invoice resolution order.
- **Redesign of `generateSemesterInvoice`** — only the pin-lookup step is added; all other logic (component rule evaluation, stacking, PaymentPlan) unchanged.
- **Student-facing portal view** of pinned fees — admin-only for v1. Flagged for v2.
- **Currency / tax / GST changes** — structure total is computed with existing tax rules (no spec changes).
- **Refund processing** — owned by `refund-automation` spec. We pin refundable flag per component but don't change the refund computation.

## Dependencies

- **Depends on:** existing `FeeStructureInstance`, `FeeComponent`, `FeeComponentRule`, `FeeAgreement`, `StudentFeeAccount`, `AuditLog` entities. Existing `resolveFeeStructure` helper. Existing admission workflow (`workflow.handlers.ts`). Existing PDF generation service (M02 People Documents) for commitment sheet.
- **Depended on by:** any future feature that wants to know "what is the current student actually committed to" — e.g., fee forecasting, batch-level revenue projection, parent communication.
- **Changes existing code:** `workflow.handlers.ts#provision_m04` (add pin step), `fee-lifecycle-service.ts#generateSemesterInvoice` (read pin first), `Student.ts` schema (add `feePins[]`), and adds a new service `fee-pin-service.ts`.

## Success Metrics

- **Correctness (hard gate):** 100% of enrolled students have a pinned `feeStructureInstanceId` for their current year-of-study within 24 hours of admission or promotion. Measured via nightly audit query; exposed as a metric on the Finance dashboard; alerts Principal + Finance Officer if < 100%.
- **Invariant (hard gate):** For every active invoice, the line-item sum (minus concessions/scholarships/agreement overrides) equals the pinned structure's total. Nightly check; zero deviation tolerance; alerts on any mismatch.
- **Throughput (soft):** Batch operation "pin Year-1 for 200 admitted students" completes in < 60 seconds end-to-end, including commitment sheet PDF generation.
- **Parent communication (soft):** ≥ 95% of new Year-1 pins produce an emailed commitment sheet within 10 minutes of admission finalization. Tracked via email delivery logs.
- **Operational (soft):** Re-pin events (branch change, quota change, admin override) comprise < 2% of total pin events across an academic year. Higher numbers signal data-quality or policy-drift issues.

## Template — Canonical Fee Components

This is the seed template that Colleges start from when drafting a new FeeStructure. Each component is configurable per-college; this list is the default superset from surveying typical Indian AICTE-affiliated institutions.

### Academic (recurring, per year)
| componentKey | displayLabel | isRefundable | defaultOneTime | applicableToYears |
|---|---|---|---|---|
| `tuition_fee` | Tuition Fee | no | no | all |
| `development_fee` | Development Fee | no | no | all |
| `examination_fee` | University Examination Fee | no | no | all |
| `internal_assessment_fee` | Internal Assessment Fee | no | no | all |

### Admission one-offs (Year 1 only, typically)
| componentKey | displayLabel | isRefundable | defaultOneTime | applicableToYears |
|---|---|---|---|---|
| `admission_fee` | Admission Fee | no | yes | [1] |
| `registration_fee` | Registration Fee | no | yes | [1] |
| `id_card_fee` | ID Card & Uniform Fee | no | yes | [1] |
| `orientation_fee` | Orientation / Induction Fee | no | yes | [1] |

### Lab & Practical
| componentKey | displayLabel | isRefundable | defaultOneTime | applicableToYears |
|---|---|---|---|---|
| `laboratory_fee` | General Laboratory Fee | no | no | all |
| `computer_lab_fee` | Computer Lab Fee | no | no | all |
| `workshop_fee` | Engineering Workshop Fee | no | no | [1] |
| `project_fee` | Project / Capstone Fee | no | no | [4] |
| `internship_fee` | Industrial Training / Internship Fee | no | no | [3, 4] |

### Infrastructure & Services
| componentKey | displayLabel | isRefundable | defaultOneTime | applicableToYears |
|---|---|---|---|---|
| `library_fee` | Library Fee | no | no | all |
| `digital_resources_fee` | E-Resources / Digital Learning Fee | no | no | all |
| `sports_fee` | Sports / Gymkhana Fee | no | no | all |
| `medical_fee` | Medical / Health Service Fee | no | no | all |
| `insurance_premium` | Student Insurance Premium | no | no | all |

### Student Life
| componentKey | displayLabel | isRefundable | defaultOneTime | applicableToYears |
|---|---|---|---|---|
| `student_activity_fee` | Student Activity / Cultural Fee | no | no | all |
| `nss_fee` | NSS / Community Service Fee | no | no | all |
| `placement_service_fee` | Placement Service Fee | no | no | [3, 4] |
| `alumni_fee` | Alumni Association Fee | no | yes | [4] |
| `convocation_fee` | Convocation Fee | no | yes | [4] |

### Regulatory / Compliance
| componentKey | displayLabel | isRefundable | defaultOneTime | applicableToYears |
|---|---|---|---|---|
| `university_affiliation_fee` | University Affiliation Fee | no | no | all |
| `aicte_ugc_fee` | AICTE / UGC Contribution | no | no | all |
| `pta_fee` | PTA Contribution | no | no | all |

### Caution Deposits (refundable at exit)
| componentKey | displayLabel | isRefundable | defaultOneTime | applicableToYears |
|---|---|---|---|---|
| `caution_deposit_general` | General Caution Deposit | yes | yes | [1] |
| `caution_deposit_library` | Library Caution Deposit | yes | yes | [1] |
| `caution_deposit_lab` | Lab Equipment Caution Deposit | yes | yes | [1] |

### Conditional (inclusion via FeeComponentRule)
| componentKey | displayLabel | isRefundable | defaultOneTime | applicableToYears |
|---|---|---|---|---|
| `hostel_fee` | Hostel Accommodation Fee | no | no | all |
| `mess_fee` | Mess Fee | no | no | all |
| `transport_fee` | Transport Fee | no | no | all |
| `caution_deposit_hostel` | Hostel Caution Deposit | yes | yes | [1] |

Colleges can add bespoke components (e.g., "Coding Platform License Fee", "Textbook Bundle Fee", "Specialized Equipment Fee for ECE") as needed. The template is a starting point, not a ceiling.

## Changelog

- **2026-04-21** — Initial spec created. Key design decisions captured: programme-level scope (no course-level fees), snapshot-at-enrollment with annual lock per year-of-study, invoice generation reads pin-first, Fee Commitment Sheet PDF in scope, student portal view deferred to v2.
- **2026-04-21** — Fixed component-count typo: "~30" → 33 (actual sum of category tables is 4+4+5+5+5+3+3+4 = 33). No functional change; label-only. Discovered during T2 implementation by the seed agent — the category tables were always authoritative; the headline number was incorrect. Updated tasks.md to match.
