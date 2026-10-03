import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import supertest from 'supertest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, mobileClient } from '../factories/juvi.factory';
import { publishTestNotice } from '../factories/notice.factory';
import { studentOnJuvi, deliveryOf } from '../factories/notification.factory';
import { MobileSession } from '../../models/juvi/MobileSession';
import { NotificationDelivery } from '../../models/juvi/NotificationDelivery';
import { JuviEvent } from '../../models/juvi/JuviEvent';
import { drainOutbox } from '../../shared/outbox';
import { FakePushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';
import { runSender } from '../../modules/juvi-app/notifications/sender';
import { signReceipt } from '../../modules/juvi-app/notifications/receipts';
import { DIGEST_WINDOW_MS } from '../../modules/juvi-app/notifications/policy';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const PUSH = `${V1}/me/devices/current/push-token`;
const RECEIPTS = `${V1}/notifications/receipts`;
const fake = new FakePushTransport();
const REASON = 'Exam postponed by the university';
const tokenOf = async (deviceId: string) => (await MobileSession.findOne({ deviceId, revokedAt: null }).lean())?.pushToken ?? null;

beforeAll(async () => { app = await getTestApp(); setPushTransport(fake); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

let tokenCounter = 0;
/** A sent Urgent notification and the receipt the app received with it. */
async function sentNotification() {
  tokenCounter += 1;
  const s = await studentOnJuvi(app, fx, { pushToken: `tok-r-${tokenCounter}` });
  const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
  const { data } = fake.sent[fake.sent.length - 1]!.message;
  const row = (await deliveryOf(n._id, s.account._id))!;
  return { s, n, row, deliveryId: data.deliveryId!, receipt: data.receipt! };
}

describe('PUT/DELETE /me/devices/current/push-token (spec §7.1)', () => {
  it('sets the token on the caller\'s session, moving it off any other session first', async () => {
    const a = await studentOnJuvi(app, fx);
    const b = await studentOnJuvi(app, fx);
    await mobileClient(app, a.accessToken).put(PUSH).send({ token: 'fcm-1', platform: 'android' }).expect(204);
    expect(await tokenOf(a.deviceId)).toBe('fcm-1');
    await mobileClient(app, b.accessToken).put(PUSH).send({ token: 'fcm-1', platform: 'android' }).expect(204);
    expect(await tokenOf(a.deviceId)).toBeNull();
    expect(await tokenOf(b.deviceId)).toBe('fcm-1');
    expect(await MobileSession.countDocuments({ pushToken: 'fcm-1' })).toBe(1);

    await mobileClient(app, b.accessToken).delete(PUSH).expect(204);
    expect(await tokenOf(b.deviceId)).toBeNull();
  });

  it('validates the body and needs a session', async () => {
    const a = await studentOnJuvi(app, fx);
    const bad = await mobileClient(app, a.accessToken).put(PUSH).send({ token: 'fcm-1', platform: 'ios' }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    await mobileClient(app, a.accessToken).put(PUSH).send({ token: 'x'.repeat(4097), platform: 'android' }).expect(400);
    await mobileClient(app).put(PUSH).send({ token: 'fcm-1', platform: 'android' }).expect(401);
  });

  it('signing out removes the session\'s token with it', async () => {
    const a = await studentOnJuvi(app, fx, { pushToken: 'fcm-out' });
    await mobileClient(app, a.accessToken).post(`${V1}/auth/sign-out`).expect(204);
    expect(await MobileSession.countDocuments({ pushToken: 'fcm-out' })).toBe(0);
  });
});

describe('POST /notifications/receipts (spec §7.2)', () => {
  it('needs no session: delivered, then opened, each moving the row forward once', async () => {
    const { deliveryId, receipt } = await sentNotification();
    // Inside [sentAt, now], so the clamp leaves it alone.
    const deliveredAt = new Date().toISOString();
    const res = await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId, receipt, event: 'delivered', at: deliveredAt }] }).expect(200);
    expect(res.body).toEqual({ accepted: 1, rejected: 0 });
    expect(await NotificationDelivery.findById(deliveryId).lean()).toMatchObject({ status: 'delivered', deliveredAt: new Date(deliveredAt) });

    const openedAt = new Date().toISOString();
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId, receipt, event: 'opened', at: openedAt }] }).expect(200);
    // A late or repeated delivered receipt is a no-op: status only moves forward.
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId, receipt, event: 'delivered', at: openedAt }] }).expect(200);
    expect(await NotificationDelivery.findById(deliveryId).lean()).toMatchObject({ status: 'opened', deliveredAt: new Date(deliveredAt), openedAt: new Date(openedAt) });
  });

  it('opened with no delivered receipt back-fills deliveredAt; at is clamped to [sentAt, now]', async () => {
    const { row, deliveryId, receipt } = await sentNotification();
    const before = Date.now();
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId, receipt, event: 'opened', at: '2020-01-01T00:00:00.000Z' }] }).expect(200);
    const opened = (await NotificationDelivery.findById(deliveryId).lean())!;
    expect(opened.openedAt).toEqual(row.sentAt);
    expect(opened.deliveredAt).toEqual(row.sentAt);

    const second = await sentNotification();
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId: second.deliveryId, receipt: second.receipt, event: 'delivered', at: '2099-01-01T00:00:00.000Z' }] }).expect(200);
    const delivered = (await NotificationDelivery.findById(second.deliveryId).lean())!;
    expect(delivered.deliveredAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(delivered.deliveredAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('skips forged and expired receipts, and is 401 RECEIPT_INVALID only when every item fails', async () => {
    const { deliveryId, receipt } = await sentNotification();
    const at = new Date().toISOString();
    const forged = `${'A'.repeat(43)}.${receipt.split('.')[1]}`;
    const expired = signReceipt(deliveryId, new Date(Date.now() - 1_000));
    const mixed = await supertest(app).post(RECEIPTS).send({ items: [
      { deliveryId, receipt: forged, event: 'opened', at },
      { deliveryId, receipt, event: 'delivered', at },
    ] }).expect(200);
    expect(mixed.body).toEqual({ accepted: 1, rejected: 1 });
    const none = await supertest(app).post(RECEIPTS).send({ items: [
      { deliveryId, receipt: forged, event: 'opened', at },
      { deliveryId, receipt: expired, event: 'opened', at },
    ] }).expect(401);
    expect(none.body.error.code).toBe('RECEIPT_INVALID');
    expect((await NotificationDelivery.findById(deliveryId).lean())!.status).toBe('delivered');
    await supertest(app).post(RECEIPTS).send({ items: [] }).expect(400);
  });

  it('a Routine digest\'s receipt moves every row sent with it', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-digest' });
    const a = await publishTestNotice(fx, { priority: 'routine', title: 'A' });
    const b = await publishTestNotice(fx, { priority: 'routine', title: 'B' });
    await runSender(new Date(Date.now() + DIGEST_WINDOW_MS + 60_000), fake);
    const { data } = fake.sent[0]!.message;
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId: data.deliveryId, receipt: data.receipt, event: 'delivered', at: new Date().toISOString() }] }).expect(200);
    for (const n of [a, b]) expect((await deliveryOf(n._id, s.account._id))!.status).toBe('delivered');
  });
});

describe('POST /events (spec §7.3)', () => {
  it('stores allow-listed events with the caller, app version and platform; drops invalid ones one by one', async () => {
    const s = await studentOnJuvi(app, fx);
    const at = new Date().toISOString();
    const res = await mobileClient(app, s.accessToken).post(`${V1}/events`).send({ events: [
      { name: 'app.opened', at, props: {} },
      { name: 'notification.opened', at, props: { tier: 'urgent', count: 1 } },
      { name: 'notice.body_viewed', at, props: {} },
      { name: 'settings.changed', at, props: { note: 'free text here' } },
    ] }).expect(200);
    expect(res.body).toEqual({ accepted: 2, rejected: 2 });
    const rows = await JuviEvent.find({ accountId: s.account._id }).sort({ name: 1 }).lean();
    expect(rows.map((r) => r.name)).toEqual(['app.opened', 'notification.opened']);
    expect(rows[1]).toMatchObject({ props: { tier: 'urgent', count: 1 }, appVersion: '1.0.0', platform: 'android' });
    expect(String(rows[0]!.collegeId)).toBe(fx.collegeId);
  });

  it('takes 1–100 events per request and needs a session', async () => {
    const s = await studentOnJuvi(app, fx);
    const one = { name: 'app.opened', at: new Date().toISOString(), props: {} };
    await mobileClient(app, s.accessToken).post(`${V1}/events`).send({ events: [] }).expect(400);
    await mobileClient(app, s.accessToken).post(`${V1}/events`).send({ events: Array(101).fill(one) }).expect(400);
    await mobileClient(app).post(`${V1}/events`).send({ events: [one] }).expect(401);
  });
});
