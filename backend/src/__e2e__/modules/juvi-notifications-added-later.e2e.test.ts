// backend/src/__e2e__/modules/juvi-notifications-added-later.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient } from '../factories/juvi.factory';
import { publishTestNotice } from '../factories/notice.factory';
import { studentOnJuvi, deliveriesFor } from '../factories/notification.factory';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { backfillAddedLater } from '../../modules/juvi-app/notices/recipient-service';
import { FakePushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const fake = new FakePushTransport();
const DAY = 86_400_000;

beforeAll(async () => { app = await getTestApp(); setPushTransport(fake); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

describe('people added later get exactly one push (spec §5.5)', () => {
  it('the Spaces-load back-fill requests one push for that person; a second pass sends nothing', async () => {
    await provisionTestStudent(fx);                                             // the audience at publish
    const n = await publishTestNotice(fx, { priority: 'important', title: 'Fee dates' });
    expect(fake.sent).toHaveLength(0);

    const late = await studentOnJuvi(app, fx, { pushToken: 'tok-late' });
    await mobileClient(app, late.accessToken).get(`${V1}/spaces`).expect(200);  // reconcileAccount → backfillAddedLater
    await drainOutbox();
    expect(await NoticeRecipient.exists({ noticeId: n._id, personId: late.person._id, addedLater: true })).toBeTruthy();
    expect(await OutboxEvent.exists({ dedupeKey: `notif:notice:${n._id}:published:${late.account._id}` })).toBeTruthy();
    expect(fake.sent.map((m) => [m.tokens, m.message.data.noticeId, m.message.data.title])).toEqual([[['tok-late'], String(n._id), 'Fee dates']]);

    await NoticeRecipient.deleteOne({ noticeId: n._id, personId: late.person._id });
    await backfillAddedLater(fx.collegeId, String(late.account._id));           // re-inserts the row, re-requests the push
    await drainOutbox();
    expect(fake.sent).toHaveLength(1);
    expect((await deliveriesFor(n._id)).filter((r) => String(r.accountId) === String(late.account._id))).toHaveLength(1);
  });

  it('only for notices under 7 days old whose deadline has not passed', async () => {
    await provisionTestStudent(fx);
    const old = await publishTestNotice(fx, { title: 'Eight days old', priority: 'important' });
    await Notice.updateOne({ _id: old._id }, { $set: { publishedAt: new Date(Date.now() - 8 * DAY) } });
    const closed = await publishTestNotice(fx, { title: 'Deadline passed', priority: 'important', ackRequired: true, ackDeadline: new Date(Date.now() + DAY).toISOString() });
    await Notice.updateOne({ _id: closed._id }, { $set: { ackDeadline: new Date(Date.now() - 60_000) } });
    const open = await publishTestNotice(fx, { title: 'Still open', priority: 'important', ackRequired: true, ackDeadline: new Date(Date.now() + DAY).toISOString() });

    const late = await studentOnJuvi(app, fx, { pushToken: 'tok-late' });
    expect(await backfillAddedLater(fx.collegeId, String(late.account._id))).toBe(3);   // every row is still added
    await drainOutbox();
    expect(fake.sent.map((m) => m.message.data.noticeId)).toEqual([String(open._id)]);
  });

  it('a person not yet active gets the row but no push', async () => {
    await provisionTestStudent(fx);
    await publishTestNotice(fx);
    const onboarding = await provisionTestStudent(fx);
    expect(await backfillAddedLater(fx.collegeId, String(onboarding.account._id))).toBe(1);
    await drainOutbox();
    expect(await OutboxEvent.countDocuments({ dedupeKey: { $regex: `:published:${onboarding.account._id}$` } })).toBe(0);
  });
});
