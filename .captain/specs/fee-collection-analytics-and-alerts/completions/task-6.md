# Completion: Task 6 — Stub workers (SMS + email + WhatsApp)

**Feature:** fee-collection-analytics-and-alerts
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed

- **Created:** `backend/src/workers/_stub-delivery.ts` — shared helper module. Exports `StubDeliveryPayload`, `StubChannel`, `STUB_DELIVERY_CONCURRENCY`, `processStubDelivery(channel, job)`, `stubDeliveryEnabled()`, `registerStubWorker(queueName, channel)`. Centralises the three-step delivery logic so each channel wrapper stays ~20 lines.
- **Created:** `backend/src/workers/sms-stub.worker.ts` — thin wrapper consuming `platform:sms`. Exports `SMS_STUB_CONCURRENCY=5`, `smsStubWorker`, `registerSmsStubWorker`.
- **Created:** `backend/src/workers/email-stub.worker.ts` — thin wrapper consuming `platform:email`. Exports `EMAIL_STUB_CONCURRENCY=5`, `emailStubWorker`, `registerEmailStubWorker`.
- **Created:** `backend/src/workers/whatsapp-stub.worker.ts` — thin wrapper consuming `platform:whatsapp`. Exports `WHATSAPP_STUB_CONCURRENCY=5`, `whatsappStubWorker`, `registerWhatsappStubWorker`.
- **Created:** `backend/src/workers/__tests__/stub-delivery.test.ts` — 14 tests (happy paths per channel, missing-contact variants, invoice-paid guard, no-reminderId, structured log prefixes, register gate via `STUB_DELIVERY` env var, concurrency constants).
- **Modified:** `backend/src/models/finance/FeeReminder.ts` — extended `deliveryStatus` enum to include `'skipped_paid'` (required by the invoice-paid guard in plan §1.6 / §4 R-4) and added `deliveredAt?: Date` field. Additive, backward-compatible; no migration.

## Test Results

- Focused (stub-delivery.test.ts): **14/14 passing**
- Full backend suite: 483/484 passing. The single pre-existing failure is in `fee-analytics-schema.test.ts` (from T1, unrelated to this task — `FeeAlertsCronRun.advancedByStage` default shape mismatch).
- TypeScript strict: 0 errors in files owned by T6. Pre-existing TS error in `backend/src/models/finance/FeeAlertsCronRun.ts` (T1 interface/Document extension conflict) is not touched by this task.

## Spec Coverage

- ✓ Task 6 AC 1-3: Happy-path delivery for SMS / email / WhatsApp flips `FeeReminder.deliveryStatus = 'delivered'` and stamps `deliveredAt`.
- ✓ Task 6 AC 4: Missing-`to` (null + empty string) → `deliveryStatus: 'failed'` with `deliveryDetails.reason = 'missing_contact'` + structured WARN log.
- ✓ Task 6 AC 5: Pre-dispatch invoice-paid check → `deliveryStatus: 'skipped_paid'` when the linked `Invoice.status === 'paid'`.
- ✓ Task 6 AC 6: No `reminderId` in payload → delivery still logs; no FeeReminder writes.
- ✓ Task 6 AC 7: `register*` functions use `registerQueue` which is idempotent (QueueManager dedupes via the internal `queues` Map).
- ✓ Task 6 AC 8: `STUB_DELIVERY_CONCURRENCY = 5` shared across all three wrappers.
- ✓ Task 6 AC 9: `STUB_DELIVERY=false` → `register*` returns `null` and `registerQueue` is never called.
- ✓ Task 6 AC 10: Grep-able log prefixes `[stub-delivery] channel=<c> to=<to> template=<t> context=<JSON>` for happy path and `[stub-delivery-skipped] channel=<c> reason="missing contact" template=<t>` for skipped.
- ✓ Plan §1.6 flow: missing contact → failed; else invoice-paid guard → skipped_paid; else delivered.
- ✓ Plan §3.2 registration gating via `STUB_DELIVERY` env var.
- ✓ §Journey 3 Stub delivery.

## Behaviour highlights

- **DRY**: each channel wrapper is 25 lines. All behaviour lives in `_stub-delivery.ts`. Adding a new channel is one 25-line file.
- **No auto-registration**: per task brief, the `register*` functions are provided but not called from any server startup code. Whoever wires the startup sequence (a separate task, orthogonal to T6) invokes them.
- **No BullMQ at test time**: the wrapper split lets us unit-test by calling the processor directly with a mock `Job<StubDeliveryPayload>`. `registerQueue` is mocked so tests never touch Redis.
- **Idempotency**: the `register*` path relies on `QueueManager.registerQueue`'s internal Map dedup; tests assert multiple calls forward to the underlying helper and trust QueueManager's own unit tests for the dedup contract.
- **Structured logging only**: no AuditLog emission. Stub workers are explicitly temporary; when real providers ship, the `[stub-delivery]` prefix lets ops grep every call-site.

## Spec Gaps / Notes

1. **`FeeReminder.deliveryStatus` enum extension** — the pre-existing enum was `['delivered', 'read', 'failed', 'pending']`. Plan §1.6 requires flipping to `'skipped_paid'` but the enum didn't allow it. I extended the enum additively (and added the `deliveredAt` field used by the happy path) since without this the spec-required state transition can't be persisted. Change is backward-compatible — existing documents are unaffected.

2. **Pre-existing TS + test failures (T1 work-in-progress)** — `backend/src/models/finance/FeeAlertsCronRun.ts` and `backend/src/models/finance/__tests__/fee-analytics-schema.test.ts` have a Document-interface conflict and a defaults-shape assertion failure respectively. These files are untracked / being developed under Task 1 by another agent. I did not touch them. They do not affect T6 files.

3. **Producer-side payload wiring not in scope** — `executeReminderSequence()` and the fee-alerts cron (T5) are the producers that put jobs on these queues. The payload contract (`StubDeliveryPayload`) lives in `_stub-delivery.ts`; producers should import it for type safety. Asserting producer correctness is T5's responsibility.

4. **`QUEUE_NAMES` entries already exist** — `SMS`, `EMAIL`, `WHATSAPP` are all registered in `QueueManager.ts`. No additions needed for T6, matching plan §1.1.

5. **Server-startup registration not wired** — per task brief, wiring `registerSmsStubWorker() / registerEmailStubWorker() / registerWhatsappStubWorker()` into `backend/src/index.ts` is deliberately left out of this task. Whoever does the startup wiring (likely T12 or a separate integration ticket) should gate on `stubDeliveryEnabled()` at boot.

## Violations

None.

## Notes

- Doc-blocks inside each worker file call out that the registration is idempotent via `registerQueue`, document the `STUB_DELIVERY` gate, and cross-reference `_stub-delivery.ts` for the behaviour.
- Test file mocks only `registerQueue` — the actual `processStubDelivery` path runs against real Mongoose models + real in-memory Mongo for end-to-end truthfulness of the FeeReminder / Invoice state-transition assertions.
- Log format uses `console.log` / `console.warn` (matches the rest of the codebase which does not route through a structured logger yet). When a real logger is adopted, the `[stub-delivery]` prefix migrates cleanly to a `logger.info({ event: 'stub-delivery', channel, to, template })` call.
