/**
 * Reach, pending and the CSV (spec §6.5, §7.1, §7.2). Shared by the mobile
 * publisher API and the admin console; `manageableNotice` is the one gate.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice, NOTICE_REMINDERS_MAX } from '../../../models/juvi/Notice';
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { MobileSession } from '../../../models/juvi/MobileSession';
import { User } from '../../../models/User';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { createAuditLog } from '../../../shared/audit';
import { MobileContext } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { groupLabel } from './audience';
import { ADMIN_ROLES } from './publisher-scope';
import { encodeCursor, decodeCursor, noticeNotFound } from './mobile-service';
import { ReachResponse, ReachGroup, PendingQuery, PendingResponse, Reminders } from './schemas';

export const REACH_LIST_MAX = 200;
export const SPARKLINE_BUCKETS = 24;
export type ReachBucket = 'acknowledged' | 'seen' | 'not_seen' | 'not_on_juvi';

export interface NoticeActor { collegeId: string; userId: string; name: string; role: string; isAdmin: boolean; via: 'mobile' | 'erp' }

const iso = (d?: Date | null): string | null => (d ? new Date(d).toISOString() : null);
const ROW_FIELDS = 'personId accountId kind labels addedLater seenAt dismissedAt ack';

export async function mobileActor(ctx: MobileContext): Promise<NoticeActor> {
  const user = await User.findOne({ _id: ctx.userId, collegeId: ctx.collegeId }).select('name').lean();
  return { collegeId: ctx.collegeId, userId: ctx.userId, name: user?.name ?? 'Juvi user', role: ctx.role, isAdmin: false, via: 'mobile' };
}

export function erpActor(collegeId: string, user: { id: string; name?: string; role: string }): NoticeActor {
  return { collegeId, userId: user.id, name: user.name || 'System', role: user.role, isAdmin: ADMIN_ROLES.has(user.role), via: 'erp' };
}

/** The notice, when the actor published it or has ERP admin rights; otherwise an audited 403 (RCH-02). */
export async function manageableNotice(actor: NoticeActor, noticeId: string, action: 'reach' | 'remind' | 'archive'): Promise<LeanNotice> {
  if (!Types.ObjectId.isValid(noticeId)) throw noticeNotFound();
  const notice = await Notice.findOne({ _id: noticeId, collegeId: actor.collegeId }).lean<LeanNotice>();
  if (!notice) throw noticeNotFound();
  const isPublisher = Boolean(notice.publisher.userId) && String(notice.publisher.userId) === actor.userId;
  if (actor.isAdmin || isPublisher) return notice;
  await createAuditLog({
    collegeId: actor.collegeId, entityType: 'NoticeReach', entityId: String(notice._id), entityName: `Notice from ${notice.publisher.office}`,
    action: 'access_denied',
    changes: [{ field: action, displayName: 'Refused: not the publisher', oldValue: null, newValue: { action, via: actor.via, role: actor.role, userId: actor.userId } }],
    performedBy: actor.name,
  });
  throw new MobileApiError(403, 'NOT_PUBLISHER', 'Only the publisher of this notice can do that.');
}

export function reachBucket(r: Pick<LeanNoticeRecipient, 'ack' | 'seenAt' | 'accountId'>): ReachBucket {
  if (r.ack) return 'acknowledged';
  if (r.seenAt) return 'seen';
  if (!r.accountId) return 'not_on_juvi';
  return 'not_seen';
}

/** Cumulative counts at the end of each of `buckets` equal slices of [start, end]; outliers clamp to the ends. */
export function sparkline(times: Date[], start: Date, end: Date, buckets = SPARKLINE_BUCKETS): number[] {
  const from = start.getTime();
  const span = Math.max(end.getTime() - from, 1);
  const out = new Array<number>(buckets).fill(0);
  for (const t of times) {
    const i = Math.min(buckets - 1, Math.max(0, Math.floor(((t.getTime() - from) / span) * buckets)));
    out[i] = (out[i] ?? 0) + 1;
  }
  for (let i = 1; i < buckets; i++) out[i] = (out[i] ?? 0) + (out[i - 1] ?? 0);
  return out;
}

export function remindersView(notice: Pick<LeanNotice, 'reminders'>): Reminders {
  const last = notice.reminders[notice.reminders.length - 1];
  return { used: notice.reminders.length, max: NOTICE_REMINDERS_MAX, lastAt: last ? iso(last.at) : null };
}

/** CSV cell: quoted when needed; a leading =, +, -, @ is defused so spreadsheets never evaluate it. */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

async function peopleInfo(collegeId: string, personIds: Types.ObjectId[]): Promise<Map<string, { name: string; identifier: string | null }>> {
  if (personIds.length === 0) return new Map();
  const [persons, students, faculty, staff] = await Promise.all([
    Person.find({ collegeId, _id: { $in: personIds } }).select('name').lean(),
    Student.find({ collegeId, personId: { $in: personIds } }).select('personId rollNumber').lean(),
    Faculty.find({ collegeId, personId: { $in: personIds } }).select('personId employeeCode').lean(),
    Staff.find({ collegeId, personId: { $in: personIds } }).select('personId employeeCode').lean(),
  ]);
  const ident = new Map<string, string>();
  for (const s of students) if (s.rollNumber) ident.set(String(s.personId), s.rollNumber);
  for (const e of [...faculty, ...staff]) if (!ident.has(String(e.personId))) ident.set(String(e.personId), e.employeeCode);
  return new Map(persons.map((p) => [String(p._id), { name: p.name, identifier: ident.get(String(p._id)) ?? null }]));
}

const COUNT_KEY: Record<ReachBucket, 'acknowledged' | 'seen' | 'notSeen' | 'notOnJuvi'> = {
  acknowledged: 'acknowledged', seen: 'seen', not_seen: 'notSeen', not_on_juvi: 'notOnJuvi',
};
const labelOf = (r: LeanNoticeRecipient) => groupLabel(r.kind, r.labels ?? {});
const ackTime = (r: LeanNoticeRecipient) => (r.ack ? new Date(r.ack.at).getTime() : 0);

export async function buildReach(collegeId: string, notice: LeanNotice, now = new Date()): Promise<ReachResponse> {
  const rows = await NoticeRecipient.find({ collegeId, noticeId: notice._id }).select(ROW_FIELDS).lean<LeanNoticeRecipient[]>();
  const snapshot = rows.filter((r) => !r.addedLater);
  const later = rows.filter((r) => r.addedLater);

  const totals = { acknowledged: 0, seen: 0, notSeen: 0, notOnJuvi: 0 };
  const groups = new Map<string, ReachGroup>();
  for (const r of snapshot) {
    const key = COUNT_KEY[reachBucket(r)];
    totals[key] += 1;
    const label = labelOf(r);
    const g = groups.get(label) ?? { label, total: 0, acknowledged: 0, seen: 0, notSeen: 0, notOnJuvi: 0 };
    g.total += 1;
    g[key] += 1;
    groups.set(label, g);
  }

  const lateRows = rows.filter((r) => r.ack?.late).sort((a, b) => ackTime(a) - ackTime(b)).slice(0, REACH_LIST_MAX);
  const commentRows = rows.filter((r) => r.ack?.comment).sort((a, b) => ackTime(a) - ackTime(b)).slice(0, REACH_LIST_MAX);
  const laterRows = later.slice(0, REACH_LIST_MAX);
  const info = await peopleInfo(collegeId, [...lateRows, ...commentRows, ...laterRows].map((r) => r.personId));
  const person = (r: LeanNoticeRecipient) => {
    const p = info.get(String(r.personId));
    return { name: p?.name ?? 'Unknown member', identifier: p?.identifier ?? null, group: labelOf(r) };
  };
  const progress = snapshot.flatMap((r) => (notice.ackRequired ? (r.ack ? [new Date(r.ack.at)] : []) : (r.seenAt ? [new Date(r.seenAt)] : [])));

  return {
    noticeId: String(notice._id), title: notice.title, status: notice.status, ackRequired: notice.ackRequired,
    deadline: iso(notice.ackDeadline), publishedAt: iso(notice.publishedAt),
    audience: notice.counts.audience, ...totals,
    dismissed: snapshot.filter((r) => r.dismissedAt).length,
    late: snapshot.filter((r) => r.ack?.late).length,
    reminders: remindersView(notice),
    sparkline: sparkline(progress, new Date(notice.publishedAt ?? notice.createdAt), now),
    groups: [...groups.values()].sort((a, b) => a.label.localeCompare(b.label)),
    lateAcks: lateRows.map((r) => ({ ...person(r), at: iso(r.ack!.at) })),
    comments: commentRows.map((r) => ({ ...person(r), at: iso(r.ack!.at), comment: r.ack!.comment!, late: r.ack!.late })),
    addedLater: {
      total: later.length,
      acknowledged: later.filter((r) => r.ack).length,
      seen: later.filter((r) => !r.ack && r.seenAt).length,
      items: laterRows.map((r) => ({ ...person(r), at: iso(r.ack?.at ?? r.seenAt), state: reachBucket(r) })),
    },
    asOf: now.toISOString(),
  };
}

/** Snapshot rows still pending: not acknowledged, or (no acknowledgement required) neither seen nor dismissed. */
export async function pendingPage(collegeId: string, notice: LeanNotice, q: PendingQuery): Promise<PendingResponse> {
  const pending = notice.ackRequired ? { ack: null } : { ack: null, seenAt: null, dismissedAt: null };
  const rows = await NoticeRecipient.find({ collegeId, noticeId: notice._id, addedLater: false, ...pending }).select(ROW_FIELDS).lean<LeanNoticeRecipient[]>();
  const info = await peopleInfo(collegeId, rows.map((r) => r.personId));
  const accountIds = rows.flatMap((r) => (r.accountId ? [r.accountId] : []));
  const sessions = accountIds.length
    ? await MobileSession.aggregate<{ _id: Types.ObjectId; at: Date }>([
      { $match: { collegeId: new Types.ObjectId(collegeId), accountId: { $in: accountIds } } },
      { $group: { _id: '$accountId', at: { $max: '$lastActiveAt' } } },
    ])
    : [];
  const lastSeen = new Map(sessions.map((s) => [String(s._id), s.at]));

  let people = rows.map((r) => {
    const p = info.get(String(r.personId));
    return {
      name: p?.name ?? 'Unknown member', identifier: p?.identifier ?? null, group: labelOf(r),
      state: reachBucket(r) as 'seen' | 'not_seen' | 'not_on_juvi',
      lastSeenInApp: r.accountId ? iso(lastSeen.get(String(r.accountId))) : null,
    };
  });
  const needle = q.q?.toLowerCase();
  if (needle) people = people.filter((p) => p.name.toLowerCase().includes(needle) || (p.identifier ?? '').toLowerCase().includes(needle));
  const counts = new Map<string, number>();
  for (const p of people) counts.set(p.group, (counts.get(p.group) ?? 0) + 1);
  if (q.group) people = people.filter((p) => p.group === q.group);
  people.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

  const c = q.cursor ? decodeCursor(q.cursor) : { o: 0 };
  if (typeof c.o !== 'number' || !Number.isInteger(c.o) || c.o < 0) throw new MobileApiError(400, 'VALIDATION_FAILED', 'That page cursor is not valid.');
  const offset = c.o;
  return {
    items: people.slice(offset, offset + q.limit),
    total: people.length,
    groups: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label)),
    nextCursor: offset + q.limit < people.length ? encodeCursor({ o: offset + q.limit }) : null,
  };
}

const STATUS_WORDS: Record<ReachBucket, string> = { acknowledged: 'Acknowledged', seen: 'Seen', not_seen: 'Not seen', not_on_juvi: 'Not on Juvi' };

/** Every member, snapshot first then added later (admin only; the route enforces it). */
export async function reachCsv(collegeId: string, notice: LeanNotice): Promise<string> {
  const rows = await NoticeRecipient.find({ collegeId, noticeId: notice._id }).select(ROW_FIELDS).lean<LeanNoticeRecipient[]>();
  const info = await peopleInfo(collegeId, rows.map((r) => r.personId));
  const lines = ['Name,Identifier,Group,Status,Acknowledged at,Late,Seen at,Comment,Added later'];
  const view = rows.map((r) => ({ r, name: info.get(String(r.personId))?.name ?? 'Unknown member', group: labelOf(r) }));
  view.sort((a, b) => Number(a.r.addedLater) - Number(b.r.addedLater) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  for (const { r, name, group } of view) {
    lines.push([
      name, info.get(String(r.personId))?.identifier ?? '', group, STATUS_WORDS[reachBucket(r)],
      iso(r.ack?.at) ?? '', r.ack?.late ? 'yes' : '', iso(r.seenAt) ?? '', r.ack?.comment ?? '', r.addedLater ? 'yes' : '',
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}
