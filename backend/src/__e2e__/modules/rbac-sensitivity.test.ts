import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestUser } from '../factories/user.factory';
import { createTestPolicy } from '../factories/policy.factory';
import { Person } from '../../models/people/Person';
import { invalidatePolicies } from '../../shared/rbac/cache';

/**
 * 010 P3 — sensitivity classes. The staff read-everything fallback grants no
 * classes, so an accountant reading a person never receives the Aadhaar
 * number; an admin does. A write carrying a hidden field is refused.
 */
let api: TestApi;
let fx: BaseFixtures;
let accToken: string;
let personId: string;

beforeAll(async () => {
  api = createTestApi(await getTestApp());
  fx = await seedBase();
  accToken = (await createTestUser({ collegeId: fx.collegeId, role: 'staff', personaType: 'ST-ACC', name: 'Acc', email: 'acc@sens.test', password: 'secret-123' })).token;
  personId = String((await Person.create({ collegeId: fx.collegeId, name: 'Sensitive Sam', phone: '9000000555', aadhaar: '123412341234' }))._id);
  // College row: accountants may update people, but still see no sensitive classes.
  await createTestPolicy(fx.collegeId, { role: 'staff', personaType: 'ST-ACC', module: 'people', action: 'update', effect: 'allow', scope: { sensitivity: [] }, priority: 800 });
  await invalidatePolicies(fx.collegeId);
  process.env.RBAC_ENFORCE = 'true';
});
afterAll(async () => { process.env.RBAC_ENFORCE = 'false'; await cleanupTestApp(); });

describe('field masks', () => {
  it('strips the Aadhaar for the accountant and keeps it for the admin', async () => {
    const acc = await api.as(accToken).get(`/api/people/persons/${personId}`).expect(200);
    expect(acc.body.name).toBe('Sensitive Sam');
    expect(acc.body).not.toHaveProperty('aadhaar');
    const adm = await api.as(fx.admin.token).get(`/api/people/persons/${personId}`).expect(200);
    expect(adm.body.aadhaar).toBe('123412341234');
  });
  it('masks list responses too', async () => {
    const res = await api.as(accToken).get('/api/people/persons?limit=100').expect(200);
    expect(res.body.items.some((p: any) => 'aadhaar' in p)).toBe(false);
  });
  it('refuses a write that carries a hidden field, allows one that does not', async () => {
    const r = await api.as(accToken).put(`/api/people/persons/${personId}`).send({ aadhaar: '999' }).expect(403);
    expect(r.body.error).toMatch(/aadhaar/);
    await api.as(accToken).put(`/api/people/persons/${personId}`).send({ name: 'Sam S.' }).expect(200);
    expect((await Person.findById(personId).lean())!.aadhaar).toBe('123412341234');
  });
  it('login tells the browser what each module may show', async () => {
    const login = await api.post('/api/auth/login').send({ email: 'acc@sens.test', password: 'secret-123' }).expect(200);
    expect(login.body.sensitivity.people).toEqual([]);
    expect(login.body.sensitivity.finance).toBeNull();
    const adm = await api.post('/api/auth/login').send({ email: 'admin@test.com', password: 'test123' }).expect(200);
    expect(adm.body.sensitivity.people).toBeNull();
  });
});
