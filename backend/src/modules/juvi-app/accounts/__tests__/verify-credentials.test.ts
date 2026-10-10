import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

// The whole point of `verifyCredentials` is what it does NOT touch, so the Redis client is mocked
// and asserted on rather than exercised: `incr` is `recordFailure`'s only write.
const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), incr: vi.fn(), expire: vi.fn(), ttl: vi.fn(), del: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));

import { verifyCredentials, signIn } from '../auth-service';
import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { User } from '../../../../models/User';
import { Person } from '../../../../models/people/Person';
import { College } from '../../../../models/College';
import { JuviAccount } from '../../../../models/juvi/JuviAccount';
import { MobileSession } from '../../../../models/juvi/MobileSession';

const oid = () => new Types.ObjectId();
const DEVICE = { id: 'device-0001', name: 'Test Phone', platform: 'android' as const, appVersion: '1.0.0', osVersion: '14' };

/**
 * 011-account-deletion T7 — `verifyCredentials` is `signIn`'s credential chain with every
 * side effect removed.
 *
 * The public deletion page (Story 3 AC2) is the reason it exists: it cannot call `signIn`, which
 * creates a `MobileSession` and wants a `device` payload a web form cannot supply. What makes the
 * extraction safe is the *absence* of effects, so that is what these tests pin — a session row, a
 * token, or a bump to the sign-in lockout budget would all be a regression here.
 *
 * The sign-in behaviour itself is pinned by the untouched `juvi-app-auth.e2e.test.ts` suite.
 */

async function seed(collegeId: Types.ObjectId, tag: string, password: string) {
  const person = await Person.create({ collegeId, name: `Person ${tag}`, phone: '1' });
  const user = await User.create({
    collegeId, personId: person._id, email: `${tag}@x.test`, name: tag, role: 'student', personaType: 'L-STU',
    password: await bcrypt.hash(password, 10),
  });
  const account = await JuviAccount.create({ collegeId, personId: person._id, userId: user._id, kind: 'student', provisionedBy: 'test' });
  return { user, account };
}

describe('verifyCredentials (011 T7)', () => {
  beforeAll(async () => { await setupMongo(); }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); vi.clearAllMocks(); });

  it('returns the user and the account for the right password', async () => {
    const collegeId = oid();
    const { user, account } = await seed(collegeId, 'alice', 'right-horse-1');

    const got = await verifyCredentials(String(collegeId), 'alice@x.test', 'right-horse-1');

    expect(String(got.user._id)).toBe(String(user._id));
    expect(String(got.account._id)).toBe(String(account._id));
  });

  it('throws one identical generic 401 for a wrong password and an unknown identifier', async () => {
    const collegeId = oid();
    await seed(collegeId, 'bob', 'right-horse-2');

    const wrong = await verifyCredentials(String(collegeId), 'bob@x.test', 'wrong-horse-9').catch((e) => e);
    const absent = await verifyCredentials(String(collegeId), 'nobody@x.test', 'wrong-horse-9').catch((e) => e);

    expect(wrong.statusCode).toBe(401);
    expect(wrong.code).toBe('INVALID_CREDENTIALS');
    expect(absent.message).toBe(wrong.message);
    expect(absent.code).toBe(wrong.code);
  });

  it('treats a user with no Juvi account as the same generic 401', async () => {
    const collegeId = oid();
    const person = await Person.create({ collegeId, name: 'No Juvi', phone: '1' });
    await User.create({ collegeId, personId: person._id, email: 'nojuvi@x.test', name: 'No Juvi', role: 'student', personaType: 'L-STU', password: await bcrypt.hash('right-horse-3', 10) });

    const err = await verifyCredentials(String(collegeId), 'nojuvi@x.test', 'right-horse-3').catch((e) => e);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  it('creates no session and leaves the sign-in lockout budget alone, on success and on failure', async () => {
    const collegeId = oid();
    await seed(collegeId, 'carol', 'right-horse-4');

    await verifyCredentials(String(collegeId), 'carol@x.test', 'right-horse-4');
    await verifyCredentials(String(collegeId), 'carol@x.test', 'wrong-horse-9').catch(() => undefined);

    // No session row, and therefore no tokens: this is why the web page must not call `signIn`.
    expect(await MobileSession.countDocuments({ collegeId })).toBe(0);
    // `recordFailure` writes through `incr` and only through `incr`. Five bogus public requests must
    // not be able to lock a victim out of the app (Story 3 AC6).
    expect(redisMock.incr).not.toHaveBeenCalled();
    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('charges the lockout budget in signIn, not in the shared chain', async () => {
    const collegeId = oid();
    await College.create({
      _id: collegeId, name: 'X College', code: 'XCO', status: 'active',
      address: { line1: 'a', city: 'b', state: 'c', pincode: '500001' }, contactEmail: 'a@b.c', contactPhone: '1',
      juvi: { enabled: true },
    });
    await seed(collegeId, 'dave', 'right-horse-5');

    // Removing `recordFailure` from `signIn` and leaving it out entirely keeps every other test in
    // this repo green — nothing else asserts the budget is charged at all. This is that assertion.
    await signIn({ collegeId: String(collegeId), identifier: 'dave@x.test', password: 'wrong-horse-9', device: DEVICE }).catch(() => undefined);

    expect(redisMock.incr).toHaveBeenCalledTimes(1);
  });
});
