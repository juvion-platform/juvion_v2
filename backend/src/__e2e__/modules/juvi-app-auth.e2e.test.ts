import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import bcrypt from 'bcryptjs';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { MobileSession } from '../../models/juvi/MobileSession';
import { deactivateAccount } from '../../modules/juvi-app/accounts/provisioning-service';
import { User } from '../../models/User';
import { formatJuviId } from '../../modules/juvi-app/accounts/juvi-id';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { clearFailures } from '../../modules/juvi-app/accounts/cooldown';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';

/** Well-shaped, canonical, and assigned to nobody. */
const UNKNOWN_JUVI_ID = 'JUVZZZZZZZZ';

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => {
  await cleanupTestApp();
  fx = await seedBase();
  await enableJuvi(fx.collegeId, { supportContact: { name: 'Exam Office', phone: '040-1' } });
  // Redis is never flushed between runs, so the two fixed literals below would accrue one cooldown
  // charge per run and flip their assertions from 401 to 429 within the 600s window.
  await clearFailures(UNKNOWN_JUVI_ID);
  await clearFailures('JUVR00T0000');
});
afterAll(async () => { await cleanupTestApp(); });

function signIn(juviId: string, password: string, device = TEST_DEVICE) {
  // Not async: an async wrapper would unwrap the returned supertest Test (a thenable) into a
  // plain Promise, losing the `.expect()` chain callers rely on.
  return mobileClient(app).post(`${V1}/auth/sign-in`).send({ juviId, password, device });
}

describe('POST /auth/sign-in', () => {
  it('signs in with the Juvi ID and flags must-change', async () => {
    const s = await provisionTestStudent(fx);
    const res = await signIn(s.juviId, s.tempPassword).expect(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.accessExpiresIn).toBe(900);
    expect(res.body.collegeId).toBe(fx.collegeId);
    expect(res.body.account).toMatchObject({ kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingComplete: false, mustChangePassword: true });
    const session = await MobileSession.findOne({ accountId: s.account._id }).lean();
    expect(session?.deviceName).toBe('Test Phone');
  });

  // Review Focus 1 — the way a person actually writes the ID down.
  it('accepts the spaced, lowercased transcription of the same ID', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(formatJuviId(s.juviId).toLowerCase(), s.tempPassword).expect(200);
  });

  // Review Focus 2 — the likeliest migration mistake gets actionable copy, not a 401.
  it('400 VALIDATION_FAILED naming the shape when a roll number is typed in', async () => {
    const s = await provisionTestStudent(fx);
    const res = await signIn(s.student.rollNumber, s.tempPassword).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields[0].path).toBe('juviId');
    expect(res.body.error.fields[0].message).toBe("That doesn't look like a Juvi ID. It looks like JUV-4K7P-2M9X.");
  });

  it('no longer accepts the roll number or the email that used to work', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.student.rollNumber, s.tempPassword).expect(400);
    await signIn(s.person.email, s.tempPassword).expect(400);
  });

  it('returns one identical 401 body for wrong password and unknown Juvi ID', async () => {
    const s = await provisionTestStudent(fx);
    const a = await signIn(s.juviId, 'nope-nope-000').expect(401);
    const b = await signIn(UNKNOWN_JUVI_ID, 'nope-nope-000').expect(401);
    expect(a.body).toEqual(b.body);
    expect(a.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  // Review finding 1 — the cooldown must not be a way to tell a real ID from an unknown one.
  it('spends the same failure budget for an unknown Juvi ID as for a real one', async () => {
    const s = await provisionTestStudent(fx);
    const unknown = 'JUVQQQQQQQQ'; // valid shape, no User behind it
    await clearFailures(s.juviId);
    await clearFailures(unknown); // this literal recurs across runs; Redis is not flushed between them

    for (let i = 0; i < 5; i += 1) {
      await signIn(s.juviId, 'bad-bad-000').expect(401);
      await signIn(unknown, 'bad-bad-000').expect(401);
    }

    // The 6th attempt must be indistinguishable: same status, same body.
    const real = await signIn(s.juviId, 'bad-bad-000').expect(429);
    const ghost = await signIn(unknown, 'bad-bad-000').expect(429);
    expect(real.body).toEqual(ghost.body);
    expect(real.body.error.code).toBe('COOLDOWN');
  });

  // Review Focus 5 — a User that holds an ID but carries no college is a clean 401, never a 500.
  it('401s, and does not 500, for a User with a Juvi ID and no collegeId', async () => {
    const password = 'root-horse-9';
    await User.create({ email: 'root@x.test', password: await bcrypt.hash(password, 10), name: 'Root', role: 'super_admin', juviId: 'JUVR00T0000' });
    // The correct password, so the 401 can only come from the no-college guard — never from `!ok`.
    const res = await signIn('JUVR00T0000', password).expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives ACCOUNT_DEACTIVATED only when the password is right', async () => {
    const s = await provisionTestStudent(fx);
    await deactivateAccount(fx.collegeId, String(s.account._id), 'admin', 'admin');
    const wrong = await signIn(s.juviId, 'bad-bad-000').expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const right = await signIn(s.juviId, s.tempPassword).expect(403);
    expect(right.body.error).toMatchObject({ code: 'ACCOUNT_DEACTIVATED', supportContact: { name: 'Exam Office' } });
  });

  // Review Focus 3 — §6's ELIGIBLE_STATUSES check (ruling R-B): a deliberate widening.
  it('refuses an exiting account, and accepts the same account while active', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.juviId, s.tempPassword).expect(200);
    await JuviAccount.updateOne({ _id: s.account._id, collegeId: fx.collegeId }, { $set: { status: 'exiting' } });
    const res = await signIn(s.juviId, s.tempPassword).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    await JuviAccount.updateOne({ _id: s.account._id, collegeId: fx.collegeId }, { $set: { status: 'active' } });
    await signIn(s.juviId, s.tempPassword).expect(200);
  });

  it('503 INSTITUTION_PAUSED with the pause message, and only after a correct password', async () => {
    const s = await provisionTestStudent(fx);
    await enableJuvi(fx.collegeId, { paused: true, pausedMessage: 'Back after exams.' });
    const wrong = await signIn(s.juviId, 'bad-bad-000').expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const res = await signIn(s.juviId, s.tempPassword).expect(503);
    expect(res.body.error).toEqual({ code: 'INSTITUTION_PAUSED', message: 'Back after exams.' });
    expect(await MobileSession.countDocuments({ collegeId: fx.collegeId, accountId: s.account._id })).toBe(0);
  });

  // Review Focus 5 — one budget, whichever way the ID is spelled.
  it('429s on the fifth failure and stays locked under the other spelling', async () => {
    const s = await provisionTestStudent(fx);
    for (let i = 0; i < 4; i += 1) await signIn(formatJuviId(s.juviId).toLowerCase(), 'bad-bad-000').expect(401);
    const fifth = await signIn(s.juviId, 'bad-bad-000').expect(401);
    expect(fifth.body.error.code).toBe('INVALID_CREDENTIALS');
    const locked = await signIn(s.juviId, s.tempPassword).expect(429);
    expect(locked.body.error).toMatchObject({ code: 'COOLDOWN' });
    expect(locked.body.error.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('replaces an earlier session for the same device', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.juviId, s.tempPassword).expect(200);
    await signIn(s.juviId, s.tempPassword).expect(200);
    const sessions = await MobileSession.find({ accountId: s.account._id }).lean();
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((x) => !x.revokedAt)).toHaveLength(1);
  });

  it('400 VALIDATION_FAILED on a missing device', async () => {
    const res = await mobileClient(app).post(`${V1}/auth/sign-in`).send({ juviId: UNKNOWN_JUVI_ID, password: 'y' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields[0].path).toBe('device');
  });
});

describe('refresh, sign-out, change-password', () => {
  it('rotates the refresh token and revokes on replay', async () => {
    const s = await provisionTestStudent(fx);
    const first = (await signIn(s.juviId, s.tempPassword)).body;
    const rotated = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);
    const replay = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(401);
    expect(replay.body.error).toMatchObject({ code: 'SESSION_INVALIDATED', reason: 'token_reuse' });
    // The whole session is gone: the rotated token is dead too.
    await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: rotated.body.refreshToken, deviceId: TEST_DEVICE.id }).expect(401);
  });

  it('refuses refresh with 403 ACCOUNT_DEACTIVATED once the ERP login is disabled, without rotating the token', async () => {
    const s = await provisionTestStudent(fx);
    const first = (await signIn(s.juviId, s.tempPassword)).body;
    await User.updateOne({ collegeId: fx.collegeId, _id: s.account.userId }, { $set: { isActive: false } });

    const res = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(403);
    expect(res.body.error).toMatchObject({ code: 'ACCOUNT_DEACTIVATED', message: 'This account is no longer active at your institution.', supportContact: { name: 'Exam Office' } });

    // Refused before rotation: the session and the token the client holds are untouched.
    const session = await MobileSession.findOne({ collegeId: fx.collegeId, accountId: s.account._id }).lean();
    expect(session?.revokedAt).toBeFalsy();
    expect(session?.previousRefreshTokenHash).toBeFalsy();
  });

  it('sign-out invalidates the next request', async () => {
    const s = await provisionTestStudent(fx);
    const { accessToken } = (await signIn(s.juviId, s.tempPassword)).body;
    await mobileClient(app, accessToken).post(`${V1}/auth/sign-out`).expect(204);
    const res = await mobileClient(app, accessToken).post(`${V1}/auth/sign-out`).expect(401);
    expect(res.body.error).toMatchObject({ code: 'SESSION_INVALIDATED', reason: 'sign_out' });
  });

  it('change-password clears the flag, kills the temp password and other sessions, keeps this one', async () => {
    const s = await provisionTestStudent(fx);
    const phoneA = (await signIn(s.juviId, s.tempPassword)).body;
    const phoneB = (await signIn(s.juviId, s.tempPassword, { ...TEST_DEVICE, id: 'device-2' })).body;

    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: 'wrong', newPassword: 'longenough1' }).expect(401);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: s.tempPassword, newPassword: 'short' }).expect(400);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: s.tempPassword, newPassword: 'longenough1' }).expect(204);

    await signIn(s.juviId, s.tempPassword).expect(401);
    const again = await signIn(s.juviId, 'longenough1', { ...TEST_DEVICE, id: 'device-3' }).expect(200);
    expect(again.body.account.mustChangePassword).toBe(false);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/sign-out`).expect(204);      // A survived until now
    const b = await mobileClient(app, phoneB.accessToken).post(`${V1}/auth/sign-out`).expect(401);
    expect(b.body.error.reason).toBe('password_changed');
  });
});
