/**
 * T6 — shared stub-delivery helper consumed by the SMS / email / WhatsApp
 * stub workers.
 *
 * Rationale for pulling this out:
 *   The three stub workers are byte-for-byte identical apart from the
 *   channel name in log prefixes and the queue they register against.
 *   Duplicating the 80-line body three times would be a maintenance
 *   hazard — any real-provider swap or behaviour tweak would have to be
 *   copy-pasted. This helper centralises the processor logic so each
 *   channel-specific worker file is a thin (~20 line) wrapper.
 *
 * Behaviour (identical across channels, per plan §1.6 + Task 6 ACs):
 *   1. If `to` is null/empty → structured WARN log, flip the matching
 *      FeeReminder to `deliveryStatus: 'failed'` with
 *      `deliveryDetails.reason = 'missing_contact'`, resolve. No retry.
 *   2. Else pre-dispatch invoice-paid check: if the FeeReminder's invoice
 *      has already been paid, flip `deliveryStatus: 'skipped_paid'` and
 *      resolve. Prevents reminding a student who paid between the cron
 *      decision and the stub dispatch (plan §4 R-4).
 *   3. Else happy path: structured INFO log, flip
 *      `deliveryStatus: 'delivered'` with `deliveredAt = now`, resolve.
 *
 * Logging:
 *   All logs use the grep-able prefixes `[stub-delivery]` and
 *   `[stub-delivery-skipped]`. When real providers ship, searching for
 *   these strings surfaces every remaining stub call-site.
 *
 * Registration gate:
 *   `registerStubWorker()` honours the `STUB_DELIVERY` env var. When
 *   `STUB_DELIVERY === 'false'` the register function is a no-op and
 *   returns `null`. Default behaviour is to register (any value other
 *   than the literal string `'false'` registers the worker) which keeps
 *   non-prod environments wired up while letting prod opt out once real
 *   providers are live.
 */

import type { Job, Queue } from 'bullmq';

import { FeeReminder } from '../models/finance/FeeReminder';
import { Invoice } from '../models/finance/Invoice';
import { registerQueue } from '../shared/queue/QueueManager';

/**
 * Payload shape every stub worker expects on the platform:<channel>
 * queue. Producers (the fee-alerts cron, the existing
 * `executeReminderSequence`, and ad-hoc admin triggers) enqueue jobs
 * matching this shape.
 */
export interface StubDeliveryPayload {
  to: string | null;
  template: string;
  context: object;
  reminderId?: string;
}

export type StubChannel = 'sms' | 'email' | 'whatsapp';

/**
 * Concurrency for stub workers. Shared across channels so the three
 * worker files have a single knob. The cap is deliberately modest —
 * stubs do a tiny amount of Mongo work per job, and real providers will
 * tune their own limits.
 */
export const STUB_DELIVERY_CONCURRENCY = 5;

/**
 * Shared processor executed by every stub worker. `channel` is the only
 * parameter that differs between wrappers; it only affects log prefixes.
 */
export async function processStubDelivery(
  channel: StubChannel,
  job: Job<StubDeliveryPayload>,
): Promise<void> {
  const { to, template, context, reminderId } = job.data;

  // 1. Missing-contact path.
  if (!to || to.trim() === '') {
    // eslint-disable-next-line no-console
    console.warn(
      `[stub-delivery-skipped] channel=${channel} reason="missing contact" template=${template}`,
    );
    if (reminderId) {
      await FeeReminder.updateOne(
        { _id: reminderId },
        {
          deliveryStatus: 'failed',
          deliveryDetails: { reason: 'missing_contact' },
        },
      );
    }
    return;
  }

  // 2. Pre-dispatch invoice-paid guard. Only relevant when we have a
  //    reminderId — ad-hoc jobs without a reminderId aren't linked to an
  //    invoice and can't be skipped this way.
  if (reminderId) {
    const reminder = await FeeReminder.findById(reminderId)
      .select({ invoiceId: 1 })
      .lean();
    if (reminder?.invoiceId) {
      const invoice = await Invoice.findById(reminder.invoiceId)
        .select({ status: 1 })
        .lean();
      if (invoice?.status === 'paid') {
        await FeeReminder.updateOne(
          { _id: reminderId },
          { deliveryStatus: 'skipped_paid' },
        );
        return;
      }
    }
  }

  // 3. Happy path. JSON-stringify context so the log line stays on a
  //    single greppable row.
  // eslint-disable-next-line no-console
  console.log(
    `[stub-delivery] channel=${channel} to=${to} template=${template} context=${JSON.stringify(
      context,
    )}`,
  );
  if (reminderId) {
    await FeeReminder.updateOne(
      { _id: reminderId },
      { deliveryStatus: 'delivered', deliveredAt: new Date() },
    );
  }
}

/**
 * Returns `true` when stub workers should be registered. Default is
 * registered; set `STUB_DELIVERY=false` in prod once real providers ship.
 */
export function stubDeliveryEnabled(): boolean {
  return process.env.STUB_DELIVERY !== 'false';
}

/**
 * Shared registration helper. Each channel-specific file calls this
 * with its queue name + channel tag. Gated by `STUB_DELIVERY` — when
 * disabled, returns `null` and no worker is created. Idempotent via
 * `registerQueue`.
 */
export function registerStubWorker(
  queueName: string,
  channel: StubChannel,
): Queue | null {
  if (!stubDeliveryEnabled()) return null;
  return registerQueue({
    name: queueName,
    processor: (job: Job) =>
      processStubDelivery(channel, job as Job<StubDeliveryPayload>),
    concurrency: STUB_DELIVERY_CONCURRENCY,
  });
}
