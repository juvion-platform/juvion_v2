import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

// The Redis client is mocked for the same reason `verify-credentials.test.ts` mocks it: this route's
// contract is largely about which keys it does *not* touch. `getJuviConfig`'s cache also lands here.
const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), incr: vi.fn(), expire: vi.fn(), ttl: vi.fn(), del: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));

import { publicDeletionRouter } from '../public-deletion-routes';
import { mobileErrorHandler } from '../../errors';
import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { User } from '../../../../models/User';
import { Person } from '../../../../models/people/Person';
import { College } from '../../../../models/College';
import { JuviAccount } from '../../../../models/juvi/JuviAccount';
import { MobileSession } from '../../../../models/juvi/MobileSession';
import { AuditLog } from '../../../../shared/audit';
import { DELETION_GRACE_DAYS } from '../deletion-service';

/**
 * 011-account-deletion T9 — `POST /v1/account-deletion`, the public web path (Story 3).
 *
 * The router is mounted on a **bare** Express app here rather than on `app.ts`, and that is
 * deliberate: the real app's `cors()` middleware rejects a disallowed `Origin` before the route
 * ever runs (`app.ts:28-38`). CORS is not what this route relies on (AC8 — "CORS alone does not stop
 * a form POST from being *processed*"), so testing through it would assert the middleware's
 * behaviour instead of the route's own check. The full-app reachability case lives in
 * `__e2e__/modules/juvi-account-deletion.e2e.test.ts`.
 *
 * The form-encoded body is not incidental: the public page carries no script at all (AC9), so it
 * submits natively and every request here uses `application/x-www-form-urlencoded`.
 */

const COLLEGE_CODE = 'TESTCOLL';
const PASSWORD = 'river-lamp-482';
const ORIGIN = 'http://localhost:5173';

const app = express();
app.use(publicDeletionRouter);
app.use(mobileErrorHandler);

const oid = () => new Types.ObjectId();

/** A same-origin browser submission: both AC8 signals present and agreeing. */
const form = (fields: Record<string, string>) =>
  request(app).post('/account-deletion').set('Sec-Fetch-Site', 'same-origin').set('Origin', ORIGIN).type('form').send(fields);

async function seedCollege(code = COLLEGE_CODE) {
  // `lookupInstitutionByCode` requires `status: 'active'` *and* `juvi.enabled` (institution-config.ts:73-79).
  return College.create({
    name: 'Test College', code, status: 'active', juvi: { enabled: true },
    contactPhone: '9999999999', contactEmail: 'office@x.test',
    address: { line1: '1 College Road', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
  });
}

async function seedStudent(collegeId: Types.ObjectId, tag: string, password = PASSWORD) {
  const person = await Person.create({ collegeId, name: `Person ${tag}`, phone: `90${tag}` });
  const user = await User.create({
    collegeId, personId: person._id, email: `${tag}@x.test`, name: tag, role: 'student', personaType: 'L-STU',
    password: await bcrypt.hash(password, 10),
  });
  const account = await JuviAccount.create({ collegeId, personId: person._id, userId: user._id, kind: 'student', provisionedBy: 'test' });
  return { person, user, account };
}

const reload = (id: Types.ObjectId) => JuviAccount.findById(id).lean();

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
beforeEach(() => { redisMock.get.mockResolvedValue(null); redisMock.incr.mockResolvedValue(1); });
afterEach(async () => { await clearCollections(); vi.clearAllMocks(); });

describe('POST /v1/account-deletion (011 T9)', () => {
  it('schedules deletion from a native form POST, and needs no Authorization header', async () => {
    const college = await seedCollege();
    const s = await seedStudent(college._id, 's1');

    const res = await form({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requested: true, graceDays: DELETION_GRACE_DAYS, completesAt: expect.any(String) });
    expect(new Date(res.body.completesAt).getTime()).toBeGreaterThan(Date.now());

    const after = await reload(s.account._id as Types.ObjectId);
    expect(after?.deletionRequestedAt).toBeInstanceOf(Date);
    expect(after?.deletionRequestedVia).toBe('public_web');
    // The claim is the sweep's, not the request's — a request must never look already-executing.
    expect(after?.deletionClaimedAt ?? null).toBeNull();
  });

  it('records the request against the account, never the submitted identifier', async () => {
    const college = await seedCollege();
    const s = await seedStudent(college._id, 's1');

    await form({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD });

    const rows = await AuditLog.find({ entityType: 'JuviAccountPublicDeletion' }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe('request_deletion');
    expect(rows[0]?.entityId).toBe(String(s.account._id));
    // `performedBy` is the actor. E-mails and roll numbers must never reach an audit trail.
    expect(rows[0]?.performedBy).toBe(String(s.account._id));
    expect(JSON.stringify(rows)).not.toContain('s1@x.test');
  });

  it('re-asserts a fresh deadline on a repeat POST without a second audit row', async () => {
    const college = await seedCollege();
    const s = await seedStudent(college._id, 's1');

    await form({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD });
    const first = await reload(s.account._id as Types.ObjectId);
    await new Promise((r) => setTimeout(r, 5));
    const second = await form({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD });

    expect(second.status).toBe(200);
    const after = await reload(s.account._id as Types.ObjectId);
    // Fresh clock: the requester asking again restarts their own grace period rather than being
    // told "already requested". (T10 hangs the push off the same transition flag.)
    expect(after!.deletionRequestedAt!.getTime()).toBeGreaterThan(first!.deletionRequestedAt!.getTime());
    expect(await AuditLog.countDocuments({ entityType: 'JuviAccountPublicDeletion' })).toBe(1);
    // The response must not disclose that someone else already asked.
    expect(second.body).toEqual({ requested: true, graceDays: DELETION_GRACE_DAYS, completesAt: expect.any(String) });
  });

  it('answers a real identifier with a wrong password exactly as it answers a nonexistent one', async () => {
    const college = await seedCollege();
    const s = await seedStudent(college._id, 's1');

    const wrongPassword = await form({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: 'not-the-password' });
    const nonexistent = await form({ institutionCode: COLLEGE_CODE, identifier: 'ghost@x.test', password: PASSWORD });

    expect(wrongPassword.status).toBe(nonexistent.status);
    expect(wrongPassword.status).toBe(401);
    expect(JSON.stringify(wrongPassword.body)).toBe(JSON.stringify(nonexistent.body));
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    // Neither branch may leave a trace, so the response is the only channel — and it says nothing.
    expect((await reload(s.account._id as Types.ObjectId))?.deletionRequestedAt ?? null).toBeNull();
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('collapses an unknown institution code into the same generic failure', async () => {
    const res = await form({ institutionCode: 'NOPE', identifier: 's1@x.test', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('never creates a MobileSession and never charges the sign-in lockout budget', async () => {
    const college = await seedCollege();
    await seedStudent(college._id, 's1');

    await form({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD });
    await form({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: 'wrong' });

    expect(await MobileSession.countDocuments()).toBe(0);
    // AC6: a failing public attempt must not be able to spend the owner's sign-in lockout budget.
    const keys = redisMock.incr.mock.calls.map((c) => String(c[0]));
    expect(keys.every((k) => k.startsWith('juvi:deletion-verify:'))).toBe(true);
    expect(keys.some((k) => k.startsWith('juvi:login-fail:'))).toBe(false);
  });
});

/**
 * AC8 — every presented signal must agree. Neither header is a fallback for the other, so the
 * matrix below is the AC, not a sample of it.
 */
describe('POST /v1/account-deletion — cross-site rejection (011 T9 / AC8)', () => {
  async function expectRejected(req: request.Test) {
    const res = await req;
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await JuviAccount.countDocuments({ deletionRequestedAt: { $ne: null } })).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
  }

  it('rejects a request presenting neither Sec-Fetch-Site nor Origin', async () => {
    const college = await seedCollege();
    await seedStudent(college._id, 's1');
    await expectRejected(
      request(app).post('/account-deletion').type('form').send({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD }),
    );
  });

  it('rejects an Origin outside the CORS allowlist even when Sec-Fetch-Site claims same-origin', async () => {
    const college = await seedCollege();
    await seedStudent(college._id, 's1');
    await expectRejected(
      request(app).post('/account-deletion')
        .set('Sec-Fetch-Site', 'same-origin').set('Origin', 'https://evil.example')
        .type('form').send({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD }),
    );
  });

  it('rejects a Sec-Fetch-Site of cross-site even from an allowlisted Origin', async () => {
    const college = await seedCollege();
    await seedStudent(college._id, 's1');
    await expectRejected(
      request(app).post('/account-deletion')
        .set('Sec-Fetch-Site', 'cross-site').set('Origin', ORIGIN)
        .type('form').send({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD }),
    );
  });

  it('accepts an allowlisted Origin alone, and a same-origin Referer alone', async () => {
    const college = await seedCollege();
    await seedStudent(college._id, 's1');
    const payload = { institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD };

    const byOrigin = await request(app).post('/account-deletion').set('Origin', ORIGIN).type('form').send(payload);
    expect(byOrigin.status).toBe(200);

    const byReferer = await request(app).post('/account-deletion')
      .set('Sec-Fetch-Site', 'same-origin').set('Referer', `${ORIGIN}/account-deletion.html`)
      .type('form').send(payload);
    expect(byReferer.status).toBe(200);
  });

  it('rejects a cross-site Referer', async () => {
    const college = await seedCollege();
    await seedStudent(college._id, 's1');
    await expectRejected(
      request(app).post('/account-deletion')
        .set('Referer', 'https://evil.example/account-deletion.html')
        .type('form').send({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test', password: PASSWORD }),
    );
  });

  it('rejects a malformed body before anything is looked up', async () => {
    const res = await form({ institutionCode: COLLEGE_CODE, identifier: 's1@x.test' });
    expect(res.status).toBe(400);
    // The body is echoed nowhere — this is a validation failure, not an authentication one.
    expect(JSON.stringify(res.body)).not.toContain('s1@x.test');
  });
});

describe('requestPublicDeletion (011 T9)', () => {
  it('reports the unset → set transition, and not a repeat', async () => {
    const { requestPublicDeletion } = await import('../deletion-service');
    const college = await seedCollege();
    const s = await seedStudent(college._id, 's1');

    expect(await requestPublicDeletion(String(college._id), String(s.account._id))).toBe(true);
    expect(await requestPublicDeletion(String(college._id), String(s.account._id))).toBe(false);
  });

  it('is scoped by collegeId, so a foreign id changes nothing', async () => {
    const { requestPublicDeletion } = await import('../deletion-service');
    const college = await seedCollege();
    const s = await seedStudent(college._id, 's1');

    expect(await requestPublicDeletion(String(oid()), String(s.account._id))).toBe(false);
    expect((await reload(s.account._id as Types.ObjectId))?.deletionRequestedAt ?? null).toBeNull();
  });
});
