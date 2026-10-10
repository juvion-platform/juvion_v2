import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn(), status: 'ready' }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));

import { deleteScoped, runAccountDeletion } from '../deletion-service';
import { AuditLog, createAuditLog } from '../../../../shared/audit';
import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { JuviAccount } from '../../../../models/juvi/JuviAccount';
import { MobileSession } from '../../../../models/juvi/MobileSession';
import { ChannelMembership } from '../../../../models/juvi/ChannelMembership';
import { JuviProvisionedCredential } from '../../../../models/juvi/JuviProvisionedCredential';
import { NotificationDelivery } from '../../../../models/juvi/NotificationDelivery';
import { JuviEvent } from '../../../../models/juvi/JuviEvent';
import { NoticeRecipient } from '../../../../models/juvi/NoticeRecipient';
import { Notice } from '../../../../models/juvi/Notice';
import { User } from '../../../../models/User';
import { Person } from '../../../../models/people/Person';

const oid = () => new Types.ObjectId();

/**
 * 011-account-deletion T3 — the tenancy guard on the module's deleteMany path.
 *
 * The scope-plugin hooks findOne/updateOne/deleteOne/… but NOT deleteMany, and it is
 * inert on the mobile stack. Nothing else scopes these writes, so `deleteScoped` is
 * the only thing standing between a bug and a cross-college delete.
 */
describe('deleteScoped', () => {
  it('throws without a collegeId and does not touch the model', async () => {
    const model = { deleteMany: vi.fn() } as any;
    await expect(deleteScoped(model, { accountId: 'a1' })).rejects.toThrow(/collegeId/);
    expect(model.deleteMany).not.toHaveBeenCalled();
  });

  it('passes the filter through untouched when collegeId is present', async () => {
    const model = { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }) } as any;
    const res = await deleteScoped(model, { collegeId: 'c1', accountId: 'a1' });
    expect(model.deleteMany).toHaveBeenCalledWith({ collegeId: 'c1', accountId: 'a1' });
    expect(res.deletedCount).toBe(2);
  });
});

/** Seeds one college's full Juvi footprint for an account and returns the created rows. */
async function seedCollege(collegeId: Types.ObjectId, tag: string) {
  const personId = oid();
  const user = await new User({ email: `${tag}@x.test`, password: 'plain-secret', name: tag, role: 'student', personaType: 'L-STU' }).save();
  await Person.create({ _id: personId, collegeId, name: `Person ${tag}`, phone: '1' });
  const account = await JuviAccount.create({ collegeId, personId, userId: user._id, kind: 'student', provisionedBy: 'test' });

  const notice = await Notice.create({
    collegeId, title: `N ${tag}`, body: 'b', publisher: { office: 'Registrar' },
    status: 'published', counts: { audience: 1, onJuvi: 1 },
  });
  await MobileSession.create({ collegeId, accountId: account._id, userId: user._id, deviceId: 'd1', deviceName: 'Pixel', platform: 'android', appVersion: '1.0.0', osVersion: '14', refreshTokenHash: `h-${tag}`, refreshExpiresAt: new Date() });
  await ChannelMembership.create({ collegeId, channelId: oid(), accountId: account._id });
  await JuviProvisionedCredential.create({ collegeId, accountId: account._id, source: 'bulk', identifier: `id-${tag}`, displayName: tag, ciphertext: Buffer.from('a'), iv: Buffer.from('b'), authTag: Buffer.from('c'), expiresAt: new Date() });
  await NotificationDelivery.create({ collegeId, accountId: account._id, source: { type: 'notice', id: notice._id, kind: 'published' }, tier: 'routine', status: 'sent', batchKey: 'k', groupKey: 'g', sendAfter: new Date() });
  await JuviEvent.create({ collegeId, accountId: account._id, name: 'notice.seen', at: new Date() });
  await NoticeRecipient.create({ collegeId, noticeId: notice._id, personId, accountId: account._id, kind: 'student', ack: { at: new Date(), late: false, method: 'hold', sessionId: oid(), offline: false } });

  return { user, account, notice, personId };
}

describe('runAccountDeletion (011 T4)', () => {
  beforeAll(async () => { await setupMongo(); }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); vi.clearAllMocks(); redisMock.set.mockResolvedValue('OK'); });

  it('deletes the Juvi-owned rows, resets the audience snapshot, and leaves the ERP login intact (AC3)', async () => {
    const collegeId = oid();
    const { user, account, notice } = await seedCollege(collegeId, 'alice');
    const hashBefore = user.password;

    await runAccountDeletion(account);

    // AC3 — the single worst failure mode: the person's ERP login must survive. The existence check
    // is `not.toBeNull()`, not `toBeDefined()`: a deleted user comes back as `null`, and `null` is
    // defined, so the weaker form would pass on exactly the failure this guards.
    const after = await User.findById(user._id).lean();
    expect(after).not.toBeNull();
    expect(after!.isActive).toBe(true);
    expect(after!.password).toBe(hashBefore);

    // The six accountId-bearing collections lose this account's rows.
    expect(await JuviAccount.countDocuments({ collegeId })).toBe(0);
    expect(await MobileSession.countDocuments({ collegeId })).toBe(0);
    expect(await ChannelMembership.countDocuments({ collegeId })).toBe(0);
    expect(await JuviProvisionedCredential.countDocuments({ collegeId })).toBe(0);
    expect(await NotificationDelivery.countDocuments({ collegeId })).toBe(0);
    expect(await JuviEvent.countDocuments({ collegeId })).toBe(0);

    // The audience snapshot is reset, never deleted — the college keeps the notice's audience record.
    const snap = await NoticeRecipient.findOne({ collegeId }).lean();
    expect(snap).toBeDefined();
    expect(snap!.accountId).toBeNull();
    expect(snap!.ack).toBeNull();
    expect(snap!.receivedAt).toBeNull();
    expect(snap!.personId).toEqual(account.personId);

    // …and the cached on-Juvi counter is recounted, not left at its published value.
    const n = await Notice.findById(notice._id).lean();
    expect(n!.counts.onJuvi).toBe(0);

    // The execution audit entry exists and names the account, not the identifier.
    const entry = await AuditLog.findOne({ collegeId, entityType: 'JuviAccount', action: 'delete' }).lean();
    expect(entry).toBeDefined();
    expect(entry!.entityId).toBe(String(account._id));

    // AC2 — the touch-cache key for the deleted account goes too.
    expect(redisMock.del).toHaveBeenCalledWith(`juvi:acct-touch:${String(account._id)}`);
  });

  it('writes the delete entry even when a provisioning create entry already exists (AC4)', async () => {
    const collegeId = oid();
    const { account } = await seedCollege(collegeId, 'carol');

    // The provisioning path writes a `create` entry for this same {collegeId, entityType, entityId}.
    // A guard that omits `action: 'delete'` matches it and silently suppresses the deletion record.
    await createAuditLog({
      collegeId: String(collegeId),
      entityType: 'JuviAccount',
      entityId: String(account._id),
      entityName: 'carol',
      action: 'create',
      changes: [],
      performedBy: 'admin',
    });

    await runAccountDeletion(account);

    expect(await AuditLog.countDocuments({ collegeId, entityType: 'JuviAccount', entityId: String(account._id), action: 'delete' })).toBe(1);
    expect(await AuditLog.countDocuments({ collegeId, entityType: 'JuviAccount', entityId: String(account._id), action: 'create' })).toBe(1);
  });

  it('never touches another college (AC7, Story 2)', async () => {
    const collegeA = oid();
    const collegeB = oid();
    const a = await seedCollege(collegeA, 'a');
    const b = await seedCollege(collegeB, 'b');

    await runAccountDeletion(a.account);

    expect(await JuviAccount.countDocuments({ collegeId: collegeA })).toBe(0);
    expect(await MobileSession.countDocuments({ collegeId: collegeA })).toBe(0);
    expect(await ChannelMembership.countDocuments({ collegeId: collegeA })).toBe(0);
    expect(await JuviProvisionedCredential.countDocuments({ collegeId: collegeA })).toBe(0);
    expect(await NotificationDelivery.countDocuments({ collegeId: collegeA })).toBe(0);
    expect(await JuviEvent.countDocuments({ collegeId: collegeA })).toBe(0);

    expect(await JuviAccount.countDocuments({ collegeId: collegeB })).toBe(1);
    expect(await MobileSession.countDocuments({ collegeId: collegeB })).toBe(1);
    expect(await ChannelMembership.countDocuments({ collegeId: collegeB })).toBe(1);
    expect(await JuviProvisionedCredential.countDocuments({ collegeId: collegeB })).toBe(1);
    expect(await NotificationDelivery.countDocuments({ collegeId: collegeB })).toBe(1);
    expect(await JuviEvent.countDocuments({ collegeId: collegeB })).toBe(1);
    expect((await NoticeRecipient.findOne({ collegeId: collegeB }).lean())!.accountId).toEqual(b.account._id);
  });
});
