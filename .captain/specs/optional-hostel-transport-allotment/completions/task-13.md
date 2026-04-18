# Completion: Task 13 — BullMQ proposal-expiry worker

**Feature:** optional-hostel-transport-allotment
**Completed:** 2026-04-18
**Person:** srinikandula
**Final Status:** Refactored

## Test Results
- 6/6 tests passing in `proposal-expiry-worker.test.ts`
- Full suite: 171/171

## Implementation
- `shared/jobs/proposal-expiry-worker.ts` with `expireProposals()` core logic (testable without Redis) and `registerProposalExpiryQueue()` wrapper
- `QUEUE_NAMES.CAMPUS_PROPOSAL_EXPIRY = 'campus:proposal-expiry'` added
- Recurring job scheduled every 15 minutes via BullMQ repeat pattern
- Hooked into `server.ts` with `DISABLE_BACKGROUND_JOBS` env kill-switch

## Spec Gaps Discovered
1. **`performedBy: 'system'` not a valid ObjectId** for Notification.sentBy. Resolved with a sentinel system-actor ObjectId (`000000000000000000000000`) in allocation-lifecycle. Worth noting in the notification contract.
