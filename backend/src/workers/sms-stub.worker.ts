/**
 * T6 — SMS stub worker. Consumes the existing `platform:sms` queue.
 *
 * Thin wrapper around `processStubDelivery('sms', job)` — see
 * `./_stub-delivery.ts` for the full behaviour (missing-contact guard,
 * invoice-paid skip, happy-path structured log + FeeReminder delivery
 * status flip).
 *
 * Registration:
 *   `registerSmsStubWorker()` is gated by the `STUB_DELIVERY` env var.
 *   Default is enabled; set `STUB_DELIVERY=false` in prod once the real
 *   SMS provider ships. When disabled the function is a no-op and
 *   returns `null` — callers must treat the absence of a queue as a
 *   deliberate opt-out, not an error.
 *
 * This worker is NOT auto-registered at server start. The startup
 * sequence in `backend/src/index.ts` must call
 * `registerSmsStubWorker()` alongside the other finance workers.
 */

import type { Job, Queue } from 'bullmq';

import { QUEUE_NAMES } from '../shared/queue/QueueManager';
import {
  processStubDelivery,
  registerStubWorker,
  STUB_DELIVERY_CONCURRENCY,
  type StubDeliveryPayload,
} from './_stub-delivery';

/**
 * Concurrency cap for the SMS stub worker. Matches the shared stub cap
 * so the three channels behave symmetrically.
 */
export const SMS_STUB_CONCURRENCY = STUB_DELIVERY_CONCURRENCY;

/**
 * SMS-channel entry point. Delegates to the shared processor with the
 * `'sms'` channel tag so log prefixes identify the source.
 */
export async function smsStubWorker(
  job: Job<StubDeliveryPayload>,
): Promise<void> {
  await processStubDelivery('sms', job);
}

/**
 * Register the SMS stub against `platform:sms`. Returns `null` when
 * `STUB_DELIVERY=false`.
 */
export function registerSmsStubWorker(): Queue | null {
  return registerStubWorker(QUEUE_NAMES.SMS, 'sms');
}
