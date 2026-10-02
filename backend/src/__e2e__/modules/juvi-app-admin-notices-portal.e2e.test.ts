/**
 * What the portal composer and the welcome-notice setting need from the admin
 * notices API (notices spec §8): offices, isAdmin and the college timezone on
 * /targets, the purpose filter on the list, and the people search that feeds
 * the composer's `custom` picker.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { enableJuvi } from '../factories/juvi.factory';
import { createStaffPublisher, makeHod, publishTestNotice } from '../factories/notice.factory';
import { drainOutbox } from '../../shared/outbox';

process.env.E2E_TESTING = '1';

let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin/notices';

beforeAll(async () => { api = createTestApi(await getTestApp()); });
beforeEach(async () => {
  await drainOutbox(); await cleanupTestApp(); fx = await seedBase();
  await enableJuvi(fx.collegeId, { timezone: 'Asia/Dubai' });
});
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('GET /targets for the composer', () => {
  it('gives an admin every office, isAdmin and the college timezone', async () => {
    const res = await api.as(fx.admin.token).get(`${A}/targets`).expect(200);
    expect(res.body).toMatchObject({ office: 'College Office', isAdmin: true, timezone: 'Asia/Dubai' });
    expect(res.body.offices).toEqual(expect.arrayContaining(['College Office', "Principal's Office", 'Exam Section', 'Registrar']));
  });

  it('gives an office persona only its own office', async () => {
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const res = await api.as(exam.token).get(`${A}/targets`).expect(200);
    expect(res.body).toMatchObject({ office: 'Exam Section', offices: ['Exam Section'], isAdmin: false, timezone: 'Asia/Dubai' });
  });
});

describe('GET / ?purpose=', () => {
  it('filters by purpose and returns purpose on every row', async () => {
    await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    const standard = await publishTestNotice(fx);
    const welcome = await publishTestNotice(fx, { title: 'Welcome to JIT', purpose: 'welcome', ackRequired: true, audience: { rules: [{ kind: 'role', ids: ['student'] }] } });

    const res = await api.as(fx.admin.token).get(`${A}?purpose=welcome&status=published`).expect(200);
    expect(res.body.items.map((r: { id: string }) => r.id)).toEqual([String(welcome._id)]);
    expect(res.body.items[0].purpose).toBe('welcome');
    const all = await api.as(fx.admin.token).get(A).expect(200);
    expect(all.body.items.find((r: { id: string }) => r.id === String(standard._id)).purpose).toBe('standard');
    await api.as(fx.admin.token).get(`${A}?purpose=other`).expect(400);
  });
});

describe('GET /targets/people (custom rules)', () => {
  const label = (p: { label: string }) => p.label;

  it('searches people by name within the publisher scope', async () => {
    await createTestStudent(fx.collegeId, { name: 'Asha Rao', batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    await createTestStudent(fx.collegeId, { name: 'Asha Iyer', batchId: String(fx.batch._id), branchId: String(fx.eceBranch._id) });

    const all = await api.as(fx.admin.token).get(`${A}/targets/people?q=asha`).expect(200);
    expect(all.body.items.map(label)).toEqual(['Asha Iyer', 'Asha Rao']);
    expect(all.body.items[0]).toEqual({ id: expect.stringMatching(/^[0-9a-f]{24}$/), label: 'Asha Iyer', hint: '2024 Batch' });

    const hod = await makeHod(fx, fx.cse);
    const mine = await api.as(hod.token).get(`${A}/targets/people?q=asha`).expect(200);
    expect(mine.body.items.map(label)).toEqual(['Asha Rao']);
  });

  it('treats the search text literally and refuses callers who cannot publish', async () => {
    const student = await createTestStudent(fx.collegeId, { name: 'Ravi (Kumar)', batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    const res = await api.as(fx.admin.token).get(`${A}/targets/people?q=${encodeURIComponent('(Kumar')}`).expect(200);
    expect(res.body.items.map(label)).toEqual(['Ravi (Kumar)']);
    const refused = await api.as(student.token).get(`${A}/targets/people?q=a`).expect(403);
    expect(refused.body).toEqual({ error: 'You cannot publish notices.' });
  });
});
