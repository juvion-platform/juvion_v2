import { FilterQuery, Model, Types } from 'mongoose';

import redis from '../../../config/redis';
import { AuditLog, createAuditLog } from '../../../shared/audit';
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

