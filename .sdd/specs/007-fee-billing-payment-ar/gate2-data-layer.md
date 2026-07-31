# GATE-2 — Data Layer Validation — 007-fee-billing-payment-ar

Validator: Data Layer (Mongoose 8, no multi-doc transactions — compensating logic only).
Method: every claim opened against `main` source at the cited file:line.

Verdict: **FAIL** — 1 CRITICAL + 2 HIGH.

---

## CRITICAL

### C1 — The idempotency key is NOT unique to 007 tuition invoices; exam-fee invoices share it. Breaks both the app-level skip and the unique index.
Plan §4.8 rests on: *"9+ `type:'fee'` creation sites produce invoices with **no** `semesterId`… This filter only covers rows that have both ids, which is precisely our billed invoices."* **This premise is false.**

Two wired, shipped exam-fee paths create `type:'fee'` invoices **with both `studentId` and `semesterId`**:
- `academics/service.ts:2931-2943` — `generateExamFeeInvoice` → `type:'fee'`, `studentId`, `semesterId`, `examType`. Wired at `academics/routes.ts:380` (`POST /academics/exam-fees/generate`).
- `finance/fee-lifecycle-service.ts:643-655` — exam-fee `Invoice.create` → `type:'fee'`, `studentId`, `semesterId: data.semesterId`, `examType`. Wired via `finance/controller.ts:1230` and batch `:450` (`generateExamFeeInvoiceBatch`).

Both therefore satisfy the plan's `partialFilterExpression: { type:'fee', studentId:{$type:'objectId'}, semesterId:{$type:'objectId'} }`. Consequences:

1. **App-level idempotency is corrupted (independent of the index).** §4.1 step 4 is `Invoice.findOne({ collegeId, studentId, semesterId, type:'fee' })`. If a student already has an **exam** invoice for semester S, this findOne returns it → 007 reports `already-billed` and **never bills tuition, never credits `StudentFeeAccount.balance`**. Silent under-billing of the core happy path.
2. **The unique index E11000s a legitimate combination.** A student can legitimately hold a tuition invoice **and** an exam invoice for the same semester (also two exam invoices — `generateExamFeeInvoice` has no dedup guard). The second `Invoice.create` throws E11000, breaking the existing exam-fee feature.
3. **Index build fails on existing DBs.** Any production/seeded DB where a student already has tuition(semesterId) + exam(semesterId) for one semester (the existing `generateSemesterInvoice` at `fee-lifecycle-service.ts:538` also sets `semesterId`) makes the §4.8 migration's `createIndex` throw — and the §4.8 "pre-check" would report violations that are *by design*, not dirty data, leaving the index un-buildable.

**Why the obvious narrowing does not work:** the only discriminator in the data is `examType` (present on exam invoices, absent on tuition). But `partialFilterExpression` **does not permit `$exists:false`** (MongoDB allows only `$exists:true`, plus equality/`$type`/`$gt…`/`$and`/`$or`). So you cannot express "no examType" in the partial filter.

**Fix:** give 007 tuition invoices a **positive** discriminator and key both the findOne and the index on it — e.g. add `metadata.installment === true`, or a top-level `isSemesterInstallment: true`, and set `partialFilterExpression: { type:'fee', isSemesterInstallment: true, studentId:{$type:'objectId'}, semesterId:{$type:'objectId'} }` (equality on a scalar is allowed). Add the same predicate to the step-4 findOne. Then re-run the §4.8 pre-check — with the discriminator, existing exam/tuition rows no longer count as violations. (Demo seed is safe: `seed-fee-demo-data.ts` sets no `semesterId` — verified, 0 occurrences — so the collision is the exam-fee feature, not the seed.)

---

## HIGH

### H1 — Balance invariant formula has the wrong sign on `totalRefunded`; §4.9 verifier and the §4.6 guardrail are miscalibrated against the very refund writer they claim to guard.
Plan §2 and §4.9 assert `balance == totalDue − totalPaid − totalWaived − totalRefunded`. The refund writer contradicts this:
- `fee-lifecycle-service.ts:1516-1518` (`processRefund`): `$inc: { totalRefunded: +refund.amount, balance: +refund.amount }` — refund raises `totalRefunded` **and** raises `balance`.

So the invariant the codebase actually maintains is `balance = totalDue − totalPaid − totalWaived **+** totalRefunded`. Cross-check of the other cited `$inc` sites confirms all are consistent with the *plus* form:
- `:562-564` totalDue+/balance+ ✓ · `:668-670` totalDue+/balance+ ✓ · `:779-781` totalWaived+/balance− ✓ · `:851-854` totalPaid+/balance− ✓ · `:1175-1177` (bounce) totalPaid−/balance+ ✓ · `:1689,:1759,:1826` totalWaived+/balance− ✓ · `:1516-1518` (refund) totalRefunded+/balance+ → only consistent with **+totalRefunded**.

Impact: §4.6-point-1 explicitly names refund as a writer "the invariant guards against," but the stated invariant would **false-flag any refunded student** by `2×totalRefunded`. The §4.9 `scripts/` verifier as written reports a phantom defect the moment a refund touches a billed student. Scoping to "007-touched students" masks it only while no such student is ever refunded — but a QA refund on a billed student trips it, and the formula misrepresents the system invariant it is meant to protect.

**Fix:** state and test `balance = totalDue − totalPaid − totalWaived + totalRefunded` (matching `:1518`).

### H2 — Multi-write generation has no compensating rollback; the idempotency guard makes a partial write permanent.
§4.1 orders the writes: (7) `Invoice.create` → (8) N × `InvoiceLineItem.create` → (10) `StudentFeeAccount` `$inc { totalDue, balance }`. No transaction (correct — not a replica set), but **no compensating logic is specified** either, unlike the 006 import commit which the plan itself cites as the pattern.

Failure modes (no replica set, so any single write can fail transiently):
- Invoice persists (7), line-item loop (8) throws midway, or account `$inc` (10) throws → the Invoice now exists. **On re-run, step-4 idempotency `findOne` returns it → `already-billed` skip → `balance`/`totalDue` are never credited and line items stay incomplete.** The partial state is *cemented* by the idempotency guard; a re-run cannot self-heal.
- Net effect: the due exists as an Invoice but is invisible to net AR (§4.6-point-2 notes this failure mode only for the generic `POST /invoices`, not for the billing service's own partial failure).

Note the invariant (H1) will **not** catch this: `totalDue` and `balance` are incremented in the *same* `$inc`, so skipping step 10 leaves them mutually consistent (both un-incremented) — the money is simply absent from the account.

**Fix:** wrap `generateSemesterInstallmentForStudent` in try/catch with compensating delete (delete the Invoice + its line items if the account `$inc` fails), mirroring the 006 commit's compensating rollback — OR make re-run reparative (before skipping on `already-billed`, verify the account was actually credited for that invoice and, if not, complete it). Either closes the orphan window; the plain findOne-skip does not.

---

## MEDIUM

### M1 — The "exact by construction" rounding split needs `semester.number`, which §4.1 step 2 does not extract; and it is unguarded for non-{1,2} numbering.
§4.1 step 5 splits `first = floor(annual/2)` for "Sem-1", `annual − first` for "Sem-2" — but the function is invoked per-semester and "only sees one semester" (§7-item-6 / the concern raised). The only way to know which half this is, is `Semester.number` (verified present and required: `models/academic-structure/Semester.ts:5,11`, unique `{collegeId,academicYearId,number}` at `:18`). But **step 2 says "read `academicYearId`" only** — it never reads `number`. As written, the function has no basis to choose floor vs remainder, so the "sums exactly, no ±₹1 drift" claim is unproven by the plan.

Additionally, `number` is a bare `Number` (no enum) — nothing guarantees the AY's two semesters are numbered `{1,2}` rather than, say, `{3,4}` for a promoted cohort. The floor/remainder branch must key on relative order within the AY, not the literal value `1`. **Fix:** step 2 must load `semester.number`; derive the installment index by ranking the AY's semesters (`sort by number`), and drive floor-vs-remainder off that rank. For the demo (2 semesters numbered 1/2) it works; state the derivation explicitly and guard the >2 / non-1-based case.

### M2 — Overpayment guard and delete-recompute read-modify-write races (no transaction).
§4.3 computes `paidSoFar = Σ Payment.find({ invoiceId, status:'success' }).amount` before writing, then applies. Two concurrent `success` payments for one invoice can both read the same `paidSoFar`, both pass the `amount ≤ net − paidSoFar` check, and both apply → overpayment + double `balance` decrement. §4.3a `deletePayment` recompute has the same read-then-write window against the invoice status. No-transaction env; demo scale (single counter operator) makes it low-probability, but it is a real invariant breach. **Fix (lazy):** acceptable to accept the race at demo scale — but say so with a `ponytail:`-style ceiling note ("single-writer assumption; needs an atomic conditional update or per-account lock for concurrent counters"), rather than presenting the guard as airtight.

---

## LOW

### L1 — Net `totalOutstanding` (Σ all balances) and `dueByProgramme` (drops programme-less students) can disagree.
§4.6 makes `totalOutstanding` a `$group` over all `StudentFeeAccount.balance` with no programme join, while `dueByProgramme` keeps the orphan guard (`fee-analytics-service.ts:356` — `_student.programmeId` exists/≠null) and the `programmes` join/`$unwind` (`:361-368`). A student with a balance but no `programmeId` counts in the total but in no programme row → `total ≠ Σ programme rows`. Pre-existing shape (today's `totalOutstanding` also skips the programme join), cosmetic. Note it so a reconciling reader isn't surprised.

### L2 (verification, not a defect) — `Payment.invoiceId` needs no backfill.
Confirmed correct: 007 invoices are freshly created and only 007-era payments carry `invoiceId`, so `paidSoFar` over `{ invoiceId, status:'success' }` is complete without migrating legacy `Payment` docs. The new `{collegeId, invoiceId}` index (§4.2) is additive and safe.

---

## Verified-correct claims (spot audit)
- `Invoice.studentId` / `semesterId` are optional — `models/finance/Invoice.ts:20,28` (no `required`). ✓
- Existing `type:'fee'` sites that **omit** semesterId exist (so the `$type:'objectId'` guard is genuinely needed): admissions `workflow.handlers.ts:1216-1228`, seed `seed.ts:1128-1129`. ✓ (But C1: two sites do NOT omit it.)
- `$type:'objectId'` mirrors the T0 rollNumber fix (`Student.ts:220-223`, script `scripts/fix-student-rollnumber-index.ts`); a Mongoose-can't-alter migration is genuinely required. ✓
- `StudentFeeAccount` has `{collegeId,studentId}` unique index (`StudentFeeAccount.ts:19`) and no `min` on `balance`, so balance can go negative (refunds/waivers). ✓
- aggregate `collegeId` must be cast to ObjectId — `service.ts:91` (`new mongoose.Types.ObjectId`) and analytics already casts via `toObjectId` at `fee-analytics-service.ts:245`; Student→Programme join keys (`_student.programmeId`) and `programmeScope` application exist at `:356-368`. ✓ (net-AR switch reuses these.)
- `snapshotTotalAmount` optional (`Student.ts:93`, no `required`) with `snapshotComponents` optional (`:94`); FSI fallback `fsi.totalAmount` and the `no-amount` skip are sound. ✓
- `resolvePinYearForExistingStudent` never throws — try/`resolveStudentYearOfStudy`, catch→admission-year fallback (`student-import-pin.ts:283-302`). ✓
- `resolveActivePin(studentId, yearOfStudy)` selects the single non-archived pin for that year (`fee-pin-service.ts:487-497`) — by-year selection is unambiguous as claimed. ✓
- `createPayment` today touches neither Invoice nor StudentFeeAccount (`service.ts:269-299`); `updatePayment` is a blind `findOneAndUpdate(...data...)` (`:301-306`); `deletePayment` is delete+audit with no reversal (`:308-313`) — §4.3a's three closures are all warranted. ✓
- Existing `generateSemesterInvoice` write order is Invoice→lineItems→account `$inc` (`fee-lifecycle-service.ts:529-566`) — the plan mirrors it (and inherits H2). ✓

---

## Verdict: **FAIL** (1 CRITICAL, 2 HIGH). Resolve C1 (discriminator on the idempotency key), H1 (invariant sign), and H2 (compensating rollback) to reach PASS.
