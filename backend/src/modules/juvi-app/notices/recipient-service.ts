/**
 * Keeps recipient rows in step with accounts (spec §6.6): activation gives a
 * person's rows their account, and the Spaces-load reconcile adds rows for
 * recent notices the person matches now but did not at publish.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { loadAudienceGraph } from './audience-graph';
import { personMatchesRules } from './audience';
import { requestNoticeNotification } from '../notifications';

export const ADDED_LATER_WINDOW_DAYS = 30;
/** An added-later person is notified only for a notice under 7 days old whose deadline, if any, has not passed (notifications spec §5.5). */
export const ADDED_LATER_PUSH_DAYS = 7;

/** Gives the person's account-less rows the account and receivedAt; returns how many rows changed. */
export async function onAccountActivated(collegeId: string, accountId: string, personId: string, now = new Date()): Promise<number> {
  const rows = await NoticeRecipient.find({ collegeId, personId, accountId: null }).select('_id noticeId addedLater').lean();
  if (rows.length === 0) return 0;
  const res = await NoticeRecipient.updateMany(
    { collegeId, _id: { $in: rows.map((r) => r._id) }, accountId: null },
    { $set: { accountId: new Types.ObjectId(accountId), receivedAt: now } },
  );
  // Recounted from the rows, not $inc: an increment landing after the fan-out's own count would over-count.
  // A notice still `publishing` is skipped: its fan-out sets the count itself after its fix-up.
  const snapshotNotices = [...new Set(rows.filter((r) => !r.addedLater).map((r) => String(r.noticeId)))];
  for (const noticeId of snapshotNotices) {
    const onJuvi = await NoticeRecipient.countDocuments({ collegeId, noticeId, addedLater: false, accountId: { $ne: null } });
    await Notice.updateOne({ _id: noticeId, collegeId, status: { $ne: 'publishing' } }, { $set: { 'counts.onJuvi': onJuvi } });
  }
  return res.modifiedCount;
}

/** Inserts `addedLater: true` rows for published standard notices of the last 30 days that now match the account's person. */
export async function backfillAddedLater(collegeId: string, accountId: string, now = new Date()): Promise<number> {
  const account = await JuviAccount.findOne({ _id: accountId, collegeId }).select('_id personId status').lean();
  if (!account) return 0;
  const since = new Date(now.getTime() - ADDED_LATER_WINDOW_DAYS * 86_400_000);
  const candidates = await Notice.find({ collegeId, status: 'published', purpose: 'standard', publishedAt: { $gte: since } })
    .select('_id audience ackRequired ackDeadline publishedAt').lean<LeanNotice[]>();
  if (candidates.length === 0) return 0;
  const have = new Set((await NoticeRecipient.distinct('noticeId', { collegeId, personId: account.personId, noticeId: { $in: candidates.map((n) => n._id) } })).map(String));
  const missing = candidates.filter((n) => !have.has(String(n._id)));
  if (missing.length === 0) return 0;

  const graph = await loadAudienceGraph(collegeId, { personIds: [String(account.personId)] });
  const person = graph.people.get(String(account.personId));
  if (!person) return 0;
  const onJuvi = account.status === 'active';
  const matched = missing.filter((n) => personMatchesRules(n.audience.rules, person, graph));
  const docs = matched.map((n) => ({
    collegeId, noticeId: n._id, personId: account.personId, accountId: onJuvi ? account._id : null,
    kind: person.kind, labels: person.labels, addedLater: true, ackRequired: n.ackRequired,
    deadline: n.ackDeadline ?? null, receivedAt: onJuvi ? now : null,
  }));
  if (docs.length === 0) return 0;
  let inserted: number;
  try {
    inserted = (await NoticeRecipient.insertMany(docs, { ordered: false })).length;
  } catch (err) {
    // A concurrent pass inserted some of the same rows: the unique (noticeId, personId) index kept one each.
    const e = err as { code?: number; writeErrors?: { code?: number }[] };
    const duplicatesOnly = e.code === 11000 || (Boolean(e.writeErrors?.length) && e.writeErrors!.every((w) => w.code === 11000));
    if (!duplicatesOnly) throw err;
    inserted = docs.length - (e.writeErrors?.length ?? 1);
  }
  // One push per person per notice: the per-account dedupe key and the delivery row's unique key stop a second one.
  if (onJuvi) {
    const pushSince = now.getTime() - ADDED_LATER_PUSH_DAYS * 86_400_000;
    for (const n of matched) {
      const recent = new Date(n.publishedAt ?? 0).getTime() >= pushSince;
      const open = !n.ackDeadline || new Date(n.ackDeadline).getTime() > now.getTime();
      if (recent && open) await requestNoticeNotification(collegeId, String(n._id), 'published', String(account._id));
    }
  }
  return inserted;
}
