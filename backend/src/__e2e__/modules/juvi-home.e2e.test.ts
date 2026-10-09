import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, mobileClient, provisionTestFaculty, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, createStaffPublisher, signInAs } from '../factories/notice.factory';
import { provisionPerson } from '../../modules/juvi-app/accounts/provisioning-service';
import { revealLatestForAccount } from '../../modules/juvi-app/accounts/credential-store';

process.env.E2E_TESTING = '1';

let app: Express;
let fx: BaseFixtures;

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

const V1 = '/api/juvi-app/v1';

describe('GET /v1/today (§7.1)', () => {
  it('200 with the contract shape for a signed-in student', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const token = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, token).get(`${V1}/today`).expect(200);
    expect(res.body).toHaveProperty('asOf');
    expect(res.body.today).toHaveProperty('date');
    expect(Array.isArray(res.body.today.classes)).toBe(true);
    expect(res.body.glance.attendance).toHaveProperty('threshold');
    expect(res.body.glance.dues).toHaveProperty('available');
  });

  it('401 without a session', async () => {
    await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await mobileClient(app).get(`${V1}/today`).expect(401);
  });

  it('403 for faculty (§7.1 is the students surface)', async () => {
    const f = await provisionTestFaculty(fx);
    await activateAccount(String(f.account._id));
    const token = await signInAs(app, fx, String(f.faculty.employeeCode), f.tempPassword);
    await mobileClient(app, token).get(`${V1}/today`).expect(403);
  });
});

describe('GET /v1/teaching and /v1/me/academics (§7.2, §7.3)', () => {
  it('teaching is 200 for faculty and 403 for students', async () => {
    const f = await provisionTestFaculty(fx);
    await activateAccount(String(f.account._id));
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const sTok = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, sTok).get(`${V1}/teaching`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const fTok = await signInAs(app, fx, String(f.faculty.employeeCode), f.tempPassword);
    const teaching = await mobileClient(app, fTok).get(`${V1}/teaching`).expect(200);
    expect(teaching.body.faculty.kind).toBe('regular');
  });

  it('me/academics returns attendance+dues for a student and coursesTaught for faculty', async () => {
    const f = await provisionTestFaculty(fx);
    await activateAccount(String(f.account._id));
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const sTok = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const student = await mobileClient(app, sTok).get(`${V1}/me/academics`).expect(200);
    expect(student.body.attendance).toHaveProperty('threshold');
    expect(student.body.dues).toHaveProperty('invoices');
    const fTok = await signInAs(app, fx, String(f.faculty.employeeCode), f.tempPassword);
    const faculty = await mobileClient(app, fTok).get(`${V1}/me/academics`).expect(200);
    expect(Array.isArray(faculty.body.coursesTaught)).toBe(true);
  });

  it('staff are 403 on all three endpoints (R24)', async () => {
    const officer = await createStaffPublisher(fx, 'ST-REG');
    const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(officer.person._id), kind: 'staff', source: 'admin', performedBy: 'test' });
    await activateAccount(String(account._id));
    const cred = await revealLatestForAccount(fx.collegeId, String(account._id));
    const token = await signInAs(app, fx, String(officer.user.email), cred!.password);
    await mobileClient(app, token).get(`${V1}/today`).expect(403);
    await mobileClient(app, token).get(`${V1}/teaching`).expect(403);
    await mobileClient(app, token).get(`${V1}/me/academics`).expect(403);
  });
});
