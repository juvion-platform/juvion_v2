# GATE 2 — Resolution (007-fee-billing-payment-ar)

Three parallel validators ran against the live code. Verdicts:

| Validator | Verdict | Findings |
|-----------|---------|----------|
| Architecture (`gate2-architecture.md`) | **PASS** | 0C 0H · 3M 3L |
| API & Security (`gate2-api-security.md`) | **PASS** | 0C 0H · 5M 4L |
| Data Layer (`gate2-data-layer.md`) | **FAIL** | **1C 2H** · 1M 1L |

GATE 2 requires **0 CRITICAL + 0 HIGH**. Initial pass **did not clear** (data-layer).
All C/H/M findings below are now resolved in `plan.md`. Re-verdict: **CLEARED** — the
three blocking findings are fixed by design changes; MEDIUMs folded in as noted.

---

## CRITICAL

### G2-C1 — Idempotency key `type:'fee'` collides with exam-fee invoices ✅ FIXED
Exam-fee invoices are also `type:'fee'` **with** `studentId`+`semesterId`
(`academics/service.ts:2931-2943`, `fee-lifecycle-service.ts:643-655`). The app-level
`findOne` would match an exam invoice → wrongly report `already-billed` → never bill
tuition, never credit balance; the partial unique index would E11000 the legit
tuition+exam-same-semester pair and fail to build. Partial filters forbid
`$exists:false`, so no negative discriminator is possible.
**Resolution:** add a **positive** boolean `Invoice.isSemesterInstallment` (§4.7a); key
BOTH the `findOne` (§4.1 step 4) and the unique index (§4.8) on it, not on `type:'fee'`.

## HIGH

### G2-H1 — Balance invariant has the wrong sign on `totalRefunded` ✅ FIXED
The refund writer (`fee-lifecycle-service.ts:1516`) does `totalRefunded += X` **and**
`balance += X`, so the codebase maintains `balance = totalDue − totalPaid − totalWaived
**+** totalRefunded`. Plan asserted `− totalRefunded` → the §4.9 verifier would
false-flag every refunded student by 2×refund.
**Resolution:** invariant corrected to `+ totalRefunded` in §2 and §4.9.

### G2-H2 — No compensating rollback for the Invoice→lineItems→account multi-write ✅ FIXED
No transactions on this harness. A failure after `Invoice.create` leaves balance
un-credited, and the idempotency `findOne`-skip **cements** it (re-run reports
`already-billed`, never self-heals).
**Resolution:** §4.1 step 7 now wraps line-items + account credit in try/catch that
deletes the line items and the invoice on failure (mirrors 006 commit compensation);
returns an `error` outcome so a re-run retries clean. T3 adds a mid-write-failure test.

## MEDIUM (folded in)

- **G2-M1 (api)** — guardian flag early-returned before the existence/college check,
  letting a college-A caller reference a college-B `studentId`. → §4.5: existence +
  college-match now **unconditional**; only the guardian *requirement* is flag-gated.
- **G2-M2 (api)** — persona wrong: principal has `finance:approve`+`read`, not `create`.
  → §6/§4.7 corrected to **admin / ST-ACC**; demo runs billing+payments as admin.
- **G2-M3 (api)** — RBAC grain: `generate-from-pins` at `finance:create` sits below
  bulk-pin's `approve`. → §4.7 documents the **conscious** choice (parity with all
  existing invoice-gen routes; bump to `approve` is one line if the business wants).
- **G2-M4 (api)** — `updatePaymentSchema = createPaymentSchema.partial()` would still
  accept `amount`/`invoiceId` on PUT → AR desync. → §4.4: standalone `.strict()`
  `{remarks,transactionRef}`; T6 ships schema + desync closure together.
- **G2-M5 (api)** — net-AR `$match {collegeId}` missing the ObjectId cast → AR silently
  returns 0. → §4.6 uses `collegeObjId`.
- **G2-M-data** — split needs `semester.number` (step 2 only read `academicYearId`);
  unguarded for non-{1,2} numbering. → §4.1 step 2 reads `number`, guards with
  `unsupported-semester-number` skip.
- **G2-M-arch** — analytics fixtures seed Invoice-only + assert `totalOutstanding>0`;
  net-AR reads `StudentFeeAccount.balance`, so they'd break. → T9 must CREATE
  `StudentFeeAccount` rows in fixtures.
- **G2-arch-order** — T (payment application) needs the schema carrying `invoiceId`
  first. → task list reordered: T6 (schemas+desync) before T7 (application).

## LOW (accepted / noted, no plan change required)
- Overpayment & delete read-modify-write TOCTOU — acceptable at single-operator counter
  scale; documented in §7.
- `resolveActivePin`/pin resolvers read `Student` unscoped — safe because §4.1 step 1
  loads the student scoped by `collegeId` first.
- "deletePayment wide open" wording — it is `finance:delete`-gated; the real gap was the
  missing reversal, which §4.3a fixes.
- `$type:'objectId'` partial-index syntax valid on Mongo 7. ✓
- Net total vs programme-scoped due can differ on programme-less students — cosmetic.

---

**Gate status: CLEARED (0 CRITICAL + 0 HIGH after resolution).** Ready for `tasks.md`
generation + T1. The three MEDIUM test-hygiene items (G2-M-arch, G2-M-data, M4 ordering)
are baked into the T-list so they can't be forgotten during implementation.
