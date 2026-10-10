import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Types } from 'mongoose';

// `authorize` loads policies through `shared/rbac/cache`, which reads Redis; the client is mocked so
// a miss is a miss and `resolveUserScope` never waits on a socket. Same reason `verify-credentials`
// mocks it.
const redisMock = vi.hoisted(() => ({
  get: vi.fn(async () => null), set: vi.fn(async () => 'OK'), keys: vi.fn(async () => []), del: vi.fn(async () => 1),
}));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));

import { adminRouter } from '../routes';
import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { JuviAccount } from '../../../../models/juvi/JuviAccount';
import { Policy } from '../../../../models/platform/Policy';
import { DELETION_GRACE_DAYS } from '../../accounts/deletion-service';

/**
 * 011 T13 — `GET /api/juvi-app/admin/accounts/pending-deletion` (Story 4 AC5, §3.5.1).
 *
 * This route is the **detection control** for the sweep's operational dependency: the sweep is the
 * only thing that performs a deletion, so a sweep that stalls has to be visible to a human rather
 * than silent. Two properties carry that weight, and both are one-line regressions away:
 *
 *  - the query is bounded to the caller's college. Omitting it is a cross-tenant read of who is
 *    leaving the institution — and Story 2 AC7 / §5 make the *sweep* the only sanctioned cross-tenant
 *    read, which this request path is not.
 *  - the route is gated on `platform: read` like its sibling `GET /accounts`.
 *
 * Driven through the real router over HTTP with real JWTs and the real `authorize`, so what is
 * asserted is the mounted behaviour (mount path, gate, envelope), not a re-reading of the route table.
 */

// The enforcement flag is captured before anything sets it, so the suite leaves the environment as
// it found it. `JWT_SECRET` is a fixture secret for this process, not a credential: `authenticate`
// reads it at call time, which is what makes the tokens below real to the middleware.
const PREV_ENFORCE = process.env.RBAC_ENFORCE;

const app = express();
app.use(express.json());
app.use('/api/juvi-app/admin', adminRouter);

const oid = () => new Types.ObjectId();

/** A signed ERP token, shaped exactly as `authenticate` reads it. No `tv`, so no token-version read. */
function tokenFor(id: string, role: string, personaType: string, collegeId: string): string {
  const payload = { id, name: role, email: `${role}@x.test`, role, personaType, personas: [personaType], collegeId };
  return jwt.sign(payload, process.env.JWT_SECRET as string);
}

async function seedRequested(collegeId: Types.ObjectId, daysAgo: number, claimed = false) {
  return JuviAccount.create({
    collegeId, personId: oid(), userId: oid(), kind: 'student', provisionedBy: 'test',
    deletionRequestedAt: new Date(Date.now() - daysAgo * 86_400_000),
    deletionRequestedVia: 'public_web',
    ...(claimed ? { deletionClaimedAt: new Date() } : {}),
  });
}

/** A token for a caller who can see the list: role `admin`, granted exactly `platform: read`. */
async function readerToken(collegeId: Types.ObjectId): Promise<string> {
  await Policy.create({ role: 'admin', module: 'platform', action: 'read', effect: 'allow', priority: 10, isActive: true });
  return tokenFor(String(oid()), 'admin', 'L-PRIN', String(collegeId));
}

const url = '/api/juvi-app/admin/accounts/pending-deletion';
const get = (token: string) => request(app).get(url).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  process.env.RBAC_ENFORCE = 'true';
  process.env.JWT_SECRET = 'test-secret';
  await setupMongo();
});
afterAll(async () => {
  process.env.RBAC_ENFORCE = PREV_ENFORCE;
  await teardownMongo();
});
afterEach(async () => { await clearCollections(); redisMock.get.mockClear(); });

describe('the pending-deletion list is bounded by the caller\'s college (011 T13)', () => {
  it('shows this college\'s pending requests, with an age, and never another college\'s', async () => {
    const mine = oid();
    const theirs = oid();
    const overdue = await seedRequested(mine, DELETION_GRACE_DAYS + 3, true);
    const fresh = await seedRequested(mine, 1);
    const other = await seedRequested(theirs, DELETION_GRACE_DAYS + 30);
    // A never-requested account is the third way this query can be wrong: matching on `collegeId`
    // alone, or a range predicate with the comparison inverted, would pull it in.
    await JuviAccount.create({ collegeId: mine, personId: oid(), userId: oid(), kind: 'student', provisionedBy: 'test' });

    const res = await get(await readerToken(mine));

    expect(res.status).toBe(200);
    // Oldest first: the most overdue request is the one an operator has to see.
    expect(res.body.items.map((r: { id: string }) => r.id)).toEqual([String(overdue._id), String(fresh._id)]);
    // The whole body, not just the ids: a leaked row would show up anywhere in it.
    expect(JSON.stringify(res.body)).not.toContain(String(other._id));
    expect(res.body.graceDays).toBe(DELETION_GRACE_DAYS);

    expect(res.body.items[0]).toEqual({
      id: String(overdue._id),
      requestedAt: expect.any(String),
      requestedVia: 'public_web',
      // Non-null and still listed: a claim is not a completion, so age alone decides "stalled".
      claimedAt: expect.any(String),
    });
    expect(res.body.items[1].claimedAt).toBeNull();
    // `collegeId` is not echoed per row — the caller's college is the only one this can be.
    expect(res.body.items[0]).not.toHaveProperty('collegeId');
  });
});

describe('the pending-deletion list is gated on platform: read (011 T13)', () => {
  it('serves a caller who holds platform: read and refuses one who holds only platform: update', async () => {
    const collegeId = oid();
    // Both roles hold a `platform` policy, so the refusal cannot be explained by "has no policies".
    await Policy.create({ role: 'registrar', module: 'platform', action: 'update', effect: 'allow', priority: 10, isActive: true });
    const reader = await readerToken(collegeId);
    const writer = tokenFor(String(oid()), 'registrar', 'ST-REG', String(collegeId));
    await seedRequested(collegeId, 2);

    const allowed = await get(reader);
    expect(allowed.status).toBe(200);
    expect(allowed.body.items).toHaveLength(1);

    const denied = await get(writer);
    expect(denied.status).toBe(403);
    // The refusal carries no list, not an empty one — a caller who cannot read must not learn even
    // whether their college has a pending deletion.
    expect(denied.body.items).toBeUndefined();
  });
});
