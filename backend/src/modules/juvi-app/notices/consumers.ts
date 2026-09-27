/**
 * Outbox consumers for notices (spec §6.3). Register them with
 * registerNoticeConsumers(); never write a queue of your own.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { registerConsumer, registerSweeper, emit, OutboxPayload } from '../../../shared/outbox';
import { loadAudienceGraph } from './audience-graph';
import { resolveAudience, PersonNode } from './audience';
import { channelIdsForRules, NOTICE_EVENTS, noticeEventKey } from './publish-service';

export const FANOUT_BATCH_SIZE = 1000;
export const STUCK_PUBLISHING_MS = 120_000;

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
  for (let i = 0; i < people.length; i += FANOUT_BATCH_SIZE) {
    const batch = people.slice(i, i + FANOUT_BATCH_SIZE);
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

export function registerNoticeConsumers(): void {
  registerConsumer(NOTICE_EVENTS.published, fanOutNotice);
  registerSweeper(async () => { await sweepStuckNotices(); });
}
