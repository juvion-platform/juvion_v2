import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';

/** 010 S1 + S5 — provisioning, derived role, multi-persona permissions, revocation. */
let api: TestApi;
let fx: BaseFixtures;
let personId: string;
let userId: string;

beforeAll(async () => {
  api = createTestApi(await getTestApp());
  fx = await seedBase();
  const p = await Person.create({ collegeId: fx.collegeId, name: 'Dr. Meena', phone: '9000000888' });
  await Faculty.create({ collegeId: fx.collegeId, personId: p._id, employeeCode: 'HOD02', designation: 'Professor', departmentId: fx.cse._id, contractType: 'regular', status: 'active' });
  personId = String(p._id);
});
afterAll(cleanupTestApp);

describe('user provisioning', () => {
  it('creates a user with two personas and derives the role from the highest tier', async () => {
    const res = await api.as(fx.admin.token).post('/api/platform/users')
      .send({ email: 'Meena@Test.com', password: 'secret-123', name: 'Dr. Meena', personas: ['f-fac', 'F-HOD'], personId })
      .expect(201);
    userId = res.body._id;
    expect(res.body.email).toBe('meena@test.com');
    expect(res.body.personas).toEqual(['F-FAC', 'F-HOD']);
    expect(res.body.role).toBe('hod');
    expect(res.body.password).toBeUndefined();
  });

  it('rejects unknown personas, duplicate emails and super-admin grants by a college admin', async () => {
    await api.as(fx.admin.token).post('/api/platform/users')
      .send({ email: 'x@test.com', password: 'secret-123', name: 'X', personas: ['NOPE'] }).expect(400);
    await api.as(fx.admin.token).post('/api/platform/users')
      .send({ email: 'meena@test.com', password: 'secret-123', name: 'Dup', personas: ['F-FAC'] }).expect(409);
    await api.as(fx.admin.token).post('/api/platform/users')
      .send({ email: 'sa@test.com', password: 'secret-123', name: 'SA', personas: ['L-SADM'] }).expect(403);
  });

  it('the new user logs in with the union of both personas', async () => {
    const login = await api.post('/api/auth/login').send({ email: 'meena@test.com', password: 'secret-123' }).expect(200);
    expect(login.body.user.personas).toEqual(['F-FAC', 'F-HOD']);
    expect(login.body.permissions).toContain('academics:create'); // HOD reach, not the faculty sub-domain list
    expect(login.body.permissions).toContain('people:read');
  });

  it('explains access per persona', async () => {
    const res = await api.as(fx.admin.token).get(`/api/platform/users/${userId}/explain?module=academics&action=create`).expect(200);
    expect(res.body.verdict).toBe('allow');
    expect(res.body.perPersona.map((p: any) => p.persona)).toEqual(['F-FAC', 'F-HOD']);
  });

  it('changing personas ends the old session on its next request', async () => {
    const login = await api.post('/api/auth/login').send({ email: 'meena@test.com', password: 'secret-123' }).expect(200);
    await api.as(login.body.token).get('/api/auth/me').expect(200);
    const upd = await api.as(fx.admin.token).put(`/api/platform/users/${userId}`).send({ personas: ['F-FAC'] }).expect(200);
    expect(upd.body.role).toBe('faculty');
    await api.as(login.body.token).get('/api/auth/me').expect(401);
  });

  it('lists, filters by persona, and hides inactive users by default', async () => {
    const list = await api.as(fx.admin.token).get('/api/platform/users?persona=F-FAC').expect(200);
    expect(list.body.items.some((u: any) => u._id === userId)).toBe(true);
    await api.as(fx.admin.token).put(`/api/platform/users/${userId}`).send({ isActive: false }).expect(200);
    const after = await api.as(fx.admin.token).get('/api/platform/users').expect(200);
    expect(after.body.items.some((u: any) => u._id === userId)).toBe(false);
    await api.post('/api/auth/login').send({ email: 'meena@test.com', password: 'secret-123' }).expect(401);
  });
});
