# GATE-2 — Architecture Validator Report

**Spec:** 007-fee-billing-payment-ar
**Plan:** `.sdd/specs/007-fee-billing-payment-ar/plan.md`
**Validator role:** Architecture / design-fit
**Baseline:** `main` @ 105579f
**Verdict:** **PASS** (0 CRITICAL, 0 HIGH)

All load-bearing claims in the plan were verified against the live codebase at
file:line. The design is sound, scoped, and fits existing patterns. Findings
below are MEDIUM and lower — advisory hardening, not blockers.

---

## Scrutiny 1 — Three invoice generators. Is the third justified?

**Verified.** The plan's stated reason for not reusing
`generateSemesterInvoice` holds up on reading it:

- `fee-lifecycle-service.ts:454-471` — **lazy-pin side effect**: on a pin miss it
  *writes a pin* (`feePinService.pinYear(..., 'system:invoice-lazy')`). A bill-
  generator must not mutate pin state.
- `fee-lifecycle-service.ts:442-452` — **caller-supplied FSI fallback**
  (`data.feeStructureInstanceId`), a parameter the pin-driven flow has no source
  for.
- `fee-lifecycle-service.ts:526-542` — bills the **full annual** `grossTotal`
  with **no ÷2 installment** and **no idempotency guard** (a second call to the
  same student/semester double-bills; there is no `findOne` pre-check and no
  unique index today).
- `fee-lifecycle-service.ts:510-527` — inline scholarship/concession netting the
  demo explicitly defers.

Bending `generateSemesterInvoice` to the new contract would mean ripping out
lazy-pin, the FSI fallback, and annual amount, plus adding idempotency — a
riskier diff against a function that has a dedicated test
(`generate-semester-invoice-pin.test.ts:37` imports it). A separate
`fee-billing-service.ts` that **reuses the shared primitives** (`resolveActivePin`
`fee-pin-service.ts:487`, `resolveStudentYearOfStudy`
`resolve-year-of-study.ts:92`, `Invoice`/`InvoiceLineItem`/`StudentFeeAccount`,
`createAuditLog`) is the lower-risk call. **The third generator is justified.**

Drift risk is real but adequately mitigated: the plan reuses the resolver
helpers rather than re-deriving year-of-study, so the two generators stay
behaviourally aligned on pin selection. See MEDIUM-1 for the residual concern.

## Scrutiny 2 — Two payment rails. Is the dashboard read consistent?

**Verified consistent.** The plan enriches `service.ts:269 createPayment`
(writes `Payment`, `fee-analytics-service.ts` reads `Payment`), **not** the
`PaymentTransaction` rail:

- `fee-analytics-service.ts:261-271` (`collectedPipeline`) and `:340`
  (`paymentModeBreakdown`), `:410` (collected-by-programme), `:322`
  (time series) all read `Payment` with `status:'success'`.
- `service.ts:92-95 getStats.totalCollected` also reads `Payment.status:'success'`.

So "Collected" and the balance-decrementing write are on the **same rail**.
`applyPaymentToInvoice` (`PaymentTransaction`) is untouched. No third divergent
path is introduced. **Consistent.**

## Scrutiny 3 — Regression risk

**getDashboard consumers** — only `fee-analytics-controller.ts:79` (the HTTP
route) and the two test files consume it. `FeeDashboardPage.tsx:2457/2465`
consumes the payload shape, which is unchanged (still `DashboardV1`,
`totalOutstanding`/`dueByProgramme` fields preserved). No structural break.

**Existing analytics tests will break by value — see MEDIUM-2.** The unit
fixtures seed `Invoice` + `Payment` only, no `StudentFeeAccount`
(`fee-analytics-service.test.ts:97-131, 476-495, 796`), and assert
`totalOutstanding > 0` (`:202, :835`) and `dueByProgramme` CSE present
(`:219-220`). Under §4.6 (AR from `StudentFeeAccount.balance`) those fixtures
produce **0**, failing the assertions. The plan **acknowledges** this (T10 "update
existing analytics tests") — hence not a blocker — but T10 under-states the work:
the fixtures must **add `StudentFeeAccount` rows**, not just tweak expected
numbers.

The HTTP e2e (`fee-analytics-http.e2e.test.ts:151-180`) asserts only property
**existence** on `totalOutstanding` (not its value) plus `collectedInRange`/funnel
— **survives** §4.6 unchanged.

**Removing `status` from `createPaymentSchema`** — verified safe:
- `validation.ts:71` is `status: z.enum(['success','pending','failed','reversed']).optional()`;
  `updatePaymentSchema = createPaymentSchema.partial()` (`:75`) so the strip
  removes it from PUT too, as claimed.
- Payment model default is `'success'` (`Payment.ts:18`), so the HTTP path
  degrades cleanly.
- The status-passing unit tests (`service-money-paths.test.ts:326,330`) use
  `Payment.create(...)` **directly** (not `service.createPayment`, not the Zod
  schema) and assert on `getStats` — **unaffected** by the schema strip. No test
  breaks here.
- Caveat: the strip only closes the **HTTP** vector; `service.createPayment`
  spreads `...data` (`service.ts:277`) and still honours a service-level `status`.
  The plan's phrasing "the only reachable value" is true for the API surface, not
  the service layer. Fine for the demo (no internal caller sets a non-success
  status on this function), worth a one-line accuracy note. LOW-1.

**Reversing `deletePayment`** — verified the current impl is
`findOneAndDelete` + audit only (`service.ts:308-313`), no balance reversal, as
the plan states. No existing test exercises `deletePayment` (grep found none in
finance tests), so adding reversal breaks nothing. Sound.

## Scrutiny 4 — Not breaking the tested enrolment path

**Verified.** `generate-semester-invoice-pin.test.ts:37` imports
`generateSemesterInvoice` from `fee-lifecycle-service`. The plan's new module
lives in `fee-billing-service.ts` and §4.1 explicitly does **not** modify
`generateSemesterInvoice`. The ~30-line duplication (invoice + line-item +
account `$inc`, cf. `fee-lifecycle-service.ts:529-566`) is acceptable: the two
diverge on amount (installment vs annual), idempotency, and scholarship handling,
so a shared helper would need three flags and reintroduce coupling to the tested
function. Standalone is the lazier *and* safer choice here.

## Scrutiny 5 — FE pattern fit

- **Semester service already exists** — `academics.ts:93 listSemesters(page, limit, academicYearId?, search?)`.
  §5.2's "verify-or-add" resolves to **reuse**; do not add a duplicate. The plan's
  proposed `listSemesters = () => ...{limit:200}` should be dropped in favour of
  the existing signature (`listSemesters(1, 200)`). LOW-2.
- **`FeeManagementPage.tsx`** — `TABS` at `:28`, page imports at `:15-26`, route
  block at `:55-66`. The plan's insertion points (~:27 import, ~:40 TABS, ~:66
  Route) are accurate. Fits.
- **`pin-coverage.ts`** — `getPinCoverage:71`, `BulkPinResult.dryRun:90`
  dry-run→confirm pattern exists as cited. `GenerateBillsPage` modelled on it fits.
- Both "verify-at-impl" flags (FE semester service, TABS insertion) are now
  resolved: semester service exists; TABS insertion is valid.

## Scrutiny 6 — Scope discipline

**Setup prerequisites present** (§6): current AY + 2 semesters (dev seed does
this), `FINANCE_ENFORCE_FEE_GUARDIAN` off. **Persona hand-off documented and
verified** — bulk-pin/pin-now gate is `authorize('finance','approve')`
(`routes.ts:656`), narrower than the `finance:create` billing screen, which is
narrower than the Registrar's `people`. The plan's three-persona note is correct
and demo-critical.

Two items sit slightly outside the strict "5-flow demo" line but are
**defensibly** pulled in as correctness hardening once AR trusts `balance`:
- **Reversing `deletePayment` + locked `updatePayment` (§4.3a)** — not one of the
  five flows, but leaving `deletePayment`/PUT able to silently desync
  `StudentFeeAccount.balance` after §4.6 makes the dashboard trust that field is a
  real hole an operator reaches for. Keeping it is the right call; flagged only so
  reviewers know it's deliberate scope, not creep. LOW-3.

Nothing material is **missing** for the demo.

## Scrutiny 7 — Task ordering (§8)

Mostly correct (T1 field → T6 usage; T2 index → T3/T5; T3 → T4 → T5). One
ordering wrinkle — **MEDIUM-3**: T6 ("createPayment invoice application", unit +
**integration**) precedes T8 ("`createPaymentSchema.invoiceId`"). The T6
**integration** test posts to `POST /api/finance/payments` with `invoiceId`,
which the Zod schema rejects until T8 lands (`invoiceId` not yet in the schema).
The T6 *unit* half is fine (drives `service.createPayment` directly). Fold the
`invoiceId` schema add (T8) and the `status` strip (T7's schema half) into a
single edit that lands **before** T6's integration test — §4.4 already describes
both as one schema change, so the split across T7/T8/after-T6 is an artefact of
the task list, not the design.

---

## Findings

### MEDIUM
- **MEDIUM-1 — Net AR now trusts `StudentFeeAccount.balance`, a field with ~a
  dozen writers.** §4.6 point 1 lists them (admissions `workflow.handlers.ts`,
  seed, nine `$inc` sites in `fee-lifecycle-service.ts`, generic
  `updateStudentFeeAccount`, and the balance-blind `createInvoice`
  `service.ts:504-506`). The dashboard sums **all** accounts, so pre-existing
  seeded/admissions balances appear in the AR total (the §4.9 invariant check is
  scoped to 007-touched students only). **Fix:** state in the `getDashboard` code
  comment that the AR total includes non-007 balances by design, and confirm the
  demo runs on a college whose accounts are all 007-produced (fresh import) so the
  "falls by exactly the paid amount" narrative is clean. Directionally correct
  regardless.
- **MEDIUM-2 — Existing analytics unit fixtures have no `StudentFeeAccount`.**
  `fee-analytics-service.test.ts:97-131,202,219-220,835` assert `totalOutstanding
  > 0` / `dueByProgramme` from Invoice-only fixtures. T10 must **add
  `StudentFeeAccount` seed rows** to those fixtures, not merely adjust expected
  totals. Call this out in the task so the "update existing tests" step isn't
  mistaken for a number tweak. **Fix:** amend T10 wording: "seed
  `StudentFeeAccount{ balance }` in the getDashboard fixtures; assert net AR."
- **MEDIUM-3 — Task ordering: T8 schema `invoiceId` after T6 integration.** T6's
  HTTP integration needs the schema to accept `invoiceId` (T8). **Fix:** merge the
  `createPaymentSchema` edit (add `invoiceId`, remove `status`) into one task that
  lands before T6's integration test (§4.4 already treats it as one edit).

### LOW
- **LOW-1 — "only reachable value" overstates the status strip.** The Zod strip
  guards the HTTP path only; `service.createPayment` still honours a service-level
  `status` via `...data` spread (`service.ts:277`). No caller does this today.
  Reword the §4.3a comment to "the only value reachable **via the API**."
- **LOW-2 — Don't add a duplicate semester service.** `listSemesters` already
  exists at `academics.ts:93`. §5.2 should resolve to reuse
  (`listSemesters(1, 200)`), not the proposed new one-liner.
- **LOW-3 — Reversing-delete / locked-PUT is deliberate scope, not the 5 flows.**
  Well justified as desync closure; noted so reviewers read it as intentional.

### Cosmetic
- §4 step numbering skips 9 (8 → 10) and section order runs 4.6 → 4.8 → 4.9 →
  4.7. Harmless.

---

## Verdict: **PASS**

0 CRITICAL, 0 HIGH. The two-generator/two-rail decisions are the correct
lazy-but-safe calls, verified against the actual baggage in
`generateSemesterInvoice` and the actual read path in `getDashboard`. The three
MEDIUMs are test-fixture and task-ordering hygiene the plan already gestures at —
resolve them in-plan (they need no design change) and proceed to implementation.
