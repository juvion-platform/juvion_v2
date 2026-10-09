/**
 * Mobile contract for notices. No object-or-null fields (Foundation rulings
 * R57/R61): nested objects are always present and nullable values are scalars.
 */
import { z } from 'zod';
import { ACK_COMMENT_MAX } from '../../../models/juvi/NoticeRecipient';

export const NOTICE_STATES = ['received', 'seen', 'acknowledged', 'dismissed'] as const;
export type NoticeState = (typeof NOTICE_STATES)[number];
export const NOTICE_SEGMENTS = ['due', 'done', 'all', 'published'] as const;

export const noticeAttachmentSchema = z.object({ key: z.string(), name: z.string(), mime: z.string(), size: z.number().int() });

export const noticeCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  preview: z.string(),
  office: z.string(),
  audienceLine: z.string(),
  priority: z.enum(['routine', 'important', 'urgent']),
  purpose: z.enum(['standard', 'welcome']),
  ackRequired: z.boolean(),
  ackCommentAllowed: z.boolean(),
  deadline: z.string().nullable(),
  publishedAt: z.string().nullable(),
  archived: z.boolean(),
  attachmentCount: z.number().int(),
  state: z.enum(NOTICE_STATES),
  seenAt: z.string().nullable(),
  ackAt: z.string().nullable(),
  late: z.boolean(),
  remindedAt: z.string().nullable(),
  isPublisher: z.boolean(),
});
export type NoticeCard = z.infer<typeof noticeCardSchema>;

export const noticeDetailSchema = z.object({
  ...noticeCardSchema.shape,
  body: z.string(),
  attachments: z.array(noticeAttachmentSchema),
  ackMethod: z.enum(['hold', 'confirm']).nullable(),
  ackOffline: z.boolean(),
  ackComment: z.string().nullable(),
  ackClientAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
});
export type NoticeDetail = z.infer<typeof noticeDetailSchema>;

export const ATTENTION_KINDS = ['notice', 'class_change', 'fee_due', 'assessment'] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

/**
 * §7.4 in the flat form (R33): kind is the discriminator, every other field is
 * optional so each kind carries only its own fields. Notice-card nullable
 * scalars stay `.nullable().optional()` (Foundation R57/R61: nullable values
 * are scalars; objects are never null in any response).
 */
export const attentionItemSchema = z.object({
  kind: z.enum(ATTENTION_KINDS),
  id: z.string(),
  // notice card fields (kind=notice) — the existing NoticeCard, flattened:
  title: z.string().optional(),
  preview: z.string().optional(),
  office: z.string().optional(),
  audienceLine: z.string().optional(),
  priority: z.enum(['routine', 'important', 'urgent']).optional(),
  purpose: z.enum(['standard', 'welcome']).optional(),
  ackRequired: z.boolean().optional(),
  ackCommentAllowed: z.boolean().optional(),
  // All deadlines are ISO instants (R14/R15/R16): class_change = original start,
  // fee_due = the due date at college-tz midnight, assessment = its at instant;
  // the notice's deadline is its ack deadline (nullable when there is none).
  deadline: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  attachmentCount: z.number().int().optional(),
  state: z.enum(NOTICE_STATES).optional(),
  seenAt: z.string().nullable().optional(),
  ackAt: z.string().nullable().optional(),
  late: z.boolean().optional(),
  remindedAt: z.string().nullable().optional(),
  isPublisher: z.boolean().optional(),
  // class_change (§7.4): date/start are the ORIGINAL slot; newDate/newStart the replacement.
  type: z.enum(['cancelled', 'rescheduled']).optional(),
  offeringId: z.string().optional(),
  courseCode: z.string().optional(),
  date: z.string().optional(),
  start: z.string().optional(),
  newDate: z.string().optional(),
  newStart: z.string().optional(),
  room: z.string().optional(),
  channelId: z.string().optional(),
  // fee_due (§7.4/§6): deadline is the next due date at college-tz midnight as an ISO
  // instant (R15 — same convention as R14/R16, so kinds sort together); dueDate is the
  // display 'YYYY-MM-DD' the app renders. amount is integer paise (R1): forwarded
  // unchanged from duesFor/nextInvoiceDue — never re-converted.
  invoiceNumber: z.string().optional(),
  amount: z.number().int().optional(),
  dueDate: z.string().optional(), // 'YYYY-MM-DD' display string only — deadline carries the instant (R15)
  overdue: z.boolean().optional(),
  // assessment (§7.4): the row's internal kind (internal|exam) is not sent (A6).
  at: z.string().optional(),
});
export type AttentionItem = z.infer<typeof attentionItemSchema>;

export const attentionResponseSchema = z.object({ dueCount: z.number().int(), items: z.array(attentionItemSchema) });
export type AttentionResponse = z.infer<typeof attentionResponseSchema>;

export const noticeListQuerySchema = z.object({
  segment: z.enum(NOTICE_SEGMENTS).default('all'),
  office: z.string().trim().min(1).max(60).optional(),
  cursor: z.string().min(1).max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NoticeListQuery = z.infer<typeof noticeListQuerySchema>;
export const noticeListResponseSchema = z.object({ items: z.array(noticeCardSchema), nextCursor: z.string().nullable() });
export type NoticeListResponse = z.infer<typeof noticeListResponseSchema>;

export const seenResponseSchema = z.object({ seenAt: z.string() });
export const attachmentUrlResponseSchema = z.object({ url: z.string(), expiresAt: z.string() });

/** `.strict()`: late, at and sessionId are the server's, never the client's. */
export const ackRequestSchema = z.object({
  method: z.enum(['hold', 'confirm']),
  comment: z.string().max(ACK_COMMENT_MAX).optional(),
  offline: z.boolean().default(false),
  clientAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export type AckRequest = z.infer<typeof ackRequestSchema>;

export const ackResponseSchema = z.object({
  ackAt: z.string(),
  late: z.boolean(),
  method: z.enum(['hold', 'confirm']),
  offline: z.boolean(),
  comment: z.string().nullable(),
  clientAt: z.string().nullable(),
});
export type AckResponse = z.infer<typeof ackResponseSchema>;

export const dismissResponseSchema = z.object({ dismissedAt: z.string() });

export const remindersSchema = z.object({ used: z.number().int(), max: z.number().int(), lastAt: z.string().nullable() });
export type Reminders = z.infer<typeof remindersSchema>;

/** A member in a reach list: names and roll numbers only, never a personId (spec §10). */
export const reachPersonSchema = z.object({ name: z.string(), identifier: z.string().nullable(), group: z.string(), at: z.string().nullable() });
export const reachCommentSchema = z.object({ ...reachPersonSchema.shape, comment: z.string(), late: z.boolean() });
export const REACH_STATES = ['acknowledged', 'seen', 'not_seen', 'not_on_juvi'] as const;
export const reachGroupSchema = z.object({
  label: z.string(), total: z.number().int(), acknowledged: z.number().int(), seen: z.number().int(), notSeen: z.number().int(), notOnJuvi: z.number().int(),
});
export type ReachGroup = z.infer<typeof reachGroupSchema>;

/**
 * Push delivery for the published notification (notifications spec §7.4): rows by
 * current status, so the counts are disjoint, with suppressed split by reason.
 */
export const deliveryCountsSchema = z.object({
  scheduled: z.number().int(), sent: z.number().int(), delivered: z.number().int(), opened: z.number().int(),
  failed: z.number().int(), cancelled: z.number().int(),
  suppressed: z.object({ muted: z.number().int(), tierOff: z.number().int(), noDevice: z.number().int() }),
});
export type DeliveryCounts = z.infer<typeof deliveryCountsSchema>;
/** A pending member's push state; `none` is someone not on Juvi (or with no notification row). */
export const PENDING_DELIVERY_STATES = ['not_delivered', 'delivered', 'opened', 'muted', 'tier_off', 'no_device', 'scheduled', 'none'] as const;
export type PendingDelivery = (typeof PENDING_DELIVERY_STATES)[number];

export const reachResponseSchema = z.object({
  noticeId: z.string(),
  title: z.string(),
  status: z.enum(['publishing', 'published', 'archived']),
  ackRequired: z.boolean(),
  deadline: z.string().nullable(),
  publishedAt: z.string().nullable(),
  audience: z.number().int(),
  acknowledged: z.number().int(),
  seen: z.number().int(),
  notSeen: z.number().int(),
  notOnJuvi: z.number().int(),
  dismissed: z.number().int(),
  late: z.number().int(),
  reminders: remindersSchema,
  sparkline: z.array(z.number().int()),
  groups: z.array(reachGroupSchema),
  lateAcks: z.array(reachPersonSchema),
  comments: z.array(reachCommentSchema),
  addedLater: z.object({
    total: z.number().int(), acknowledged: z.number().int(), seen: z.number().int(),
    items: z.array(z.object({ ...reachPersonSchema.shape, state: z.enum(REACH_STATES) })),
  }),
  delivery: deliveryCountsSchema,
  asOf: z.string(),
});
export type ReachResponse = z.infer<typeof reachResponseSchema>;

export const pendingQuerySchema = z.object({
  group: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  cursor: z.string().min(1).max(300).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type PendingQuery = z.infer<typeof pendingQuerySchema>;
export const pendingPersonSchema = z.object({
  name: z.string(), identifier: z.string().nullable(), group: z.string(),
  state: z.enum(['seen', 'not_seen', 'not_on_juvi']), lastSeenInApp: z.string().nullable(),
  delivery: z.enum(PENDING_DELIVERY_STATES),
});
export const pendingResponseSchema = z.object({
  items: z.array(pendingPersonSchema), total: z.number().int(),
  groups: z.array(z.object({ label: z.string(), count: z.number().int() })), nextCursor: z.string().nullable(),
});
export type PendingResponse = z.infer<typeof pendingResponseSchema>;

export const remindResponseSchema = z.object({ reminders: remindersSchema });
