import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestUser } from '../factories/user.factory';
import { createTestPolicy } from '../factories/policy.factory';
import { Person } from '../../models/people/Person';
import { invalidatePolicies } from '../../shared/rbac/cache';

import { createTestStudent } from '../factories/student.factory';
import { Faculty } from '../../models/people/Faculty';

/**
 * 010 P3 — sensitivity classes. The staff read-everything fallback grants no
 * classes, so an accountant reading a person never receives the Aadhaar
 * number; an admin does. A write carrying a hidden field is refused.
 *
 * HOD and Faculty also have sensitivity: [] on people:read, ensuring student
 * Aadhaar numbers are never leaked over the wire.
 */
let api: TestApi;
let fx: BaseFixtures;
let accToken: string;
let hodToken: string;
let facToken: string;
let regToken: string;
let tcToken: string;
let stuToken: string;
let personId: string;
let studentId: string;
let otherStudentId: string;

beforeAll(async () => {
  api = createTestApi(await getTestApp());
  fx = await seedBase();

  // Accounts staff (masked Aadhaar)
  accToken = (await createTestUser({ collegeId: fx.collegeId, role: 'staff', personaType: 'ST-ACC', name: 'Acc', email: 'acc@sens.test', password: 'secret-123' })).token;
  personId = String((await Person.create({ collegeId: fx.collegeId, name: 'Sensitive Sam', phone: '9000000555', aadhaar: '123412341234' }))._id);

  // Registrar staff (full Aadhaar)
  regToken = (await createTestUser({ collegeId: fx.collegeId, role: 'staff', personaType: 'ST-REG', name: 'Registrar', email: 'reg@sens.test', password: 'secret-123' })).token;

  // Telecaller staff (no Aadhaar)
  tcToken = (await createTestUser({ collegeId: fx.collegeId, role: 'staff', personaType: 'ST-ADM-TC', name: 'Telecaller', email: 'tc@sens.test', password: 'secret-123' })).token;

  // HOD in CSE (masked Aadhaar)
  const hodPerson = await Person.create({ collegeId: fx.collegeId, name: 'Dr. HOD', phone: '9000000771' });
  await Faculty.create({ collegeId: fx.collegeId, personId: hodPerson._id, employeeCode: 'HOD-SENS', designation: 'Professor', departmentId: fx.cse._id, contractType: 'regular', status: 'active' });
  hodToken = (await createTestUser({ collegeId: fx.collegeId, role: 'hod', personaType: 'F-HOD', name: 'HOD', email: 'hod@sens.test', password: 'secret-123', personId: String(hodPerson._id) })).token;

  // Faculty in CSE (masked Aadhaar)
  const facPerson = await Person.create({ collegeId: fx.collegeId, name: 'Prof. Faculty', phone: '9000000772' });
  const facRecord = await Faculty.create({ collegeId: fx.collegeId, personId: facPerson._id, employeeCode: 'FAC-SENS', designation: 'Assistant Professor', departmentId: fx.cse._id, contractType: 'regular', status: 'active' });
  facToken = (await createTestUser({ collegeId: fx.collegeId, role: 'faculty', personaType: 'F-FAC', name: 'Fac', email: 'fac@sens.test', password: 'secret-123', personId: String(facPerson._id) })).token;

  // Student in CSE branch (own masked Aadhaar)
  const s = await createTestStudent(fx.collegeId, { branchId: String(fx.cseBranch._id), programmeId: String(fx.btech._id), batchId: String(fx.batch._id) });
  studentId = String(s.student._id);
  await Person.findByIdAndUpdate(s.person._id, { aadhaar: '987654321098' });
  stuToken = (await createTestUser({ collegeId: fx.collegeId, role: 'student', personaType: 'L-STU', name: 'Student 1', email: 'stu@sens.test', password: 'secret-123', personId: String(s.person._id) })).token;

  // Assign student as mentee to faculty so assigned scope allows reading
  const { assignMentor } = await import('../../modules/welfare/ment-couns-ccd-service');
  await assignMentor(fx.collegeId, { mentorId: String(facRecord._id), studentId, academicYearId: String(fx.ay._id) }, String(fx.admin.user._id));

  // Other Student in CSE
  const otherS = await createTestStudent(fx.collegeId, { branchId: String(fx.cseBranch._id), programmeId: String(fx.btech._id), batchId: String(fx.batch._id) });
  otherStudentId = String(otherS.student._id);
  await Person.findByIdAndUpdate(otherS.person._id, { aadhaar: '555566667777' });

  // Update policy for accountant to update people
  await createTestPolicy(fx.collegeId, { role: 'staff', personaType: 'ST-ACC', module: 'people', action: 'update', effect: 'allow', scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, priority: 800 });
  await invalidatePolicies(fx.collegeId);
  process.env.RBAC_ENFORCE = 'true';
});
afterAll(async () => { process.env.RBAC_ENFORCE = 'false'; await cleanupTestApp(); });

describe('Aadhaar RBAC Sensitivity Control', () => {
  it('1. authorized persona (Admin / Registrar) receives full Aadhaar', async () => {
    const adm = await api.as(fx.admin.token).get(`/api/people/students/${studentId}`).expect(200);
    expect(adm.body.personId.aadhaar).toBe('987654321098');

    const reg = await api.as(regToken).get(`/api/people/students/${studentId}`).expect(200);
    expect(reg.body.personId.aadhaar).toBe('987654321098');
  });

  it('2. masked persona (HOD / Faculty / Accounts) receives masked Aadhaar', async () => {
    // HOD reading student details in own department
    const hodRes = await api.as(hodToken).get(`/api/people/students/${studentId}`).expect(200);
    expect(hodRes.body.personId.aadhaar).toBe('••••••••1098');

    // Faculty reading student details in department
    const facRes = await api.as(facToken).get(`/api/people/students/${studentId}`).expect(200);
    expect(facRes.body.personId.aadhaar).toBe('••••••••1098');

    // Accounts reading person
    const accRes = await api.as(accToken).get(`/api/people/persons/${personId}`).expect(200);
    expect(accRes.body.aadhaar).toBe('••••••••1234');
  });

  it('3. unauthorized persona (Telecaller) does not receive Aadhaar', async () => {
    const tcRes = await api.as(tcToken).get(`/api/people/persons/${personId}`).expect(200);
    expect(tcRes.body.name).toBe('Sensitive Sam');
    expect(tcRes.body).not.toHaveProperty('aadhaar');
  });

  it('4. student can only access their own Aadhaar, cannot access another student', async () => {
    // Student accessing own record
    const selfRes = await api.as(stuToken).get(`/api/people/students/${studentId}`).expect(200);
    expect(selfRes.body.personId.aadhaar).toBe('••••••••1098');

    // Student attempting to access another student's record returns 404 (by-ID scope backstop)
    await api.as(stuToken).get(`/api/people/students/${otherStudentId}`).expect(404);
  });

  it('5. direct API/by-ID access cannot bypass Aadhaar protection or writes', async () => {
    // Masked user directly querying by personId gets masked Aadhaar
    const directRes = await api.as(accToken).get(`/api/people/persons/${personId}`).expect(200);
    expect(directRes.body.aadhaar).toBe('••••••••1234');

    // Masked user cannot write or mutate Aadhaar
    const writeAttempt = await api.as(accToken).put(`/api/people/persons/${personId}`).send({ aadhaar: '123456789999' }).expect(403);
    expect(writeAttempt.body.error).toMatch(/aadhaar/);

    // Permitted write without Aadhaar succeeds
    await api.as(accToken).put(`/api/people/persons/${personId}`).send({ name: 'Sam S.' }).expect(200);
    expect((await Person.findById(personId).lean())!.aadhaar).toBe('123412341234');
  });

  it('login response conveys proper sensitivity classes per persona', async () => {
    const accLogin = await api.post('/api/auth/login').send({ email: 'acc@sens.test', password: 'secret-123' }).expect(200);
    expect(accLogin.body.sensitivity.people).toContain('people.aadhaar:masked');

    const regLogin = await api.post('/api/auth/login').send({ email: 'reg@sens.test', password: 'secret-123' }).expect(200);
    expect(regLogin.body.sensitivity.people).toContain('people.aadhaar');

    const tcLogin = await api.post('/api/auth/login').send({ email: 'tc@sens.test', password: 'secret-123' }).expect(200);
    expect(tcLogin.body.sensitivity.people).not.toContain('people.aadhaar');
    expect(tcLogin.body.sensitivity.people).not.toContain('people.aadhaar:masked');
  });
});

