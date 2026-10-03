/**
 * Mobile contract for notifications (notifications spec §7.1–§7.3). No
 * object-or-null fields (Foundation rulings R57/R61).
 */
import { z } from 'zod';
import { eventItemSchema, EVENTS_MAX } from './events-service';

export const pushTokenRequestSchema = z.object({
  token: z.string().min(1).max(4096),
  /** Android only in R1; iOS arrives with sub-project 7. */
  platform: z.enum(['android']),
}).strict();

export const receiptItemSchema = z.object({
  deliveryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id'),
  receipt: z.string().min(1).max(200),
  event: z.enum(['delivered', 'opened']),
  at: z.string().datetime({ offset: true }),
});
export type ReceiptItem = z.infer<typeof receiptItemSchema>;
export const receiptsRequestSchema = z.object({ items: z.array(receiptItemSchema).min(1).max(50) }).strict();
export const receiptsResponseSchema = z.object({ accepted: z.number().int(), rejected: z.number().int() });

/**
 * The documented request. The Dart generator cannot build a string-or-number-or-boolean
 * map value, so the contract types `props` as a plain map; `validEvent` enforces the
 * prop rules. The controller parses the looser envelope so one bad event never fails the batch.
 */
const documentedEventSchema = eventItemSchema.extend({
  props: z.record(z.string(), z.unknown()).optional()
    .describe('Up to 10 keys, 1 KB serialised; each value a string of at most 64 characters matching ^[A-Za-z0-9_.:-]*$, a number or a boolean.'),
});
export const eventsRequestSchema = z.object({ events: z.array(documentedEventSchema).min(1).max(EVENTS_MAX) }).strict();
export const eventsEnvelopeSchema = z.object({ events: z.array(z.unknown()).min(1).max(EVENTS_MAX) }).strict();
export const eventsResponseSchema = z.object({ accepted: z.number().int(), rejected: z.number().int() });
