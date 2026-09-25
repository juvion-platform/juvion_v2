import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { createTestUser } from '../factories/user.factory';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';

/**
 * 010 S4 — row scope on lists AND single records, with enforcement on.
 * An HOD (department-only people:read by default policy) sees CSE students
 * only, and cannot open an ECE student by URL.
 */
let api: TestApi;
let fx: BaseFixtures;
let hodToken: string;
let cseStudentId: string;
let eceStudentId: string;

beforeAll(async () => {
  api = createTestApi(await getTestApp());
  fx = await seedBase();
  const p = await Person.create({ collegeId: fx.collegeId, name: 'Dr. HOD', phone: '9000000777' });
  await Faculty.create({ collegeId: fx.collegeId, personId: p._id, employeeCode: 'HOD01', designation: 'Professor', departmentId: fx.cse._id, contractType: 'regular', status: 'active' });
  hodToken = (await createTestUser({ collegeId: fx.collegeId, role: 'hod', personaType: 'F-HOD', name: 'HOD', email: 'hod@test.com', personId: String(p._id) })).token;
  cseStudentId = String((await createTestStudent(fx.collegeId, { branchId: String(fx.cseBranch._id), programmeId: String(fx.btech._id), batchId: String(fx.batch._id) })).student._id);
  eceStudentId = String((await createTestStudent(fx.collegeId, { branchId: String(fx.eceBranch._id), programmeId: String(fx.btech._id), batchId: String(fx.batch._id) })).student._id);
  process.env.RBAC_ENFORCE = 'true';
});
afterAll(async () => { process.env.RBAC_ENFORCE = 'false'; await cleanupTestApp(); });

describe('HOD department scope', () => {
  it('lists only students in the HOD department', async () => {
    const res = await api.as(hodToken).get('/api/people/students').expect(200);
    const ids = res.body.items.map((s: any) => String(s._id));
    expect(ids).toContain(cseStudentId);
    expect(ids).not.toContain(eceStudentId);
  });
  it('opens an own-department student, not another department\'s', async () => {
    await api.as(hodToken).get(`/api/people/students/${cseStudentId}`).expect(200);
    await api.as(hodToken).get(`/api/people/students/${eceStudentId}`).expect(404);
    // HOD holds people:read only, so the module gate answers before row scope does.
    await api.as(hodToken).put(`/api/people/students/${eceStudentId}`).send({ status: 'active' }).expect(403);
  });
  it('admin still sees both', async () => {
    await api.as(fx.admin.token).get(`/api/people/students/${eceStudentId}`).expect(200);
  });
});
