# Completion: Task 17 — Nightly fee-pin-audit BullMQ job

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/models/finance/FeePinAuditSnapshot.ts` — per-college daily snapshot with `{collegeId: 1, runAt: -1}` compound index
- **Created:** `backend/src/workers/fee-pin-audit.worker.ts` — BullMQ worker + `registerFeePinAuditWorker()` + `FEE_PIN_AUDIT_CONCURRENCY=1` + `FEE_PIN_AUDIT_JOB_OPTS` (3 attempts, exp backoff @5min, `cronPattern: '0 2 * * *'`)
- **Created:** `backend/src/models/__tests__/feePinAuditSnapshot.schema.test.ts` — 3 schema tests
- **Created:** `backend/src/workers/__tests__/fee-pin-audit.worker.test.ts` — 10 orchestration tests
- **Modified:** `backend/src/shared/queue/QueueManager.ts` — appended `FEE_PIN_AUDIT: 'finance:fee-pin-audit'` under Finance group

## Test Results
- Focused: 13/13 passing (3 schema + 10 worker)
- Full backend suite: 441/441 passing
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ Plan §5 observability — coverage + invariants + deferredPinsCount + commitmentSheetFailureCount metrics
- ✓ §Journey 7 pin/invoice mismatch detection
- ✓ §Success Metrics: `fee_pins.coverage.current_year`, `fee_pins.deferred.count`, `fee_pins.stale.count`, `fee_pins.commitment_sheet.failure_rate`, `fee_invoice.pin_vs_invoice_mismatch.count`

## Behavior highlights
- Iterates all `status='active'` colleges (skips suspended) when `job.data.collegeId` omitted
- Accepts single-college override via `job.data.collegeId`
- Partial-failure tolerance: one college throws → worker logs + continues; other colleges still get snapshots
- EMAIL alert enqueued when coverage < 100% (best-effort; EMAIL queue failure doesn't fail audit run)
- 90-day retention via per-run `deleteMany({ runAt: { $lt: cutoff } })`
- Calls T12's `getCoverage` + `getInvariants` functions (already tested in T12's HTTP suite)
- `missingSample` in snapshot capped at 50 students (full list would bloat the document)

## Cron scheduling
Wired via BullMQ's `repeat.pattern`. Server-startup code:
```ts
const queue = registerFeePinAuditWorker();
await queue.add('nightly', {}, {
  repeat: { pattern: FEE_PIN_AUDIT_JOB_OPTS.cronPattern },
  attempts: FEE_PIN_AUDIT_JOB_OPTS.attempts,
  backoff: FEE_PIN_AUDIT_JOB_OPTS.backoff,
});
```
Snippet documented in the worker file's doc-block. No hidden scheduler magic — repeat is visible at boot.

## Spec Gaps / Notes

1. **`CoverageMissingStudent.rollNumber` is optional** on T12's service type, required-string on snapshot model. Worker maps `m.rollNumber ?? ''` — absence becomes empty string.

2. **EMAIL job schema not formally defined** anywhere in the codebase. Stubbed `{ subject, body, recipients: ['principal', 'finance_officer'] }` — downstream email-service will likely resolve role strings to actual addresses via College settings.

3. **Alert-trigger condition per spec** — "coverage < 100% → daily aggregate; invariant mismatch > 0 → immediate". My worker fires a single alert per run when either condition is true, from inside the nightly job. If Finance wants invariant alerts to be truly immediate (triggered from invoice generation at write time rather than nightly), that's a separate task.

## Violations
None.

## Notes
- Added to QUEUE_NAMES under the `// Finance` group next to `FEE_COMMITMENT` (T4) — consistent grouping.
- `addJob` helper deliberately not exported for this queue — repeat is driven from the caller so scheduling is visible at boot, not hidden in a producer helper.
- Snapshot model has no unique index; multiple runs per day would accumulate (but in practice cron runs once/day). If operators want to run ad-hoc audits without pollution, they can scope via `job.data.collegeId`.
