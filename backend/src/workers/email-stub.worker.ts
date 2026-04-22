/**
 * T6 — Email stub worker. Consumes the existing `platform:email` queue.
 *
 * Thin wrapper around `processStubDelivery('email', job)` — see
 * `./_stub-delivery.ts` for the full behaviour (missing-contact guard,
 * invoice-paid skip, happy-path structured log + FeeReminder delivery
 * status flip).
 *
 * Registration:
 *   `registerEmailStubWorker()` is gated by the `STUB_DELIVERY` env var.
 *   Default is enabled; set `STUB_DELIVERY=false` in prod once the real
 *   email provider ships. When disabled the function is a no-op and
 *   returns `null`.
 *
 * This worker is NOT auto-registered at server start. The startup
 * sequence in `backend/src/index.ts` must call
 * `registerEmailStubWorker()` alongside the other finance workers.
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
 * Concurrency cap for the email stub worker. Matches the shared stub
 * cap so the three channels behave symmetrically.
 */
export const EMAIL_STUB_CONCURRENCY = STUB_DELIVERY_CONCURRENCY;

/**
 * Email-channel entry point. Delegates to the shared processor with the
 * `'email'` channel tag so log prefixes identify the source.
 */
export async function emailStubWorker(
  job: Job<StubDeliveryPayload>,
): Promise<void> {
  await processStubDelivery('email', job);
}

/**
 * Register the email stub against `platform:email`. Returns `null` when
 * `STUB_DELIVERY=false`.
 */
export function registerEmailStubWorker(): Queue | null {
  return registerStubWorker(QUEUE_NAMES.EMAIL, 'email');
}
