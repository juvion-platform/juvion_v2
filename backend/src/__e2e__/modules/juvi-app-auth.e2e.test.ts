import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { MobileSession } from '../../models/juvi/MobileSession';
import { deactivateAccount } from '../../modules/juvi-app/accounts/provisioning-service';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId, { supportContact: { name: 'Exam Office', phone: '040-1' } }); });
afterAll(async () => { await cleanupTestApp(); });

function signIn(identifier: string, password: string, device = TEST_DEVICE, collegeId = fx.collegeId) {
  // Not async: an async wrapper would unwrap the returned supertest Test (a thenable) into a
  // plain Promise, losing the `.expect()` chain callers rely on.
  return mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId, identifier, password, device });
}

describe('POST /auth/sign-in', () => {
  it('signs in with roll number + temporary password and flags must-change', async () => {
    const s = await provisionTestStudent(fx);
    const res = await signIn(s.student.rollNumber, s.tempPassword).expect(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.accessExpiresIn).toBe(900);
    expect(res.body.account).toMatchObject({ kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingComplete: false, mustChangePassword: true });
    const session = await MobileSession.findOne({ accountId: s.account._id }).lean();
    expect(session?.deviceName).toBe('Test Phone');
  });

  it('accepts the email identifier for the same user', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.person.email, s.tempPassword).expect(200);
  });

  it('returns one identical 401 body for wrong password and unknown identifier', async () => {
    const s = await provisionTestStudent(fx);
    const a = await signIn(s.student.rollNumber, 'nope-nope-000').expect(401);
    const b = await signIn('DOESNOTEXIST', 'nope-nope-000').expect(401);
    expect(a.body).toEqual(b.body);
    expect(a.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives ACCOUNT_DEACTIVATED only when the password is right', async () => {
    const s = await provisionTestStudent(fx);
    await deactivateAccount(fx.collegeId, String(s.account._id), 'admin', 'admin');
    const wrong = await signIn(s.student.rollNumber, 'bad-bad-000').expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const right = await signIn(s.student.rollNumber, s.tempPassword).expect(403);
    expect(right.body.error).toMatchObject({ code: 'ACCOUNT_DEACTIVATED', supportContact: { name: 'Exam Office' } });
  });

  it('refuses an identifier from another college with the generic 401', async () => {
    const s = await provisionTestStudent(fx);
    const res = await signIn(s.student.rollNumber, s.tempPassword, TEST_DEVICE, '000000000000000000000099').expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('replaces an earlier session for the same device', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.student.rollNumber, s.tempPassword).expect(200);
    await signIn(s.student.rollNumber, s.tempPassword).expect(200);
    const sessions = await MobileSession.find({ accountId: s.account._id }).lean();
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((x) => !x.revokedAt)).toHaveLength(1);
  });

  it('400 VALIDATION_FAILED on a missing device', async () => {
    const res = await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier: 'x', password: 'y' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields[0].path).toBe('device');
  });
});

describe('refresh, sign-out, change-password', () => {
  it('rotates the refresh token and revokes on replay', async () => {
    const s = await provisionTestStudent(fx);
    const first = (await signIn(s.student.rollNumber, s.tempPassword)).body;
    const rotated = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);
    const replay = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(401);
    expect(replay.body.error).toMatchObject({ code: 'SESSION_INVALIDATED', reason: 'token_reuse' });
    // The whole session is gone: the rotated token is dead too.
    await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: rotated.body.refreshToken, deviceId: TEST_DEVICE.id }).expect(401);
  });

  it('sign-out invalidates the next request', async () => {
    const s = await provisionTestStudent(fx);
    const { accessToken } = (await signIn(s.student.rollNumber, s.tempPassword)).body;
    await mobileClient(app, accessToken).post(`${V1}/auth/sign-out`).expect(204);
    const res = await mobileClient(app, accessToken).post(`${V1}/auth/sign-out`).expect(401);
    expect(res.body.error).toMatchObject({ code: 'SESSION_INVALIDATED', reason: 'sign_out' });
  });

  it('change-password clears the flag, kills the temp password and other sessions, keeps this one', async () => {
    const s = await provisionTestStudent(fx);
    const phoneA = (await signIn(s.student.rollNumber, s.tempPassword)).body;
    const phoneB = (await signIn(s.student.rollNumber, s.tempPassword, { ...TEST_DEVICE, id: 'device-2' })).body;

    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: 'wrong', newPassword: 'longenough1' }).expect(401);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: s.tempPassword, newPassword: 'short' }).expect(400);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: s.tempPassword, newPassword: 'longenough1' }).expect(204);

    await signIn(s.student.rollNumber, s.tempPassword).expect(401);
    const again = await signIn(s.student.rollNumber, 'longenough1', { ...TEST_DEVICE, id: 'device-3' }).expect(200);
    expect(again.body.account.mustChangePassword).toBe(false);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/sign-out`).expect(204);      // A survived until now
    const b = await mobileClient(app, phoneB.accessToken).post(`${V1}/auth/sign-out`).expect(401);
    expect(b.body.error.reason).toBe('password_changed');
  });
});
