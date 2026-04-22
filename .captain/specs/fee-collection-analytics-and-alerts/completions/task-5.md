# Completion: Task 5 — fee-alerts-cron.worker (HARDEST)

**Feature:** fee-collection-analytics-and-alerts
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed

### Created
- `backend/src/workers/fee-alerts-cron.worker.ts` — nightly BullMQ worker implementing the stage-transition engine, side-effect guards, per-college / per-student error tolerance, idempotency, dry-run, and audit persistence per plan §1.5.

### Modified (additive, required to make T5 green)
- `backend/src/models/finance/DefaulterRecord.ts` — extended `welfareReferralStatus` enum from `['none','referred','returned']` to `['none','pending','referred','returned']`. Plan §1.5 and the test spec both require `defaulter.welfareReferralStatus = 'pending'` on the welfare_referred transition; the enum had to accept it. Backward compatible: existing values keep working.

## Test Results
- **Focused file (`fee-alerts-cron.worker.test.ts`):** 16 / 16 passing (2.63s)
- **Full backend suite:** 545 / 545 passing (0 regressions — previous baseline was 541 before T17; T18-T20 + T5 tests each added; no prior tests broken)
- **TypeScript strict (`npm run typecheck -w backend`):** 0 errors

## Required Exports (verified against test file imports)

```ts
export const FEE_ALERTS_CRON_CONCURRENCY = 1;
export const FEE_ALERTS_CRON_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5 * 60 * 1000 },
  cronPattern: '0 2 * * *',
};
export interface FeeAlertsCronJobData { collegeId?: string; dryRun?: boolean; }
export async function feeAlertsCronWorker(job: Job<FeeAlertsCronJobData>): Promise<void>;
export function registerFeeAlertsCronWorker(): Queue;
```

All five exports present with exact types matching the test imports. `FEE_ALERTS_CRON_JOB_OPTS.backoff.delay === 300000` and `cronPattern === '0 2 * * *'` as asserted.

## Scenario-by-Scenario Results

| # | Scenario | Result |
|---|---|---|
| Exports | `FEE_ALERTS_CRON_CONCURRENCY === 1` | PASS |
| Exports | 3 attempts, 5-min exponential backoff, `0 2 * * *` | PASS |
| 1 | Day 0 invoice → stage_1, no penalty, no hold | PASS |
| 2 | Day 3 overdue → stage_1, reminder dispatched | PASS |
| 3 | Day 10 first-time → stage_2 + 1 FinePenalty(₹200 late_fee) | PASS |
| 4 | Day 20 already-stage_2 → stage_3, no new penalty | PASS |
| 5 | Day 40 first-time → stage_4 + 1 FinancialHold(pending_approval) | PASS |
| 6 | Day 70 → welfare_referred, welfareReferralStatus=pending, no reminder | PASS |
| 7 | Re-run same day → idempotent; audit.alreadyAdvanced ≥ 1 on 2nd run | PASS |
| 8 | Already stage_2 + still day 10 → no new penalty, audit.unchanged ≥ 1 | PASS |
| 9 | stage_3 → stage_4 transition → exactly 1 FinancialHold(pending_approval) | PASS |
| 10 | autoEscalationPaused = tomorrow → skipped, audit.paused ≥ 1 | PASS |
| 11 | status='exited' → skipped, audit.skipped ≥ 1 | PASS |
| 12 | One student throws + per-college isolation → others still processed | PASS |
| 13 | dryRun=true → zero FinePenalty / FinancialHold / DefaulterRecord / audit writes | PASS |
| Bonus | Non-active (status='suspended') colleges excluded from default iteration | PASS |

## Red-Green-Refactor Trace

### RED
Worker file did not exist. Initial `npm test -w backend -- fee-alerts-cron.worker` failed with "cannot find module" on the test file's imports of `FEE_ALERTS_CRON_CONCURRENCY`, `FEE_ALERTS_CRON_JOB_OPTS`, `feeAlertsCronWorker`, `FeeAlertsCronJobData`.

### GREEN (three iterations)

1. **First pass — 13/16 passing.** Three failures:
   - Day 0 invoice: `Invoice.find({ dueDate: { $lt: now } })` strict-less-than excluded invoices due at exactly `now` (the test fixture seeds `dueDate(0) === FROZEN_NOW`). Plan pseudocode says `$lt`, but spec §Journey 2 says Day 0 gets a "pre-due" reminder, i.e. it must be on the cron's scan. Changed to `$lte`. (Documented in inline comment — plan pseudocode deviated for fixture correctness.)
   - Day 70 welfare_referred: DefaulterRecord save threw ValidationError because `welfareReferralStatus = 'pending'` was not in the enum. Extended the enum.
   - Idempotency re-run: audit was being written with `alreadyAdvanced=1` correctly, but the test asserted `runs[1]` (sorted by `startedAt`) had `alreadyAdvanced >= 1`. Both runs shared the same frozen `startedAt`, so `.sort({ startedAt: 1 })` returned them in an unspecified-but-stable order that happened to put the first-inserted doc at index 1. Fixed by monotonic-startedAt tie-break: if a prior audit exists for the college at the same `startedAt`, bump by +1ms.

2. **Second pass — 16/16 passing.** All GREEN.

### REFACTOR
- Removed scratch `console.log` debug lines added during GREEN diagnosis.
- Pulled the per-invoice body into `processInvoice` and the per-college body into `processCollege` for readability; the main `feeAlertsCronWorker` is now ~15 lines.
- Added inline rationale comments at every non-obvious branch: why `$lte` not `$lt`, why `isNew` is checked before the idempotency gate, why we save the defaulter early in the stage_4 branch (FinancialHold requires `defaulterRecordId`), why monotonic startedAt.
- Stage-4 internal-email enqueue left as an explicit `TODO (T8/T10)` comment since no helper exists today.

## Spec Gaps / Notes

1. **Plan pseudocode says `dueDate: { $lt: now }`; we use `$lte`.**
   The test's Day 0 fixture seeds `dueDate === FROZEN_NOW` and expects the invoice to be scanned. Spec §Journey 2 treats Day 0 as "pre-due SMS reminder" (stage_1). Under `$lt`, that invoice is silently excluded and no reminder ever fires. `$lte` is the only interpretation that reconciles the plan, the spec, and the test.

2. **`welfareReferralStatus` enum extension** (modification to T1's model).
   T1's DefaulterRecord kept `welfareReferralStatus: ['none','referred','returned']`. Plan §1.5 line 148 says the cron sets it to `'pending'`. Adding `'pending'` to the enum here is the smallest additive change to make the spec + test compatible.

3. **FinePenalty schema has no `invoiceId` field and no `appliedAt` field.**
   Plan §1.5 writes both. The existing schema (`backend/src/models/finance/FinePenalty.ts`) only has `collegeId, studentId, type, reason, amount, dueDate, paidAmount, status, imposedBy, metadata`. To preserve the semantic link to the invoice, we write `metadata: { source: 'fee-alerts-cron', invoiceId, appliedAt }`. `status: 'applied'` in the plan isn't in the enum either; we used `status: 'pending'` (the closest match — pending collection). Tests assert only `type, amount, collegeId, studentId` so this passes, but downstream analytics that filter on `FinePenalty.status === 'applied'` will need to be aware.

4. **FinancialHold requires `defaulterRecordId` (required in schema).**
   On a stage_4 transition, we now `await defaulter.save()` before creating the hold to get a stable `_id`. This moves the defaulter save from "end of function" to "before hold creation" on the stage_4 branch only. The final-field updates at the bottom still run and save again (via Mongoose's change tracking) — benign double-save on this one branch.

5. **Internal-email enqueue for new pending holds — NOT WIRED.**
   Plan §1.5 says "enqueue email to Finance Officer + Principal" on stage_4 transition. No helper exists in this codebase for typed Principal/Finance-Officer notifications; T10 (FinancialHoldsPage) is the canonical surface for pending-approval review. Left an inline `TODO (T8/T10)` comment in the worker. The hold is created with the correct status and metadata — no data loss, just no push notification.

6. **Monotonic-startedAt tie-break on audit write.**
   Two runs in the same millisecond (fake timers in tests, manual rapid re-enqueue in prod) would share `startedAt` and break `.sort({ startedAt: 1 })`-ordered UI timelines. Added a cheap `findOne({ collegeId }).sort({ startedAt: -1 }).select('startedAt')` look-up that bumps the new audit's `startedAt` by +1ms on conflict. Small, harmless hack that keeps UI timelines in insertion order.

7. **`dryRun` mode also skips reminder dispatch.**
   Plan §1.5 doesn't explicitly say so, but test scenario 13 asserts `executeReminderSequence` was NOT called under `dryRun: true`. The spec's intent is "no side effects" — reminders are a side effect. Skipped.

## Violations

None.

- Multi-tenancy: every model write includes `collegeId` (`FinePenalty`, `FinancialHold`, `DefaulterRecord`, `FeeAlertsCronRun`).
- TypeScript strict: no `any`, no unused locals, no implicit-any. `as unknown as (job: Job) => ...` cast on the `processor` registration is the same pattern `fee-pin-audit.worker.ts` uses.
- `String(doc._id)` not `as string`: used on every ObjectId→string coercion in reminder-dispatch args.
- Test file was NOT modified.

## Follow-ups (for future tasks)

- **T8 (HTTP API) / T10 (FinancialHoldsPage):** wire an internal-notification helper so stage_4 transitions emit an email alert to Finance Officer + Principal. Today the hold itself + the pending-approval UI are the signal path.
- **T12 (E2E):** the cron-end-to-end scenario will assert `FeeReminder` + `DefaulterRecord` + `FinancialHold` counts after a multi-student seed run. Test covers that happy path; our per-student-error test (Scenario 12) is the first safety net.
- **Post-v1:** consider adding `'applied'` to the `FinePenalty.status` enum so we can distinguish cron-auto-applied from manual imposition without relying on `metadata.source`. Backward-compatible addition; skip for now.
- **`dueDate: { $lte: now }` vs `$lt`:** if the plan pseudocode is the authoritative reference going forward, re-open whether Day 0 should be scanned or whether the cron should fire at T+1 from the due date. The current interpretation follows the test + spec.
