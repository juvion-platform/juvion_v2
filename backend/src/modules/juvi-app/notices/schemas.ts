/**
 * Mobile contract for notices. No object-or-null fields (Foundation rulings
 * R57/R61): nested objects are always present and nullable values are scalars.
 */
import { z } from 'zod';

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
