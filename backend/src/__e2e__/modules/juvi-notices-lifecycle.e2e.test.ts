import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent, mobileClient } from '../factories/juvi.factory';
import { activateAccount, publishTestNotice, signInAs } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { drainOutbox } from '../../shared/outbox';
import { backfillAddedLater } from '../../modules/juvi-app/notices/recipient-service';

process.env.E2E_TESTING = '1';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const ADMIN = '/api/juvi-app/admin/notices';

beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('publish → fan-out → acknowledge → reach, end to end (spec §12)', () => {
  it('an ERP publish reaches the app, the acknowledgement shows in ERP reach, and the counts reconcile', async () => {
    const a = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(a.account._id));
    const b = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(b.account._id));
    await provisionTestStudent(fx);                                  // Not on Juvi
    const created = await api.as(fx.admin.token).post(ADMIN).send({
      title: 'Fee dates', body: 'Pay by Friday.', ackRequired: true, audience: { rules: [{ kind: 'batch', ids: [String(fx.batch._id)] }] },
    }).expect(201);
    await drainOutbox();

    const ta = await signInAs(app, fx, a.student.rollNumber, a.tempPassword, 'device-a');
    const tb = await signInAs(app, fx, b.student.rollNumber, b.tempPassword, 'device-b');
    expect((await mobileClient(app, ta).get(`${V1}/attention`)).body.items.map((c: { id: string }) => c.id)).toEqual([created.body.id]);
    await mobileClient(app, ta).post(`${V1}/notices/${created.body.id}/ack`).send({ method: 'hold' }).expect(200);
    await mobileClient(app, tb).post(`${V1}/notices/${created.body.id}/seen`).expect(200);
    await drainOutbox();

    const reach = (await api.as(fx.admin.token).get(`${ADMIN}/${created.body.id}/reach`).expect(200)).body;
    expect(reach).toMatchObject({ audience: 3, acknowledged: 1, seen: 1, notSeen: 0, notOnJuvi: 1 });
    expect(reach.acknowledged + reach.seen + reach.notSeen + reach.notOnJuvi).toBe(reach.audience);
    const list = (await api.as(fx.admin.token).get(ADMIN).expect(200)).body.items[0];
    expect(list).toMatchObject({ acknowledged: 1, seen: 1, counts: { audience: 3, onJuvi: 2 } });
  });
});

describe('Not on Juvi, then activation (spec §6.6)', () => {
  it('a member who activates after publish receives the card, and reach moves them from Not on Juvi to not seen', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const n = await publishTestNotice(fx, { ackRequired: true });
    expect(n.counts).toEqual({ audience: 1, onJuvi: 0 });
    const t = await signInAs(app, fx, s.student.rollNumber, s.tempPassword, 'device-s');
    expect((await mobileClient(app, t).get(`${V1}/attention`)).body.dueCount).toBe(0);

    for (const step of [0, 1, 2, 3]) await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step }).expect(200);

    const row = (await NoticeRecipient.findOne({ noticeId: n._id, personId: s.person._id }).lean())!;
    expect(String(row.accountId)).toBe(String(s.account._id));
    expect(row.receivedAt).toBeInstanceOf(Date);
    expect(row.addedLater).toBe(false);
    expect((await Notice.findById(n._id).lean())!.counts).toEqual({ audience: 1, onJuvi: 1 });
    expect((await mobileClient(app, t).get(`${V1}/attention`)).body.items.map((c: { id: string }) => c.id)).toEqual([String(n._id)]);
    expect((await api.as(fx.admin.token).get(`${ADMIN}/${n._id}/reach`).expect(200)).body).toMatchObject({ audience: 1, notSeen: 1, notOnJuvi: 0 });
  });
});

describe('added later (spec §6.5, §6.6)', () => {
  it('a member who matches after publish gets an added-later row on the Spaces load, reported apart from the snapshot', async () => {
    await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const n = await publishTestNotice(fx, { ackRequired: true });
    const late = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(late.account._id));
    const t = await signInAs(app, fx, late.student.rollNumber, late.tempPassword, 'dev-late');
    await mobileClient(app, t).get(`${V1}/spaces`).expect(200);                 // reconcileAccount → backfillAddedLater

    const row = (await NoticeRecipient.findOne({ noticeId: n._id, personId: late.person._id }).lean())!;
    expect(row).toMatchObject({ addedLater: true, ackRequired: true, labels: { batch: '2024 Batch', section: 'A' } });
    expect(String(row.accountId)).toBe(String(late.account._id));
    expect((await mobileClient(app, t).get(`${V1}/attention`)).body.dueCount).toBe(1);

    const reach = (await api.as(fx.admin.token).get(`${ADMIN}/${n._id}/reach`).expect(200)).body;
    expect(reach).toMatchObject({ audience: 1, notOnJuvi: 1, addedLater: { total: 1, acknowledged: 0, seen: 0 } });
    expect(reach.acknowledged + reach.seen + reach.notSeen + reach.notOnJuvi).toBe(reach.audience);
    expect((await api.as(fx.admin.token).get(`${ADMIN}/${n._id}/reach/pending`).expect(200)).body.items.map((p: { name: string }) => p.name)).not.toContain(late.person.name);
    expect((await Notice.findById(n._id).lean())!.counts).toEqual({ audience: 1, onJuvi: 0 });

    expect(await backfillAddedLater(fx.collegeId, String(late.account._id))).toBe(0);   // idempotent
    expect(await NoticeRecipient.countDocuments({ noticeId: n._id })).toBe(2);
  });

  it('skips notices older than 30 days, archived, welcome and non-matching notices; an onboarding member gets the card on activation', async () => {
    await provisionTestStudent(fx);
    const old = await publishTestNotice(fx, { title: 'Old' });
    await Notice.updateOne({ _id: old._id }, { $set: { publishedAt: new Date(Date.now() - 31 * 86_400_000) } });
    const archived = await publishTestNotice(fx, { title: 'Archived' });
    await Notice.updateOne({ _id: archived._id }, { $set: { status: 'archived' } });
    await publishTestNotice(fx, { title: 'Welcome', purpose: 'welcome', audience: { rules: [{ kind: 'role', ids: ['student'] }] } });
    const other = await provisionTestStudent(fx, { branchId: String(fx.eceBranch._id) });
    await publishTestNotice(fx, { title: 'Custom', audience: { rules: [{ kind: 'custom', ids: [String(other.person._id)] }] } });
    const current = await publishTestNotice(fx, { title: 'Current' });

    const late = await provisionTestStudent(fx);                                    // onboarding: Not on Juvi
    expect(await backfillAddedLater(fx.collegeId, String(late.account._id))).toBe(1);
    const rows = await NoticeRecipient.find({ personId: late.person._id }).lean();
    expect(rows.map((r) => String(r.noticeId))).toEqual([String(current._id)]);
    expect(rows[0]).toMatchObject({ addedLater: true, accountId: null, receivedAt: null });

    await activateAccount(String(late.account._id));
    const after = (await NoticeRecipient.findOne({ personId: late.person._id }).lean())!;
    expect(String(after.accountId)).toBe(String(late.account._id));
    expect(after.receivedAt).toBeInstanceOf(Date);
    expect((await Notice.findById(current._id).lean())!.counts.onJuvi).toBe(0);     // added-later rows stay out of the snapshot counts
  });
});
