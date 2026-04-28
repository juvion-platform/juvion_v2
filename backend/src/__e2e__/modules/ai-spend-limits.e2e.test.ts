/**
 * Task L6 — e2e tests for `PATCH /api/colleges/:id/ai-spend-limits`.
 *
 * Spec: .captain/specs/llm-spend-limits/tasks.md §L6
 *
 * Coverage:
 *   - 200 happy paths (weeklyInr only, alertThresholdPct only, both fields)
 *   - 400 (invalid weeklyInr negative, invalid alertThresholdPct=101 & =0)
 *   - 401 (no auth header)
 *   - 403 (non-admin / non-platform-update role — finance officer)
 *   - 404 (college not found)
 *   - Cross-college: super_admin via URL :id works; admin can't write a
 *     college that doesn't match their JWT collegeId
 *
 * Verifies the response shape:
 *   { aiSpendLimits: { weeklyInr, alertThresholdPct },
 *     currentSpend:   { spent, limit, pct } }
 *
 * AuditLog row asserted on the first happy-path test (proves the service
 * write-path was exercised end-to-end).
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { Types } from 'mongoose';
import supertest from 'supertest';
import type { Express } from 'express';

import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestUser } from '../factories/user.factory';

import { College } from '../../models/College';
import { AuditLog } from '../../shared/audit';
import { _resetCachesForTest } from '../../modules/platform/spend-limits/cache';

let app: Express;
let fx: BaseFixtures;

beforeAll(async () => {
  app = await getTestApp();
  fx = await seedBase();
}, 60_000);

afterAll(async () => {
  await cleanupTestApp();
});

afterEach(async () => {
  // Reset caches so a previous test's reads don't leak into the next.
  _resetCachesForTest();
  // Reset spend limits on the seeded college so each test starts at the
  // schema defaults.
  await College.findByIdAndUpdate(fx.collegeId, {
    $set: { aiSpendLimits: { weeklyInr: 0, alertThresholdPct: 80 } },
  });
  await AuditLog.deleteMany({ entityType: 'College' });
});

// PATCH helper — supertest exposes .patch but our shared TestApi only wraps
// get/post/put/delete; building a tiny inline helper avoids touching the
// shared file just for this test.
function patch(token: string, url: string) {
  return supertest(app).patch(url).set('Authorization', `Bearer ${token}`);
}
function patchNoAuth(url: string) {
  return supertest(app).patch(url);
}

describe('PATCH /api/colleges/:id/ai-spend-limits — happy paths', () => {
  it('200: admin updates weeklyInr only → DB reflects + AuditLog row exists', async () => {
    const res = await patch(fx.admin.token, `/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ weeklyInr: 1500 })
      .expect(200);

    // Response shape
    expect(res.body.aiSpendLimits).toBeDefined();
    expect(res.body.aiSpendLimits.weeklyInr).toBe(1500);
    expect(res.body.aiSpendLimits.alertThresholdPct).toBe(80); // unchanged default
    expect(res.body.currentSpend).toBeDefined();
    expect(typeof res.body.currentSpend.spent).toBe('number');
    expect(res.body.currentSpend.limit).toBe(1500);
    expect(typeof res.body.currentSpend.pct).toBe('number');

    // DB write-back
    const db = await College.findById(fx.collegeId).lean();
    expect(db?.aiSpendLimits?.weeklyInr).toBe(1500);
    expect(db?.aiSpendLimits?.alertThresholdPct).toBe(80);

    // AuditLog row
    const audit = await AuditLog.find({
      entityType: 'College',
      entityId: fx.collegeId,
      action: 'update',
    }).lean();
    expect(audit.length).toBeGreaterThanOrEqual(1);
    const change = audit[0]?.changes.find((c: any) => c.field === 'aiSpendLimits.weeklyInr');
    expect(change).toBeDefined();
    expect(change?.oldValue).toBe(0);
    expect(change?.newValue).toBe(1500);
  });

  it('200: admin updates alertThresholdPct only → DB reflects, weeklyInr unchanged', async () => {
    // Seed an existing weeklyInr so we can assert it survives the partial update.
    await College.findByIdAndUpdate(fx.collegeId, {
      $set: { aiSpendLimits: { weeklyInr: 999, alertThresholdPct: 80 } },
    });
    _resetCachesForTest();

    const res = await patch(fx.admin.token, `/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ alertThresholdPct: 90 })
      .expect(200);

    expect(res.body.aiSpendLimits.weeklyInr).toBe(999);
    expect(res.body.aiSpendLimits.alertThresholdPct).toBe(90);

    const db = await College.findById(fx.collegeId).lean();
    expect(db?.aiSpendLimits?.weeklyInr).toBe(999);
    expect(db?.aiSpendLimits?.alertThresholdPct).toBe(90);
  });

  it('200: admin updates both fields atomically', async () => {
    const res = await patch(fx.admin.token, `/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ weeklyInr: 2500, alertThresholdPct: 75 })
      .expect(200);

    expect(res.body.aiSpendLimits.weeklyInr).toBe(2500);
    expect(res.body.aiSpendLimits.alertThresholdPct).toBe(75);
    expect(res.body.currentSpend.limit).toBe(2500);

    const db = await College.findById(fx.collegeId).lean();
    expect(db?.aiSpendLimits?.weeklyInr).toBe(2500);
    expect(db?.aiSpendLimits?.alertThresholdPct).toBe(75);
  });
});

describe('PATCH /api/colleges/:id/ai-spend-limits — validation', () => {
  it('400: rejects negative weeklyInr', async () => {
    const res = await patch(fx.admin.token, `/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ weeklyInr: -1 })
      .expect(400);
    expect(res.body.error).toBeTruthy();
  });

  it('400: rejects alertThresholdPct = 101', async () => {
    const res = await patch(fx.admin.token, `/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ alertThresholdPct: 101 })
      .expect(400);
    expect(res.body.error).toBeTruthy();
  });

  it('400: rejects alertThresholdPct = 0 (min 1)', async () => {
    await patch(fx.admin.token, `/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ alertThresholdPct: 0 })
      .expect(400);
  });
});

describe('PATCH /api/colleges/:id/ai-spend-limits — auth', () => {
  it('401: missing auth header', async () => {
    await patchNoAuth(`/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ weeklyInr: 100 })
      .expect(401);
  });

  it('403: non-admin role (finance staff / ST-ACC) is denied', async () => {
    const finance = await createTestUser({
      collegeId: fx.collegeId,
      role: 'staff',
      personaType: 'ST-ACC',
      name: 'Finance Officer',
      email: 'finance.officer@test.com',
    });

    const res = await patch(finance.token, `/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ weeklyInr: 100 })
      .expect(403);
    expect(res.body.error).toBeTruthy();
  });
});

describe('PATCH /api/colleges/:id/ai-spend-limits — not found', () => {
  it('404: college does not exist (super_admin bypasses the cross-college gate)', async () => {
    // Use super_admin: admin/principal would (rightly) fail the cross-college
    // gate with 403 before reaching the service, since their JWT collegeId
    // can never match a non-existent college. super_admin is the only role
    // that can produce a true 404 from this endpoint.
    const ghostId = new Types.ObjectId().toString();
    const res = await patch(fx.superAdmin.token, `/api/colleges/${ghostId}/ai-spend-limits`)
      .send({ weeklyInr: 500 })
      .expect(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe('PATCH /api/colleges/:id/ai-spend-limits — cross-college / super_admin', () => {
  it('200: super_admin can update any college via the URL :id', async () => {
    // super_admin has no collegeId in JWT — uses the URL param directly.
    const res = await patch(fx.superAdmin.token, `/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ weeklyInr: 4242 })
      .expect(200);
    expect(res.body.aiSpendLimits.weeklyInr).toBe(4242);
  });

  it('200: admin can update their own college (URL :id matches their JWT collegeId)', async () => {
    const res = await patch(fx.admin.token, `/api/colleges/${fx.collegeId}/ai-spend-limits`)
      .send({ weeklyInr: 333 })
      .expect(200);
    expect(res.body.aiSpendLimits.weeklyInr).toBe(333);
  });

  it('403: admin (non-super_admin) trying to write a different college is rejected', async () => {
    // Create a SECOND college; the seeded admin is NOT scoped to it.
    const otherCollege = await College.create({
      name: 'Other Test College',
      code: `OTHER-${Date.now()}`,
      address: { line1: '2 Elsewhere Rd', city: 'Mumbai', state: 'MH', pincode: '400001' },
      contactEmail: 'admin@other.test',
      contactPhone: '9000000002',
      subscription: { plan: 'basic', status: 'active' },
      status: 'active',
    });
    const otherId = String(otherCollege._id);

    try {
      await patch(fx.admin.token, `/api/colleges/${otherId}/ai-spend-limits`)
        .send({ weeklyInr: 1 })
        .expect(403);
    } finally {
      await College.findByIdAndDelete(otherId);
    }
  });
});
