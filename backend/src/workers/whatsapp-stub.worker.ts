/**
 * T6 — WhatsApp stub worker. Consumes the existing `platform:whatsapp`
 * queue.
 *
 * Thin wrapper around `processStubDelivery('whatsapp', job)` — see
 * `./_stub-delivery.ts` for the full behaviour (missing-contact guard,
 * invoice-paid skip, happy-path structured log + FeeReminder delivery
 * status flip).
 *
 * Registration:
 *   `registerWhatsappStubWorker()` is gated by the `STUB_DELIVERY` env
 *   var. Default is enabled; set `STUB_DELIVERY=false` in prod once the
 *   real WhatsApp Business provider ships. When disabled the function
 *   is a no-op and returns `null`.
 *
 * This worker is NOT auto-registered at server start. The startup
 * sequence in `backend/src/index.ts` must call
 * `registerWhatsappStubWorker()` alongside the other finance workers.
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
 * Concurrency cap for the WhatsApp stub worker. Matches the shared stub
 * cap so the three channels behave symmetrically.
 */
export const WHATSAPP_STUB_CONCURRENCY = STUB_DELIVERY_CONCURRENCY;

/**
 * WhatsApp-channel entry point. Delegates to the shared processor with
 * the `'whatsapp'` channel tag so log prefixes identify the source.
 */
export async function whatsappStubWorker(
  job: Job<StubDeliveryPayload>,
): Promise<void> {
  await processStubDelivery('whatsapp', job);
}

/**
 * Register the WhatsApp stub against `platform:whatsapp`. Returns
 * `null` when `STUB_DELIVERY=false`.
 */
export function registerWhatsappStubWorker(): Queue | null {
  return registerStubWorker(QUEUE_NAMES.WHATSAPP, 'whatsapp');
}
