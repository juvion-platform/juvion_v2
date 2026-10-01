/**
 * Outbox consumers for notices (spec §6.3). Register them with
 * registerNoticeConsumers(); never write a queue of your own.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { Person } from '../../../models/people/Person';
import { registerConsumer, registerSweeper, emit, OutboxPayload } from '../../../shared/outbox';
import { createAuditLog, AuditLog } from '../../../shared/audit';
import { loadAudienceGraph } from './audience-graph';
import { resolveAudience, PersonNode } from './audience';
import { channelIdsForRules, NOTICE_EVENTS, noticeEventKey } from './publish-service';

export const FANOUT_BATCH_SIZE = 1000;
export const STUCK_PUBLISHING_MS = 120_000;

/**
 * The batch size `fanOutNotice` actually loops with. Defaults to
 * `FANOUT_BATCH_SIZE`; test-only setters below let a partial-failure test
 * exercise the multi-batch path without waiting on 1,000 real rows, without
 * changing the documented production constant.
 */
let fanoutBatchSize: number = FANOUT_BATCH_SIZE;
export function __setFanoutBatchSizeForTesting(n: number): void { fanoutBatchSize = n; }
export function __resetFanoutBatchSizeForTesting(): void { fanoutBatchSize = FANOUT_BATCH_SIZE; }

function snapshotRow(notice: LeanNotice, p: PersonNode, now: Date) {
  const onJuvi = Boolean(p.accountId);
  return {
    collegeId: notice.collegeId, noticeId: notice._id, personId: new Types.ObjectId(p.personId),
    accountId: onJuvi ? new Types.ObjectId(p.accountId!) : null, kind: p.kind, labels: p.labels,
    addedLater: false, ackRequired: notice.ackRequired, deadline: notice.ackDeadline ?? null,
    receivedAt: onJuvi ? now : null, seenAt: null, dismissedAt: null, remindedAt: null, ack: null, archived: false,
  };
}

/**
 * notice.published: resolve the audience, upsert one NoticeRecipient per member in
 * batches of 1,000 (`ordered: false`, upsert on the unique (noticeId, personId)),
 * then set counts, channelIds, status and publishedAt. Idempotent: a notice that is
 * no longer `publishing` is left alone, and a retry only inserts the missing rows.
 */
export async function fanOutNotice(payload: OutboxPayload): Promise<void> {
  const collegeId = payload.collegeId;
  const noticeId = String(payload.noticeId);
  const notice = await Notice.findOne({ _id: noticeId, collegeId }).lean<LeanNotice>();
  if (!notice || notice.status !== 'publishing') return;

  const people = resolveAudience(notice.audience.rules, await loadAudienceGraph(collegeId));
  const now = new Date();
  for (let i = 0; i < people.length; i += fanoutBatchSize) {
    const batch = people.slice(i, i + fanoutBatchSize);
    await NoticeRecipient.bulkWrite(batch.map((p) => ({
      updateOne: {
        filter: { noticeId: notice._id, personId: new Types.ObjectId(p.personId) },
        update: { $setOnInsert: snapshotRow(notice, p, now) },
        upsert: true,
      },
    })), { ordered: false });
  }

  const snapshot = { collegeId, noticeId: notice._id, addedLater: false };
  const [audience, onJuvi, channelIds] = await Promise.all([
    NoticeRecipient.countDocuments(snapshot),
    NoticeRecipient.countDocuments({ ...snapshot, accountId: { $ne: null } }),
    channelIdsForRules(collegeId, notice.audience.rules),
  ]);
  await Notice.updateOne(
    { _id: notice._id, collegeId, status: 'publishing' },
    { $set: { counts: { audience, onJuvi }, channelIds, status: 'published', publishedAt: now } },
  );
  console.log(`[juvi-notices] fan-out ${noticeId}: ${audience} recipients, ${onJuvi} on Juvi`);
}

/** Re-emits notice.published for notices stuck in `publishing` for over 2 minutes; the dedupe key makes it a no-op when the event exists. */
export async function sweepStuckNotices(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_PUBLISHING_MS);
  // Tenancy enumerator (like reconcileAllEnabledColleges): colleges with stuck notices, then a per-college query.
  const collegeIds = await Notice.distinct('collegeId', { status: 'publishing', createdAt: { $lt: cutoff } });
  let emitted = 0;
  for (const cid of collegeIds) {
    const stuck = await Notice.find({ collegeId: cid, status: 'publishing', createdAt: { $lt: cutoff } }).select('_id').limit(100).lean();
    for (const n of stuck) {
      const id = String(n._id);
      if (await emit(NOTICE_EVENTS.published, { collegeId: String(cid), noticeId: id }, noticeEventKey.published(id))) emitted += 1;
    }
  }
  return emitted;
}

/**
 * notice.acknowledged: the ERP audit entry (spec §6.3, NTC-06). Never the comment text.
 * One entry per recipient row, even when the event is retried.
 */
export async function recordAcknowledgement(payload: OutboxPayload): Promise<void> {
  const collegeId = payload.collegeId;
  const row = await NoticeRecipient.findOne({ _id: String(payload.recipientId), collegeId }).lean<LeanNoticeRecipient>();
  if (!row?.ack) return;
  const recipientId = String(row._id);
  const noticeId = String(row.noticeId);
  if (await AuditLog.exists({ collegeId, entityType: 'NoticeAcknowledgement', entityId: noticeId, 'changes.newValue.recipientId': recipientId })) return;
  const [notice, person] = await Promise.all([
    Notice.findOne({ _id: row.noticeId, collegeId }).select('publisher.office').lean(),
    Person.findOne({ _id: row.personId, collegeId }).select('name').lean(),
  ]);
  const name = person?.name ?? 'Unknown member';
  await createAuditLog({
    collegeId, entityType: 'NoticeAcknowledgement', entityId: noticeId,
    entityName: `Notice from ${notice?.publisher.office ?? 'the college'}`,
    action: 'acknowledge',
    changes: [{
      field: 'ack', displayName: 'Acknowledged', oldValue: null,
      newValue: {
        recipientId, name, at: row.ack.at, late: row.ack.late, method: row.ack.method,
        offline: row.ack.offline, sessionId: String(row.ack.sessionId), hasComment: Boolean(row.ack.comment),
      },
    }],
    performedBy: name,
  });
}

/** notice.reminder: stamp remindedAt on members who have neither acknowledged nor dismissed. */
export async function markReminded(payload: OutboxPayload): Promise<void> {
  await NoticeRecipient.updateMany(
    { collegeId: payload.collegeId, noticeId: String(payload.noticeId), ack: null, dismissedAt: null, archived: false },
    { $set: { remindedAt: new Date() } },
  );
}

/** notice.archived: mirror the archive onto every row (it drives the Due filter). */
export async function mirrorArchive(payload: OutboxPayload): Promise<void> {
  await NoticeRecipient.updateMany({ collegeId: payload.collegeId, noticeId: String(payload.noticeId) }, { $set: { archived: true } });
}

export function registerNoticeConsumers(): void {
  registerConsumer(NOTICE_EVENTS.published, fanOutNotice);
  registerConsumer(NOTICE_EVENTS.acknowledged, recordAcknowledgement);
  registerConsumer(NOTICE_EVENTS.reminder, markReminded);
  registerConsumer(NOTICE_EVENTS.archived, mirrorArchive);
  registerSweeper(async () => { await sweepStuckNotices(); });
}
