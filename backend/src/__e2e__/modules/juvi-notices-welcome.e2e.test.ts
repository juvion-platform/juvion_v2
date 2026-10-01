import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient } from '../factories/juvi.factory';
import { activateAccount, publishTestNotice, signInAs } from '../factories/notice.factory';
import { College } from '../../models/College';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { Channel } from '../../models/juvi/Channel';
import { AuditLog } from '../../shared/audit';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';

process.env.E2E_TESTING = '1';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const ADMIN = '/api/juvi-app/admin';

beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

async function onboardingStudent(deviceId: string) {
  const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  return { ...s, token: await signInAs(app, fx, s.student.rollNumber, s.tempPassword, deviceId) };
}

describe('GET /onboarding/first-notice (US-5, spec §6.5)', () => {
  it('auto-creates one default welcome notice per kind, records it, and creates snapshot rows on demand', async () => {
    const a = await onboardingStudent('device-a');
    const first = await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200);
    expect(first.body).toMatchObject({ title: 'Welcome to Juvi', purpose: 'welcome', office: 'Juvi', ackRequired: true, deadline: null, state: 'received', isPublisher: false });
    expect((await College.findById(fx.collegeId).lean())!.juvi.welcomeNotice?.studentNoticeId).toBe(first.body.id);
    const row = (await NoticeRecipient.findOne({ noticeId: first.body.id, personId: a.person._id }).lean())!;
    expect(row).toMatchObject({ addedLater: false, ackRequired: true, kind: 'student', labels: { batch: '2024 Batch', section: 'A' } });
    expect(String(row.accountId)).toBe(String(a.account._id));
    expect(row.receivedAt).toBeInstanceOf(Date);
    expect((await Notice.findById(first.body.id).lean())!.counts).toEqual({ audience: 1, onJuvi: 1 });

    // Asking again changes nothing.
    expect((await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200)).body.id).toBe(first.body.id);
    expect(await NoticeRecipient.countDocuments({ noticeId: first.body.id })).toBe(1);

    const b = await onboardingStudent('device-b');
    expect((await mobileClient(app, b.token).get(`${V1}/onboarding/first-notice`).expect(200)).body.id).toBe(first.body.id);
    expect((await Notice.findById(first.body.id).lean())!.counts).toEqual({ audience: 2, onJuvi: 2 });

    const f = await provisionTestFaculty(fx);
    const tf = await signInAs(app, fx, f.faculty.employeeCode, f.tempPassword, 'device-f');
    const facultyWelcome = await mobileClient(app, tf).get(`${V1}/onboarding/first-notice`).expect(200);
    expect(facultyWelcome.body.id).not.toBe(first.body.id);
    expect((await College.findById(fx.collegeId).lean())!.juvi.welcomeNotice?.facultyNoticeId).toBe(facultyWelcome.body.id);
    expect(await Notice.countDocuments({ collegeId: fx.collegeId, purpose: 'welcome' })).toBe(2);
  });

  it('two concurrent first requests share one default', async () => {
    const a = await onboardingStudent('device-a');
    const b = await onboardingStudent('device-b');
    const [ra, rb] = await Promise.all([
      mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`),
      mobileClient(app, b.token).get(`${V1}/onboarding/first-notice`),
    ]);
    expect(ra.body.id).toBe(rb.body.id);
    expect(await Notice.countDocuments({ collegeId: fx.collegeId, purpose: 'welcome' })).toBe(1);
    expect((await Notice.findById(ra.body.id).lean())!.counts.audience).toBe(2);
  });

  it('the acknowledgement is real: audited and in reach, reconciling to the grown audience', async () => {
    const a = await onboardingStudent('device-a');
    const b = await onboardingStudent('device-b');
    const w = (await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200)).body;
    await mobileClient(app, b.token).get(`${V1}/onboarding/first-notice`).expect(200);
    await mobileClient(app, a.token).post(`${V1}/notices/${w.id}/ack`).send({ method: 'hold' }).expect(200);
    await drainOutbox();
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement', entityId: w.id })).toBe(1);
    const reach = (await api.as(fx.admin.token).get(`${ADMIN}/notices/${w.id}/reach`).expect(200)).body;
    expect(reach).toMatchObject({ audience: 2, acknowledged: 1, notSeen: 1, notOnJuvi: 0, addedLater: { total: 0 } });
    expect(reach.acknowledged + reach.seen + reach.notSeen + reach.notOnJuvi).toBe(reach.audience);
  });

  it('publishing a welcome notice fans out to nobody: published at once, no event, no rows, counts at zero', async () => {
    await onboardingStudent('device-a');
    const w = await publishTestNotice(fx, { title: 'Welcome to JIT', purpose: 'welcome', ackRequired: true, audience: { rules: [{ kind: 'role', ids: ['student'] }] } });
    expect(w).toMatchObject({ status: 'published', counts: { audience: 0, onJuvi: 0 } });
    expect(w.publishedAt).toBeInstanceOf(Date);
    expect(await NoticeRecipient.countDocuments({ noticeId: w._id })).toBe(0);
    expect(await OutboxEvent.countDocuments({ collegeId: fx.collegeId, dedupeKey: `notice:${String(w._id)}:published` })).toBe(0);
    const audit = (await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(w._id), action: 'publish' }).lean())!;
    expect(audit.changes.find((c) => c.field === 'status')?.newValue).toBe('published');
  });

  it('refuses a deadline on a welcome notice with a 400, but keeps acknowledgement and comments', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const base = { title: 'Welcome to JIT', body: 'Hello.', purpose: 'welcome', ackRequired: true, audience: { rules: [{ kind: 'role', ids: ['student'] }] } };
    const res = await api.as(fx.admin.token).post(`${ADMIN}/notices`).send({ ...base, ackDeadline: future }).expect(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.map((d: { message: string }) => d.message)).toContain('A welcome notice cannot have a deadline: each person sees it when they join');
    expect(await Notice.countDocuments({ collegeId: fx.collegeId, purpose: 'welcome' })).toBe(0);

    const ok = await api.as(fx.admin.token).post(`${ADMIN}/notices`).send({ ...base, ackCommentAllowed: true }).expect(201);
    expect((await Notice.findById(ok.body.id).lean())!).toMatchObject({ status: 'published', ackRequired: true, ackCommentAllowed: true, ackDeadline: null });
  });

  it('a welcome notice publishes even when nobody matches its rules yet', async () => {
    // No student is provisioned yet, so the batch rule (the factory default) matches nobody.
    const w = await publishTestNotice(fx, { title: 'Welcome, batch', purpose: 'welcome' });
    expect(w).toMatchObject({ status: 'published', counts: { audience: 0, onJuvi: 0 } });
  });

  it('uses the configured welcome notice, creating the onboarding account its row on demand', async () => {
    const a = await onboardingStudent('device-a');
    const configured = await publishTestNotice(fx, { title: 'Welcome to JIT', purpose: 'welcome', ackRequired: true, audience: { rules: [{ kind: 'role', ids: ['student'] }] } });
    expect(configured.counts).toEqual({ audience: 0, onJuvi: 0 });
    expect(await NoticeRecipient.countDocuments({ noticeId: configured._id })).toBe(0);
    const plain = await publishTestNotice(fx, { title: 'Not a welcome' });
    await api.as(fx.admin.token).put(`${ADMIN}/settings`).send({ welcomeNotice: { studentNoticeId: String(plain._id) } }).expect(400);
    await api.as(fx.admin.token).put(`${ADMIN}/settings`).send({ welcomeNotice: { studentNoticeId: String(configured._id) } }).expect(200);

    const res = await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200);
    expect(res.body).toMatchObject({ id: String(configured._id), title: 'Welcome to JIT' });
    expect(await NoticeRecipient.countDocuments({ noticeId: configured._id })).toBe(1);
    expect(String((await NoticeRecipient.findOne({ noticeId: configured._id }).lean())!.accountId)).toBe(String(a.account._id));
    expect((await Notice.findById(configured._id).lean())!.counts).toEqual({ audience: 1, onJuvi: 1 });

    // An archived configured notice falls back to the default.
    await Notice.updateOne({ _id: configured._id }, { $set: { status: 'archived' } });
    const fallback = await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200);
    expect(fallback.body).toMatchObject({ title: 'Welcome to Juvi', office: 'Juvi' });
    await api.as(fx.admin.token).put(`${ADMIN}/settings`).send({ welcomeNotice: { studentNoticeId: null } }).expect(200);
  });
});

describe('GET /channels/:id notices[] (US-6, NTC-07)', () => {
  it('lists the notices whose audience matches the channel and that the caller received', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const other = await provisionTestStudent(fx);
    await reconcileCollege(fx.collegeId);
    const batchChannel = (await Channel.findOne({ collegeId: fx.collegeId, scopeType: 'batch', scopeId: fx.batch._id }).lean())!;
    const forBatch = await publishTestNotice(fx, { title: 'For the batch' });
    await publishTestNotice(fx, { title: 'Just one person', audience: { rules: [{ kind: 'custom', ids: [String(other.person._id)] }] } });
    const t = await signInAs(app, fx, s.student.rollNumber, s.tempPassword, 'device-s');
    const res = await mobileClient(app, t).get(`${V1}/channels/${batchChannel._id}`).expect(200);
    expect(res.body.notices).toHaveLength(1);
    expect(res.body.notices[0]).toMatchObject({ id: String(forBatch._id), title: 'For the batch', audienceLine: 'Sent to 2024 Batch', state: 'received' });
    const college = (await Channel.findOne({ collegeId: fx.collegeId, scopeType: 'college' }).lean())!;
    expect((await mobileClient(app, t).get(`${V1}/channels/${college._id}`).expect(200)).body.notices).toEqual([]);
  });
});
