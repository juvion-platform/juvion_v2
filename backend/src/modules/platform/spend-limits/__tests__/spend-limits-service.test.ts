import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { College } from '../../../../models/College';
import { AgentAction } from '../../../../models/juvi/AgentAction';
import { AuditLog } from '../../../../shared/audit';
import {
  assertWithinSpendLimit,
  getCurrentSpend,
  updateSpendLimits,
} from '../service';
import {
  getCachedLimits,
  getCachedSpend,
  invalidateLimits,
  invalidateSpend,
  _resetCachesForTest,
} from '../cache';

/**
 * Helpers
 */

async function makeCollege(overrides: {
  weeklyInr?: number;
  alertThresholdPct?: number;
  name?: string;
} = {}) {
  return College.create({
    name: overrides.name ?? 'Acme Institute of Technology',
    code: `C${Math.floor(Math.random() * 10_000_000)}`,
    address: { line1: '1 Acme Way', city: 'Hyderabad', state: 'TS', pincode: '500001' },
    contactEmail: 'admin@acme.edu',
    contactPhone: '+91-9999999999',
    aiSpendLimits: {
      weeklyInr: overrides.weeklyInr ?? 0,
      alertThresholdPct: overrides.alertThresholdPct ?? 80,
    },
  });
}

async function makeAgentAction(collegeId: Types.ObjectId | string, costInr: number, opts: {
  type?: 'forecast' | 'situations' | 'chat' | 'risk' | 'reminder-draft' | 'reminder-approve' | 'situation-dismiss';
  createdAt?: Date;
} = {}) {
  // Insert directly via the underlying collection so we can control createdAt
  // (Mongoose's `timestamps: true` would otherwise overwrite `createdAt`).
  const collection = AgentAction.collection;
  await collection.insertOne({
    collegeId: typeof collegeId === 'string' ? new Types.ObjectId(collegeId) : collegeId,
    userId: new Types.ObjectId(),
    type: opts.type ?? 'forecast',
    maskedPrompt: 'masked',
    maskedResponse: 'masked',
    provider: 'claude',
    model: 'claude-sonnet-4.5',
    durationMs: 1234,
    inputTokens: 100,
    outputTokens: 100,
    costInr,
    createdAt: opts.createdAt ?? new Date(),
    updatedAt: opts.createdAt ?? new Date(),
  });
}

beforeAll(async () => {
  await setupMongo();
});

afterAll(async () => {
  await teardownMongo();
});

afterEach(async () => {
  await clearCollections();
  _resetCachesForTest();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─── assertWithinSpendLimit ───────────────────────────────────────────────────

describe('assertWithinSpendLimit', () => {
  it('weeklyInr=0 → bypass: returns no warning, no block, spent=0, limit=0', async () => {
    const college = await makeCollege({ weeklyInr: 0 });
    // Even a heavy spend should be ignored when limit is 0 (= no limit).
    await makeAgentAction(college._id, 999);

    const result = await assertWithinSpendLimit(String(college._id));

    expect(result.blocked).toBe(false);
    expect(result.warning).toBe(false);
    expect(result.spent).toBe(0);
    expect(result.limit).toBe(0);
    expect(result.pct).toBe(0);
    expect(result.resetsAt).toBeInstanceOf(Date);
  });

  it('spent < threshold → no warning, no block', async () => {
    const college = await makeCollege({ weeklyInr: 100, alertThresholdPct: 80 });
    await makeAgentAction(college._id, 50); // 50% utilisation

    const result = await assertWithinSpendLimit(String(college._id));

    expect(result.blocked).toBe(false);
    expect(result.warning).toBe(false);
    expect(result.spent).toBe(50);
    expect(result.limit).toBe(100);
    expect(result.pct).toBeCloseTo(50, 5);
  });

  it('spent ≥ threshold but < 100% → warning, not blocked', async () => {
    const college = await makeCollege({ weeklyInr: 100, alertThresholdPct: 80 });
    await makeAgentAction(college._id, 85); // 85% utilisation

    const result = await assertWithinSpendLimit(String(college._id));

    expect(result.warning).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.pct).toBeCloseTo(85, 5);
  });

  it('spent ≥ 100% → throws AppError(429, "Weekly LLM budget exceeded")', async () => {
    const college = await makeCollege({ weeklyInr: 100 });
    await makeAgentAction(college._id, 120);

    await expect(assertWithinSpendLimit(String(college._id))).rejects.toMatchObject({
      statusCode: 429,
      message: 'Weekly LLM budget exceeded',
      name: 'AppError',
    });
  });

  it('DB error → default-allow (no throw)', async () => {
    const college = await makeCollege({ weeklyInr: 100 });
    // Force the limits load to fail. Service should swallow + return default-allow state.
    const spy = vi.spyOn(College, 'findById').mockImplementationOnce(() => {
      throw new Error('synthetic DB outage');
    });

    const result = await assertWithinSpendLimit(String(college._id));

    expect(result.blocked).toBe(false);
    expect(result.warning).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it('cache hit on second call within TTL → no DB query', async () => {
    const college = await makeCollege({ weeklyInr: 1000 });
    await makeAgentAction(college._id, 100);

    // First call — populates both caches
    await assertWithinSpendLimit(String(college._id));

    // Spies set AFTER first call so we observe cache-only paths
    const collegeSpy = vi.spyOn(College, 'findById');
    const aggSpy = vi.spyOn(AgentAction, 'aggregate');

    await assertWithinSpendLimit(String(college._id));

    expect(collegeSpy).not.toHaveBeenCalled();
    expect(aggSpy).not.toHaveBeenCalled();
  });

  it('limit window only counts cost in the last 7 days', async () => {
    const college = await makeCollege({ weeklyInr: 100 });
    const now = Date.now();
    await makeAgentAction(college._id, 80, { createdAt: new Date(now - 1 * 60 * 60 * 1000) }); // 1h ago — counts
    await makeAgentAction(college._id, 200, { createdAt: new Date(now - 8 * 24 * 60 * 60 * 1000) }); // 8d ago — excluded

    const result = await assertWithinSpendLimit(String(college._id));

    expect(result.spent).toBe(80);
    expect(result.blocked).toBe(false);
    expect(result.warning).toBe(true); // 80% ≥ default 80% threshold
  });

  it('cross-college isolation: spend on college A does not affect college B', async () => {
    const a = await makeCollege({ weeklyInr: 100, name: 'A College' });
    const b = await makeCollege({ weeklyInr: 100, name: 'B College' });
    await makeAgentAction(a._id, 99);
    await makeAgentAction(b._id, 10);

    const ra = await assertWithinSpendLimit(String(a._id));
    const rb = await assertWithinSpendLimit(String(b._id));

    expect(ra.spent).toBe(99);
    expect(rb.spent).toBe(10);
  });
});

// ─── cache TTL + invalidation ─────────────────────────────────────────────────

describe('spend-limits cache', () => {
  it('TTL expiry triggers refetch', async () => {
    const college = await makeCollege({ weeklyInr: 1000 });
    await makeAgentAction(college._id, 100);

    // Populate cache
    await assertWithinSpendLimit(String(college._id));
    expect(getCachedLimits(String(college._id))).toBeDefined();

    // Fast-forward past 60s TTL
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61 * 1000);

    // Cache should now miss
    expect(getCachedLimits(String(college._id))).toBeUndefined();
    expect(getCachedSpend(String(college._id))).toBeUndefined();
  });

  it('manual invalidate clears entry', async () => {
    const college = await makeCollege({ weeklyInr: 1000 });
    await makeAgentAction(college._id, 100);

    await assertWithinSpendLimit(String(college._id));
    expect(getCachedLimits(String(college._id))).toBeDefined();
    expect(getCachedSpend(String(college._id))).toBeDefined();

    invalidateLimits(String(college._id));
    invalidateSpend(String(college._id));

    expect(getCachedLimits(String(college._id))).toBeUndefined();
    expect(getCachedSpend(String(college._id))).toBeUndefined();
  });

  it('cross-college invalidation: invalidating A leaves B intact', async () => {
    const a = await makeCollege({ weeklyInr: 100 });
    const b = await makeCollege({ weeklyInr: 100 });
    await makeAgentAction(a._id, 50);
    await makeAgentAction(b._id, 50);

    await assertWithinSpendLimit(String(a._id));
    await assertWithinSpendLimit(String(b._id));

    invalidateLimits(String(a._id));
    invalidateSpend(String(a._id));

    expect(getCachedLimits(String(a._id))).toBeUndefined();
    expect(getCachedSpend(String(a._id))).toBeUndefined();
    expect(getCachedLimits(String(b._id))).toBeDefined();
    expect(getCachedSpend(String(b._id))).toBeDefined();
  });

  it('limit update invalidates cache → next call refetches', async () => {
    const college = await makeCollege({ weeklyInr: 100 });
    await makeAgentAction(college._id, 90); // 90% — warning

    const before = await assertWithinSpendLimit(String(college._id));
    expect(before.warning).toBe(true);
    expect(before.limit).toBe(100);

    // Admin bumps the limit. updateSpendLimits should invalidate caches.
    await updateSpendLimits(String(college._id), { weeklyInr: 1000 }, '000000000000000000000099');

    const after = await assertWithinSpendLimit(String(college._id));
    expect(after.limit).toBe(1000);
    expect(after.warning).toBe(false);
  });
});

// ─── updateSpendLimits ────────────────────────────────────────────────────────

describe('updateSpendLimits', () => {
  it('updates aiSpendLimits, invalidates cache, and returns new limits + current spend', async () => {
    const college = await makeCollege({ weeklyInr: 100, alertThresholdPct: 80 });
    await makeAgentAction(college._id, 30);
    await assertWithinSpendLimit(String(college._id)); // populate cache

    const result = await updateSpendLimits(
      String(college._id),
      { weeklyInr: 500, alertThresholdPct: 90 },
      '000000000000000000000099',
    );

    expect(result.aiSpendLimits.weeklyInr).toBe(500);
    expect(result.aiSpendLimits.alertThresholdPct).toBe(90);
    expect(result.currentSpend.spent).toBe(30);
    expect(result.currentSpend.limit).toBe(500);
    expect(result.currentSpend.pct).toBeCloseTo(6, 5); // 30/500

    // DB is the source of truth
    const reloaded = await College.findById(college._id).lean();
    expect(reloaded?.aiSpendLimits?.weeklyInr).toBe(500);
    expect(reloaded?.aiSpendLimits?.alertThresholdPct).toBe(90);

    // Cache was invalidated by the update
    expect(getCachedLimits(String(college._id))).toBeUndefined();
  });

  it('emits an AuditLog entry with from→to changes', async () => {
    const college = await makeCollege({ weeklyInr: 100, alertThresholdPct: 80 });

    await updateSpendLimits(
      String(college._id),
      { weeklyInr: 250 },
      '000000000000000000000099',
    );

    const audits = await AuditLog.find({
      entityType: 'College',
      entityId: String(college._id),
    }).lean();

    expect(audits.length).toBe(1);
    expect(audits[0]?.action).toBe('update');
    expect(audits[0]?.performedBy).toBe('000000000000000000000099');
    const change = audits[0]?.changes.find((c) => c.field === 'aiSpendLimits.weeklyInr');
    expect(change?.oldValue).toBe(100);
    expect(change?.newValue).toBe(250);
  });

  it('partial update: alertThresholdPct only — does not change weeklyInr', async () => {
    const college = await makeCollege({ weeklyInr: 100, alertThresholdPct: 80 });

    const result = await updateSpendLimits(
      String(college._id),
      { alertThresholdPct: 50 },
      '000000000000000000000099',
    );

    expect(result.aiSpendLimits.weeklyInr).toBe(100); // untouched
    expect(result.aiSpendLimits.alertThresholdPct).toBe(50);
  });

  it('throws 404 when college does not exist', async () => {
    await expect(
      updateSpendLimits(
        new Types.ObjectId().toString(),
        { weeklyInr: 500 },
        '000000000000000000000099',
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── getCurrentSpend ──────────────────────────────────────────────────────────

describe('getCurrentSpend', () => {
  it('returns rolling 7-day spend + cachedUntil', async () => {
    const college = await makeCollege({ weeklyInr: 100 });
    await makeAgentAction(college._id, 42);

    const result = await getCurrentSpend(String(college._id));

    expect(result.spent).toBe(42);
    expect(result.cachedUntil).toBeInstanceOf(Date);
    expect(result.cachedUntil.getTime()).toBeGreaterThan(Date.now());
  });
});
