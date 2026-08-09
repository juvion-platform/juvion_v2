# GATE 2 — API & Security Validation — 007-fee-billing-payment-ar

Validator: API & Security (adversarial). Every claim below was checked against
live `main` source, not the plan's assertions.

**Verdict: PASS** (0 CRITICAL + 0 HIGH). Five MEDIUM and several LOW items
should be folded into the plan before implementation, but none breach tenant
isolation or introduce an exploitable privilege gap.

---

## What checks out (verified, not assumed)

- **`validate()` strips unknown keys and rewrites the body.**
  `middleware/validate.ts` does `req.body = schema.parse(req.body)`; Zod's
  default object mode drops unknown keys. So removing `status` from
  `createPaymentSchema` (validation.ts:60) genuinely blocks it on **POST**, and
  because `updatePaymentSchema = createPaymentSchema.partial()` (validation.ts:75)
  it is blocked on **PUT** too. `Payment.status` default `'success'`
  (Payment.ts:18) becomes the only reachable value. The §4.3a claim holds.
- **Every new query in the plan carries `collegeId`** — idempotency
  `Invoice.findOne({collegeId,studentId,semesterId,type:'fee'})`, candidate
  `Student.find({collegeId,...})`, overpayment `Invoice.findOne({_id,collegeId,studentId})`
  and `Payment.find({collegeId,invoiceId,status:'success'})`. The partial unique
  index (§4.8) keys on `collegeId` first, so uniqueness is per-tenant.
- **Generic `createInvoice` (service.ts:504) is NOT an injection surface for 007.**
  `createInvoiceSchema` (validation.ts:147) has no `semesterId` field, so a
  generic `POST /invoices` cannot forge a `fee`+`semesterId` invoice that trips
  the new partial index or bypasses the billing service. `Invoice.create({...data})`
  only picks schema-declared paths.
- **AppError arg order** in the plan's new code paths is correct (`AppError(400,…)`,
  `AppError(404,…)` — statusCode first).
- **`deletePayment` verified**: service.ts:308-313 is `findOneAndDelete` + audit
  only, no balance reversal — the §4.3a premise is accurate.

---

## MEDIUM findings

### M1 — Guardian flag wraps the whole guard, disabling the student-existence 404 on every finance-create path
**Severity: MEDIUM**
**Evidence:** `assertStudentFeeGuardianReady` (service.ts:51-61) does two things:
(1) `Student.findOne({_id, collegeId})` → 404 if missing, and (2) reject if no
`feeResponsibleParentId`. The plan §4.5 early-returns *before both*:
`if (process.env.FINANCE_ENFORCE_FEE_GUARDIAN !== 'true') return; ...existing body...`.
This guard fronts `createPayment` (269), `createInvoice` (505),
`createStudentFeeAccount` (196), `createFeeLineItem` (233), `createScholarshipAllocation` (378).
**Why it matters:** With the flag off (the demo default), the *existence + college
match* validation is also skipped. A `finance:create` caller in college A can then
POST a payment/invoice/line-item carrying a `studentId` from college B; the doc is
written under `collegeId: A` referencing a foreign student. This is **not** a
cross-tenant read (the row stays scoped to A and the overpayment guard's
`Invoice.findOne({...collegeId, studentId})` would 400 on a foreign invoice), but
it is a silent data-integrity regression — orphan payments that never join to any
college-A student and quietly drop out of the programme-scoped AR pipelines.
**Fix:** Keep the existence check unconditional; gate only the parent requirement:
```ts
export async function assertStudentFeeGuardianReady(collegeId, studentId?) {
  if (!studentId) return;
  const student = await Student.findOne({ _id: studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');
  if (process.env.FINANCE_ENFORCE_FEE_GUARDIAN !== 'true') return; // parent check is the only opt-out
  if (!student.feeResponsibleParentId) throw new AppError(400, '…');
}
```

### M2 — §6 persona hand-off names the wrong persona for `finance:create`; principal cannot generate bills or record payments
**Severity: MEDIUM**
**Evidence:** Plan §6 states "Generate-Bills and Payments are **finance:create** →
admin/principal". But `defaults.ts` grants principal only
`finance:approve` (defaults.ts:20) plus `module:* read` (defaults.ts:16) — **no
`finance:create`**. `finance:create` is held by super_admin (`*:*`, :10), admin
(`*:*`, :13) and ST-ACC accounts staff (`finance:*`, :39).
**Why it matters:** If the demo is driven as *principal* (a natural choice given
`L-PRIN`), every `POST /invoices/generate-from-pins` and `POST /payments` call
403s. Worse, the wrong fix — granting principal `finance:create` — is a real
privilege over-grant. The correct operating persona is **admin or ST-ACC (Accounts
staff)**, not principal.
**Fix:** Correct §6 to "admin / ST-ACC (Accounts staff)". If principal genuinely
must operate this screen, change the route grain to `finance:approve` (see M3)
rather than widening principal's grants.

### M3 — RBAC grain: mass bill-generation at `finance:create` sits *below* bulk-pin's `finance:approve`, inverting the money-commitment ladder
**Severity: MEDIUM**
**Evidence:** Bulk-pin is gated `authorize('finance','approve')`
(routes.ts:654-660) with the rationale "binding students to a fee structure … is a
money commitment, not a data edit." The new route (plan §4.7) proposes
`authorize('finance','create')`, matching every existing invoice-generation route
(`/invoices/batch/semester`, `/invoices/enrolment`, `/invoices/exam`, `/invoices/ad-hoc`,
generic `/invoices` — routes.ts:314-322, 575-577).
**Why it matters:** `generate-from-pins` *actually creates the dues* for the whole
pinned cohort — a heavier financial action than the pin it consumes — yet would
require a *lower* privilege than bulk-pin. Under the default policy the only persona
affected by the difference is principal (holds `approve`, not `create`), so the
inversion is real: principal can bulk-pin but couldn't generate the bills those pins
imply. Not an over-grant (ST-ACC/admin hold both), but an inconsistent grain the
plan should resolve deliberately.
**Fix:** Either (a) gate `generate-from-pins` `finance:approve` to match the
bulk-pin money-commitment rationale, or (b) keep `finance:create` and add a one-line
justification in §4.7 that it mirrors the existing invoice-generation routes. Pick
one on purpose; don't leave it implicit.

### M4 — Adding `invoiceId` to `createPaymentSchema` opens a PUT desync vector that only §4.3a's field-lock closes
**Severity: MEDIUM**
**Evidence:** §4.4 adds `invoiceId` to `createPaymentSchema`. Since
`updatePaymentSchema = createPaymentSchema.partial()` (validation.ts:75), `invoiceId`
(and the still-present `amount`, `paymentMode`, `allocations`, `collectedBy`) become
settable on **PUT**. `updatePayment` (service.ts:301-306) is a raw
`findOneAndUpdate` with **no** apply/recompute logic.
**Why it matters:** A PUT could repoint an existing payment at a different invoice,
or change `amount`, without ever moving `StudentFeeAccount.balance` or the invoice
status — exactly the AR desync §4.3a exists to prevent. The field is added in T8;
the lock is in T7. They must land in the same release, and the lock must be a real
allowlist, not a reliance on `.partial()`.
**Fix:** Define `updatePaymentSchema` as a standalone strict schema instead of
`createPaymentSchema.partial()`:
```ts
export const updatePaymentSchema = z.object({
  remarks: z.string().optional(),
  transactionRef: z.string().optional(),
}).strict();
```
Keep T7 and T8 in the same commit/PR.

### M5 — §4.6 net-AR pseudocode omits the ObjectId cast; `aggregate()` will silently return 0
**Severity: MEDIUM**
**Evidence:** §4.6 writes the new StudentFeeAccount pipeline as `$match { collegeId }`.
`aggregate()` does **not** auto-cast a string `collegeId` to ObjectId — the codebase
documents this exact trap at service.ts:87-91 and every pipeline in
`fee-analytics-service.ts` already uses the pre-cast `collegeObjId`
(toObjectId(collegeId), :245).
**Why it matters:** If the implementer follows §4.6 literally with a raw string,
`totalOutstanding` / `dueByProgramme.due` match nothing → AR renders **0** — a
correctness failure (under-fetch), not a leak, but it silently defeats US-3.
**Fix:** State in §4.6 that the new StudentFeeAccount pipelines must reuse the
already-in-scope `collegeObjId`, and join `students` via `studentId` for
`programmeScope` (StudentFeeAccount.studentId exists; `addStudentScopeStages` default
field works).

---

## LOW / informational

- **L1 — Overpayment guard is TOCTOU.** §4.3 reads `paidSoFar` (sum of successful
  payments), checks, then writes. Two concurrent payments on one invoice can both
  pass and overshoot. Acceptable at single-counter demo scale; add a
  `// ponytail: read-check-write race, fine at counter scale; unique-index or
  per-invoice lock if concurrent capture is ever added` note so the ceiling is
  explicit.
- **L2 — `resolveActivePin` / `resolvePinYearForExistingStudent` read Student
  unscoped by collegeId** (`Student.findById`, fee-pin-service.ts:487-491;
  student-import-pin.ts:283). Safe **only** because `generateSemesterInstallmentForStudent`
  step 1 loads `Student.findOne({_id, collegeId})` and 404s a foreign id before these
  are reached. Preserve that ordering; a defensive comment is warranted.
- **L3 — §4.3a calls `deletePayment` "wide open."** It is `finance:delete`-gated
  (routes.ts:276). The accurate (and verified) defect is the missing balance
  reversal, not the gate. The reversing-delete design does **not** weaken any gate —
  it adds reversal behavior behind the existing `finance:delete` grant, which is the
  right correction-path grain. Ensure the reversal writes a populated `changes[]`
  audit entry (today's delete uses `changes: []`).
- **L4 — Partial unique index uses `$type:'objectId'`** (§4.8). Supported in
  MongoDB 7 `partialFilterExpression`; the pre-existing-duplicate pre-check and the
  standalone migration (mirroring `fix-student-rollnumber-index.ts`) are correctly
  required.

---

## Verdict
**PASS** — 0 CRITICAL, 0 HIGH. Tenant isolation holds on every new path and there
is no privilege over-grant in the code as designed. Address M1–M5 (guardian
existence-check, correct persona in §6, conscious route grain, standalone
`updatePaymentSchema`, ObjectId cast on the AR pipelines) before Phase 8.
