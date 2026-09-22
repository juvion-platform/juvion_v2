import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestUser } from '../factories/user.factory';
import { Persona } from '../../models/platform/Persona';
import { User } from '../../models/User';
import { ALL_PERSONAS } from '../../shared/rbac/personas';

/** 010 S2 — college-editable persona catalog. */
let api: TestApi;
let fx: BaseFixtures;

beforeAll(async () => {
  api = createTestApi(await getTestApp());
  fx = await seedBase();
});
afterAll(cleanupTestApp);

describe('persona catalog', () => {
  it('lists the college snapshot, one row per system persona', async () => {
    const res = await api.as(fx.admin.token).get('/api/platform/personas').expect(200);
    expect(res.body).toHaveLength(ALL_PERSONAS.length);
    expect(res.body.every((p: any) => p.collegeId === fx.collegeId)).toBe(true);
  });

  it('creates a college persona under a parent and inherits its family', async () => {
    const res = await api.as(fx.admin.token).post('/api/platform/personas')
      .send({ code: 'st-acc-jr', label: 'Junior Accountant', parentCode: 'ST-ACC', primaryModule: 'finance', defaultRole: 'staff' })
      .expect(201);
    expect(res.body.code).toBe('ST-ACC-JR');
    expect(res.body.family).toBe('ST-ACC');
    expect(res.body.collegeId).toBe(fx.collegeId);
  });

  it('refuses duplicate and system codes', async () => {
    await api.as(fx.admin.token).post('/api/platform/personas')
      .send({ code: 'ST-ACC-JR', label: 'dup', primaryModule: 'finance', defaultRole: 'staff' }).expect(409);
    await api.as(fx.admin.token).post('/api/platform/personas')
      .send({ code: 'ST-ACC', label: 'clash', primaryModule: 'finance', defaultRole: 'staff' }).expect(409);
  });

  it('rejects an unknown parent and a self-referencing parent', async () => {
    await api.as(fx.admin.token).post('/api/platform/personas')
      .send({ code: 'X-ORPHAN', label: 'x', parentCode: 'NOPE', primaryModule: 'finance', defaultRole: 'staff' }).expect(400);
    const jr = await Persona.findOne({ collegeId: fx.collegeId, code: 'ST-ACC-JR' });
    await api.as(fx.admin.token).put(`/api/platform/personas/${jr!._id}`).send({ parentCode: 'ST-ACC-JR' }).expect(400);
  });

  it('edits college rows but never system rows', async () => {
    const jr = await Persona.findOne({ collegeId: fx.collegeId, code: 'ST-ACC-JR' });
    const res = await api.as(fx.admin.token).put(`/api/platform/personas/${jr!._id}`).send({ label: 'Jr. Accountant' }).expect(200);
    expect(res.body.label).toBe('Jr. Accountant');
    const sys = await Persona.findOne({ collegeId: null, code: 'ST-ACC' });
    await api.as(fx.admin.token).put(`/api/platform/personas/${sys!._id}`).send({ label: 'nope' }).expect(403);
    await api.as(fx.admin.token).delete(`/api/platform/personas/${sys!._id}`).expect(403);
  });

  it('refuses to delete a persona an active user holds, allows it once reassigned', async () => {
    const jr = await Persona.findOne({ collegeId: fx.collegeId, code: 'ST-ACC-JR' });
    const { user } = await createTestUser({ collegeId: fx.collegeId, role: 'staff', personaType: 'ST-ACC-JR', name: 'Jr', email: 'jr@test.com' });
    await api.as(fx.admin.token).delete(`/api/platform/personas/${jr!._id}`).expect(409);
    await User.updateOne({ _id: user._id }, { isActive: false });
    await api.as(fx.admin.token).delete(`/api/platform/personas/${jr!._id}`).expect(200);
  });

  it('people persona catalog reads the same collection', async () => {
    const res = await api.as(fx.admin.token).get('/api/people/personas').expect(200);
    expect(res.body.all.length).toBeGreaterThanOrEqual(ALL_PERSONAS.length);
    expect(res.body.all.find((p: any) => p.code === 'ST-ADM-TC').parentCode).toBe('ST-ADM');
  });
});
