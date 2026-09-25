import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { createTestUser } from '../factories/user.factory';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';
import { Employee } from '../../models/hr/Employee';
import { Payroll } from '../../models/hr/Payroll';
import { Certificate } from '../../models/student-dev/Certificate';

/**
 * 010 — by-id backstop. An HOD's department scope applies to single-record
 * routes the services never scoped explicitly: HR payroll (via Employee),
 * student certificates (via Student) and Department updates.
 */
let api: TestApi;
let fx: BaseFixtures;
let hodToken: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  api = createTestApi(await getTestApp());
  fx = await seedBase();
  const p = await Person.create({ collegeId: fx.collegeId, name: 'Dr. HOD', phone: '9000000771' });
  await Faculty.create({ collegeId: fx.collegeId, personId: p._id, employeeCode: 'HOD-BYID', designation: 'Professor', departmentId: fx.cse._id, contractType: 'regular', status: 'active' });
  hodToken = (await createTestUser({ collegeId: fx.collegeId, role: 'hod', personaType: 'F-HOD', name: 'HOD', email: 'hod@byid.test', personId: String(p._id) })).token;

  for (const [tag, dept] of [['cse', fx.cse], ['ece', fx.ece]] as const) {
    const ep = await Person.create({ collegeId: fx.collegeId, name: `Emp ${tag}`, phone: `90000007${tag === 'cse' ? '81' : '82'}` });
    const emp = await Employee.create({ collegeId: fx.collegeId, personId: ep._id, employeeId: `EMP-${tag}`, departmentId: dept._id, designation: 'Clerk', employeeType: 'non_teaching', joiningDate: new Date('2020-01-01'), status: 'active' });
    const pay = await Payroll.create({ collegeId: fx.collegeId, employeeId: emp._id, month: 1, year: 2026, basicPay: 30000, grossPay: 40000, netPay: 35000 });
    ids[`pay-${tag}`] = String(pay._id);
    const student = await createTestStudent(fx.collegeId, { branchId: String(tag === 'cse' ? fx.cseBranch._id : fx.eceBranch._id), programmeId: String(fx.btech._id), batchId: String(fx.batch._id) });
    const cert = await Certificate.create({ collegeId: fx.collegeId, type: 'participation', studentId: student.student._id, sourceType: 'event', sourceId: new Types.ObjectId() });
    ids[`cert-${tag}`] = String(cert._id);
  }
  process.env.RBAC_ENFORCE = 'true';
});
afterAll(async () => { process.env.RBAC_ENFORCE = 'false'; await cleanupTestApp(); });

describe('by-id backstop', () => {
  it('payroll: own department readable (pay masked), other department 404', async () => {
    const own = await api.as(hodToken).get(`/api/hr/payroll/${ids['pay-cse']}`).expect(200);
    expect(own.body).not.toHaveProperty('basicPay');
    await api.as(hodToken).get(`/api/hr/payroll/${ids['pay-ece']}`).expect(404);
    const adm = await api.as(fx.admin.token).get(`/api/hr/payroll/${ids['pay-ece']}`).expect(200);
    expect(adm.body.basicPay).toBe(30000);
  });
  it('certificates: student-linked record follows the student\'s branch', async () => {
    await api.as(hodToken).get(`/api/student-dev/certificates/${ids['cert-cse']}`).expect(200);
    await api.as(hodToken).get(`/api/student-dev/certificates/${ids['cert-ece']}`).expect(404);
  });
  it('department update: own department only', async () => {
    await api.as(hodToken).put(`/api/academics/departments/${fx.cse._id}`).send({ name: 'CSE (renamed)' }).expect(200);
    await api.as(hodToken).put(`/api/academics/departments/${fx.ece._id}`).send({ name: 'nope' }).expect(404);
  });
});
