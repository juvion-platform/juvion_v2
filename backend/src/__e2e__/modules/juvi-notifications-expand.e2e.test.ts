// backend/src/__e2e__/modules/juvi-notifications-expand.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient } from '../factories/juvi.factory';
import { publishTestNotice } from '../factories/notice.factory';
import { studentOnJuvi, quietHoursAround, deliveriesFor } from '../factories/notification.factory';
import { Channel } from '../../models/juvi/Channel';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { NotificationDelivery, NotificationSourceKind } from '../../models/juvi/NotificationDelivery';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { archiveNotice, remindNotice } from '../../modules/juvi-app/notices/publish-service';
import { erpActor } from '../../modules/juvi-app/notices/reach-service';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';
import { expandNotification, __setExpandBatchSizeForTesting, batchKeyOf } from '../../modules/juvi-app/notifications/expand-consumer';
import { DIGEST_WINDOW_MS } from '../../modules/juvi-app/notifications/policy';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const REASON = 'Exam postponed by the university';
const near = (d: Date | null | undefined, t: number, slack = 5_000) => Boolean(d) && Math.abs(new Date(d!).getTime() - t) <= slack;
const admin = () => erpActor(fx.collegeId, { id: String(fx.admin.user._id), name: 'Admin', role: 'admin' });

/**
 * The rows exactly as the expansion writes them. The dispatcher pass that expanded them
 * also ran the sender (an afterEvents sweeper), so the rows are rewritten here, at `now`.
 */
async function expanded(noticeId: unknown, kind: NotificationSourceKind = 'published', now = new Date()) {
  const id = String(noticeId);
  await NotificationDelivery.deleteMany({ 'source.id': new Types.ObjectId(id), 'source.kind': kind });
  await expandNotification({ collegeId: fx.collegeId, source: { type: 'notice', id, kind } }, now);
  return deliveriesFor(id, kind);
}
const rowOf = async (noticeId: unknown, accountId: unknown, kind: NotificationSourceKind = 'published') =>
  (await expanded(noticeId, kind)).find((r) => String(r.accountId) === String(accountId));

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterEach(() => { __setExpandBatchSizeForTesting(null); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('notification.requested → one row per person on Juvi (spec §5.1, §5.2)', () => {
  it('fan-out requests the push; each recipient on Juvi gets one scheduled row; re-running changes nothing', async () => {
    const a = await studentOnJuvi(app, fx);
    const b = await studentOnJuvi(app, fx);
    await provisionTestStudent(fx);                                            // Not on Juvi: no row
    const n = await publishTestNotice(fx, { priority: 'important' });
    expect(await OutboxEvent.findOne({ dedupeKey: `notif:notice:${n._id}:published` }).lean()).toMatchObject({ type: 'notification.requested', status: 'done' });
    expect((await deliveriesFor(n._id)).map((r) => String(r.accountId)).sort()).toEqual([String(a.account._id), String(b.account._id)].sort());

    const now = new Date();
    const rows = await expanded(n._id, 'published', now);
    for (const r of rows) {
      expect(r).toMatchObject({ status: 'scheduled', tier: 'important', reason: null, batchKey: batchKeyOf(n), groupKey: `notice:${n._id}`, attempts: 0, lockedUntil: null });
      expect(String(r.collegeId)).toBe(fx.collegeId);
      expect(r.sendAfter).toEqual(now);
    }
    expect(await expandNotification({ collegeId: fx.collegeId, source: { type: 'notice', id: String(n._id), kind: 'published' } })).toBe(2);
    expect(await deliveriesFor(n._id)).toEqual(rows);
  });

  it('walks the recipients in batches', async () => {
    __setExpandBatchSizeForTesting(2);
    for (let i = 0; i < 5; i++) await studentOnJuvi(app, fx);
    const n = await publishTestNotice(fx);
    expect(await deliveriesFor(n._id)).toHaveLength(5);
  });

  it('an archived notice notifies nobody', async () => {
    await studentOnJuvi(app, fx);
    const n = await publishTestNotice(fx);
    await archiveNotice(admin(), String(n._id));
    expect(await expanded(n._id)).toEqual([]);
  });
});

describe('the §6 policy at expansion (NTF-01, NTF-02, PRF-03, SPC-05)', () => {
  it('tier off suppresses Important and Routine, never Urgent', async () => {
    const s = await studentOnJuvi(app, fx);
    await JuviAccount.updateOne({ _id: s.account._id }, { $set: { 'settings.tiers': { important: false, routine: false } } });
    const important = await publishTestNotice(fx, { priority: 'important' });
    const routine = await publishTestNotice(fx, { priority: 'routine' });
    const urgent = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    expect(await rowOf(important._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'tier_off' });
    expect(await rowOf(routine._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'tier_off' });
    expect(await rowOf(urgent._id, s.account._id)).toMatchObject({ status: 'scheduled', tier: 'urgent', reason: null });
  });

  it('muting every channel the notice appears in suppresses it, except Urgent; a notice in none of their channels cannot be muted', async () => {
    const s = await studentOnJuvi(app, fx);
    await reconcileCollege(fx.collegeId);                                     // creates the batch channel and the membership
    const batchChannel = (await Channel.findOne({ collegeId: fx.collegeId, scopeType: 'batch', scopeId: fx.batch._id }).lean())!;
    await mobileClient(app, s.accessToken).put(`${V1}/channels/${batchChannel._id}/mute`).expect(200);

    const muted = await publishTestNotice(fx, { priority: 'important' });
    expect(muted.channelIds.map(String)).toEqual([String(batchChannel._id)]);
    expect(await rowOf(muted._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'muted' });
    const urgent = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    expect(await rowOf(urgent._id, s.account._id)).toMatchObject({ status: 'scheduled' });
    const section = await publishTestNotice(fx, { priority: 'important', audience: { rules: [{ kind: 'section', ids: [String(fx.cseSection._id)] }] } });
    expect(section.channelIds).toEqual([]);
    expect(await rowOf(section._id, s.account._id)).toMatchObject({ status: 'scheduled' });
  });

  it('quiet hours hold Important until the window ends; Urgent goes now', async () => {
    const s = await studentOnJuvi(app, fx);
    const now = new Date();
    await JuviAccount.updateOne({ _id: s.account._id }, { $set: { 'settings.quietHours': quietHoursAround(now) } });
    const important = await publishTestNotice(fx, { priority: 'important' });
    const urgent = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    const held = (await rowOf(important._id, s.account._id))!;
    expect(held.status).toBe('scheduled');
    expect(near(held.sendAfter, now.getTime() + 3_600_000, 61_000)).toBe(true);
    expect(near((await rowOf(urgent._id, s.account._id))!.sendAfter, Date.now(), 30_000)).toBe(true);
  });

  it('a reminder is Important and goes only to those who have not acknowledged or dismissed', async () => {
    const acked = await studentOnJuvi(app, fx);
    const pending = await studentOnJuvi(app, fx);
    const n = await publishTestNotice(fx, { priority: 'routine', ackRequired: true });
    await mobileClient(app, acked.accessToken).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(200);
    await remindNotice(admin(), String(n._id));
    await drainOutbox();
    expect(await OutboxEvent.exists({ dedupeKey: `notif:notice:${n._id}:reminder-1` })).toBeTruthy();
    const rows = await expanded(n._id, 'reminder-1');
    expect(rows.map((r) => String(r.accountId))).toEqual([String(pending.account._id)]);
    expect(rows[0]).toMatchObject({ tier: 'important', status: 'scheduled' });
  });
});

describe('Routine digest windows (NTF-04, spec §6.4)', () => {
  it('opens a window 15 minutes out, and later Routine notices from the office join it', async () => {
    const s = await studentOnJuvi(app, fx);
    const before = Date.now();
    const first = await publishTestNotice(fx, { priority: 'routine', title: 'One' });
    const second = await publishTestNotice(fx, { priority: 'routine', title: 'Two' });
    // Routine rows are not due for 15 minutes, so the sender has not touched them.
    const [r1] = await deliveriesFor(first._id);
    const [r2] = await deliveriesFor(second._id);
    expect(String(r1!.accountId)).toBe(String(s.account._id));
    expect(r1!.status).toBe('scheduled');
    expect(r1!.sendAfter.getTime()).toBeGreaterThanOrEqual(before + DIGEST_WINDOW_MS);
    expect(r2!.sendAfter.getTime()).toBe(r1!.sendAfter.getTime());
    expect(r2!.batchKey).toBe(r1!.batchKey);
  });
});
