import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const s3 = vi.hoisted(() => ({ configured: false, put: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../shared/s3/s3-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/s3/s3-client')>()),
  isS3Configured: () => s3.configured,
  putObject: (input: unknown) => s3.put(input),
}));

import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { enableJuvi, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, createStaffPublisher, makeHod } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { AuditLog } from '../../shared/audit';

process.env.E2E_TESTING = '1';

let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin/notices';
const batchRule = () => [{ kind: 'batch', ids: [String(fx.batch._id)] }];
const body = (extra: Record<string, unknown> = {}) => ({ title: 'Exam timetable', body: 'Attached.', audience: { rules: batchRule() }, ...extra });

beforeAll(async () => { api = createTestApi(await getTestApp()); });
beforeEach(async () => {
  await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId);
  s3.configured = false; s3.put.mockClear();
});
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

async function publishAs(token: string, extra: Record<string, unknown> = {}) {
  const res = await api.as(token).post(A).send(body(extra)).expect(201);
  await drainOutbox();
  return res.body as { id: string; status: string };
}

describe('publish through the ERP (US-1)', () => {
  it('previews, publishes, lists with counts and shows the detail', async () => {
    const on = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(on.account._id));
    await provisionTestStudent(fx);
    const preview = await api.as(fx.admin.token).post(`${A}/audience-preview`).send({ rules: batchRule() }).expect(200);
    expect(preview.body).toMatchObject({ total: 2, onJuvi: 1, notOnJuvi: 1, line: 'Sent to 2024 Batch' });

    const created = await api.as(fx.admin.token).post(A).send(body({ ackRequired: true, office: 'Exam Section' })).expect(201);
    expect(created.body).toMatchObject({ title: 'Exam timetable', office: 'Exam Section', canManage: true, isMine: true });
    // kick() starts the fan-out inline, so the 201 may already see it finished.
    expect(['delivering', 'delivered']).toContain(created.body.delivery.state);
    await drainOutbox();

    const list = await api.as(fx.admin.token).get(A).expect(200);
    expect(list.body).toMatchObject({ total: 1, page: 1 });
    expect(list.body.items[0]).toMatchObject({
      id: created.body.id, office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published',
      delivery: { state: 'delivered' }, counts: { audience: 2, onJuvi: 1 }, acknowledged: 0, seen: 0,
      deadlineState: 'none', reminders: { used: 0, max: 2 }, isMine: true,
    });
    const detail = await api.as(fx.admin.token).get(`${A}/${created.body.id}`).expect(200);
    expect(detail.body).toMatchObject({ body: 'Attached.', audience: { rules: batchRule(), line: 'Sent to 2024 Batch' }, attachments: [], priority: 'routine', purpose: 'standard' });
  });

  it('refuses out-of-scope audiences with the ERP error shape (HOD targeting another department)', async () => {
    const hod = await makeHod(fx, fx.cse);
    await provisionTestStudent(fx, { branchId: String(fx.eceBranch._id) });
    const preview = await api.as(hod.token).post(`${A}/audience-preview`).send({ rules: [{ kind: 'department', ids: [String(fx.ece._id)] }] }).expect(403);
    expect(preview.body).toEqual({ error: 'You can only send notices to your own department.' });
    await api.as(hod.token).post(A).send(body({ audience: { rules: [{ kind: 'department', ids: [String(fx.ece._id)] }] } })).expect(403);
    const targets = await api.as(hod.token).get(`${A}/targets`).expect(200);
    expect(targets.body.departments).toEqual([{ id: String(fx.cse._id), label: 'Computer Science' }]);
    expect(targets.body.kinds).not.toContain('all');
    expect(await Notice.countDocuments({ collegeId: fx.collegeId })).toBe(0);
  });

  it('validates the body with { error: "Validation failed", details }', async () => {
    const res = await api.as(fx.admin.token).post(A).send({ title: '', body: 'x', audience: { rules: [] } }).expect(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['title', 'audience.rules']));
  });
});

describe('POST /attachments (spec §6.1)', () => {
  const pdf = Buffer.from('%PDF-1.4 test');

  it('is 503 without storage, then stores a PDF and refuses other types and oversize files', async () => {
    const off = await api.as(fx.admin.token).post(`${A}/attachments`).attach('file', pdf, { filename: 'timetable.pdf', contentType: 'application/pdf' }).expect(503);
    expect(off.body.error).toMatch(/not configured/);
    s3.configured = true;
    const ok = await api.as(fx.admin.token).post(`${A}/attachments`).attach('file', pdf, { filename: 'timetable.pdf', contentType: 'application/pdf' }).expect(201);
    expect(ok.body).toMatchObject({ name: 'timetable.pdf', mime: 'application/pdf', size: pdf.length });
    expect(ok.body.key).toMatch(new RegExp(`^colleges/${fx.collegeId}/notices/`));
    const zip = await api.as(fx.admin.token).post(`${A}/attachments`).attach('file', pdf, { filename: 'a.zip', contentType: 'application/zip' }).expect(400);
    expect(zip.body.error).toMatch(/Unsupported file type/);
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    expect((await api.as(fx.admin.token).post(`${A}/attachments`).attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' }).expect(400)).body.error).toBe('File too large (max 10 MB)');
    await api.as(fx.admin.token).post(`${A}/attachments`).expect(400);
  });
});

describe('list, reach, CSV and audit (US-4, RCH-01, RCH-02)', () => {
  it('scopes the list, gives reach to the publisher and admins, audits refusals, and exports CSV for admins only', async () => {
    await provisionTestStudent(fx);
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const acc = await createStaffPublisher(fx, 'ST-ACC');
    const student = await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    const mine = await publishAs(exam.token);
    await publishAs(fx.admin.token, { title: 'From the office' });

    expect((await api.as(exam.token).get(A).expect(200)).body.items.map((r: { id: string }) => r.id)).toEqual([mine.id]);
    expect((await api.as(fx.admin.token).get(A).expect(200)).body.total).toBe(2);
    expect((await api.as(fx.admin.token).get(`${A}?office=Exam%20Section`).expect(200)).body.total).toBe(1);
    expect((await api.as(fx.admin.token).get(`${A}?status=archived`).expect(200)).body.total).toBe(0);
    await api.as(acc.token).get(`${A}/${mine.id}`).expect(404);

    const reach = await api.as(exam.token).get(`${A}/${mine.id}/reach`).expect(200);
    expect(reach.body).toMatchObject({ audience: 2, notOnJuvi: 2 });
    expect((await api.as(fx.admin.token).get(`${A}/${mine.id}/reach/pending`).expect(200)).body.total).toBe(2);
    const refused = await api.as(acc.token).get(`${A}/${mine.id}/reach`).expect(403);
    expect(refused.body).toEqual({ error: 'Only the publisher of this notice can do that.' });
    await api.as(student.token).get(`${A}/${mine.id}/reach`).expect(403);
    const denied = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeReach', entityId: mine.id, action: 'access_denied' }).lean();
    expect(denied.map((d) => (d.changes[0]!.newValue as { role: string; via: string }).role).sort()).toEqual(['staff', 'student']);
    expect((denied[0]!.changes[0]!.newValue as { via: string }).via).toBe('erp');

    await api.as(exam.token).get(`${A}/${mine.id}/reach.csv`).expect(403);
    const csv = await api.as(fx.admin.token).get(`${A}/${mine.id}/reach.csv`).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    const lines = csv.text.trim().split('\n');
    expect(lines[0]).toBe('Name,Identifier,Group,Status,Acknowledged at,Late,Seen at,Comment,Added later,Delivery');
    expect(lines).toHaveLength(3);
    expect(lines.slice(1).every((l) => l.includes('Not on Juvi'))).toBe(true);

    const audit = await api.as(exam.token).get(`${A}/${mine.id}/audit`).expect(200);
    expect(audit.body.items.map((i: { action: string }) => i.action)).toEqual(expect.arrayContaining(['publish', 'access_denied']));
    await api.as(acc.token).get(`${A}/${mine.id}/audit`).expect(404);
  });
});

describe('remind, archive and retry delivery (NTC-08, NTC-09, spec §11)', () => {
  it('caps reminders at two, archives once, and refuses both for another office', async () => {
    await provisionTestStudent(fx);
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const acc = await createStaffPublisher(fx, 'ST-ACC');
    const n = await publishAs(exam.token, { ackRequired: true });
    await api.as(acc.token).post(`${A}/${n.id}/remind`).expect(403);
    await api.as(exam.token).post(`${A}/${n.id}/remind`).expect(200);
    const second = await api.as(fx.admin.token).post(`${A}/${n.id}/remind`).expect(200);
    expect(second.body.reminders).toMatchObject({ used: 2, max: 2 });
    const third = await api.as(exam.token).post(`${A}/${n.id}/remind`).expect(409);
    expect(third.body.error).toBe('A notice can have at most two reminders.');
    await api.as(acc.token).post(`${A}/${n.id}/archive`).expect(403);
    expect((await api.as(exam.token).post(`${A}/${n.id}/archive`).expect(200)).body.status).toBe('archived');
    expect((await api.as(exam.token).post(`${A}/${n.id}/archive`).expect(409)).body.error).toBe('This notice has been archived.');
  });

  it('shows a dead fan-out as failed and lets only an admin retry it', async () => {
    await provisionTestStudent(fx);
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const stuck = await Notice.create({
      collegeId: fx.collegeId, title: 'Stuck', body: 'b', publisher: { userId: exam.user._id, office: 'Exam Section' },
      audience: { rules: batchRule(), line: 'Sent to 2024 Batch' }, status: 'publishing',
    });
    await OutboxEvent.create({
      collegeId: fx.collegeId, type: 'notice.published', payload: { collegeId: fx.collegeId, noticeId: String(stuck._id) },
      dedupeKey: `notice:${stuck._id}:published`, status: 'dead', attempts: 8, lastError: 'boom', availableAt: new Date(), lockedUntil: null,
    });
    expect((await api.as(exam.token).get(`${A}/${stuck._id}`).expect(200)).body.delivery).toMatchObject({ state: 'failed', attempts: 8, lastError: 'boom' });
    await api.as(exam.token).post(`${A}/${stuck._id}/retry-delivery`).expect(403);
    expect((await api.as(fx.admin.token).post(`${A}/${stuck._id}/retry-delivery`).expect(200)).body.state).toBe('delivering');
    await drainOutbox();
    expect((await Notice.findById(stuck._id).lean())!.status).toBe('published');
    expect((await api.as(fx.admin.token).post(`${A}/${stuck._id}/retry-delivery`).expect(409)).body.error).toMatch(/Nothing to retry/);
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(stuck._id), action: 'update' })).toBe(1);
  });
});
