/**
 * Publishing (spec §6.1): validate → scope check → write `publishing` →
 * emit notice.published → kick → 201. The fan-out runs in consumers.ts.
 * A welcome notice is the exception (spec §6.5): it is written `published`
 * with no fan-out, and welcome-service.ts creates its rows at onboarding.
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
import { OutboxEvent, emit, kick } from '../../../shared/outbox';
import { isS3Configured, putObject } from '../../../shared/s3/s3-client';
import { loadAudienceGraph } from './audience-graph';
import { resolveAudience, ruleChannelRefs, audienceLine, groupLabel } from './audience';
import { PublisherScope, narrowToScope, assertAudienceInScope } from './scope';
import { PublishInput } from './admin-schemas';
import { MobileApiError } from '../errors';
import { NoticeActor, manageableNotice, remindersView } from './reach-service';
import { Reminders } from './schemas';

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

/** Matches exactly what `randomUUID()` produces (lowercase RFC 4122 v4). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function assertOwnAttachments(collegeId: string, attachments: INoticeAttachment[]): void {
  const prefix = attachmentPrefix(collegeId);
  for (const a of attachments) {
    const rest = a.key.startsWith(prefix) ? a.key.slice(prefix.length) : '';
    if (!UUID_V4.test(rest)) throw new AppError(400, 'Unknown attachment; upload it again');
  }
}

export async function publishNotice(collegeId: string, scope: PublisherScope, input: PublishInput, performedBy: string): Promise<LeanNotice> {
  if (input.purpose === 'welcome' && scope.kind !== 'college') throw new AppError(403, 'Only college offices publish welcome notices');
  assertOwnAttachments(collegeId, input.attachments);
  const rules = narrowToScope(scope, input.audience.rules);
  const graph = await loadAudienceGraph(collegeId);
  assertAudienceInScope(scope, rules, graph);
  // A welcome notice reaches accounts as they onboard (spec §6.5), so today's members don't matter.
  const welcome = input.purpose === 'welcome';
  if (!welcome && resolveAudience(rules, graph).length === 0) throw new AppError(400, 'This audience has no members');

  const notice = await Notice.create({
    collegeId, title: input.title, body: input.body, attachments: input.attachments,
    publisher: { personId: scope.personId, userId: scope.userId, office: scope.office },
    audience: { rules, line: audienceLine(rules, graph) },
    ackRequired: input.ackRequired, ackDeadline: input.ackDeadline ? new Date(input.ackDeadline) : null,
    ackCommentAllowed: input.ackCommentAllowed, priority: input.priority, purpose: input.purpose,
    ...(welcome ? { status: 'published', publishedAt: new Date(), counts: { audience: 0, onJuvi: 0 } } : { status: 'publishing' }),
  });
  const noticeId = String(notice._id);
  // Audit before emit: a failed audit write must never leave a notice already
  // queued for delivery (spec §10 R7) — so it must never be possible for the
  // emit+kick to have already happened when the audit write throws.
  await createAuditLog({
    collegeId, entityType: 'Notice', entityId: noticeId, entityName: `Notice from ${scope.office}`, action: 'publish',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: notice.status },
      { field: 'audience', displayName: 'Audience', oldValue: null, newValue: notice.audience.line },
    ],
    performedBy,
  });
  if (welcome) return notice.toObject() as unknown as LeanNotice;
  await emit(NOTICE_EVENTS.published, { collegeId, noticeId }, noticeEventKey.published(noticeId));
  await kick();
  return notice.toObject() as unknown as LeanNotice;
}

const stillDelivering = () => new MobileApiError(409, 'VALIDATION_FAILED', 'This notice is still being delivered; try again in a minute.');
const archivedError = () => new MobileApiError(409, 'NOTICE_ARCHIVED', 'This notice has been archived.');

/** At most two reminders (NTC-08). The cap is part of the update filter, so concurrent requests cannot exceed it. */
export async function remindNotice(actor: NoticeActor, noticeId: string, now = new Date()): Promise<{ reminders: Reminders }> {
  const notice = await manageableNotice(actor, noticeId, 'remind');
  const updated = await Notice.findOneAndUpdate(
    { _id: notice._id, collegeId: actor.collegeId, status: 'published', 'reminders.1': { $exists: false } },
    { $push: { reminders: { at: now, by: actor.name } } },
    { new: true },
  ).lean<LeanNotice>();
  if (!updated) {
    const current = (await Notice.findOne({ _id: notice._id, collegeId: actor.collegeId }).select('status reminders').lean<LeanNotice>())!;
    if (current.status === 'archived') throw archivedError();
    if (current.status === 'publishing') throw stillDelivering();
    throw new MobileApiError(409, 'REMINDER_LIMIT', 'A notice can have at most two reminders.', { reminders: remindersView(current) });
  }
  const n = updated.reminders.length;
  await emit(NOTICE_EVENTS.reminder, { collegeId: actor.collegeId, noticeId: String(notice._id) }, noticeEventKey.reminder(String(notice._id), n));
  await createAuditLog({
    collegeId: actor.collegeId, entityType: 'Notice', entityId: String(notice._id), entityName: `Notice from ${notice.publisher.office}`,
    action: 'update', changes: [{ field: 'reminders', displayName: 'Reminders sent', oldValue: n - 1, newValue: n }], performedBy: actor.name,
  });
  await kick();
  return { reminders: remindersView(updated) };
}

/**
 * published → archived; the only change a published notice allows (US-1.4). Reach data is kept.
 * A notice still `publishing` whose notice.published event is dead can be archived too, so a
 * fan-out that always fails can be cleaned up.
 */
export async function archiveNotice(actor: NoticeActor, noticeId: string, now = new Date()): Promise<{ status: 'archived'; archivedAt: string }> {
  const notice = await manageableNotice(actor, noticeId, 'archive');
  const deadDelivery = notice.status === 'publishing'
    && Boolean(await OutboxEvent.exists({ collegeId: actor.collegeId, dedupeKey: noticeEventKey.published(String(notice._id)), status: 'dead' }));
  const from = deadDelivery ? 'publishing' : 'published';
  const updated = await Notice.findOneAndUpdate(
    { _id: notice._id, collegeId: actor.collegeId, status: from },
    { $set: { status: 'archived', archivedAt: now } },
    { new: true },
  ).lean<LeanNotice>();
  if (!updated) throw notice.status === 'publishing' ? stillDelivering() : archivedError();
  await emit(NOTICE_EVENTS.archived, { collegeId: actor.collegeId, noticeId: String(notice._id) }, noticeEventKey.archived(String(notice._id)));
  await createAuditLog({
    collegeId: actor.collegeId, entityType: 'Notice', entityId: String(notice._id), entityName: `Notice from ${notice.publisher.office}`,
    action: 'archive', changes: [{ field: 'status', displayName: 'Status', oldValue: from, newValue: 'archived' }], performedBy: actor.name,
  });
  await kick();
  return { status: 'archived', archivedAt: now.toISOString() };
}
