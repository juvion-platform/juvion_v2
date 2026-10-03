import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent } from '../factories/juvi.factory';
import { publishTestNotice } from '../factories/notice.factory';
import { MobileSession } from '../../models/juvi/MobileSession';
import { NotificationDelivery, NotificationTier, LeanNotificationDelivery } from '../../models/juvi/NotificationDelivery';
import { LeanNotice } from '../../models/juvi/Notice';
import { drainOutbox } from '../../shared/outbox';
import { FakePushTransport, PushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';
import { runSender, settle, SEND_BATCH_MAX, SENDER_CONCURRENCY } from '../../modules/juvi-app/notifications/sender';

process.env.E2E_TESTING = '1';

/**
 * Review I3: the sender sends account groups concurrently, claims Urgent before the
 * backlog, and settles only rows whose lease it still holds. Rows and devices are
 * inserted directly: the sender reads only the row, the notice, the recipient row
 * (absent here, so nothing is cancelled) and the account's sessions.
 */

let fx: BaseFixtures;
const fake = new FakePushTransport();
const REASON = 'Exam postponed by the university';
let tokenSeq = 0;

beforeAll(async () => { await getTestApp(); setPushTransport(fake); });
beforeEach(async () => {
  await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId);
  await provisionTestStudent(fx);   // the notice needs an audience; never signed in, so it has no device
  fake.reset();
});
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

/** `n` due rows for `n` fresh accounts, each with one device. */
async function dueRows(notice: LeanNotice, n: number, tier: NotificationTier, sendAfter: Date): Promise<Types.ObjectId[]> {
  const collegeId = new Types.ObjectId(fx.collegeId);
  const accounts = Array.from({ length: n }, () => new Types.ObjectId());
  await MobileSession.collection.insertMany(accounts.map((accountId) => {
    tokenSeq += 1;
    return {
      collegeId, accountId, userId: new Types.ObjectId(), deviceId: `d-${tokenSeq}`, deviceName: 'Phone', platform: 'android', appVersion: '1.0.0', osVersion: '14',
      refreshTokenHash: `h-${tokenSeq}`, refreshExpiresAt: new Date(Date.now() + 86_400_000), lastActiveAt: new Date(), pushToken: `tok-${tokenSeq}`, revokedAt: null,
    };
  }));
  await NotificationDelivery.collection.insertMany(accounts.map((accountId) => ({
    collegeId, accountId, source: { type: 'notice', id: notice._id, kind: 'published' }, tier, status: 'scheduled', reason: null,
    batchKey: `office:${notice.publisher.office}`, groupKey: `notice:${notice._id}`, sendAfter, sentAt: null, deliveredAt: null, openedAt: null,
    attempts: 0, lastError: null, lockedUntil: null, createdAt: sendAfter, updatedAt: sendAfter,
  })));
  return accounts;
}

describe('sender throughput (review I3)', () => {
  it('sends 240 account groups concurrently: well under the serial time with a 50 ms transport', async () => {
    const notice = await publishTestNotice(fx, { priority: 'important' });
    const N = 240;
    await dueRows(notice, N, 'important', new Date(Date.now() - 1_000));
    let inFlight = 0; let peak = 0;
    const slow: PushTransport = {
      name: 'fake',
      async send(tokens) {
        inFlight += 1; peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 50));
        inFlight -= 1;
        return tokens.map((token) => ({ token, ok: true }));
      },
    };
    const started = Date.now();
    const stats = await runSender(new Date(), slow);
    const wall = Date.now() - started;
    expect(stats).toMatchObject({ claimed: N, sent: N });
    expect(await NotificationDelivery.countDocuments({ collegeId: fx.collegeId, status: 'sent' })).toBe(N);
    expect(peak).toBe(SENDER_CONCURRENCY);
    const serial = N * 50;   // 12 s of transport time alone
    expect(wall).toBeLessThan(serial / 4);
  }, 30_000);

  it('an Urgent row created after a backlog of overdue Important rows is sent in the first pass', async () => {
    // Publish both first: publishing drains the outbox, which runs the sender.
    const important = await publishTestNotice(fx, { priority: 'important' });
    const urgent = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    await dueRows(important, SEND_BATCH_MAX + 20, 'important', new Date(Date.now() - 3_600_000));
    const [urgentAccount] = await dueRows(urgent, 1, 'urgent', new Date());
    const stats = await runSender(new Date(), fake);
    expect(stats.claimed).toBe(SEND_BATCH_MAX);
    const row = (await NotificationDelivery.findOne({ collegeId: fx.collegeId, accountId: urgentAccount }).lean<LeanNotificationDelivery>())!;
    expect(row).toMatchObject({ tier: 'urgent', status: 'sent' });
    expect(fake.sent.filter((m) => m.message.data.tier === 'urgent')).toHaveLength(1);
    expect(await NotificationDelivery.countDocuments({ collegeId: fx.collegeId, tier: 'important', status: 'scheduled' })).toBe(21);
  }, 30_000);

  it('a settle whose lease has been taken over by another pass writes nothing', async () => {
    const notice = await publishTestNotice(fx, { priority: 'important' });
    const [accountId] = await dueRows(notice, 1, 'important', new Date(Date.now() - 1_000));
    const mine = new Date(Date.now() - 5_000);          // the lease this pass set, now expired
    const theirs = new Date(Date.now() + 55_000);       // another pass re-claimed the row
    await NotificationDelivery.updateOne({ collegeId: fx.collegeId, accountId }, { $set: { lockedUntil: theirs } });
    const row = (await NotificationDelivery.findOne({ collegeId: fx.collegeId, accountId }).lean<LeanNotificationDelivery>())!;

    await settle([{ ...row, lockedUntil: mine }], { status: 'sent', sentAt: new Date(), lastError: null });
    expect(await NotificationDelivery.findById(row._id).lean()).toMatchObject({ status: 'scheduled', sentAt: null, lockedUntil: theirs });

    await settle([row], { status: 'sent', sentAt: new Date(), lastError: null });
    expect(await NotificationDelivery.findById(row._id).lean()).toMatchObject({ status: 'sent', lockedUntil: null });
  });
});
