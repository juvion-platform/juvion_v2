/**
 * The sender (notifications spec §5.3). Registered as an `afterEvents` outbox
 * sweeper, so it runs on the 5 s dispatcher tick and after every kick. It claims
 * due `scheduled` rows one at a time under a 60 s lease (up to 500 a pass),
 * re-checks the notice, gathers a Routine digest, sends one data message to the
 * account's devices, prunes dead tokens and backs off transient failures.
 *
 * Rows are claimed across colleges, like outbox events; every later read and
 * write is scoped by the row's collegeId.
 */
import { NotificationDelivery, LeanNotificationDelivery, DeliveryReason } from '../../../models/juvi/NotificationDelivery';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { MobileSession } from '../../../models/juvi/MobileSession';
import { getPushTransport, PushTransport, PushResult, TOKEN_ERRORS } from './transport';
import { signReceipt, RECEIPT_TTL_MS } from './receipts';
import { buildNoticePush } from './payload';

export const SEND_BATCH_MAX = 500;
export const LEASE_MS = 60_000;
export const MAX_SEND_ATTEMPTS = 5;
export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_MAX_MS = 600_000;

/** 30 s × 2^attempts, capped at ten minutes. */
export function sendBackoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_MAX_MS);
}

export interface SenderStats { claimed: number; sent: number; cancelled: number; noDevice: number; retried: number; failed: number }

type Row = LeanNotificationDelivery;
/** The wall clock; a pass reads it at every claim so the lease runs from the claim, not from the pass start. */
export type Clock = () => Date;
const leaseFree = (now: Date) => ({ $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] });

/** `now` is only the due cut-off for `sendAfter`; the lease is measured on `clock()` at the moment of the claim. */
async function claim(filter: Record<string, unknown>, now: Date, clock: Clock): Promise<Row | null> {
  const claimedAt = clock();
  return NotificationDelivery.findOneAndUpdate(
    { ...filter, status: 'scheduled', sendAfter: { $lte: now }, ...leaseFree(claimedAt) },
    { $set: { lockedUntil: new Date(claimedAt.getTime() + LEASE_MS) } },
    { new: true, sort: { sendAfter: 1 } },
  ).lean<Row>();
}

/** Every other due Routine row in the same digest window: same account and batch key (spec §6.4). */
async function claimDigest(primary: Row, now: Date, clock: Clock): Promise<Row[]> {
  const scope = { collegeId: primary.collegeId, accountId: primary.accountId, batchKey: primary.batchKey, tier: 'routine' };
  const ids = await NotificationDelivery.find({ ...scope, _id: { $ne: primary._id }, status: 'scheduled', sendAfter: { $lte: now }, ...leaseFree(clock()) })
    .select('_id').lean();
  const out: Row[] = [];
  for (const { _id } of ids) {
    const row = await claim({ ...scope, _id }, now, clock);
    if (row) out.push(row);
  }
  return out;
}

async function settle(rows: Row[], set: Record<string, unknown>): Promise<void> {
  if (rows.length === 0) return;
  await NotificationDelivery.updateMany(
    { _id: { $in: rows.map((r) => r._id) }, collegeId: rows[0]!.collegeId, status: 'scheduled' },
    { $set: { ...set, lockedUntil: null } },
  );
}

const cancelReason = (notice: LeanNotice | undefined, row: LeanNoticeRecipient | undefined): DeliveryReason | null => {
  if (!notice || notice.status !== 'published' || row?.archived) return 'archived';
  if (row?.ack) return 'acknowledged';
  if (row?.dismissedAt) return 'dismissed';
  return null;
};

async function sendGroup(primary: Row, transport: PushTransport, now: Date, clock: Clock, stats: SenderStats): Promise<void> {
  const rows = primary.tier === 'routine' ? [primary, ...(await claimDigest(primary, now, clock))] : [primary];
  stats.claimed += rows.length - 1;
  const collegeId = primary.collegeId;
  const noticeIds = rows.map((r) => r.source.id);
  const [notices, recipients] = await Promise.all([
    Notice.find({ collegeId, _id: { $in: noticeIds } }).select('status title confidential publisher publishedAt').lean<LeanNotice[]>(),
    NoticeRecipient.find({ collegeId, noticeId: { $in: noticeIds }, accountId: primary.accountId }).select('noticeId ack dismissedAt archived').lean<LeanNoticeRecipient[]>(),
  ]);
  const noticeBy = new Map(notices.map((n) => [String(n._id), n]));
  const recipientBy = new Map(recipients.map((r) => [String(r.noticeId), r]));

  // 1. Re-check: archived, acknowledged or dismissed since the row was scheduled.
  const live: Row[] = [];
  for (const r of rows) {
    const reason = cancelReason(noticeBy.get(String(r.source.id)), recipientBy.get(String(r.source.id)));
    if (!reason) { live.push(r); continue; }
    await settle([r], { status: 'cancelled', reason });
    stats.cancelled += 1;
  }
  if (live.length === 0) return;

  // 2. The account's devices.
  const sessions = await MobileSession.find({ collegeId, accountId: primary.accountId, revokedAt: null, refreshExpiresAt: { $gt: now }, pushToken: { $type: 'string' } })
    .select('pushToken').lean();
  const tokens = [...new Set(sessions.map((s) => s.pushToken!))];
  if (tokens.length === 0) {
    await settle(live, { status: 'suppressed', reason: 'no_device' });
    stats.noDevice += live.length;
    return;
  }

  // 3. One message: the newest notice of the group carries the delivery id and receipt.
  const publishedAt = (r: Row) => new Date(noticeBy.get(String(r.source.id))?.publishedAt ?? 0).getTime();
  const lead = live.reduce((a, b) => (publishedAt(b) > publishedAt(a) ? b : a));
  const notice = noticeBy.get(String(lead.source.id))!;
  const deliveryId = String(lead._id);
  const message = buildNoticePush({
    deliveryId, receipt: signReceipt(deliveryId, new Date(now.getTime() + RECEIPT_TTL_MS)),
    noticeId: String(notice._id), tier: lead.tier, groupKey: lead.groupKey, office: notice.publisher.office, title: notice.title,
    confidential: notice.confidential ?? false, variant: lead.source.kind === 'published' ? 'published' : 'reminder', count: live.length,
  });
  let results: PushResult[];
  try {
    results = await transport.send(tokens, message);
  } catch {
    results = tokens.map((token) => ({ token, ok: false, error: 'UNAVAILABLE' as const }));
  }

  // 4. Dead tokens leave their sessions.
  const dead = results.filter((r) => !r.ok && r.error && TOKEN_ERRORS.has(r.error)).map((r) => r.token);
  if (dead.length > 0) await MobileSession.updateMany({ collegeId, pushToken: { $in: dead } }, { $unset: { pushToken: 1 } });

  if (results.some((r) => r.ok)) {
    await settle(live, { status: 'sent', sentAt: now, lastError: null });
    stats.sent += live.length;
    return;
  }
  const transient = results.find((r) => !r.ok && !(r.error && TOKEN_ERRORS.has(r.error)));
  if (!transient) {
    // Every device token was dead: nothing left to deliver to.
    await settle(live, { status: 'suppressed', reason: 'no_device' });
    stats.noDevice += live.length;
    return;
  }
  // 5. Transient: back off, and fail after five attempts. `lastError` is the code, never the payload.
  for (const r of live) {
    const attempts = r.attempts + 1;
    const lastError = transient.error ?? 'UNKNOWN';
    if (attempts >= MAX_SEND_ATTEMPTS) {
      await settle([r], { status: 'failed', attempts, lastError });
      stats.failed += 1;
    } else {
      await settle([r], { attempts, lastError, sendAfter: new Date(now.getTime() + sendBackoffMs(attempts)) });
      stats.retried += 1;
    }
  }
}

/** One sender pass. A row whose processing throws keeps its lease and is retried once the lease expires (spec §11). */
export async function runSender(now: Date = new Date(), transport?: PushTransport, clock: Clock = () => new Date()): Promise<SenderStats> {
  const t = transport ?? (await getPushTransport());
  const stats: SenderStats = { claimed: 0, sent: 0, cancelled: 0, noDevice: 0, retried: 0, failed: 0 };
  while (stats.claimed < SEND_BATCH_MAX) {
    const row = await claim({}, now, clock);
    if (!row) break;
    stats.claimed += 1;
    try {
      await sendGroup(row, t, now, clock, stats);
    } catch (err) {
      console.error('[juvi-push] send failed for delivery', String(row._id), err instanceof Error ? err.message : err);
    }
  }
  return stats;
}
