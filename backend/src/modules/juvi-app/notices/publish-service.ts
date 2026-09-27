/**
 * Publishing (spec §6.1): validate → scope check → write `publishing` →
 * emit notice.published → kick → 201. The fan-out runs in consumers.ts.
 * No transactions (the test harness is not a replica set, as in Foundation).
 */
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { Types } from 'mongoose';
import { AppError } from '../../../middleware/errorHandler';
import {
  Notice, LeanNotice, IAudienceRule, INoticeAttachment, NOTICE_ATTACHMENT_MIMES, NOTICE_ATTACHMENT_MAX_BYTES,
} from '../../../models/juvi/Notice';
import { Channel } from '../../../models/juvi/Channel';
import { createAuditLog } from '../../../shared/audit';
import { emit, kick } from '../../../shared/outbox';
import { isS3Configured, putObject } from '../../../shared/s3/s3-client';
import { loadAudienceGraph } from './audience-graph';
import { resolveAudience, ruleChannelRefs, audienceLine, groupLabel } from './audience';
import { PublisherScope, narrowToScope, assertAudienceInScope } from './scope';
import { PublishInput } from './admin-schemas';

export const NOTICE_EVENTS = {
  published: 'notice.published',
  reminder: 'notice.reminder',
  acknowledged: 'notice.acknowledged',
  archived: 'notice.archived',
} as const;

export const noticeEventKey = {
  published: (noticeId: string) => `notice:${noticeId}:published`,
  archived: (noticeId: string) => `notice:${noticeId}:archived`,
  reminder: (noticeId: string, n: number) => `notice:${noticeId}:reminder:${n}`,
  acknowledged: (noticeId: string, personId: string) => `notice:${noticeId}:ack:${personId}`,
};

export const attachmentPrefix = (collegeId: string) => `colleges/${collegeId}/notices/`;

export interface UploadedFile { buffer: Buffer; originalname: string; mimetype: string; size: number }
export interface AudiencePreview { total: number; onJuvi: number; notOnJuvi: number; groups: { label: string; total: number; onJuvi: number }[]; line: string }

/** Plain file name for display: no path, no control characters. */
function displayName(original: string): string {
  const name = basename(original.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (name || 'attachment').slice(0, 200);
}

export async function uploadAttachment(collegeId: string, file: UploadedFile): Promise<INoticeAttachment> {
  if (!isS3Configured()) throw new AppError(503, 'Attachments are unavailable: file storage is not configured');
  if (!NOTICE_ATTACHMENT_MIMES.includes(file.mimetype)) throw new AppError(400, 'Unsupported file type. Use PDF, PNG, JPEG, WEBP, DOCX, XLSX or PPTX.');
  if (file.size > NOTICE_ATTACHMENT_MAX_BYTES) throw new AppError(400, 'File too large (max 10 MB)');
  const key = `${attachmentPrefix(collegeId)}${randomUUID()}`;
  await putObject({ key, body: file.buffer, contentType: file.mimetype });   // putObject always sets SSE (AES256)
  return { key, name: displayName(file.originalname), mime: file.mimetype, size: file.size };
}

export async function previewAudience(collegeId: string, scope: PublisherScope, rules: IAudienceRule[]): Promise<AudiencePreview> {
  const narrowed = narrowToScope(scope, rules);
  const graph = await loadAudienceGraph(collegeId);
  assertAudienceInScope(scope, narrowed, graph);
  const people = resolveAudience(narrowed, graph);
  const groups = new Map<string, { label: string; total: number; onJuvi: number }>();
  for (const p of people) {
    const label = groupLabel(p.kind, p.labels);
    const row = groups.get(label) ?? { label, total: 0, onJuvi: 0 };
    row.total += 1;
    if (p.accountId) row.onJuvi += 1;
    groups.set(label, row);
  }
  const onJuvi = people.filter((p) => p.accountId).length;
  return {
    total: people.length, onJuvi, notOnJuvi: people.length - onJuvi,
    groups: [...groups.values()].sort((a, b) => a.label.localeCompare(b.label)),
    line: audienceLine(narrowed, graph),
  };
}

/** Channels whose scope equals a rule (spec §6.4), for inline cards. */
export async function channelIdsForRules(collegeId: string, rules: IAudienceRule[]): Promise<Types.ObjectId[]> {
  const refs = ruleChannelRefs(rules);
  if (refs.length === 0) return [];
  const rows = await Channel.find({
    collegeId,
    $or: refs.map((r) => ({ scopeType: r.scopeType, scopeId: r.scopeId ? new Types.ObjectId(r.scopeId) : null })),
  }).select('_id').lean();
  return rows.map((r) => r._id);
}

function assertOwnAttachments(collegeId: string, attachments: INoticeAttachment[]): void {
  const prefix = attachmentPrefix(collegeId);
  for (const a of attachments) {
    const rest = a.key.startsWith(prefix) ? a.key.slice(prefix.length) : '';
    if (!rest || rest.includes('/')) throw new AppError(400, 'Unknown attachment; upload it again');
  }
}

export async function publishNotice(collegeId: string, scope: PublisherScope, input: PublishInput, performedBy: string): Promise<LeanNotice> {
  if (input.purpose === 'welcome' && scope.kind !== 'college') throw new AppError(403, 'Only college offices publish welcome notices');
  assertOwnAttachments(collegeId, input.attachments);
  const rules = narrowToScope(scope, input.audience.rules);
  const graph = await loadAudienceGraph(collegeId);
  assertAudienceInScope(scope, rules, graph);
  if (resolveAudience(rules, graph).length === 0) throw new AppError(400, 'This audience has no members');

  const notice = await Notice.create({
    collegeId, title: input.title, body: input.body, attachments: input.attachments,
    publisher: { personId: scope.personId, userId: scope.userId, office: scope.office },
    audience: { rules, line: audienceLine(rules, graph) },
    ackRequired: input.ackRequired, ackDeadline: input.ackDeadline ? new Date(input.ackDeadline) : null,
    ackCommentAllowed: input.ackCommentAllowed, priority: input.priority, purpose: input.purpose, status: 'publishing',
  });
  const noticeId = String(notice._id);
  await emit(NOTICE_EVENTS.published, { collegeId, noticeId }, noticeEventKey.published(noticeId));
  await createAuditLog({
    collegeId, entityType: 'Notice', entityId: noticeId, entityName: `Notice from ${scope.office}`, action: 'publish',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'publishing' },
      { field: 'audience', displayName: 'Audience', oldValue: null, newValue: notice.audience.line },
    ],
    performedBy,
  });
  await kick();
  return notice.toObject() as unknown as LeanNotice;
}
