import { FilterQuery, Model, Types } from 'mongoose';

import redis from '../../../config/redis';
import { AuditLog, createAuditLog } from '../../../shared/audit';
import { MobileApiError } from '../errors';
import { IJuviAccount, JuviAccount } from '../../../models/juvi/JuviAccount';
import { MobileSession } from '../../../models/juvi/MobileSession';
import { ChannelMembership } from '../../../models/juvi/ChannelMembership';
import { JuviProvisionedCredential } from '../../../models/juvi/JuviProvisionedCredential';
import { NotificationDelivery } from '../../../models/juvi/NotificationDelivery';
import { JuviEvent } from '../../../models/juvi/JuviEvent';
import { NoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { Notice } from '../../../models/juvi/Notice';
import { Person } from '../../../models/people/Person';
import { revokeSession } from './session-service';

/**
 * Tenancy-guarded `deleteMany` for the Juvi account-deletion path (011 §5).
 *
 * The 010 scope-plugin hooks `findOne`/`updateOne`/`deleteOne`/… but **not**
 * `deleteMany` (`shared/rbac/scope-plugin.ts:73`), and it is inert on the mobile
 * stack anyway (it reads `req.authScope`, which the mobile routes never set).
 * Nothing else enforces `collegeId` on these writes, so every delete in this
 * module goes through here rather than calling `deleteMany` directly.
 */
export async function deleteScoped<T>(model: Model<T>, filter: Record<string, unknown>) {
  if (!filter.collegeId) throw new Error('deleteScoped requires collegeId');
  return model.deleteMany(filter as FilterQuery<T>);
}

/**
 * The **only** account-deletion path (011 §3.1, §5) — called by the in-app endpoint,
 * the public executor and the sweep. Order is load-bearing:
 *
 *  1. audit intent (existence-guarded) → 2. revoke sessions write-through → 3. reset
 *  `NoticeRecipient` → 4. delete child rows → 5. delete the account row(s) last.
 *
 * `User` / `Person` / `Student`/`Faculty`/`Staff` and every ERP record are untouched:
 * the person's web login must still work afterwards (Story 2 AC3).
 */
export async function runAccountDeletion(account: IJuviAccount): Promise<void> {
  const collegeId = String(account.collegeId);
  const userId = String(account.userId);
  const primaryId = String(account._id);

  // AC8 — the credential verified is the user's, so the whole account set for it goes.
  const accountIds = (await JuviAccount.find({ collegeId, userId }).select('_id').lean()).map((a) => a._id);
  const ids: Types.ObjectId[] = accountIds.length ? accountIds : [account._id as Types.ObjectId];

  // 1. Execution intent first, existence-guarded. The `action: 'delete'` key is mandatory:
  //    without it the guard also matches the provisioning `create` entry for this account
  //    (`provisioning-service.ts:165-174`) and silently suppresses the deletion record (AC4).
  const alreadyLogged = await AuditLog.exists({ collegeId, entityType: 'JuviAccount', entityId: primaryId, action: 'delete' });
  if (!alreadyLogged) {
    // The account row carries no display name; fall back to the id (which is the documented actor).
    const person = await Person.findById(account.personId).select('name').lean();
    await createAuditLog({
      collegeId,
      entityType: 'JuviAccount',
      entityId: primaryId,
      entityName: person?.name ?? primaryId,
      action: 'delete',
      changes: [],
      performedBy: primaryId,
    });
  }

  // 2. Revoke every session write-through *then* delete (AC2). `deleteMany` alone cannot clear
  //    the 60 s `juvi:sess:<sid>` cache, so a deleted-but-cached session would still be accepted.
  const sessions = await MobileSession.find({ collegeId, accountId: { $in: ids } }).select('_id').lean();
  for (const s of sessions) await revokeSession(String(s._id), 'account_deleted');

  // 3. Reset — never delete — the notice audience snapshot. The row belongs to the notice and the
  //    college keeps it; only the person's Juvi-owned state is cleared.
  const rows = await NoticeRecipient.find({ collegeId, accountId: { $in: ids } }).select('_id noticeId addedLater').lean();
  if (rows.length) {
    await NoticeRecipient.updateMany(
      // Narrow by _id, never by accountId: this is what stops a concurrent fan-out having its
      // newly-set accountId nulled by this pass.
      { collegeId, _id: { $in: rows.map((r) => r._id) } },
      { $set: { accountId: null, receivedAt: null, seenAt: null, dismissedAt: null, remindedAt: null, ack: null } },
    );
    const snapshotNoticeIds = [...new Set(rows.filter((r) => !r.addedLater).map((r) => String(r.noticeId)))];
    for (const noticeId of snapshotNoticeIds) {
      const onJuvi = await NoticeRecipient.countDocuments({ collegeId, noticeId, addedLater: false, accountId: { $ne: null } });
      await Notice.updateOne({ _id: noticeId, collegeId, status: { $ne: 'publishing' } }, { $set: { 'counts.onJuvi': onJuvi } });
    }
  }

  // 4. Child rows.
  await deleteScoped(MobileSession, { collegeId, accountId: { $in: ids } });
  await deleteScoped(ChannelMembership, { collegeId, accountId: { $in: ids } });
  await deleteScoped(JuviProvisionedCredential, { collegeId, accountId: { $in: ids } });
  await deleteScoped(NotificationDelivery, { collegeId, accountId: { $in: ids } });
  await deleteScoped(JuviEvent, { collegeId, accountId: { $in: ids } });
  for (const id of ids) await redis.del(`juvi:acct-touch:${String(id)}`);

  // 5. The account row(s) last, by { collegeId, userId } — not by _id (AC8).
  await deleteScoped(JuviAccount, { collegeId, userId });
}

/**
 * The one clear shape (011 §3.5.1, Story 4 AC1). Three callers — the explicit cancel below, a
 * successful sign-in, a successful password change — and every one of them goes through here so
 * the three fields move together and a reader never has to ask which of them a clear touches.
 *
 * Two properties are load-bearing:
 *  - `deletionClaimedAt: null` in **this** filter, and only here. It is the cancellation deadline:
 *    a clear landing after the executor claimed the row matches nothing and is refused, while one
 *    landing before it matches and wins. Adding it to the *sweep's* claim filter instead would
 *    strand a row whose executor crashed.
 *  - `$unset`, never `$set: null`. The sweep's `{ deletionRequestedAt: 1 }` index is sparse, and a
 *    sparse index still indexes an explicit null — `$set: null` would put every cleared account
 *    back into the scan.
 *
 * Returns whether the clear matched, which is what lets the explicit path tell "too late" from
 * "nothing was pending".
 */
export async function clearDeletionRequest(collegeId: string, accountId: string): Promise<boolean> {
  const res = await JuviAccount.updateOne(
    { _id: accountId, collegeId, deletionRequestedAt: { $ne: null }, deletionClaimedAt: null },
    { $unset: { deletionRequestedAt: 1, deletionRequestedVia: 1, deletionClaimedAt: 1 } },
  );
  return (res.matchedCount ?? 0) > 0;
}

/**
 * The explicit *Cancel deletion* action (Story 4 AC1). Unlike the two best-effort callers, a
 * no-match here is not swallowed: a row that is still set but could not be cleared has been
 * claimed by the executor, so the UI is told *too late* rather than shown a 204 that lies.
 *
 * The re-read happens after the failed clear, which is the order that stays honest under a
 * concurrent claim — if the clear matched, we won and nothing else matters.
 */
export async function cancelDeletionRequest(collegeId: string, accountId: string): Promise<void> {
  if (await clearDeletionRequest(collegeId, accountId)) return;
  const stillPending = await JuviAccount.exists({ _id: accountId, collegeId, deletionRequestedAt: { $ne: null } });
  if (stillPending) {
    throw new MobileApiError(409, 'DELETION_NOT_CANCELLABLE', 'This deletion is already being processed and can no longer be cancelled.');
  }
}

/**
 * The best-effort clear used after a successful sign-in and after a successful password change
 * (Story 4 AC1): regaining the password days later is independent evidence of ownership, so a
 * pending public request is dropped.
 *
 * Never throws, and never touches Redis or a queue. With background jobs disabled an unregistered
 * queue throws (`QueueManager.ts:55-59`); a clear that needed one would 500 every sign-in.
 */
export async function clearDeletionRequestBestEffort(collegeId: string, accountId: string): Promise<void> {
  try {
    await clearDeletionRequest(collegeId, accountId);
  } catch (err) {
    console.warn('[juvi-app] best-effort deletion-request clear failed', accountId, err);
  }
}

/**
 * The deferred public path's grace period, in days (011 §3.5).
 *
 * It lives here rather than in the sweep worker because **two** modules need the same number and
 * neither may own the other: the public endpoint tells the requester when their deletion completes,
 * and the sweep decides when to run it. Defining it in the worker would make the response text
 * depend on the executor, so a drift between the two would be a promise the college never keeps.
 *
 * Seven days is the industry norm for exactly this shape: long enough that a stuffed shared
 * password is not an irreversible silence, short enough that the requester — who may no longer have
 * the app — is not left waiting.
 */
export const DELETION_GRACE_DAYS = 7;

/**
 * Schedule a deletion from the public web form (011 Story 3 AC4, §3.5).
 *
 * **Not the deletion, and deliberately not idempotent-with-a-guard.** The in-app path deletes now,
 * because a live authenticated session plus a typed phrase proves possession. The web form has only
 * a password, and that password is the *shared ERP credential* — so a single stuffed password would
 * otherwise become an unauthenticated, irreversible account destruction. The request therefore sets
 * a deadline and the sweep executes it.
 *
 * Returns whether **this call** was the unset → set transition. Two things hang off it and must not
 * be duplicated by a repeat POST: the `request_deletion` audit row and, in T10, the push. A repeat
 * still re-asserts `deletionRequestedAt` to now, which **extends** the window rather than
 * completing it — deliberate: the second request is a second independent proof of the password, and
 * someone who just asked again has asked to be deleted, not to be deleted sooner.
 *
 * Two statements rather than one `findOneAndUpdate`, because the two branches write different
 * things: only the transition may be reported to the audit trail. `$unset`ing the claim is not
 * needed here — a claimed row means the executor is already past the point of no return, and
 * `clearDeletionRequest` (the only place that unsets) is what refuses in that case, not this.
 */
export async function requestPublicDeletion(collegeId: string, accountId: string): Promise<boolean> {
  const requestedAt = new Date();
  const set = { deletionRequestedAt: requestedAt, deletionRequestedVia: 'public_web' as const };

  const transition = await JuviAccount.updateOne(
    { _id: accountId, collegeId, deletionRequestedAt: null },
    { $set: set },
  );
  if ((transition.matchedCount ?? 0) > 0) return true;

  // Already set: re-assert the clock, and write nothing a reader could mistake for a first request.
  await JuviAccount.updateOne(
    { _id: accountId, collegeId, deletionRequestedAt: { $ne: null } },
    { $set: { deletionRequestedAt: requestedAt } },
  );
  return false;
}

