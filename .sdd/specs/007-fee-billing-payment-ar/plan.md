# Implementation Plan — 007-fee-billing-payment-ar

**Goal:** make the last two of the five demo flows work end-to-end —
**record a student payment** (transaction capture, no gateway) and **a real-time
finance dashboard with Accounts Receivable** — by building the missing bridge
between a *pinned* student and *billable dues*, and wiring payments to reduce
those dues so AR moves live.

> Scope discipline: this deliberately does **not** touch the half-built
> reconciliation / bounce / refund / `PaymentTransaction` / gateway machinery.
> It builds the minimal correct spine: **pin → semester bill → payment → AR**.

---

## 1. Audit findings that constrain the design (all verified against `main` @ 105579f)

1. **Pinning creates no dues.** `commitPin` (`fee-pin-service.ts:702-714`) only pushes
   the embedded `Student.feePins[]` snapshot (`snapshotTotalAmount`,
   `snapshotComponents`) + audit + optional commitment-sheet job. **No
   `StudentFeeAccount`, no `Invoice`, no line items.** So a freshly imported +
   auto-pinned student owes nothing the system can see.
2. **Fees are authored *annually*, per year-of-study.** `FeeStructureInstance`
   axis is `yearOfStudy` (1–8) and `totalAmount` is the **whole-year** figure
   (`FeeStructureInstance.ts:48,75,78`). `FeeComponent` has a bare `amount`
   (`FeeComponent.ts:18`) — no term/frequency. There is **no semester amount** anywhere.
3. **Semesters already exist as a first-class entity** — model
   (`Semester.ts`: `academicYearId`, `number` 1/2, `year`, dates, `status`),
   CRUD API (`academics/routes.ts:153-157`), admin UI
   (`admin-portal/src/pages/academics/SemestersPage.tsx`). Dev seed makes **2 per
   academic year** (`seed.ts:768`). No new model needed.
4. **`generateSemesterInvoice` (`fee-lifecycle-service.ts:381`) is pin-aware and
   correct — but bills the FULL annual snapshot and has no idempotency guard.**
   It reads the active pin (`:424`), uses `snapshotComponents` (`:481-487`),
   creates `Invoice` + `InvoiceLineItem` (`:529,547`), and upserts
   `StudentFeeAccount` `{ $inc: totalDue, balance }` (`:562-566`). Calling it for
   both semesters of a year would **double-bill the annual fee**. Its batch sibling
   `generateBatchInvoices` (`:583`) drives off `Enrollment` (`:588`), which the
   import→pin flow never creates.
5. **The UI payment path is on the wrong rail.** `PaymentsPage.tsx` → `createPayment`
   (`finance.ts:49`) → `POST /api/finance/payments` → `service.createPayment`
   (`service.ts:269`) writes a `Payment` doc and (optionally) `$inc`s
   `FeeLineItem.paidAmount` — it **never touches `Invoice` or `StudentFeeAccount`.**
   The balance-maintaining path (`applyPaymentToInvoice`, `:807`) works off
   `PaymentTransaction` (a different model) and is not wired to any UI.
6. **The FE form defaults `status` to `'pending'`** (`PaymentsPage.tsx:24,42`) and
   sends it. Dashboard "Collected" only counts `Payment.status:'success'`
   (`fee-analytics-service.ts:265`), so a default-recorded payment silently does
   not count.
7. **Dashboard AR is fed by unpaid `Invoice` docs, gross.** `totalOutstanding`
   (`:254-258`) and `dueByProgramme.due` (`:373-381`) sum the invoice's full
   `totalAmount` for statuses in `UNPAID_INVOICE_STATUSES` (`:118-125`, which
   **includes `partially_paid`**). Payments are **never subtracted** (the
   "minus successful payments" comment at `:252` is not implemented). So a
   **partial** payment would not move AR — only a fully-paid invoice dropping out
   of the status set would. The "pays 20k of 45k → balance 25k" narrative requires
   AR to be **net**.
8. **Guardian gate** (`assertStudentFeeGuardianReady`, `service.ts:51`) throws 400
   before every finance-create (`:196,233,270,378,…`) unless the student has
   `feeResponsibleParentId`. Import guardian columns are optional
   (`import-schemas/student.ts:124-126`). FE mirrors it (`PaymentsPage.tsx:60,238`).
9. **No student-facing portal exists** (workspaces: backend, admin-portal, e2e).
   Payment recording is a staff/counter action at
   `/finance/fee-management/payments`. This matches the "no gateway" scope.

---

## 2. Behaviour contract (what "done" means)

```
Setup (one-time, not a build task):
  - current AcademicYear.isCurrent = true, with its 2 Semester rows present.
  - FINANCE_ENFORCE_FEE_GUARDIAN unset/false for the demo.

Flow:
  1. Admin opens Finance → Fee Management → "Generate Bills".
  2. Picks a Semester (+ optional Year filter). "Preview" (dry-run) shows:
       N will bill · M already billed · K no active pin · L pinned-to-different-AY · P no-amount.
  3. "Generate" → one fee Invoice per pinned student for that semester,
       amount = their pinned annual total ÷ 2 (SEMESTER_INSTALLMENTS_PER_YEAR).
       Idempotent: re-running skips anyone already billed for that (student, semester).
       StudentFeeAccount.balance is credited by the installment.
  4. Admin opens Payments → "New Payment" → picks the student.
       The student's oldest unpaid invoice is pre-selected (overridable).
       Records amount (mode, date); status defaults to success.
       Payment applies to that invoice: invoice → partially_paid / paid,
       StudentFeeAccount.balance decremented. Overpayment beyond the invoice is rejected.
  5. Finance dashboard: "Collected" rises (Payment.success), "Outstanding (AR)"
       falls by the paid amount — live, including partial payments.
```

**Invariants**
- One **semester-installment** invoice per `(collegeId, studentId, semesterId)` —
  keyed on our own discriminator `isSemesterInstallment:true`, **NOT** `type:'fee'`
  (exam-fee invoices are also `type:'fee'` **with** a `semesterId` — see G2-C1 / §4.8).
- `StudentFeeAccount.balance == totalDue − totalPaid − totalWaived **+** totalRefunded`
  — matches the actual writers (the refund writer `fee-lifecycle-service.ts:1516`
  does `totalRefunded += X` **and** `balance += X`; refund raises what's owed). G2-H1.
- Dashboard AR == Σ `StudentFeeAccount.balance` (net), scoped by programme.
- A payment recorded with a non-`success` status does **not** move invoice/AR.

---

## 3. User stories & acceptance criteria

**US-1 — Generate semester bills for pinned students.**
As a finance admin, I generate per-semester fee invoices for all pinned students in one action.
- AC-1.1 Generating for semester S bills each active student who has a non-archived pin
  for their resolved year, amount = `round(snapshotTotalAmount / 2)`.
- AC-1.2 Re-running for the same semester creates **no** duplicate invoices (idempotent skip).
- AC-1.3 A student with no active pin, or whose year-of-study can't resolve, is skipped and reported by reason (not errored).
- AC-1.4 Each generated invoice credits the student's `StudentFeeAccount.balance` by the installment.
- AC-1.5 A dry-run returns the projected counts and writes nothing.

**US-2 — Record a payment that reduces the bill.**
As a finance admin, I record a counter/manual payment and see the student's balance drop.
- AC-2.1 Recording a payment defaults to `status: success` and counts as Collected.
- AC-2.2 The payment applies to the chosen invoice (default: oldest unpaid): invoice becomes
  `paid` when fully covered, else `partially_paid`; `StudentFeeAccount.balance` decrements by the amount.
- AC-2.3 A payment exceeding the invoice's remaining balance is rejected with 400.
- AC-2.4 A payment recorded without an invoice still writes a `Payment` (backward compatible).

**US-3 — Real-time AR on the dashboard.**
- AC-3.1 "Outstanding (AR)" equals the net sum of `StudentFeeAccount.balance` and falls after each payment, including partial payments.
- AC-3.2 "Collected" reflects successful payments in the window.
- AC-3.3 Outstanding-by-programme reflects net balances per programme.

**US-4 — Guardian gate is demo-optional.**
- AC-4.1 With `FINANCE_ENFORCE_FEE_GUARDIAN` off, a student without a fee guardian can be billed and paid (backend + FE).
- AC-4.2 With it on, the 400 and the FE block return, unchanged from today.

---

## 4. Backend changes

### 4.1 New module — `backend/src/modules/finance/fee-billing-service.ts`

Purpose: pin-driven, semester-installment invoice generation. Kept **separate**
from `generateSemesterInvoice` so the existing enrolment-driven contract and its
tests are untouched. Reuses `resolveActivePin`, `resolveStudentYearOfStudy`,
`Invoice`/`InvoiceLineItem`/`StudentFeeAccount`, `createAuditLog`.

```
const SEMESTER_INSTALLMENTS_PER_YEAR = 2;
// Indian UG programmes run two semesters per academic year, so an annually-authored
// fee is billed in two equal installments. NICE-TO-HAVE (later): derive this per
// programme/regulation, or split at the component level (some one-time fees billed
// once/year). v1 = equal halves. See §9.

type BillOutcome =
  | { kind: 'generated'; studentId; invoiceId; amount }
  | { kind: 'already-billed'; studentId; invoiceId }
  | { kind: 'no-active-pin'; studentId }
  | { kind: 'pinned-to-different-ay'; studentId }   // (b) guard tripped
  | { kind: 'skipped'; studentId; reason: 'no-amount' | 'unsupported-semester-number' }
  | { kind: 'error'; studentId; error };
// generated/dry-run outcomes also carry yearAssumed + derivedFrom ('calendar'|'admission')
// so the operator can see when a bill leaned on the admission-year fallback.
```

**`generateSemesterInstallmentForStudent(collegeId, { studentId, semesterId }, performedBy, opts?: { dryRun }): Promise<BillOutcome>`**
1. Load student `{ _id, collegeId }`; if missing → throw 404 (single-student caller) —
   in batch it's pre-filtered so this is defensive.
2. Load semester `{ _id: semesterId, collegeId }`; 404 if missing; read **`academicYearId`
   AND `number`** (needed for the exact split — G2-M-data). Guard: if `number ∉ {1,2}`
   → `{ kind:'skipped', reason:'unsupported-semester-number' }` (v1 assumes 2/year).
3. **Select the pin by year-of-study (a), guarded by academic year (b):**
   - `{ yearOfStudy, derivedFrom } = await resolvePinYearForExistingStudent(studentId, student.studyYearAtAdmission)`
     (`student-import-pin.ts:283` — tries `resolveStudentYearOfStudy`, falls back to
     admission year on throw; robust for batch-less imported students, which was
     (a)'s only weakness). Never throws → no `year-unresolvable` outcome needed.
   - `pin = resolveActivePin(studentId, yearOfStudy)`; if `null` → `{ kind: 'no-active-pin' }`.
     Selecting **by year** is unambiguous: the invariant is one non-archived pin per
     year, so a promoted student holding pins for years 1/2/3 resolves cleanly —
     which pure academic-year matching (b) could **not** do (see §7, pre-existing
     same-AY divergence).
   - **(b) as a guard, not a selector:** load `FeeStructureInstance.findById(pin.feeStructureInstanceId)`;
     if its `academicYearId` ≠ the semester's `academicYearId` →
     `{ kind: 'pinned-to-different-ay' }` (skip loudly, don't bill silently).
4. **Idempotency (G2-C1 — discriminator, NOT `type:'fee'`):**
   `Invoice.findOne({ collegeId, studentId, semesterId, isSemesterInstallment: true })`;
   if found → `{ kind: 'already-billed', invoiceId }`.
   > **Why not `type:'fee'`:** exam-fee invoices are ALSO `type:'fee'` **with**
   > `studentId`+`semesterId` (`academics/service.ts:2931-2943`,
   > `fee-lifecycle-service.ts:643-655`). Keying on `type:'fee'` would match an
   > exam invoice → wrongly report `already-billed` → never bill tuition, never
   > credit balance. We add a **positive** boolean `isSemesterInstallment` to the
   > `Invoice` model and key on it. (Partial indexes forbid `$exists:false`, so a
   > negative discriminator is impossible — must be positive.)
5. **Amount:** `annual = pin.snapshotTotalAmount ?? fsi.totalAmount` — `snapshotTotalAmount`
   is optional (undefined on legacy pins). If **both** are absent/0 →
   `{ kind: 'skipped', reason: 'no-amount' }`. **Never bill 0.**
   `first = Math.floor(annual / SEMESTER_INSTALLMENTS_PER_YEAR)`; this semester's
   installment = `semester.number === 1 ? first : annual − first`. Both invoices
   read the **same** `annual` (frozen pin) so the two independent generations sum to
   `annual` **exactly** — the split key is `semester.number` from step 2, which is
   why it must be loaded there.
6. If `dryRun` → return `{ kind:'generated', amount: installment, yearAssumed, derivedFrom }` **without writing**.
7. **Write with compensating rollback (G2-H2 — no transactions on this harness):**
   ```
   const invoice = await Invoice.create({ ...isSemesterInstallment:true, type:'fee',
       status:'generated', studentId, semesterId, totalAmount:installment,
       netPayable:installment, dueDate:+30d, invoiceNumber, items:<from snapshot> });
   try {
     for (comp of snapshotComponents) await InvoiceLineItem.create({ ... scaled,
         remainder→largest component so lines sum EXACTLY to installment ... sourcePinId:pin._id });
     await StudentFeeAccount.findOneAndUpdate({collegeId,studentId},
         { $inc:{ totalDue:installment, balance:installment } }, { upsert:true });
   } catch (e) {
     await InvoiceLineItem.deleteMany({ collegeId, invoiceId: invoice._id });
     await Invoice.deleteOne({ _id: invoice._id, collegeId });   // compensate → re-run retries clean
     return { kind:'error', studentId, error:String(e) };
   }
   ```
   Without this, a failure after `Invoice.create` leaves the balance un-credited and
   the step-4 `findOne` skip **cements** it — a re-run sees the invoice and reports
   `already-billed`, so it can never self-heal. Mirrors the 006 commit compensation.
   > v1 does **not** prorate scholarships/concessions into the installment
   > (demo students have none); full scholarship handling stays in the
   > enrolment-driven `generateSemesterInvoice`. See §9.
8. `createAuditLog(... entityType:'Invoice', action:'create' ...)`.
9. Return `{ kind:'generated', invoiceId, amount: installment, yearAssumed, derivedFrom }`.

**`generateSemesterInstallmentsForPinned(collegeId, { semesterId, studentIds?, yearOfStudy?, dryRun? }, performedBy)`**
- Load semester → `academicYearId`.
- Candidate set:
  - If `studentIds` given → those (individual / selected-rows path).
  - Else `Student.find({ collegeId, status:'active', feePins: { $elemMatch: { archivedAt: null } } })`
    (mirrors the coverage query pattern in `fee-pin-audit-service.ts:152-239`).
- For each candidate call `generateSemesterInstallmentForStudent(..., { dryRun })`,
  honouring the optional `yearOfStudy` filter (skip if resolved year ≠ filter).
- Aggregate → `{ dryRun, generated, alreadyBilled, noPin, pinnedToDifferentAy, noAmount, unsupportedSemesterNumber, errors: [{studentId, error}] }`.
- Concurrency: sequential loop (matches `generateBatchInvoices` style; demo scale is small).

### 4.2 `Payment` model — `backend/src/models/finance/Payment.ts`
- Add optional `invoiceId?: Schema.Types.ObjectId` (`ref: 'Invoice'`). Backward
  compatible (existing payments have none). Add index `{ collegeId, invoiceId }`.

### 4.3 `createPayment` — `backend/src/modules/finance/service.ts:269`
- `assertStudentFeeGuardianReady` stays (existence check now unconditional; only the
  guardian *requirement* is flag-gated — §4.5).
- Status is no longer client-settable (stripped from the schema, §4.4), so every
  payment persists as the model default `'success'`. The guard/apply below therefore
  key on `invoiceId` presence, not on a client-sent status.
- **Overpayment guard (before writing):** if `data.invoiceId`, load
  `Invoice.findOne({ _id: data.invoiceId, collegeId, studentId: data.studentId })`
  (400 if not found / mismatched). Compute `paidSoFar = Σ Payment.find({ collegeId,
  invoiceId, status:'success' }).amount`; `net = invoice.netPayable ?? invoice.totalAmount`;
  if `data.amount > net − paidSoFar` → throw
  `AppError(400, 'Payment exceeds the invoice's remaining balance')`.
- Create the `Payment` (unchanged), now including `invoiceId`.
- **Apply to invoice + account — when `invoiceId` present** (status is always `success`):
  - `paidNow = paidSoFar + doc.amount`; `invoice.status = paidNow >= net ? 'paid' : 'partially_paid'`; `invoice.save()`.
  - `StudentFeeAccount.findOneAndUpdate({ collegeId, studentId }, { $inc: { totalPaid: +amount, balance: -amount }, $set: { lastPaymentDate: paymentDate } }, { upsert: true })`.
- Leave the existing `allocations[]`→`FeeLineItem` block (`:283-296`) untouched (backward compat; unused by the demo).
- Audit log unchanged.

### 4.3a Close the desync vectors (removing the UI is not enough)
Removing the FE status controls closes the *convenient* path, not the *vector* —
`status` rides `createPaymentSchema` → PUT via `.partial()`, and `deletePayment`
is wide open and **does not reverse the balance** (`service.ts:308` — verified:
`findOneAndDelete` + audit only). So:
- **Strip `status` from `createPaymentSchema`** → the model default `'success'`
  (`Payment.ts:20`) becomes the only reachable value. Since `updatePaymentSchema =
  createPaymentSchema.partial()`, this also removes `status` from PUT.
- **Lock `updatePayment` to non-financial fields** (`remarks`, `transactionRef`).
  Reject/strip `amount`, `invoiceId`, `status` — a PUT must not be able to desync AR.
- **Make `deletePayment` reverse + recompute + audit** (the real correction path;
  operators fat-finger counter entries and *will* reach for delete):
  - If the deleted payment had `status:'success'` + `invoiceId`: `$inc`
    `StudentFeeAccount { totalPaid: −amount, balance: +amount }`; recompute the
    invoice status from the remaining successful payments (`paid`→`partially_paid`→
    `generated`); write an audit entry recording the reversal.
  - Bare payment (no `invoiceId`) → delete as today (nothing to reverse).

### 4.4 Payment schemas — `validation.ts:60` (G2-M4)
- `createPaymentSchema`: add `invoiceId: z.string().optional()`; **remove `status`**
  (§4.3a) so the model default `'success'` is the only reachable value.
- **`updatePaymentSchema` must be a standalone `.strict()` schema of ONLY
  `{ remarks?, transactionRef? }` — NOT `createPaymentSchema.partial()`.** As a
  partial-of-create it would still accept `amount`/`invoiceId` (and, before the strip,
  `status`), and `updatePayment` does a raw `findOneAndUpdate` (`service.ts:301`) with
  no recompute → AR desync via PUT. Standalone-strict closes it at the schema.

### 4.5 Guardian gate flag — `service.ts:51` (G2-M1 — keep existence check unconditional)
```
export async function assertStudentFeeGuardianReady(collegeId, studentId?) {
  if (!studentId) return;
  // Existence + college-match ALWAYS runs — even with enforcement off — or a
  // college-A caller could write finance records referencing a college-B studentId
  // (orphan rows, cross-tenant AR noise). G2-M1.
  const student = await Student.findOne({ _id: studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');
  // DEMO CHOICE (2026-07): only the GUARDIAN requirement is flag-gated OFF, so
  // bulk-imported students can be billed/paid without a linked fee guardian. The
  // guard exists because production finance needs a payer-of-record (receipts,
  // dunning, refunds). RE-ENABLE: FINANCE_ENFORCE_FEE_GUARDIAN=true.
  if (process.env.FINANCE_ENFORCE_FEE_GUARDIAN !== 'true') return;
  if (!student.feeResponsibleParentId) throw new AppError(400, 'Fee responsible guardian is required ...');
}
```
Add `FINANCE_ENFORCE_FEE_GUARDIAN` to `.env.example` + the CLAUDE.md env table.

### 4.6 Dashboard AR → net receivable — `fee-analytics-service.ts:getDashboard`
- **Replace** `outstandingPipeline` (`:254-258`) with an aggregation over
  `StudentFeeAccount`: `$match { collegeId: collegeObjId }` — **use the cast
  `collegeObjId` (`new mongoose.Types.ObjectId`), NOT the raw string** (`aggregate()`
  does not auto-cast; the documented trap at `:87-91` — a raw string silently matches
  nothing → AR returns 0). G2-M5. Then join `students` for `programmeScope`,
  `$group { _id:null, due: { $sum: '$balance' } }`. → `totalOutstanding` = net AR.
- **Replace** the `dueByProgramme` `due` source (`:344-385`): join
  `StudentFeeAccount → Student → Programme` (same `collegeObjId` cast), `due: { $sum: '$balance' }`;
  keep the `collected` half (Payment) as-is (`:389-411`). Merge as today.
- Leave `collectedInRange`, `collectionTimeSeries`, `paymentModeBreakdown`,
  `funnelByStage`, overdue (DefaulterRecord), and `dueVsCollectedByMonth` unchanged.
  > `dueVsCollectedByMonth` stays invoice-issuance based — it's a trend, not the AR total.
- **AR aging is out of scope (NICE-TO-HAVE).** Add a comment block where
  `overdue`/AR is computed noting aging buckets (0–30/30–60/60–90/90+) as a
  fast-follow (see §9).
- Update the existing analytics unit tests to the net-balance expectation (§8).
- **Net AR trusts `balance`, not invoices** — two consequences to state in code:
  1. `StudentFeeAccount` has **many** writers besides ours — admissions
     (`workflow.handlers.ts:1183`), seed (`seed.ts:1114`), nine `$inc` sites in
     `fee-lifecycle-service.ts` (waiver/refund/bounce/…), and the generic REST
     (`updateStudentFeeAccount` can set `totalDue` without recomputing `balance`).
     The **invariant** (§4.9) guards against *these*, which is its real value.
  2. Dues that exist only as an `Invoice` — e.g. one created via the dumb generic
     `POST /invoices` (`service.ts:504`, `Invoice.create({...data})`), which never
     credits `balance` — are **invisible** to net AR. Fine because our flow never
     bills that way; state it so nobody bills via CRUD and wonders why AR is flat.

### 4.7a `Invoice` model discriminator — `backend/src/models/finance/Invoice.ts` (G2-C1)
- Add `isSemesterInstallment?: boolean` (default undefined). Our generator sets it
  `true`; nothing else does. This is the positive discriminator that separates our
  tuition-installment invoices from the co-resident **exam-fee** `type:'fee'` invoices
  (`academics/service.ts:2931-2943`, `fee-lifecycle-service.ts:643-655`) which also
  carry `studentId`+`semesterId`.

### 4.8 Idempotency — partial unique index on `Invoice` (G2-C1)
`backend/src/models/finance/Invoice.ts`:
```
schema.index(
  { collegeId: 1, studentId: 1, semesterId: 1 },
  { unique: true,
    partialFilterExpression: {
      isSemesterInstallment: true,          // NOT type:'fee' — exam invoices share that
      studentId: { $type: 'objectId' },
      semesterId: { $type: 'objectId' },
    } },
);
```
- **Keyed on `isSemesterInstallment:true`, not `type:'fee'`** — otherwise the index
  E11000s the legitimate tuition-installment + exam-fee-same-semester pair, and the
  app-level `findOne` (§4.1 step 4) matches an exam invoice and wrongly skips tuition.
  (Partial filters forbid `$exists:false`, so a negative discriminator is impossible —
  the marker must be positive.)
- The `$type:'objectId'` guards stay: they keep any legacy/foreign row that somehow
  set the flag without both ids from collapsing to `{collegeId,null,null}` (the T0
  rollNumber trap).
- **Pre-check existing data before adding** (`Invoice.aggregate` for existing
  `(collegeId, studentId, semesterId)` dupes among `isSemesterInstallment:true`) — the
  build fails on pre-existing violations. Fresh DBs have none.
- **Deploy note (same class as `fix-student-rollnumber-index.ts`):** Mongoose won't
  alter an existing index — ship a small idempotent migration script.

### 4.9 Balance invariant (guard rail + test) — G2-H1
Add a check (unit + a `scripts/` verifier) asserting, **scoped to students the 007
flow touched** (those with an `isSemesterInstallment:true` invoice), that
`balance == totalDue − totalPaid − totalWaived **+** totalRefunded` — the `+` matches
the actual refund writer (`fee-lifecycle-service.ts:1516` does `totalRefunded += X` and
`balance += X`). A `−totalRefunded` invariant would false-flag every refunded student
by 2×refund. **Do not run it over all accounts** — seeded/admissions accounts carry
balances our formula never produced and would fail immediately (fixture noise).

### 4.7 Routes + controller — `routes.ts`, `controller.ts`
- New controller `generateFeeBillsCtrl` → `feeBillingService.generateSemesterInstallmentsForPinned(req.collegeId!, req.body, who(req))`.
- New route (place with the invoice routes, ~`routes.ts:314`):
  `router.post('/invoices/generate-from-pins', authorize('finance','create'), validate(generateFeeBillsSchema), ctrl.generateFeeBillsCtrl);`
- **RBAC grain (G2-M3 — decided):** gate at **`finance:create`** for parity with every
  existing invoice-generation route (`routes.ts:314-317, 575-577` are all `finance:create`).
  This is *below* bulk-pin's `finance:approve` (`routes.ts:656`) — a conscious choice:
  generating a bill is an invoice-create op, consistent with its siblings; bulk-pin's
  `approve` is a separate pinning precedent. If the business wants batch billing gated
  higher, bump to `finance:approve` — a one-line change. (No demo impact: run as **admin**.)
- `generateFeeBillsSchema` (validation.ts): `{ semesterId: string.min(1), studentIds: string[].optional(), yearOfStudy: number.int().min(1).max(8).optional(), dryRun: boolean.optional() }`.
- **Route-collision note:** `/payments/counter`, `/payments/:id/match`,
  `/payments/:id/bounce` are each registered twice (`routes.ts:265-269` and
  `:583-588`). Not touched here, but flagged — do not add the new route in a way
  that shadows. (Follow-up cleanup ticket.)

---

## 5. Frontend changes

### 5.1 `admin-portal/src/services/finance.ts`
- Add `generateFeeBills = (body) => api.post('/finance/invoices/generate-from-pins', body).then(r=>r.data)`.
- Reuse `listInvoices(page, limit, status?, studentId?)` (`:109`) to fetch a
  student's invoices for the payment allocation dropdown; filter client-side to
  open statuses (`!== 'paid' | 'cancelled' | 'written_off'`) and sort oldest-first.

### 5.2 Semester list service (verify-or-add)
- The payment/bills screens need semesters. **Verify** whether an FE semester
  service exists (SemestersPage.tsx implies one). If not, add
  `listSemesters = () => api.get('/academics/semesters', { params:{ limit:200 } })`
  in the academics service. (Do not assume; confirm the file first.)

### 5.3 `admin-portal/src/pages/finance/PaymentsPage.tsx`
- **Remove the status controls entirely** (not just re-default): drop `status` from
  `emptyForm` (`:24`), the status `<select>` (`:222`), and the inline
  Mark-success/failed/Reverse/Retry row buttons (`:100-119`) + `quickTransition`/`quickUpdateMut`.
  Every recorded payment is `success` (model default). This deletes edge cases #8/#9
  at the UI, matched by the schema strip in §4.3a at the API.
- **Invoice allocation:** add `invoiceId:''` to `emptyForm`; add a modal `<select>`
  fed by a new `useQuery(['open-invoices', form.studentId], () => listInvoices(1,50,undefined,form.studentId))`
  filtered to open invoices; **default-select the oldest unpaid**, operator can pick
  another or leave "(no invoice)". Include `invoiceId` in `payload` (strip if empty).
  Optionally show the selected invoice's remaining balance to prevent overpayment before submit.
- **Guardian block behind flag:** gate the `financeBlocked` term of the submit
  `disabled` (`:238`) on a flag (`import.meta.env.VITE_FINANCE_ENFORCE_FEE_GUARDIAN === 'true'`,
  wrapped in `admin-portal/src/config/flags.ts`). Keep `StudentFinanceReadinessCard`
  rendering as advisory. Same comment as the backend, so both re-enable together.

### 5.4 New page — `admin-portal/src/pages/finance/GenerateBillsPage.tsx`
- Modeled on `PinCoveragePage.tsx` + the `bulkPin` dry-run→confirm pattern
  (`pin-coverage.ts:87-115`). Controls: **Semester** select (from §5.2), optional
  **Year** filter. "Preview" → `generateFeeBills({ semesterId, yearOfStudy?, dryRun:true })`
  → show projected counts in a `confirmAction` dialog → "Generate" → real call →
  toast summary `{ generated, alreadyBilled, noPin, pinnedToDifferentAy, noAmount, errors }`
  (surface `yearAssumed`/`derivedFrom` on rows so an admission-year fallback is visible).
- Reuse `getPinCoverage` (`pin-coverage.ts:71`) to list pinned students with a
  per-row "Generate bill" (`studentIds:[id]`) and a "Generate all". Permission gate
  `hasPermission('finance','create')`.
- Register in `FeeManagementPage.tsx`: import the page (~`:27`), add a `TABS` entry
  (`{ to:'/finance/fee-management/generate-bills', label:'Generate Bills' }`, ~`:40`),
  add `<Route path="generate-bills" element={<GenerateBillsPage/>} />` (~`:66`).

### 5.5 `FeeDashboardPage.tsx`
- **No data change needed** — it already reads `getDashboard`; AR lights up once §4.6
  lands. Optional: relabel the "Pending" pill (`:2715`) → "Outstanding (AR)".

---

## 6. Setup / prerequisites (not build tasks, but required to demo)
- Ensure the demo college's current `AcademicYear.isCurrent = true` and its **2
  Semester rows exist** (dev seed already does; for the **e2e** college extend
  `seedE2EAcademicYear()` in `seed-e2e-users.ts:53` to also upsert 2 semesters if
  e2e coverage is added).
- Leave `FINANCE_ENFORCE_FEE_GUARDIAN` unset (off) for the demo env.
- The demo import CSV can stay minimal (guardian columns optional with the flag off).
- **Persona hand-off (G2-M2 — corrected):** import runs as the **Registrar**
  (`people`); Generate-Bills and Payments are **`finance:create`** → **admin or ST-ACC**
  (**NOT principal** — principal holds only `finance:approve`+`read`, `defaults.ts:16,20`,
  so it would 403 on both); Pin-Coverage's Pin-now / bulk-pin is **`finance:approve`**
  (`routes.ts:656`). Simplest demo: run billing + payments as **admin** (holds the `*:*`
  wildcard). The demo script must switch personas or the wrong role 403s on the billing screen.

---

## 7. Edge cases
1. **Re-run generation** → idempotent skip per `(student, semester)` — app `findOne` + unique index (§4.4, §4.8).
2. **Student with no active pin for the resolved year** → skipped `no-active-pin`.
3. **Batch-less imported student** → `resolvePinYearForExistingStudent` falls back to admission year (`derivedFrom:'admission'`); never `year-unresolvable`. Surfaced on the row.
4. **Pin is for a different academic year than the chosen semester** → skipped `pinned-to-different-ay` (the (b) guard) — billed loudly, not silently.
5. **No amount** (`snapshotTotalAmount` and `fsi.totalAmount` both absent/0) → skipped `no-amount`. **Never bill 0.**
6. **Odd annual total** (₹90,001) → `first=floor(annual/2)`, `second=annual−first` → sums exactly. Line items: remainder to the largest component. No ±₹1.
7. **Same-AY divergent pins** (Year-1 import pin + Year-3 update pin, same AY — see below) → selecting **by year** (a) picks the right one unambiguously; (b) alone could not.
8. **Payment > invoice remaining** → 400 (AC-2.3), before any write.
9. **Payment with no `invoiceId`** → bare `Payment` (AC-2.4); does not move AR (apply only when `invoiceId` present, so no negative-balance upsert).
10. **Delete a settled payment** → reverses `StudentFeeAccount` + recomputes invoice status + audits (§4.3a). The correction path.
11. **PUT on a payment** → limited to `remarks`/`transactionRef`; cannot change `amount`/`status`/`invoiceId` (§4.3a).
12. **Two payments covering an invoice** → second flips to `paid`; a third overpaying is rejected (#8).
13. **Programme-scoped viewer (HOD)** → net-AR pipelines apply `programmeScope` via the Student join, same as today.
14. **Multi-semester** → a student billed Sem-1 + Sem-2 has two invoices; payment defaults to the **oldest unpaid** (Sem-1 first).

> **Pre-existing issue this feature must live with (NOT 007's to fix):** two pin
> paths can create pins at **different years within the same AY** — import at
> `resolvePinYearOfStudy` (blank→1), the update path at
> `resolveYearOfStudyForStalePinCheck` (calendar). A student admitted two years ago,
> imported with `studyYearAtAdmission` blank, then fee-axis-edited, holds a Year-1
> **and** a Year-3 pin, same AY. 007 is robust to it (select by year), but the stale
> Year-1 pin is a data-hygiene bug worth its own ticket — flag it, don't silently
> absorb it.

---

## 8. Task breakdown (TDD-ordered, each commit-shaped)
- **T1** Model fields: `Payment.invoiceId` (+ `{collegeId,invoiceId}` index) **and**
  `Invoice.isSemesterInstallment` (§4.7a); unit: models accept/omit them.
- **T2** `Invoice` partial unique index keyed on `isSemesterInstallment:true` (§4.8,
  `$type:'objectId'` guards) + idempotent migration script (mirror
  `fix-student-rollnumber-index.ts`) + pre-check for existing violators. (unit)
- **T3** `fee-billing-service.generateSemesterInstallmentForStudent` — pin selection by
  year via `resolvePinYearForExistingStudent`, (b) AY guard, `isSemesterInstallment`
  idempotency (NOT `type:'fee'`), floor+remainder split via `semester.number`,
  **compensating rollback** (§4.1 step 7), all skip/error outcomes, `StudentFeeAccount`
  credit, dry-run writes nothing. (unit — include an exam-fee-invoice-present case proving
  it still bills tuition; and a mid-write-failure case proving no orphan invoice/balance.)
- **T4** `generateSemesterInstallmentsForPinned` — candidate query, outcome aggregation,
  `studentIds`/`yearOfStudy` filters, dry-run. (unit)
- **T5** route + controller + `generateFeeBillsSchema`; integration: `POST /invoices/generate-from-pins` (dry-run + real), `finance:create` gate.
- **T6** Payment schemas + desync closure **(ship together — G2-M4):** add
  `createPaymentSchema.invoiceId`, **strip `status`**, make **`updatePaymentSchema`
  standalone `.strict()` `{remarks,transactionRef}`**, and **reversing `deletePayment`**
  (reverse balance + recompute invoice + audit). (unit + integration)
- **T7** `createPayment` invoice application — partial→`partially_paid`, full→`paid`,
  balance decrement, overpayment 400, bare-payment still works. Depends on T6 (schema
  must carry `invoiceId` first). (unit + integration)
- **T8** Guardian flag on `assertStudentFeeGuardianReady` — **existence check
  unconditional (G2-M1)**, guardian requirement flag-gated; enforced when on, bypassed
  when off. (unit) + `.env.example` + CLAUDE.md.
- **T9** Analytics net AR — `totalOutstanding` + `dueByProgramme` from
  `StudentFeeAccount.balance` with the **`collegeObjId` cast (G2-M5)**; **update analytics
  tests — fixtures must now CREATE `StudentFeeAccount` rows** (they seed Invoice-only
  today and assert `totalOutstanding>0`, which would break — G2-arch). (unit)
- **T10** Balance invariant (§4.9, `+totalRefunded`) — unit + `scripts/` verifier, **scoped to `isSemesterInstallment` students**.
- **T11** FE `finance.ts` (`generateFeeBills`, open-invoice fetch) + flags config + semester service (verify/add).
- **T12** FE `PaymentsPage` — remove status controls, invoice select (default oldest unpaid), guardian flag. (component test: payload has `invoiceId`, no `status`)
- **T13** FE `GenerateBillsPage` + tab wiring; dry-run→confirm. (component test)
- **T14** Manual QA pass of the full flow; optional single e2e happy-path (generate → pay → AR drops). *(e2e optional given the quarantined-spec history; lean on unit/integration + manual.)*

## 9. Decisions & explicit non-goals (NICE-TO-HAVE, later)
- **Installment split** = equal halves via `SEMESTER_INSTALLMENTS_PER_YEAR=2`, `floor + remainder`
  so both halves sum exactly. Later: derive per programme/regulation; component-level split.
- **Payment correction path** = **reversing delete** (§4.3a). Status is not editable
  (stripped from schema); the `pending/failed/reversed` state machine is out of scope
  until the `PaymentTransaction`/gateway work (Seam B).
- **AR aging buckets** (0–30/30–60/60–90/90+) — commented as nice-to-have; not built.
- **Scholarship/concession proration** per installment — deferred; full handling
  remains in the enrolment-driven `generateSemesterInvoice`.
- **Printable receipt PDF**, **payment gateway**, **student self-service portal** — out of scope.
- **Route-collision cleanup** (`/payments/counter` etc. double-registered) — follow-up ticket.
- **Same-AY divergent pins** (§7) — pre-existing; separate hygiene ticket, not 007.
- **Guardian gate** kept, feature-flagged OFF for demo; flip `FINANCE_ENFORCE_FEE_GUARDIAN=true` for real colleges.
```
