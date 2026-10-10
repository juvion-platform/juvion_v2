import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { MobileSession } from '../../models/juvi/MobileSession';
import { User } from '../../models/User';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

function signIn(identifier: string, password: string) {
  return mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier, password, device: TEST_DEVICE });
}

/** Provisions a student and returns a live access token for it. */
async function signedInStudent() {
  const s = await provisionTestStudent(fx);
  const res = await signIn(s.student.rollNumber, s.tempPassword).expect(200);
  return { ...s, token: res.body.accessToken as string };
}

describe('DELETE /me/account (011 T5)', () => {
  it('deletes the Juvi rows, leaves the ERP login intact, and rejects the old token afterwards', async () => {
    const s = await signedInStudent();

    await mobileClient(app, s.token).delete(`${V1}/me/account`).expect(204);

    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId })).toBe(0);
    expect(await MobileSession.countDocuments({ collegeId: fx.collegeId })).toBe(0);

    // The ERP login is untouched — the same assertion T4 guards, at the HTTP path.
    const user = await User.findById(s.account.userId).lean();
    expect(user?.isActive).not.toBe(false);
    expect(user?.password).toBeTruthy();

    // The token was live seconds ago; the row it resolves against is gone, so it is refused.
    const after = await mobileClient(app, s.token).get(`${V1}/me`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('SESSION_INVALIDATED');
  });

  it('answers a repeat call with a defined error, never a 500', async () => {
    const s = await signedInStudent();
    await mobileClient(app, s.token).delete(`${V1}/me/account`).expect(204);

    const again = await mobileClient(app, s.token).delete(`${V1}/me/account`);
    expect([401, 404]).toContain(again.status);
    expect(again.body.error?.code).toBeTypeOf('string');
  });

  it('deletes immediately when a public request is already pending on the account', async () => {
    const s = await signedInStudent();
    // A public web request landed first: the grace period is running and nothing has claimed it.
    await JuviAccount.updateOne(
      { _id: s.account._id, collegeId: fx.collegeId },
      { $set: { deletionRequestedAt: new Date(), deletionRequestedVia: 'public_web' } },
    );

    // A live session plus the typed phrase is stronger evidence than the window protects, so the
    // window collapses: 204 now, not a 409 and not a wait.
    await mobileClient(app, s.token).delete(`${V1}/me/account`).expect(204);
    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId })).toBe(0);
    expect(await MobileSession.countDocuments({ collegeId: fx.collegeId })).toBe(0);
  });

  it('still deletes when the ERP login has been disabled', async () => {
    const s = await signedInStudent();
    // `authenticateMobile` does not consult `User.isActive` — only `deactivateAccount` flipping the
    // JuviAccount to `deactivated` does. So a disabled ERP login keeps a working token, and the
    // Juvi delete must not become a way to strand the account.
    await User.updateOne({ _id: s.account.userId, collegeId: fx.collegeId }, { $set: { isActive: false } });

    await mobileClient(app, s.token).delete(`${V1}/me/account`).expect(204);
    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId })).toBe(0);
  });

  it('requires an authenticated session', async () => {
    const s = await signedInStudent();
    const res = await mobileClient(app).delete(`${V1}/me/account`);
    expect(res.status).toBe(401);
    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId })).toBe(1);
    expect(String((await JuviAccount.findOne({ collegeId: fx.collegeId }).lean())!._id)).toBe(String(s.account._id));
  });
});
