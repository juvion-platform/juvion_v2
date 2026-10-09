// backend/src/modules/juvi-app/notifications/expand-consumer.ts
/**
 * notification.requested → one NotificationDelivery row per person (notifications
 * spec §5.2). Walks the notice's NoticeRecipient rows in batches of 1,000, applies
 * the §6 policy and upserts with $setOnInsert on the unique (source, accountId)
 * key, so a re-run changes nothing.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { JuviAccount, IAccountSettings } from '../../../models/juvi/JuviAccount';
import { ChannelMembership } from '../../../models/juvi/ChannelMembership';
import { NotificationDelivery, NotificationSourceKind, NotificationTier } from '../../../models/juvi/NotificationDelivery';
import { emit, OutboxPayload } from '../../../shared/outbox';
import { getJuviConfig } from '../config/institution-config';
import { decide, digestSendAfter, PolicySettings } from './policy';
import { ClassException, LeanClassException } from '../../../models/academic-ops/ClassException';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { Channel } from '../../../models/juvi/Channel';
import { ELIGIBLE_STATUSES } from '../../../models/juvi/JuviAccount'; // JuviAccount and IAccountSettings are already imported

export const NOTIFICATION_REQUESTED = 'notification.requested';
export const EXPAND_BATCH_SIZE = 1000;
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

let expandBatchSize = EXPAND_BATCH_SIZE;
/** Test-only: exercise the multi-batch walk without 1,000 real rows. */
export function __setExpandBatchSizeForTesting(n: number | null): void { expandBatchSize = n ?? EXPAND_BATCH_SIZE; }

export const notificationKey = {
  published: (noticeId: string) => `notif:notice:${noticeId}:published`,
  reminder: (noticeId: string, n: number) => `notif:notice:${noticeId}:reminder-${n}`,
  /** One person added to the audience after publish (spec §5.5). */
  addedLater: (noticeId: string, accountId: string) => `notif:notice:${noticeId}:published:${accountId}`,
};

/** Notices batch by office: there is no office id, so the key carries the office name (spec §4.1 `office:<officeId>`). */
export const batchKeyOf = (notice: Pick<LeanNotice, 'publisher'>): string => `office:${notice.publisher.office}`;
export const groupKeyOf = (noticeId: string): string => `notice:${noticeId}`;

export interface NoticeSource { type: 'notice'; id: string; kind: NotificationSourceKind }
/** Today&Teaching §8: the tier travels in the request, so expansion does not recompute it. */
export interface ClassChangeSource { type: 'class_change'; id: string; kind: 'created' | 'revoked'; tier: NotificationTier }
export type NotificationSource = NoticeSource | ClassChangeSource;

/** Records notification.requested for a notice; idempotent on its dedupe key. */
export async function requestNoticeNotification(collegeId: string, noticeId: string, kind: NotificationSourceKind, accountId?: string): Promise<boolean> {
  const dedupeKey = accountId
    ? notificationKey.addedLater(noticeId, accountId)
    : kind === 'published' ? notificationKey.published(noticeId) : notificationKey.reminder(noticeId, Number(kind.slice('reminder-'.length)));
  const source: NotificationSource = { type: 'notice', id: noticeId, kind };
  return emit(NOTIFICATION_REQUESTED, { collegeId, source, ...(accountId ? { accountId } : {}) }, dedupeKey);
}

export function settingsOf(s: IAccountSettings | undefined): PolicySettings {
  return {
    quietHours: { start: s?.quietHours?.start ?? '22:00', end: s?.quietHours?.end ?? '07:00' },
    tiers: { important: s?.tiers?.important ?? true, routine: s?.tiers?.routine ?? true },
  };
}

/**
 * Accounts that muted every channel the notice appears in. A notice appears in a
 * channel when the channel is in `Notice.channelIds` — the matcher `channelNotices`
 * (notices/mobile-service.ts) reads for the channel screen — so this inverts it:
 * the person's memberships whose channel is in the notice's list (spec §6.2).
 */
export async function mutedEverywhere(collegeId: string, accountIds: Types.ObjectId[], channelIds: Types.ObjectId[]): Promise<Set<string>> {
  if (channelIds.length === 0) return new Set();
  const memberships = await ChannelMembership.find({ collegeId, accountId: { $in: accountIds }, channelId: { $in: channelIds } })
    .select('accountId mutedAt').lean();
  const tally = new Map<string, { total: number; muted: number }>();
  for (const m of memberships) {
    const t = tally.get(String(m.accountId)) ?? { total: 0, muted: 0 };
    t.total += 1;
    if (m.mutedAt) t.muted += 1;
    tally.set(String(m.accountId), t);
  }
  return new Set([...tally].filter(([, t]) => t.muted === t.total).map(([id]) => id));
}

/** The open Routine digest window per account: the earliest `scheduled` Routine row for the batch key (spec §6.4). */
async function openWindows(collegeId: string, accountIds: Types.ObjectId[], batchKey: string): Promise<Map<string, Date>> {
  const rows = await NotificationDelivery.find({ collegeId, accountId: { $in: accountIds }, batchKey, tier: 'routine', status: 'scheduled' })
    .select('accountId sendAfter').lean();
  const out = new Map<string, Date>();
  for (const r of rows) {
    const prev = out.get(String(r.accountId));
    if (!prev || r.sendAfter < prev) out.set(String(r.accountId), r.sendAfter);
  }
  return out;
}

async function expandBatch(
  collegeId: string, notice: LeanNotice, kind: NotificationSourceKind, tier: NotificationTier,
  accountIds: Types.ObjectId[], timezone: string, now: Date,
): Promise<void> {
  const batchKey = batchKeyOf(notice);
  const groupKey = groupKeyOf(String(notice._id));
  const [accounts, muted, windows] = await Promise.all([
    JuviAccount.find({ collegeId, _id: { $in: accountIds } }).select('settings').lean(),
    mutedEverywhere(collegeId, accountIds, notice.channelIds ?? []),
    tier === 'routine' ? openWindows(collegeId, accountIds, batchKey) : Promise.resolve(new Map<string, Date>()),
  ]);
  const settingsBy = new Map(accounts.map((a) => [String(a._id), a.settings]));
  await NotificationDelivery.bulkWrite(accountIds.map((accountId) => {
    const id = String(accountId);
    const settings = settingsOf(settingsBy.get(id));
    const d = decide({ tier, settings, mutedAllMatchingChannels: muted.has(id), now, collegeTimezone: timezone });
    const common = { tier, batchKey, groupKey, sentAt: null, deliveredAt: null, openedAt: null, attempts: 0, lastError: null, lockedUntil: null, createdAt: now, updatedAt: now };
    const row = d.status === 'suppressed'
      ? { ...common, status: 'suppressed' as const, reason: d.reason, sendAfter: now }
      : { ...common, status: 'scheduled' as const, reason: null, sendAfter: tier === 'routine' ? digestSendAfter(d.sendAfter, windows.get(id) ?? null, now, settings, timezone) : d.sendAfter };
    return {
      updateOne: {
        // `collegeId`, `source` and `accountId` are written from the filter on insert. No automatic timestamps: a re-run must not touch updatedAt.
        filter: { collegeId: new Types.ObjectId(collegeId), 'source.type': 'notice', 'source.id': notice._id, 'source.kind': kind, accountId },
        update: { $setOnInsert: row },
        upsert: true,
        timestamps: false,
      },
    };
  }), { ordered: false });
}

/**
 * The consumer. A published notice notifies every recipient on Juvi; a reminder
 * only those who have neither acknowledged nor dismissed it; an added-later request
 * (payload.accountId) only that person. A notice that is not `published` (archived,
 * or still publishing) notifies nobody.
 */
export async function expandNotification(payload: OutboxPayload, now: Date = new Date()): Promise<number> {
  const collegeId = payload.collegeId;
  const source = payload.source as NotificationSource | undefined;
  if (!source || !Types.ObjectId.isValid(source.id)) return 0;
  if (source.type === 'class_change') return expandClassChange(payload, now);
  if (source.type !== 'notice') return 0;
  const notice = await Notice.findOne({ _id: source.id, collegeId }).select('status priority publisher channelIds').lean<LeanNotice>();
  if (!notice || notice.status !== 'published') return 0;

  // A reminder is always Important (spec §4.1, NTC-08).
  const tier: NotificationTier = source.kind === 'published' ? notice.priority : 'important';
  const accountId = typeof payload.accountId === 'string' && Types.ObjectId.isValid(payload.accountId) ? new Types.ObjectId(payload.accountId) : null;
  const filter: Record<string, unknown> = { collegeId, noticeId: notice._id, accountId: accountId ?? { $ne: null } };
  if (source.kind !== 'published') Object.assign(filter, { ack: null, dismissedAt: null });
  const timezone = (await getJuviConfig(collegeId))?.timezone ?? DEFAULT_TIMEZONE;

  let expanded = 0;
  let after: Types.ObjectId | null = null;
  type Page = { _id: Types.ObjectId; accountId: Types.ObjectId }[];
  for (;;) {
    const page: Page = await NoticeRecipient.find(after ? { ...filter, _id: { $gt: after } } : filter)
      .sort({ _id: 1 }).limit(expandBatchSize).select('_id accountId').lean<Page>();
    if (page.length === 0) break;
    after = page[page.length - 1]!._id;
    await expandBatch(collegeId, notice, source.kind, tier, page.map((r) => r.accountId), timezone, now);
    expanded += page.length;
    if (page.length < expandBatchSize) break;
  }
  return expanded;
}

/**
 * The teaching seats of the slot other than the acting user: the offering's
 * facultyId and coFacultyIds plus the slot's substitute and original faculty.
 */
function teachingFacultyOf(offering: { facultyId?: Types.ObjectId; coFacultyIds?: Types.ObjectId[] } | null, slot: { substituteFacultyId?: Types.ObjectId; originalFacultyId?: Types.ObjectId } | null): Types.ObjectId[] {
  const ids = [offering?.facultyId, ...(offering?.coFacultyIds ?? []), slot?.substituteFacultyId, slot?.originalFacultyId]
    .filter((v): v is Types.ObjectId => Boolean(v));
  return [...new Set(ids.map(String))].map((v) => new Types.ObjectId(v));
}

/**
 * notification.requested → one NotificationDelivery row per account for a class
 * change (Today&Teaching §8). Audience: students enrolled in the offering plus
 * the slot's other teaching faculty, minus the acting user, eligible Juvi accounts
 * only. Mute matches the course channel; the tier carried by the request (urgent
 * for a just-announced same-day change) bypasses it inside decide(). Class-change
 * rows are never Routine, so no digest window applies.
 */
export async function expandClassChange(payload: OutboxPayload, now: Date = new Date()): Promise<number> {
  const collegeId = payload.collegeId;
  const source = payload.source as ClassChangeSource | undefined;
  const tier: NotificationTier = source && 'tier' in source && source.tier === 'urgent' ? 'urgent' : 'important';
  if (!source || source.type !== 'class_change' || !Types.ObjectId.isValid(source.id)) return 0;
  const exception = await ClassException.findOne({ _id: source.id, collegeId })
    .select('timetableSlotId courseOfferingId createdBy revokedBy')
    .lean<LeanClassException | null>();
  if (!exception) return 0;
  const [slot, offering, channel, cfg] = await Promise.all([
    TimetableSlot.findOne({ _id: exception.timetableSlotId, collegeId })
      .select('substituteFacultyId originalFacultyId')
      .lean<{ _id: Types.ObjectId; substituteFacultyId?: Types.ObjectId; originalFacultyId?: Types.ObjectId } | null>(),
    CourseOffering.findOne({ _id: exception.courseOfferingId, collegeId })
      .select('facultyId coFacultyIds')
      .lean<{ _id: Types.ObjectId; facultyId?: Types.ObjectId; coFacultyIds?: Types.ObjectId[] } | null>(),
    Channel.findOne({ collegeId, scopeType: 'course_offering', scopeId: exception.courseOfferingId, status: 'active' })
      .select('_id').lean<{ _id: Types.ObjectId } | null>(),
    getJuviConfig(collegeId),
  ]);
  if (!offering) return 0;
  const timezone = cfg?.timezone ?? DEFAULT_TIMEZONE;
  const actorUserId = source.kind === 'created' ? exception.createdBy : exception.revokedBy;
  const [students, accounts] = await Promise.all([
    Enrollment.find({ collegeId, courseOfferingId: exception.courseOfferingId, status: 'enrolled' })
      .select('studentId').lean<{ studentId: Types.ObjectId }[]>(),
    JuviAccount.find({ collegeId, status: { $in: ELIGIBLE_STATUSES } })
      .select('userId studentId facultyId settings')
      .lean<{ _id: Types.ObjectId; userId: Types.ObjectId; studentId?: Types.ObjectId; facultyId?: Types.ObjectId; settings?: IAccountSettings }[]>(),
  ]);
  const studentIds = new Set(students.map((s) => String(s.studentId)));
  const facultyIds = new Set(teachingFacultyOf(offering, slot).map(String));
  const audience = accounts
    .filter((a) => (a.studentId && studentIds.has(String(a.studentId))) || (a.facultyId && facultyIds.has(String(a.facultyId))))
    .filter((a) => String(a.userId) !== String(actorUserId));
  if (audience.length === 0) return 0;
  const muted = await mutedEverywhere(collegeId, audience.map((a) => a._id), channel ? [channel._id] : []);
  const settingsBy = new Map(audience.map((a) => [String(a._id), settingsOf(a.settings)]));
  const groupKey = `class:${String(exception.courseOfferingId)}`;
  await NotificationDelivery.bulkWrite(audience.map((a) => {
    const id = String(a._id);
    const d = decide({ tier, settings: settingsBy.get(id) ?? settingsOf(undefined), mutedAllMatchingChannels: muted.has(id), now, collegeTimezone: timezone });
    const common = { tier, batchKey: 'class', groupKey, sentAt: null, deliveredAt: null, openedAt: null, attempts: 0, lastError: null, lockedUntil: null, createdAt: now, updatedAt: now };
    const row = d.status === 'suppressed'
      ? { ...common, status: 'suppressed' as const, reason: d.reason, sendAfter: now }
      : { ...common, status: 'scheduled' as const, reason: null, sendAfter: d.sendAfter };
    return {
      updateOne: {
        // `collegeId`, `source` and `accountId` are written from the filter on insert. No automatic timestamps: a re-run must not touch updatedAt.
        filter: { collegeId: new Types.ObjectId(collegeId), 'source.type': 'class_change', 'source.id': exception._id, 'source.kind': source.kind, accountId: a._id },
        update: { $setOnInsert: row },
        upsert: true,
        timestamps: false,
      },
    };
  }), { ordered: false });
  return audience.length;
}
