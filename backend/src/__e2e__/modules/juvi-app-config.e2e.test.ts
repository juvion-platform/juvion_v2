import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { College } from '../../models/College';
import { invalidateJuviConfig } from '../../modules/juvi-app/config/institution-config';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('GET /institutions/:code', () => {
  it('returns identity for an enabled college, case-insensitively', async () => {
    await enableJuvi(fx.collegeId, { accentColor: '#112233', minAppVersion: { android: '1.0.0' } });
    const res = await mobileClient(app).get(`${V1}/institutions/jit-test`).expect(200);
    expect(res.body).toEqual({ collegeId: fx.collegeId, name: 'JIT Test College', logoUrl: null, accentColor: '#112233', paused: false, pausedMessage: null, minAppVersion: { android: '1.0.0' } });
  });

  it('returns the same 404 body for unknown, disabled and inactive codes', async () => {
    const unknown = await mobileClient(app).get(`${V1}/institutions/NOPE`).expect(404);
    const disabled = await mobileClient(app).get(`${V1}/institutions/JIT-TEST`).expect(404);
    await enableJuvi(fx.collegeId); await College.updateOne({ _id: fx.collegeId }, { $set: { status: 'suspended' } }); await invalidateJuviConfig(fx.collegeId);
    const inactive = await mobileClient(app).get(`${V1}/institutions/JIT-TEST`).expect(404);
    expect(unknown.body).toEqual(disabled.body);
    expect(unknown.body).toEqual(inactive.body);
    expect(unknown.body.error.message).toBe("We couldn't find that college code.");
  });
});

describe('GET /config', () => {
  it('returns branding, defaults and onboarding steps to a signed-in user', async () => {
    await enableJuvi(fx.collegeId, { supportContact: { name: 'Office', phone: '1' } });
    const s = await provisionTestStudent(fx);
    const t = (await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier: s.student.rollNumber, password: s.tempPassword, device: TEST_DEVICE })).body.accessToken;
    const res = await mobileClient(app, t).get(`${V1}/config`).expect(200);
    expect(res.body).toMatchObject({ name: 'JIT Test College', code: 'JIT-TEST', supportContact: { name: 'Office', phone: '1' }, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false }, onboardingSteps: ['identity', 'spaces', 'notifications'] });
  });

  it('is 503 INSTITUTION_PAUSED once the admin pauses', async () => {
    await enableJuvi(fx.collegeId);
    const s = await provisionTestStudent(fx);
    const t = (await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier: s.student.rollNumber, password: s.tempPassword, device: TEST_DEVICE })).body.accessToken;
    await enableJuvi(fx.collegeId, { paused: true, pausedMessage: 'Back Monday' });
    const res = await mobileClient(app, t).get(`${V1}/config`).expect(503);
    expect(res.body.error).toEqual({ code: 'INSTITUTION_PAUSED', message: 'Back Monday' });
  });
});
