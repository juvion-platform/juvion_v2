# Tasks — 007-fee-billing-payment-ar

## STATUS (branch `feat/fee-billing-payment-ar`)
T1–T13 ✅ DONE — committed, each test-first + typecheck-clean. Full finance suite green (288).
T14 (manual UI QA + optional e2e) ⏳ pending — the flow to walk: bulk-import a student →
auto-pin → Generate Bills (finance:create as admin) → record a partial payment against the
invoice → dashboard "Collected" rises + "Outstanding (AR)" falls.
**Deploy scripts to run on existing DBs:** `fix-invoice-semester-installment-index.ts` (T2)
and `verify-fee-balance-invariant.ts` (T10, check). Leave FINANCE_ENFORCE_FEE_GUARDIAN unset.


TDD-ordered, each commit-shaped. Derived from `plan.md` §8, incorporating the GATE-2
resolutions (`gate2-resolution.md`). Each task: **RED** (failing test) → **GREEN**
(minimal impl) → **REFACTOR** → typecheck → commit.

Branch: `feat/fee-billing-payment-ar`. Test runner: `vitest run` (backend), scoped with
`NODE_OPTIONS=--max-old-space-size=8192 npx vitest run <path>`.

---

## T1 — Model fields (foundation, no behaviour) ← IN PROGRESS
**Files:** `backend/src/models/finance/Payment.ts`, `backend/src/models/finance/Invoice.ts`
- Add `Payment.invoiceId?: ObjectId (ref 'Invoice')` + index `{collegeId, invoiceId}`.
- Add `Invoice.isSemesterInstallment?: boolean` (the G2-C1 discriminator; nothing but the 007 generator sets it true).
- **Test:** a model unit test asserting both fields persist when set and are absent when omitted (backward compatible).
- Commit: `feat(finance): add Payment.invoiceId + Invoice.isSemesterInstallment (007 T1)`

## T2 — Invoice idempotency unique index + migration
**Files:** `Invoice.ts`, new `backend/src/scripts/fix-invoice-semester-installment-index.ts`
- Partial unique index `{collegeId,studentId,semesterId}` with
  `partialFilterExpression:{ isSemesterInstallment:true, studentId:{$type:'objectId'}, semesterId:{$type:'objectId'} }`.
- Idempotent migration mirroring `fix-student-rollnumber-index.ts` + pre-check for existing violators.
- **Test:** two `isSemesterInstallment:true` invoices for the same (college,student,semester) → E11000; an exam `type:'fee'` invoice with the same tuple but no flag → allowed.
- Commit: `feat(finance): unique index for semester-installment invoices + migration (007 T2)`

## T3 — `fee-billing-service.generateSemesterInstallmentForStudent`
**Files:** new `backend/src/modules/finance/fee-billing-service.ts` + `__tests__/fee-billing-service.test.ts`
- Pin selection by year (`resolvePinYearForExistingStudent`) + (b) AY guard.
- `isSemesterInstallment` idempotency (NOT `type:'fee'`), `semester.number` floor/remainder split.
- Compensating rollback on the Invoice→lineItems→account writes.
- Outcomes: generated / already-billed / no-active-pin / pinned-to-different-ay / no-amount / unsupported-semester-number / error.
- **Tests (must include):** exam-fee-invoice-present still bills tuition; mid-write failure leaves no orphan invoice/balance; Sem-1+Sem-2 sum exactly to annual; dry-run writes nothing.
- Commit: `feat(finance): pin-driven semester-installment invoice generation (007 T3)`

## T4 — `generateSemesterInstallmentsForPinned` (batch)
- Candidate query (`status:'active'` + non-archived pin), `studentIds`/`yearOfStudy` filters, outcome aggregation, dry-run.
- **Test:** batch over a mixed cohort aggregates counts correctly; dry-run writes nothing.
- Commit: `feat(finance): batch generate-from-pins with dry-run (007 T4)`

## T5 — Route + controller + schema
**Files:** `routes.ts`, `controller.ts`, `validation.ts`
- `POST /invoices/generate-from-pins`, `authorize('finance','create')`, `generateFeeBillsSchema`.
- **Test:** integration — dry-run + real, `finance:create` gate (403 without), college scoping.
- Commit: `feat(finance): POST /invoices/generate-from-pins endpoint (007 T5)`

## T6 — Payment schemas + desync closure (ship together, G2-M4)
**Files:** `validation.ts`, `service.ts` (`deletePayment`), `controller.ts`
- `createPaymentSchema`: add `invoiceId`, **remove `status`**.
- `updatePaymentSchema`: standalone `.strict()` `{remarks,transactionRef}`.
- `deletePayment`: reverse `StudentFeeAccount` + recompute invoice status + audit.
- **Test:** PUT cannot change amount/status/invoiceId; delete of a settled payment reverses balance + resets invoice status + audits; bare-payment delete is a no-op reversal.
- Commit: `feat(finance): lock payment mutations + reversing delete (007 T6)`

## T7 — `createPayment` invoice application (depends on T6)
- Overpayment guard (400 before write), apply-to-invoice when `invoiceId` present, balance decrement, partial→partially_paid / full→paid.
- **Test:** partial + full + overpayment-400 + bare-payment-still-works.
- Commit: `feat(finance): apply counter payments to invoices + balance (007 T7)`

## T8 — Guardian flag (G2-M1)
**Files:** `service.ts:51`, `.env.example`, `CLAUDE.md`
- Existence/college check **unconditional**; guardian requirement behind `FINANCE_ENFORCE_FEE_GUARDIAN`.
- **Test:** flag on → 400 without guardian; flag off → passes, but still 404 on cross-college studentId.
- Commit: `feat(finance): flag-gate fee-guardian requirement, keep existence check (007 T8)`

## T9 — Analytics net AR (G2-M5 + fixtures)
**Files:** `fee-analytics-service.ts`, its `__tests__`
- `totalOutstanding` + `dueByProgramme.due` from `StudentFeeAccount.balance`, `collegeObjId` cast.
- **Update fixtures to CREATE `StudentFeeAccount` rows** (Invoice-only fixtures would break).
- Commit: `feat(finance): net-receivable AR on dashboard (007 T9)`

## T10 — Balance invariant verifier (G2-H1)
**Files:** unit test + `backend/src/scripts/verify-fee-balance-invariant.ts`
- `balance == totalDue − totalPaid − totalWaived + totalRefunded`, scoped to `isSemesterInstallment` students.
- Commit: `test(finance): balance invariant verifier scoped to 007 (007 T10)`

## T11 — FE service + flags + semester list
**Files:** `admin-portal/src/services/finance.ts`, `config/flags.ts`, academics service
- `generateFeeBills`, open-invoice fetch, `VITE_FINANCE_ENFORCE_FEE_GUARDIAN` flag, `listSemesters` (verify-or-add).
- Commit: `feat(portal): finance-billing client + flags (007 T11)`

## T12 — FE PaymentsPage
- Remove status controls, invoice-allocation select (default oldest unpaid), guardian flag.
- **Test:** payload has `invoiceId`, no `status`.
- Commit: `feat(portal): payment records against an invoice (007 T12)`

## T13 — FE GenerateBillsPage + tab
- New page (dry-run→confirm, modeled on Pin Coverage) + `FeeManagementPage` tab wiring.
- Commit: `feat(portal): Generate Bills screen (007 T13)`

## T14 — Manual QA + optional e2e
- Full flow: import → pin → generate bills → record payment → AR drops. Optional single e2e happy-path.
- Commit (if e2e added): `test(e2e): billing→payment→AR happy path (007 T14)`

---
**Deploy checklist:** run `fix-invoice-semester-installment-index.ts` (T2) on existing DBs;
leave `FINANCE_ENFORCE_FEE_GUARDIAN` unset for demo. See `plan.md` §6 for setup prerequisites.
