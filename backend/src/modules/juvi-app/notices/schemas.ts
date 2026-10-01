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

export const noticeDetailSchema = noticeCardSchema.extend({
  body: z.string(),
  attachments: z.array(noticeAttachmentSchema),
  ackMethod: z.enum(['hold', 'confirm']).nullable(),
  ackOffline: z.boolean(),
  ackComment: z.string().nullable(),
  ackClientAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
});
export type NoticeDetail = z.infer<typeof noticeDetailSchema>;

export const attentionResponseSchema = z.object({ dueCount: z.number().int(), items: z.array(noticeCardSchema) });
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
export const reachCommentSchema = reachPersonSchema.extend({ comment: z.string(), late: z.boolean() });
export const REACH_STATES = ['acknowledged', 'seen', 'not_seen', 'not_on_juvi'] as const;
export const reachGroupSchema = z.object({
  label: z.string(), total: z.number().int(), acknowledged: z.number().int(), seen: z.number().int(), notSeen: z.number().int(), notOnJuvi: z.number().int(),
});
export type ReachGroup = z.infer<typeof reachGroupSchema>;

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
    items: z.array(reachPersonSchema.extend({ state: z.enum(REACH_STATES) })),
  }),
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
});
export const pendingResponseSchema = z.object({
  items: z.array(pendingPersonSchema), total: z.number().int(),
  groups: z.array(z.object({ label: z.string(), count: z.number().int() })), nextCursor: z.string().nullable(),
});
export type PendingResponse = z.infer<typeof pendingResponseSchema>;

export const remindResponseSchema = z.object({ reminders: remindersSchema });
