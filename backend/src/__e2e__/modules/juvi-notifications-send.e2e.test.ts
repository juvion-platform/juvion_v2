import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, mobileClient } from '../factories/juvi.factory';
import { publishTestNotice } from '../factories/notice.factory';
import { studentOnJuvi, quietHoursAround, deliveriesFor, deliveryOf } from '../factories/notification.factory';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { MobileSession } from '../../models/juvi/MobileSession';
import { NotificationDelivery } from '../../models/juvi/NotificationDelivery';
import { drainOutbox } from '../../shared/outbox';
import { remindNotice } from '../../modules/juvi-app/notices/publish-service';
import { erpActor } from '../../modules/juvi-app/notices/reach-service';
import { FakePushTransport, PushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';
import { runSender, MAX_SEND_ATTEMPTS, __setSenderConcurrencyForTesting } from '../../modules/juvi-app/notifications/sender';
import { verifyReceipt } from '../../modules/juvi-app/notifications/receipts';
import { DIGEST_WINDOW_MS } from '../../modules/juvi-app/notifications/policy';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const fake = new FakePushTransport();
const REASON = 'Exam postponed by the university';
const BODY = 'The mid-semester timetable is attached.';   // publishTestNotice's body
const later = (ms: number) => new Date(Date.now() + ms);

beforeAll(async () => { app = await getTestApp(); setPushTransport(fake); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

describe('sending (spec §5.3, §6.6)', () => {
  it('an Urgent notice goes out in the same dispatcher pass: one data message per device, never the body', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-a' });
    const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON, title: 'Exam postponed' });
    expect(fake.sent).toHaveLength(1);
    const { tokens, message } = fake.sent[0]!;
    expect(tokens).toEqual(['tok-a']);
    const row = (await deliveryOf(n._id, s.account._id))!;
    expect(message).toEqual({
      data: {
        deliveryId: String(row._id), receipt: expect.any(String), kind: 'notice', noticeId: String(n._id), tier: 'urgent',
        groupKey: `notice:${n._id}`, office: n.publisher.office, title: 'Exam postponed', variant: 'published', count: '1',
      },
      priority: 'high', collapseKey: `notice:${n._id}`,
    });
    expect(verifyReceipt(String(row._id), message.data.receipt!)).toBe(true);
    expect(JSON.stringify(fake.sent)).not.toContain(BODY);
    expect(row).toMatchObject({ status: 'sent', attempts: 0, lockedUntil: null });
    expect(row.sentAt).toBeInstanceOf(Date);
  });

  it('a confidential notice sends the office and no title', async () => {
    await studentOnJuvi(app, fx, { pushToken: 'tok-c' });
    await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON, title: 'Disciplinary hearing', confidential: true });
    const { data } = fake.sent[0]!.message;
    expect(data.title).toBeUndefined();
    expect(JSON.stringify(fake.sent)).not.toContain('Disciplinary hearing');
    expect(data.office).toBeTypeOf('string');
  });

  it('a reminder is sent as an Important reminder', async () => {
    await studentOnJuvi(app, fx, { pushToken: 'tok-r' });
    const n = await publishTestNotice(fx, { priority: 'important', ackRequired: true });
    fake.reset();
    await remindNotice(erpActor(fx.collegeId, { id: String(fx.admin.user._id), name: 'Admin', role: 'admin' }), String(n._id));
    await drainOutbox();
    expect(fake.sent.map((m) => [m.message.data.variant, m.message.data.tier])).toEqual([['reminder', 'important']]);
  });

  it('a person with no registered device is counted as no_device', async () => {
    const s = await studentOnJuvi(app, fx);
    const n = await publishTestNotice(fx, { priority: 'important' });
    expect(fake.sent).toHaveLength(0);
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'no_device' });
  });
});

describe('the re-check before sending (spec §5.3 step 1)', () => {
  it('acknowledging before sendAfter cancels the row', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-q' });
    await JuviAccount.updateOne({ _id: s.account._id }, { $set: { 'settings.quietHours': quietHoursAround(new Date()) } });
    const n = await publishTestNotice(fx, { priority: 'important', ackRequired: true });
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'scheduled' });
    await mobileClient(app, s.accessToken).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(200);
    await runSender(later(2 * 3_600_000), fake);
    expect(fake.sent).toHaveLength(0);
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'cancelled', reason: 'acknowledged' });
  });
});

describe('errors (spec §5.3, §11)', () => {
  it('UNREGISTERED clears that session\'s token; a delivery to another device still counts as sent', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-dead' });
    await MobileSession.create({
      collegeId: fx.collegeId, accountId: s.account._id, userId: s.account.userId, deviceId: 'second-phone', deviceName: 'Phone 2', platform: 'android',
      appVersion: '1.0.0', osVersion: '14', refreshTokenHash: 'h-second-phone', refreshExpiresAt: later(86_400_000), pushToken: 'tok-live',
    });
    fake.failToken('tok-dead', 'UNREGISTERED');
    const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'sent' });
    expect(await MobileSession.countDocuments({ accountId: s.account._id, pushToken: 'tok-dead' })).toBe(0);
    expect(await MobileSession.countDocuments({ accountId: s.account._id, pushToken: 'tok-live' })).toBe(1);
  });

  it('when every token is dead the row is no_device', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-gone' });
    fake.failToken('tok-gone', 'INVALID_ARGUMENT');
    const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'no_device' });
  });

  it('a transient error backs off 30 s × 2^attempts and fails after five attempts', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-flaky' });
    fake.failToken('tok-flaky', 'UNAVAILABLE');
    const before = Date.now();
    const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    const first = (await deliveryOf(n._id, s.account._id))!;
    expect(first).toMatchObject({ status: 'scheduled', attempts: 1, lastError: 'UNAVAILABLE', lockedUntil: null });
    expect(first.sendAfter.getTime() - before).toBeGreaterThanOrEqual(60_000 - 1_000);
    for (let i = 2; i <= MAX_SEND_ATTEMPTS; i++) await runSender(later(i * 3_600_000), fake);
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'failed', attempts: MAX_SEND_ATTEMPTS, lastError: 'UNAVAILABLE' });
    expect(fake.sent).toHaveLength(MAX_SEND_ATTEMPTS);
  });
});

describe('Routine batching (NTF-04, spec §6.4)', () => {
  it('ten Routine notices from one office in 15 minutes are one notification with count 10; the next window is 15 minutes out', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-digest' });
    const notices = [];
    for (let i = 1; i <= 10; i++) notices.push(await publishTestNotice(fx, { priority: 'routine', title: `Routine ${i}` }));
    expect(fake.sent).toHaveLength(0);                                  // the window is still open

    await runSender(later(DIGEST_WINDOW_MS + 60_000), fake);
    expect(fake.sent).toHaveLength(1);
    const { data, } = fake.sent[0]!.message;
    expect(data).toMatchObject({ count: '10', tier: 'routine', noticeId: String(notices[9]!._id), variant: 'published' });
    expect(data.title).toBeUndefined();
    expect(fake.sent[0]!.message.priority).toBe('normal');
    const rows = await Promise.all(notices.map((n) => deliveryOf(n._id, s.account._id)));
    expect(new Set(rows.map((r) => r!.status))).toEqual(new Set(['sent']));
    expect(new Set(rows.map((r) => r!.sentAt!.getTime())).size).toBe(1);

    const before = Date.now();
    const eleventh = await publishTestNotice(fx, { priority: 'routine', title: 'Routine 11' });
    const next = (await deliveriesFor(eleventh._id))[0]!;
    expect(next.status).toBe('scheduled');
    expect(next.sendAfter.getTime()).toBeGreaterThanOrEqual(before + DIGEST_WINDOW_MS);
  });
});

describe('the lease runs from the claim, not from the pass start (spec §11)', () => {
  afterEach(() => { __setSenderConcurrencyForTesting(null); });

  it('a row claimed late in a long pass keeps a live lease and is not re-sent by a concurrent pass', async () => {
    // One worker, so the second row is claimed only after the first send's 90 s; with
    // concurrency both rows are claimed at the start of the pass.
    __setSenderConcurrencyForTesting(1);
    await studentOnJuvi(app, fx, { pushToken: 'tok-l1' });
    await studentOnJuvi(app, fx, { pushToken: 'tok-l2' });
    fake.failToken('tok-l1', 'UNAVAILABLE'); fake.failToken('tok-l2', 'UNAVAILABLE');
    const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    expect((await deliveriesFor(n._id)).map((r) => r.status)).toEqual(['scheduled', 'scheduled']);

    await NotificationDelivery.updateMany({ 'source.id': n._id }, { $set: { sendAfter: new Date(Date.now() - 1_000) } });   // due now, so the pass can run at the real time
    let skew = 0;
    const clock = () => new Date(Date.now() + skew);
    const calls: number[] = [];
    const nested: number[] = [];
    let leaseAtSecond = 0; let clockAtSecond = 0;
    const slow: PushTransport = {
      name: 'fake',
      async send(tokens) {
        calls.push(calls.length);
        if (calls.length === 1) skew += 90_000;            // the first send takes 90 s: past the 60 s lease of the pass start
        else {
          const held = await NotificationDelivery.findOne({ lockedUntil: { $ne: null } }).lean();
          leaseAtSecond = held!.lockedUntil!.getTime(); clockAtSecond = clock().getTime();
          nested.push((await runSender(new Date(), slow, clock)).claimed);
        }
        return tokens.map((token) => ({ token, ok: true }));
      },
    };
    const stats = await runSender(new Date(), slow, clock);
    expect(stats.sent).toBe(2);
    expect(leaseAtSecond).toBeGreaterThan(clockAtSecond);
    expect(nested).toEqual([0]);
    expect(calls).toHaveLength(2);
  });
});
