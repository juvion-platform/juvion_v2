# Completion: Task 4 — FEE_COMMITMENT BullMQ queue + worker skeleton

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/workers/fee-commitment.worker.ts` — skeleton exports: `feeCommitmentWorker` (handler), `FEE_COMMITMENT_CONCURRENCY = 4`, `FEE_COMMITMENT_JOB_OPTS` (3 attempts, exponential backoff, initial delay 5s), `enqueueFeeCommitmentJob(data)`, `registerFeeCommitmentWorker()`
- **Created:** `backend/src/shared/queue/__tests__/feeCommitmentQueue.test.ts` — 8 tests
- **Modified:** `backend/src/shared/queue/QueueManager.ts` — added `FEE_COMMITMENT: 'finance:fee-commitment'` under a new `// Finance` comment group in `QUEUE_NAMES`

## Test Results
- Focused: 8/8 passing (all synchronous — no live Redis needed)
- Full backend suite: 326/326 passing
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ §Plan §3.3 — FEE_COMMITMENT queue registered
- ✓ §Plan §1.8 — retry (3 attempts, exponential backoff), concurrency cap at 4
- ✓ Worker signature matches brief: `(Job<{ studentId, pinId }>) => Promise<void>`

## Spec Gaps Discovered
1. **Backoff cadence** — plan §1.8 specified "5s / 30s / 2m" but BullMQ's `exponential` strategy with `delay: 5000` produces `5s / 10s / 20s`. The canonical formula is `delay × 2^(attemptsMade − 1)`. Tests assert retry *presence* (not exact cadence), and the worker file header comments flag this for T7: if Finance wants exactly 5s/30s/2m, T7 will register a custom BullMQ backoff strategy on the Worker. No spec text changed; noted in tasks.md for T7.
2. **Live-Redis testing deferred** — the existing codebase has no BullMQ test harness and no `ioredis-mock` devDep. Per task guidance, no new deps added; unit tests mock at the `addJob` boundary and assert synchronous contracts only. T7 will naturally exercise the full Queue → Worker round-trip when it wires real PDF logic.

## Violations
None.

## Notes
- QueueManager's `addJob` already accepts `attempts` + `backoff` via opts, so retry config is cleanly wired through producers without patching the abstraction.
- `registerFeeCommitmentWorker()` is exported but not called anywhere yet — T7 will wire it at server-start alongside other registrations (e.g. `registerProposalExpiryQueue`).
- Mirrored existing `QUEUE_NAMES as const` pattern exactly (not an enum).
