import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { Student } from '../../models';
import { JuviAccount } from '../../models/juvi/JuviAccount';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId, { accentColor: '#0055aa' }); });
afterAll(async () => { await cleanupTestApp(); });

async function tokenFor(identifier: string, password: string, deviceId = TEST_DEVICE.id) {
  const res = await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier, password, device: { ...TEST_DEVICE, id: deviceId } }).expect(200);
  return res.body.accessToken as string;
}

describe('GET /me', () => {
  it('returns the student identity card, settings and institution snapshot', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const t = await tokenFor(s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, t).get(`${V1}/me`).expect(200);
    expect(res.body.account).toMatchObject({ kind: 'student', onboardingSteps: ['identity', 'spaces', 'notifications'], mustChangePassword: true });
    expect(res.body.person.name).toBe(s.person.name);
    expect(res.body.student).toMatchObject({ rollNumber: s.student.rollNumber, programme: 'B.Tech', branch: 'CSE', batch: '2024 Batch', section: 'A', department: 'Computer Science', isLateralEntry: false, hostel: null });
    expect(res.body.faculty).toBeNull();
    expect(res.body.settings).toEqual({ quietHours: { start: '22:00', end: '07:00' }, tiers: { important: true, routine: true }, language: 'en' });
    expect(res.body.institution).toMatchObject({ name: 'JIT Test College', code: 'JIT-TEST', accentColor: '#0055aa' });
    expect(res.body.asOf).toBeTypeOf('string');
  });

  it('marks lateral entry and returns the faculty card for faculty', async () => {
    const s = await provisionTestStudent(fx);
    await Student.updateOne({ _id: s.student._id }, { $set: { studyYearAtAdmission: 2 } });
    const ts = await tokenFor(s.student.rollNumber, s.tempPassword);
    expect((await mobileClient(app, ts).get(`${V1}/me`)).body.student.isLateralEntry).toBe(true);

    const f = await provisionTestFaculty(fx);
    const tf = await tokenFor(f.faculty.employeeCode, f.tempPassword, 'device-f');
    const res = await mobileClient(app, tf).get(`${V1}/me`).expect(200);
    expect(res.body.student).toBeNull();
    expect(res.body.faculty).toMatchObject({ employeeCode: f.faculty.employeeCode, department: 'Computer Science', isHod: false });
  });
});

describe('settings and onboarding', () => {
  it('PATCH /me/settings persists and rejects an urgent toggle', async () => {
    const s = await provisionTestStudent(fx);
    const t = await tokenFor(s.student.rollNumber, s.tempPassword);
    const ok = await mobileClient(app, t).patch(`${V1}/me/settings`).send({ quietHours: { start: '23:00', end: '06:30' }, tiers: { routine: false } }).expect(200);
    expect(ok.body).toEqual({ quietHours: { start: '23:00', end: '06:30' }, tiers: { important: true, routine: false }, language: 'en' });
    const bad = await mobileClient(app, t).patch(`${V1}/me/settings`).send({ tiers: { urgent: false } }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    expect((await mobileClient(app, t).get(`${V1}/me/settings`)).body.quietHours.start).toBe('23:00');
  });

  it('advance walks the steps in order and completes after the last', async () => {
    const s = await provisionTestStudent(fx);
    const t = await tokenFor(s.student.rollNumber, s.tempPassword);
    const wrong = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 1 }).expect(400);
    expect(wrong.body.error).toMatchObject({ code: 'VALIDATION_FAILED', currentStep: 0 });
    for (const step of [0, 1]) {
      const r = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step }).expect(200);
      expect(r.body).toMatchObject({ onboardingStep: step + 1, onboardingComplete: false });
    }
    const done = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 2 }).expect(200);
    expect(done.body).toMatchObject({ onboardingStep: 3, onboardingComplete: true });
    const acct = await JuviAccount.findById(s.account._id).lean();
    expect(acct?.status).toBe('active');
    expect(acct?.onboardingCompletedAt).toBeInstanceOf(Date);
    // Re-sending the last step is idempotent.
    await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 2 }).expect(200);
    // R12: once complete, any step is a no-op and nothing is rewritten.
    const before = (await JuviAccount.findById(s.account._id).lean())!;
    const r3 = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 3 }).expect(200);
    expect(r3.body).toMatchObject({ onboardingStep: 3, onboardingComplete: true });
    const after = (await JuviAccount.findById(s.account._id).lean())!;
    expect(after.onboardingStep).toBe(3);
    expect(after.onboardingCompletedAt?.toISOString()).toBe(before.onboardingCompletedAt?.toISOString());
  });
});

describe('devices', () => {
  it('lists devices with isCurrent, revokes one, revokes others', async () => {
    const s = await provisionTestStudent(fx);
    const a = await tokenFor(s.student.rollNumber, s.tempPassword, 'device-a');
    const b = await tokenFor(s.student.rollNumber, s.tempPassword, 'device-b');
    const c = await tokenFor(s.student.rollNumber, s.tempPassword, 'device-c');
    const list = await mobileClient(app, a).get(`${V1}/me/devices`).expect(200);
    expect(list.body.items).toHaveLength(3);
    expect(list.body.items.filter((d: any) => d.isCurrent)).toHaveLength(1);
    const bRow = list.body.items.find((d: any) => !d.isCurrent);
    await mobileClient(app, a).delete(`${V1}/me/devices/${bRow.sessionId}`).expect(204);
    await mobileClient(app, a).delete(`${V1}/me/devices/000000000000000000000001`).expect(404);
    const others = await mobileClient(app, a).post(`${V1}/me/devices/revoke-others`).expect(200);
    expect(others.body.revoked).toBe(1);
    await mobileClient(app, a).get(`${V1}/me/devices`).expect(200);
    for (const dead of [b, c]) {
      const r = await mobileClient(app, dead).get(`${V1}/me/devices`).expect(401);
      expect(['signed_out_elsewhere', 'admin']).toContain(r.body.error.reason);
    }
  });
});

describe('photo', () => {
  it('returns 503 when S3 is not configured and 400 with no file', async () => {
    delete process.env.AWS_S3_BUCKET;
    const s = await provisionTestStudent(fx);
    const t = await tokenFor(s.student.rollNumber, s.tempPassword);
    await mobileClient(app, t).post(`${V1}/me/photo`).expect(400);
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8cfc0000000030001a1a0d2b70000000049454e44ae426082', 'hex');
    const res = await mobileClient(app, t).post(`${V1}/me/photo`).attach('file', png, { filename: 'p.png', contentType: 'image/png' });
    expect([503, 500]).toContain(res.status);
  });
});
