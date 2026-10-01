import { z } from 'zod';
import {
  AUDIENCE_RULE_KINDS, NOTICE_PRIORITIES, NOTICE_PURPOSES, NOTICE_ATTACHMENT_MIMES,
  NOTICE_TITLE_MAX, NOTICE_BODY_MAX, NOTICE_ATTACHMENTS_MAX, NOTICE_ATTACHMENT_MAX_BYTES,
} from '../../../models/juvi/Notice';
import { objectId } from '../admin/schemas';

const tuple = <T extends string>(list: readonly T[]) => list as unknown as [T, ...T[]];
/** A role word, or a persona code like ST-EXAM / ST-ADM-TC. */
const roleId = z.string().regex(/^(student|faculty|staff|hod|[A-Z][A-Z0-9]*(-[A-Z0-9]+)+|L-[A-Z]+)$/, 'Unknown role');

/**
 * `kind` is restricted to exactly the nine spec kinds (spec §7.3, R5): the
 * Zod enum below rejects anything else at the publish and preview boundary,
 * on top of `assertAudienceInScope`'s row-level check on the resolved rules.
 */
export const audienceRuleSchema = z.object({
  kind: z.enum(tuple(AUDIENCE_RULE_KINDS)),
  ids: z.array(z.string()).max(5000).default([]),
  departmentId: objectId.optional(),
}).strict().superRefine((r, ctx) => {
  if (r.kind === 'all') {
    if (r.ids.length) ctx.addIssue({ code: 'custom', path: ['ids'], message: 'An "all" rule takes no ids' });
  } else if (r.ids.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['ids'], message: 'Pick at least one target' });
  }
  const check = r.kind === 'role' ? roleId : objectId;
  r.ids.forEach((id, i) => { if (!check.safeParse(id).success) ctx.addIssue({ code: 'custom', path: ['ids', i], message: r.kind === 'role' ? 'Unknown role' : 'Invalid id' }); });
  if (r.departmentId && r.kind !== 'role') ctx.addIssue({ code: 'custom', path: ['departmentId'], message: 'Only a role rule takes a department' });
});

export const audienceSchema = z.object({ rules: z.array(audienceRuleSchema).min(1).max(20) }).strict();

export const noticeAttachmentInputSchema = z.object({
  key: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(200),
  mime: z.enum(tuple(NOTICE_ATTACHMENT_MIMES)),
  size: z.number().int().min(0).max(NOTICE_ATTACHMENT_MAX_BYTES),
}).strict();

export const publishSchema = z.object({
  title: z.string().trim().min(1).max(NOTICE_TITLE_MAX),
  body: z.string().trim().min(1).max(NOTICE_BODY_MAX),
  attachments: z.array(noticeAttachmentInputSchema).max(NOTICE_ATTACHMENTS_MAX).default([]),
  audience: audienceSchema,
  ackRequired: z.boolean().default(false),
  ackDeadline: z.string().datetime({ offset: true }).nullable().optional(),
  ackCommentAllowed: z.boolean().default(false),
  priority: z.enum(tuple(NOTICE_PRIORITIES)).default('routine'),
  purpose: z.enum(tuple(NOTICE_PURPOSES)).default('standard'),
  /** Admins only; ignored for everyone else (their office comes from their persona). */
  office: z.string().trim().min(1).max(60).optional(),
}).strict().superRefine((b, ctx) => {
  if (b.ackDeadline && !b.ackRequired) ctx.addIssue({ code: 'custom', path: ['ackDeadline'], message: 'A deadline requires acknowledgement' });
  if (b.ackDeadline && new Date(b.ackDeadline).getTime() <= Date.now()) ctx.addIssue({ code: 'custom', path: ['ackDeadline'], message: 'The deadline must be in the future' });
  if (b.ackCommentAllowed && !b.ackRequired) ctx.addIssue({ code: 'custom', path: ['ackCommentAllowed'], message: 'Comments are collected with an acknowledgement only' });
});
export type PublishInput = z.infer<typeof publishSchema>;

export const audiencePreviewSchema = z.object({
  rules: z.array(audienceRuleSchema).min(1).max(20),
  office: z.string().trim().min(1).max(60).optional(),
}).strict();

export const adminNoticeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['publishing', 'published', 'archived']).optional(),
  office: z.string().trim().min(1).max(60).optional(),
  q: z.string().trim().max(80).optional(),
});
export type AdminNoticeListQuery = z.infer<typeof adminNoticeListQuerySchema>;
