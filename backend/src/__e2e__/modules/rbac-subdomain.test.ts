import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestUser } from '../factories/user.factory';
import { createTestStudent } from '../factories/student.factory';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';
import { Staff } from '../../models/people/Staff';
import { invalidatePolicies } from '../../shared/rbac/cache';

/**
 * Sub-domain scopes, at the two ends that matter.
 *
 * HR's people write is scoped to `staff,faculty`, and the person-type routes
 * declare which one they serve — so HR reaches faculty and staff and is
 * refused on students. Everywhere else the scope names sub-domains no route
 * declares, so it must not become a denial: faculty still create attendance
 * sessions and the warden still opens welfare.
 */
let api: TestApi;
let fx: BaseFixtures;
let hrToken: string;
let facToken: string;
let wardenToken: string;
let studentId: string;

/** authorize() runs before validate(), so anything but 403 means authorized. */
const authorized = (status: number) => status !== 403;

beforeAll(async () => {
  api = createTestApi(await getTestApp());
  fx = await seedBase();

  const hrPerson = await Person.create({ collegeId: fx.collegeId, name: 'HR One', phone: '9000000801' });
  await Staff.create({
    collegeId: fx.collegeId, personId: hrPerson._id, employeeCode: 'E-HR1',
    designation: 'HR Officer', departmentId: fx.cse._id, staffType: 'administrative', status: 'active',
  });
  hrToken = (await createTestUser({
    collegeId: fx.collegeId, role: 'staff', personaType: 'ST-HR', name: 'HR',
    email: 'hr@subdomain.test', password: 'secret-123', personId: String(hrPerson._id),
  })).token;

  const facPerson = await Person.create({ collegeId: fx.collegeId, name: 'Prof One', phone: '9000000802' });
  await Faculty.create({
    collegeId: fx.collegeId, personId: facPerson._id, employeeCode: 'E-FAC1',
    designation: 'Professor', departmentId: fx.cse._id, contractType: 'regular', status: 'active',
  });
  facToken = (await createTestUser({
    collegeId: fx.collegeId, role: 'faculty', personaType: 'F-FAC', name: 'Fac',
    email: 'fac@subdomain.test', password: 'secret-123', personId: String(facPerson._id),
  })).token;

  const wardenPerson = await Person.create({ collegeId: fx.collegeId, name: 'Warden One', phone: '9000000803' });
  await Staff.create({
    collegeId: fx.collegeId, personId: wardenPerson._id, employeeCode: 'E-WRD1',
    designation: 'Warden', departmentId: fx.cse._id, staffType: 'administrative', status: 'active',
  });
  wardenToken = (await createTestUser({
    collegeId: fx.collegeId, role: 'staff', personaType: 'ST-WARDEN', name: 'Warden',
    email: 'warden@subdomain.test', password: 'secret-123', personId: String(wardenPerson._id),
  })).token;

  const s = await createTestStudent(fx.collegeId, {
    branchId: String(fx.cseBranch._id), programmeId: String(fx.btech._id), batchId: String(fx.batch._id),
  });
  studentId = String(s.student._id);

  await invalidatePolicies(fx.collegeId);
  process.env.RBAC_ENFORCE = 'true';
}, 300_000);

afterAll(async () => { process.env.RBAC_ENFORCE = 'false'; await cleanupTestApp(); });

describe('sub-domain scope, where the routes declare one', () => {
  it('HR reaches the faculty and staff records its scope names', async () => {
    const fac = await api.as(hrToken).post('/api/people/faculty').send({});
    const staff = await api.as(hrToken).post('/api/people/staff').send({});
    expect(authorized(fac.status), `faculty create got ${fac.status}`).toBe(true);
    expect(authorized(staff.status), `staff create got ${staff.status}`).toBe(true);
  }, 300_000);

  it('HR is refused on students, which its scope does not name', async () => {
    const create = await api.as(hrToken).post('/api/people/students').send({});
    expect(create.status).toBe(403);
    expect(create.body.error).toBe('Access denied for this resource');

    const update = await api.as(hrToken).put(`/api/people/students/${studentId}`).send({ admissionYear: 2025 });
    expect(update.status).toBe(403);
  }, 300_000);

  it('HR still reads people — the read policy names no sub-domain', async () => {
    const res = await api.as(hrToken).get('/api/people/students');
    expect(res.status).toBe(200);
  }, 300_000);
});

describe('sub-domain scope, where no route declares one', () => {
  it('faculty still create attendance sessions', async () => {
    const res = await api.as(facToken).post('/api/academics/attendance-sessions').send({});
    expect(authorized(res.status), `attendance create got ${res.status}`).toBe(true);
  }, 300_000);

  it('the warden still opens welfare', async () => {
    const res = await api.as(wardenToken).get('/api/welfare/hostel-blocks');
    expect(res.status).toBe(200);
  }, 300_000);
});
