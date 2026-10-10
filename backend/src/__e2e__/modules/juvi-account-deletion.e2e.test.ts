import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import request from 'supertest';
import { allowedOrigins } from '../../shared/http/allowed-origins';
import { DELETION_GRACE_DAYS } from '../../modules/juvi-app/accounts/deletion-service';
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

    // The ERP login is untouched — the same assertion T4 guards, at the HTTP path. Written as
    // `toBe(true)` on a row that must still *exist*: `expect(user?.isActive).not.toBe(false)` reads
    // as the same guard but passes when `user` is null, i.e. it would go green on precisely the
    // failure — the person deleted outright — that this line is here to catch.
    const user = await User.findById(s.account.userId).lean();
    expect(user).not.toBeNull();
    expect(user!.isActive).toBe(true);
    expect(user!.password).toBeTruthy();

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

/** Puts a public-path deletion request on the account. */
function requestDeletion(accountId: unknown, claimedAt?: Date) {
  return JuviAccount.updateOne(
    { _id: accountId, collegeId: fx.collegeId },
    { $set: { deletionRequestedAt: new Date(), deletionRequestedVia: 'public_web', ...(claimedAt ? { deletionClaimedAt: claimedAt } : {}) } },
  );
}

describe('DELETE /me/account/deletion-request (011 T6)', () => {
  it('clears a pending, unclaimed request and leaves the account in place', async () => {
    const s = await signedInStudent();
    await requestDeletion(s.account._id);

    await mobileClient(app, s.token).delete(`${V1}/me/account/deletion-request`).expect(204);

    // $unset, not $set: null — the sparse `{ deletionRequestedAt: 1 }` sweep index only indexes
    // present fields, so an explicit null would drag every cleared account back into the scan.
    const raw = await JuviAccount.findOne({ collegeId: fx.collegeId }).lean();
    expect(raw).not.toBeNull();
    expect('deletionRequestedAt' in raw!).toBe(false);
    expect('deletionRequestedVia' in raw!).toBe(false);
    expect('deletionClaimedAt' in raw!).toBe(false);
    expect(await MobileSession.countDocuments({ collegeId: fx.collegeId })).toBe(1);
  });

  it('is a 204 no-op when nothing was pending', async () => {
    const s = await signedInStudent();
    await mobileClient(app, s.token).delete(`${V1}/me/account/deletion-request`).expect(204);
    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId })).toBe(1);
  });

  it('refuses with 409 once the executor has claimed the row', async () => {
    const s = await signedInStudent();
    await requestDeletion(s.account._id, new Date());

    const res = await mobileClient(app, s.token).delete(`${V1}/me/account/deletion-request`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DELETION_NOT_CANCELLABLE');
    // Still set: the deletion is committing and the UI must be able to say "too late".
    const raw = await JuviAccount.findOne({ collegeId: fx.collegeId }).lean();
    expect(raw!.deletionRequestedAt).toBeInstanceOf(Date);
  });

  it('requires an authenticated session', async () => {
    const s = await signedInStudent();
    await requestDeletion(s.account._id);
    expect((await mobileClient(app).delete(`${V1}/me/account/deletion-request`)).status).toBe(401);
    const raw = await JuviAccount.findOne({ collegeId: fx.collegeId }).lean();
    expect(raw!.deletionRequestedAt).toBeInstanceOf(Date);
  });
});

describe('best-effort clears on the auth paths (011 T6)', () => {
  it('drops a pending request on a successful sign-in', async () => {
    const s = await provisionTestStudent(fx);
    await requestDeletion(s.account._id);

    await signIn(s.student.rollNumber, s.tempPassword).expect(200);

    const raw = await JuviAccount.findOne({ collegeId: fx.collegeId }).lean();
    expect('deletionRequestedAt' in raw!).toBe(false);
  });

  it('drops a pending request on a successful password change', async () => {
    const s = await signedInStudent();
    await requestDeletion(s.account._id);

    await mobileClient(app, s.token)
      .post(`${V1}/auth/change-password`)
      .send({ currentPassword: s.tempPassword, newPassword: 'a-much-longer-passphrase-1' })
      .expect(204);

    const raw = await JuviAccount.findOne({ collegeId: fx.collegeId }).lean();
    expect('deletionRequestedAt' in raw!).toBe(false);
  });

  it('still returns 200 when the clear itself throws', async () => {
    const s = await provisionTestStudent(fx);
    await requestDeletion(s.account._id);

    // The realistic failure: a write that cannot land (primary unavailable, timeout). Sign-in
    // proved the credentials; a bookkeeping clear that fails must not turn that into a 500.
    const spy = vi.spyOn(JuviAccount, 'updateOne').mockRejectedValueOnce(new Error('primary unavailable'));
    let attempted = 0;
    try {
      await signIn(s.student.rollNumber, s.tempPassword).expect(200);
    } finally {
      // Read the call count before restoring: `mockRestore` resets the call history with it.
      attempted = spy.mock.calls.length;
      spy.mockRestore();
    }
    expect(attempted).toBeGreaterThan(0);
    // …and the request is still there for the next attempt to clear.
    const raw = await JuviAccount.findOne({ collegeId: fx.collegeId }).lean();
    expect(raw!.deletionRequestedAt).toBeInstanceOf(Date);
  });
});

/**
 * 011 T9 — the public web path, through the **real** app.
 *
 * The route's own CSRF matrix is pinned by `accounts/__tests__/public-deletion.test.ts`, which mounts
 * the router bare: `app.ts`'s `cors()` rejects a disallowed `Origin` before the route runs, so a
 * full-app test could only ever observe the middleware. What this file adds is the two things the
 * bare-router test structurally cannot show — that the route is reachable with **no**
 * `Authorization` header (AC7), and that it reads the *same* allowlist `cors()` does.
 */
describe('POST /account-deletion (011 T9)', () => {
  /** A same-origin submission from the allowlisted portal origin, with both AC8 signals agreeing. */
  function publicForm(fields: Record<string, string>) {
    return request(app)
      .post(`${V1}/account-deletion`)
      .set('Origin', allowedOrigins()[0]!)
      .set('Sec-Fetch-Site', 'same-origin')
      .type('form')
      .send(fields);
  }

  it('answers with no Authorization header at all, and schedules rather than deletes', async () => {
    const s = await provisionTestStudent(fx);

    const res = await publicForm({
      institutionCode: 'JIT-TEST', identifier: s.student.rollNumber, password: s.tempPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.graceDays).toBe(DELETION_GRACE_DAYS);
    // Scheduled, not executed: the account is still there and the ERP login is untouched. If the
    // mount had landed *after* spacesRouter this would be a 401 and nothing would be set — which is
    // exactly what moving that one line in `routes.ts` produces.
    const raw = await JuviAccount.findById(s.account._id).lean();
    expect(raw).not.toBeNull();
    expect(raw!.deletionRequestedAt).toBeInstanceOf(Date);
    expect(raw!.deletionRequestedVia).toBe('public_web');
    expect(await MobileSession.countDocuments({ collegeId: fx.collegeId })).toBe(0);
    expect(String((await User.findById(s.account.userId).lean())!.password)).toBeTruthy();
  });

  it('carries no session and no token back to the caller', async () => {
    const s = await provisionTestStudent(fx);

    const res = await publicForm({
      institutionCode: 'JIT-TEST', identifier: s.student.rollNumber, password: s.tempPassword,
    });

    // A web form has nowhere to put a token, and issuing one here would be an unauthenticated
    // session-minting endpoint. The body is exactly the scheduling receipt.
    expect(Object.keys(res.body).sort()).toEqual(['completesAt', 'graceDays', 'requested']);
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
  });
});
