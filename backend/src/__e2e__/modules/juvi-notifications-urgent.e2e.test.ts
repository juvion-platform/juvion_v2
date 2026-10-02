// backend/src/__e2e__/modules/juvi-notifications-urgent.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, createStaffPublisher, makeHod } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { AuditLog } from '../../shared/audit';
import { drainOutbox } from '../../shared/outbox';

process.env.E2E_TESTING = '1';

let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin/notices';
const REASON = 'University postponed the exam at short notice';
const body = (extra: Record<string, unknown> = {}) => ({
  title: 'Exam postponed', body: 'Details inside.', audience: { rules: [{ kind: 'batch', ids: [String(fx.batch._id)] }] }, ...extra,
});

beforeAll(async () => { api = createTestApi(await getTestApp()); });
beforeEach(async () => {
  await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId);
  const s = await provisionTestStudent(fx);
  await activateAccount(String(s.account._id));
});
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('the Urgent gate (notifications spec §6.5)', () => {
  it('refuses an office publisher with 403 URGENT_NOT_ALLOWED and creates nothing', async () => {
    const registrar = await createStaffPublisher(fx, 'ST-REG');
    const res = await api.as(registrar.token).post(A).send(body({ priority: 'urgent', urgentReason: REASON })).expect(403);
    expect(res.body).toEqual({ error: expect.stringMatching(/Only an IT admin can publish Urgent/), detail: { code: 'URGENT_NOT_ALLOWED' } });
    expect(await Notice.countDocuments({ collegeId: fx.collegeId })).toBe(0);
    // Routine and Important stay open to them.
    await api.as(registrar.token).post(A).send(body({ priority: 'important' })).expect(201);
  });

  it('refuses an HOD too: their notices policy names its actions, so no wildcard grants Urgent', async () => {
    const hod = await makeHod(fx, fx.cse);
    await api.as(hod.token).post(A).send(body({ priority: 'urgent', urgentReason: REASON, audience: { rules: [{ kind: 'department', ids: [String(fx.cse._id)] }] } })).expect(403);
  });

  it('needs a reason of 10–300 characters', async () => {
    await api.as(fx.admin.token).post(A).send(body({ priority: 'urgent' })).expect(400);
    await api.as(fx.admin.token).post(A).send(body({ priority: 'urgent', urgentReason: 'Too short' })).expect(400);
    await api.as(fx.admin.token).post(A).send(body({ priority: 'urgent', urgentReason: 'x'.repeat(301) })).expect(400);
  });

  it('an admin publishes Urgent: the reason is stored, returned and written to the publish audit entry', async () => {
    const res = await api.as(fx.admin.token).post(A).send(body({ priority: 'urgent', urgentReason: REASON, confidential: true })).expect(201);
    await drainOutbox();
    expect(res.body).toMatchObject({ priority: 'urgent', urgentReason: REASON, confidential: true });
    expect(await Notice.findById(res.body.id).lean()).toMatchObject({ priority: 'urgent', urgentReason: REASON, confidential: true });
    const audit = (await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'Notice', entityId: res.body.id, action: 'publish' }).lean())!;
    expect(audit.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'priority', newValue: 'urgent' }),
      expect.objectContaining({ field: 'urgentReason', newValue: REASON }),
      expect.objectContaining({ field: 'confidential', newValue: true }),
    ]));
  });

  it('a principal may publish Urgent; a reason sent with another priority is dropped', async () => {
    await api.as(fx.principal.token).post(A).send(body({ priority: 'urgent', urgentReason: REASON })).expect(201);
    const routine = await api.as(fx.admin.token).post(A).send(body({ priority: 'routine', urgentReason: REASON })).expect(201);
    expect(routine.body).toMatchObject({ priority: 'routine', urgentReason: null, confidential: false });
  });
});

describe('GET /targets → canPublishUrgent (spec §7.5)', () => {
  it('is true for admin and principal, false for an office publisher and an HOD', async () => {
    expect((await api.as(fx.admin.token).get(`${A}/targets`).expect(200)).body.canPublishUrgent).toBe(true);
    expect((await api.as(fx.principal.token).get(`${A}/targets`).expect(200)).body.canPublishUrgent).toBe(true);
    const registrar = await createStaffPublisher(fx, 'ST-REG');
    expect((await api.as(registrar.token).get(`${A}/targets`).expect(200)).body.canPublishUrgent).toBe(false);
    const hod = await makeHod(fx, fx.cse);
    expect((await api.as(hod.token).get(`${A}/targets`).expect(200)).body.canPublishUrgent).toBe(false);
  });
});
