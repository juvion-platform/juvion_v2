import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';

import { LLMUsageSnapshot } from '../LLMUsageSnapshot';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

/**
 * Task L2 — llm-spend-limits: LLMUsageSnapshot model.
 *
 * Covers spec/plan §1.3 (schema shape) and §2.3 (compound index) for the new
 * weekly per-college usage snapshot collection that backs the Mon 06:00 cron
 * audit row written by the weekly summary worker.
 *
 * Pattern: plain TS interface + `model<T>()` (no `extends Document`) — mirrors
 * AgentAction.ts.  See `agent-models.test.ts` for the index-inspection pattern
 * via `Model.collection.indexes()`.
 */

const oid = () => new Types.ObjectId();

const baseDoc = () => {
  // Monday 00:00 UTC — pick a real Monday so the test reads naturally
  const weekStart = new Date('2026-04-20T00:00:00.000Z');
  const weekEnd = new Date('2026-04-26T23:59:59.999Z');
  return {
    collegeId: oid(),
    weekStart,
    weekEnd,
    totalCostInr: 42.5,
    totalCalls: 8,
    byType: { chat: 3, forecast: 4, 'reminder-draft': 1 },
    limitAtTime: 1000,
    alertThresholdAtTime: 80,
  };
};

describe('Task L2 — LLMUsageSnapshot model (juvi/llm-spend-limits)', () => {
  beforeAll(async () => {
    await setupMongo();
    await LLMUsageSnapshot.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
  });

  it('creates a valid doc with all required fields populated', async () => {
    const doc = await LLMUsageSnapshot.create(baseDoc());
    expect(doc._id).toBeDefined();
    expect(doc.totalCostInr).toBe(42.5);
    expect(doc.totalCalls).toBe(8);
    expect(doc.limitAtTime).toBe(1000);
    expect(doc.alertThresholdAtTime).toBe(80);
    expect(doc.weekStart).toBeInstanceOf(Date);
    expect(doc.weekEnd).toBeInstanceOf(Date);
    // timestamps applied
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects creation when collegeId is missing', async () => {
    const { collegeId: _omit, ...rest } = baseDoc();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LLMUsageSnapshot.create(rest as any),
    ).rejects.toThrow();
  });

  it('rejects creation when weekStart is missing', async () => {
    const { weekStart: _omit, ...rest } = baseDoc();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LLMUsageSnapshot.create(rest as any),
    ).rejects.toThrow();
  });

  it('rejects creation when weekEnd is missing', async () => {
    const { weekEnd: _omit, ...rest } = baseDoc();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LLMUsageSnapshot.create(rest as any),
    ).rejects.toThrow();
  });

  it('rejects creation when totalCostInr is missing', async () => {
    const { totalCostInr: _omit, ...rest } = baseDoc();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LLMUsageSnapshot.create(rest as any),
    ).rejects.toThrow();
  });

  it('rejects creation when totalCalls is missing', async () => {
    const { totalCalls: _omit, ...rest } = baseDoc();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LLMUsageSnapshot.create(rest as any),
    ).rejects.toThrow();
  });

  it('rejects creation when limitAtTime is missing', async () => {
    const { limitAtTime: _omit, ...rest } = baseDoc();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LLMUsageSnapshot.create(rest as any),
    ).rejects.toThrow();
  });

  it('rejects creation when alertThresholdAtTime is missing', async () => {
    const { alertThresholdAtTime: _omit, ...rest } = baseDoc();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LLMUsageSnapshot.create(rest as any),
    ).rejects.toThrow();
  });

  it('accepts an empty byType {} (default applied when omitted)', async () => {
    const { byType: _omit, ...rest } = baseDoc();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await LLMUsageSnapshot.create(rest as any);
    expect(doc.byType).toBeDefined();
    expect(doc.byType).toEqual({});
  });

  it('accepts arbitrary keys in byType (free-form Mixed)', async () => {
    const doc = await LLMUsageSnapshot.create({
      ...baseDoc(),
      byType: {
        forecast: 5,
        chat: 2,
        'reminder-draft': 1,
        'a-future-action-type-not-yet-known': 9,
      },
    });
    const seen = doc.byType as Record<string, number>;
    expect(seen.forecast).toBe(5);
    expect(seen.chat).toBe(2);
    expect(seen['reminder-draft']).toBe(1);
    expect(seen['a-future-action-type-not-yet-known']).toBe(9);
  });

  it('rejects negative totalCostInr (min 0)', async () => {
    await expect(
      LLMUsageSnapshot.create({ ...baseDoc(), totalCostInr: -0.01 }),
    ).rejects.toThrow();
  });

  it('rejects negative totalCalls (min 0)', async () => {
    await expect(
      LLMUsageSnapshot.create({ ...baseDoc(), totalCalls: -1 }),
    ).rejects.toThrow();
  });

  it('rejects negative limitAtTime (min 0)', async () => {
    await expect(
      LLMUsageSnapshot.create({ ...baseDoc(), limitAtTime: -1 }),
    ).rejects.toThrow();
  });

  it('declares compound index { collegeId:1, weekStart:-1 } (non-unique)', async () => {
    const indexes = await LLMUsageSnapshot.collection.indexes();
    const found = indexes.find((ix) => {
      const k = ix.key as Record<string, number>;
      return (
        k.collegeId === 1 &&
        k.weekStart === -1 &&
        Object.keys(k).length === 2
      );
    });
    expect(found).toBeDefined();
    // Plan note: admin re-runs are allowed (later-write-wins handled in cron),
    // so the index must NOT enforce uniqueness.
    expect(found?.unique).not.toBe(true);
  });

  it('is college-scoped on read (cross-college isolation)', async () => {
    const collegeA = oid();
    const collegeB = oid();
    await LLMUsageSnapshot.create({ ...baseDoc(), collegeId: collegeA });
    const seenFromA = await LLMUsageSnapshot.find({ collegeId: collegeA });
    const seenFromB = await LLMUsageSnapshot.find({ collegeId: collegeB });
    expect(seenFromA).toHaveLength(1);
    expect(seenFromB).toHaveLength(0);
  });

  it('allows two snapshots for the same (collegeId, weekStart) — admin re-runs', async () => {
    // Plan note: index is non-unique; cron worker handles later-write-wins.
    // The schema must NOT reject a duplicate (collegeId, weekStart) pair.
    const collegeId = oid();
    const weekStart = new Date('2026-04-20T00:00:00.000Z');
    const weekEnd = new Date('2026-04-26T23:59:59.999Z');
    const first = await LLMUsageSnapshot.create({
      ...baseDoc(),
      collegeId,
      weekStart,
      weekEnd,
      totalCostInr: 10,
    });
    const second = await LLMUsageSnapshot.create({
      ...baseDoc(),
      collegeId,
      weekStart,
      weekEnd,
      totalCostInr: 12,
    });
    expect(String(first._id)).not.toBe(String(second._id));
    const all = await LLMUsageSnapshot.find({ collegeId, weekStart });
    expect(all).toHaveLength(2);
  });
});
