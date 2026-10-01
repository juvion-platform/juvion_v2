/**
 * ERP-side reads for notices (spec §7.2, §8). Admins (admin, super_admin,
 * principal) see the whole college; everyone else sees what they published.
 */
import { Types } from 'mongoose';
import { AppError } from '../../../middleware/errorHandler';
import { Notice, LeanNotice, IAudienceRule, INoticeAttachment } from '../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { OutboxEvent, IOutboxEvent, retryDead, kick } from '../../../shared/outbox';
import { AuditLog, createAuditLog } from '../../../shared/audit';
import { paginate } from '../../../shared/pagination';
import { PaginatedResult } from '../../../shared/types';
import { NOTICE_EVENTS, noticeEventKey } from './publish-service';
import { NoticeActor, remindersView } from './reach-service';
import { AdminNoticeListQuery, DeadEventsQuery } from './admin-schemas';
import { Reminders } from './schemas';

export type DeliveryState = 'delivering' | 'delivered' | 'failed';
export interface DeliveryView { state: DeliveryState; attempts: number; lastError: string | null; updatedAt: string | null }
export interface AdminNoticeRow {
  id: string; title: string; office: string; audienceLine: string; status: LeanNotice['status']; delivery: DeliveryView;
  publishedAt: string | null; createdAt: string; ackRequired: boolean; deadline: string | null; deadlineState: 'none' | 'open' | 'passed';
  counts: { audience: number; onJuvi: number }; acknowledged: number; seen: number; reminders: Reminders; isMine: boolean;
}
export interface AdminNoticeDetail extends AdminNoticeRow {
  body: string; attachments: INoticeAttachment[]; audience: { rules: IAudienceRule[]; line: string };
  ackCommentAllowed: boolean; priority: LeanNotice['priority']; purpose: LeanNotice['purpose']; archivedAt: string | null; canManage: boolean;
}

const iso = (d?: Date | null): string | null => (d ? new Date(d).toISOString() : null);
const AUDIT_TYPES = ['Notice', 'NoticeAcknowledgement', 'NoticeReach'];

function deliveryView(notice: LeanNotice, event: Pick<IOutboxEvent, 'status' | 'attempts' | 'lastError'> & { updatedAt?: Date } | undefined): DeliveryView {
  const base = { attempts: event?.attempts ?? 0, updatedAt: iso(event?.updatedAt) };
  if (notice.status !== 'publishing') return { ...base, state: 'delivered', lastError: null };
  if (event?.status === 'dead') return { ...base, state: 'failed', lastError: event.lastError ?? null };
  return { ...base, state: 'delivering', lastError: null };
}

const isMine = (actor: NoticeActor, n: LeanNotice) => Boolean(n.publisher.userId) && String(n.publisher.userId) === actor.userId;

function row(actor: NoticeActor, n: LeanNotice, event: Parameters<typeof deliveryView>[1], stats?: { acknowledged: number; seen: number }): AdminNoticeRow {
  const deadline = n.ackDeadline ? new Date(n.ackDeadline) : null;
  return {
    id: String(n._id), title: n.title, office: n.publisher.office, audienceLine: n.audience.line, status: n.status,
    delivery: deliveryView(n, event), publishedAt: iso(n.publishedAt), createdAt: new Date(n.createdAt).toISOString(),
    ackRequired: n.ackRequired, deadline: iso(deadline), deadlineState: !deadline ? 'none' : deadline.getTime() > Date.now() ? 'open' : 'passed',
    counts: n.counts, acknowledged: stats?.acknowledged ?? 0, seen: stats?.seen ?? 0, reminders: remindersView(n), isMine: isMine(actor, n),
  };
}

async function eventsFor(collegeId: string, notices: LeanNotice[]) {
  const events = await OutboxEvent.find({ collegeId, dedupeKey: { $in: notices.map((n) => noticeEventKey.published(String(n._id))) } })
    .select('dedupeKey status attempts lastError updatedAt').lean<(IOutboxEvent & { updatedAt: Date })[]>();
  return new Map(events.map((e) => [e.dedupeKey, e]));
}

export async function listAdminNotices(actor: NoticeActor, q: AdminNoticeListQuery): Promise<PaginatedResult<AdminNoticeRow>> {
  const filter: Record<string, unknown> = { collegeId: actor.collegeId };
  if (!actor.isAdmin) filter['publisher.userId'] = new Types.ObjectId(actor.userId);
  if (q.status) filter.status = q.status;
  if (q.office) filter['publisher.office'] = q.office;
  const page = await paginate(Notice, filter, q.page, q.limit, { createdAt: -1 }, undefined, { search: q.q ?? '' });
  const notices = page.items as unknown as LeanNotice[];
  const stats = await NoticeRecipient.aggregate<{ _id: Types.ObjectId; acknowledged: number; seen: number }>([
    { $match: { collegeId: new Types.ObjectId(actor.collegeId), noticeId: { $in: notices.map((n) => n._id) }, addedLater: false } },
    { $group: {
      _id: '$noticeId',
      acknowledged: { $sum: { $cond: [{ $ne: ['$ack', null] }, 1, 0] } },
      seen: { $sum: { $cond: [{ $and: [{ $eq: ['$ack', null] }, { $ne: ['$seenAt', null] }] }, 1, 0] } },
    } },
  ]);
  const statBy = new Map(stats.map((s) => [String(s._id), s]));
  const events = await eventsFor(actor.collegeId, notices);
  return { ...page, items: notices.map((n) => row(actor, n, events.get(noticeEventKey.published(String(n._id))), statBy.get(String(n._id)))) };
}

/** Admin or publisher; anyone else gets 404, as if the notice did not exist. */
async function visibleNotice(actor: NoticeActor, noticeId: string): Promise<LeanNotice> {
  const notice = Types.ObjectId.isValid(noticeId) ? await Notice.findOne({ _id: noticeId, collegeId: actor.collegeId }).lean<LeanNotice>() : null;
  if (!notice || !(actor.isAdmin || isMine(actor, notice))) throw new AppError(404, 'Notice not found');
  return notice;
}

export async function getAdminNotice(actor: NoticeActor, noticeId: string): Promise<AdminNoticeDetail> {
  const n = await visibleNotice(actor, noticeId);
  const [stats] = await NoticeRecipient.aggregate<{ acknowledged: number; seen: number }>([
    { $match: { collegeId: new Types.ObjectId(actor.collegeId), noticeId: n._id, addedLater: false } },
    { $group: { _id: null, acknowledged: { $sum: { $cond: [{ $ne: ['$ack', null] }, 1, 0] } }, seen: { $sum: { $cond: [{ $and: [{ $eq: ['$ack', null] }, { $ne: ['$seenAt', null] }] }, 1, 0] } } } },
  ]);
  const events = await eventsFor(actor.collegeId, [n]);
  return {
    ...row(actor, n, events.get(noticeEventKey.published(String(n._id))), stats),
    body: n.body, attachments: n.attachments.map(({ key, name, mime, size }) => ({ key, name, mime, size })),
    audience: { rules: n.audience.rules.map((r) => ({ kind: r.kind, ids: [...r.ids], ...(r.departmentId ? { departmentId: r.departmentId } : {}) })), line: n.audience.line },
    ackCommentAllowed: n.ackCommentAllowed, priority: n.priority, purpose: n.purpose, archivedAt: iso(n.archivedAt),
    canManage: actor.isAdmin || isMine(actor, n),
  };
}

export async function auditTrail(actor: NoticeActor, noticeId: string) {
  const n = await visibleNotice(actor, noticeId);
  const rows = await AuditLog.find({ collegeId: actor.collegeId, entityId: String(n._id), entityType: { $in: AUDIT_TYPES } }).sort({ timestamp: -1 }).limit(500).lean();
  return { items: rows.map((r) => ({ action: r.action, entityType: r.entityType, performedBy: r.performedBy, at: new Date(r.timestamp).toISOString(), changes: r.changes })) };
}

/** Admin "Retry delivery" for a dead notice.published event (spec §11). */
export async function retryDelivery(actor: NoticeActor, noticeId: string): Promise<DeliveryView> {
  if (!actor.isAdmin) throw new AppError(403, 'Only admins can retry delivery');
  const n = await visibleNotice(actor, noticeId);
  const key = noticeEventKey.published(String(n._id));
  if (n.status !== 'publishing' || !(await retryDead(actor.collegeId, key))) throw new AppError(409, 'Nothing to retry: delivery has not failed');
  await createAuditLog({
    collegeId: actor.collegeId, entityType: 'Notice', entityId: String(n._id), entityName: `Notice from ${n.publisher.office}`,
    action: 'update', changes: [{ field: 'delivery', displayName: 'Delivery', oldValue: 'failed', newValue: 'retried' }], performedBy: actor.name,
  });
  await kick();
  const event = await OutboxEvent.findOne({ collegeId: actor.collegeId, dedupeKey: key }).lean<IOutboxEvent & { updatedAt: Date }>();
  return deliveryView(n, event ?? undefined);
}

export interface DeadEventRow { id: string; type: string; noticeId: string | null; attempts: number; lastError: string | null; createdAt: string; updatedAt: string | null }

/** This college's dead notice events, newest first (spec §6.2). Admin only. lastError is already capped by the outbox. */
export async function listDeadEvents(actor: NoticeActor, q: DeadEventsQuery): Promise<PaginatedResult<DeadEventRow>> {
  if (!actor.isAdmin) throw new AppError(403, 'Only admins can see failed deliveries');
  const filter = { collegeId: actor.collegeId, status: 'dead', type: { $in: Object.values(NOTICE_EVENTS) } };
  const page = await paginate(OutboxEvent, filter, q.page, q.limit, { createdAt: -1 }, undefined, { search: '' });
  const events = page.items as unknown as (IOutboxEvent & { updatedAt?: Date })[];
  return {
    ...page,
    items: events.map((e) => ({
      id: String(e._id), type: e.type, noticeId: typeof e.payload?.noticeId === 'string' ? e.payload.noticeId : null,
      attempts: e.attempts, lastError: e.lastError ?? null, createdAt: new Date(e.createdAt).toISOString(), updatedAt: iso(e.updatedAt),
    })),
  };
}
