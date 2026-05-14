import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { LeadScoringStats } from '../LeadScoringStats';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

/**
 * 001-ai-lead-scoring — daily stats model.
 * Plan task 1.6. Per spec §10.3:
 *   - one doc per (collegeId, date) — unique compound index
 *   - tracks totalScored, llmScored, rulesOnlyScored, cost, latency, grade dist
 *   - the worker upserts + $inc this on every score completion
 */

const oid = () => new mongoose.Types.ObjectId();

describe('LeadScoringStats schema', () => {
  beforeAll(async () => {
    await setupMongo();
    await LeadScoringStats.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
  });

  it('creates a daily stats doc with all aggregated counters', async () => {
    const doc = await LeadScoringStats.create({
      collegeId: oid(),
      date: new Date('2026-05-14T00:00:00Z'),
      totalScored: 50,
      llmScored: 47,
      rulesOnlyScored: 3,
      totalLlmCostInr: 71.5,
      avgLatencyMs: 4280,
      gradeDistribution: { hot: 8, warm: 18, cold: 15, dormant: 9 },
      llmCapHit: false,
      modelVersion: 'rules-v1+claude-sonnet-4.5',
    });

    const loaded = await LeadScoringStats.findById(doc._id).lean();
    expect(loaded!.totalScored).toBe(50);
    expect(loaded!.llmScored).toBe(47);
    expect(loaded!.rulesOnlyScored).toBe(3);
    expect(loaded!.gradeDistribution.hot).toBe(8);
    expect(loaded!.gradeDistribution.dormant).toBe(9);
    expect(loaded!.llmCapHit).toBe(false);
  });

  it('rejects missing collegeId (required, multi-tenancy)', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LeadScoringStats.create({
        date: new Date(),
        totalScored: 0,
        llmScored: 0,
        rulesOnlyScored: 0,
      } as any),
    ).rejects.toThrow();
  });

  it('enforces unique compound (collegeId, date)', async () => {
    const collegeId = oid();
    const date = new Date('2026-05-14T00:00:00Z');
    await LeadScoringStats.create({ collegeId, date, totalScored: 1, llmScored: 1, rulesOnlyScored: 0 });
    await expect(
      LeadScoringStats.create({ collegeId, date, totalScored: 2, llmScored: 2, rulesOnlyScored: 0 }),
    ).rejects.toThrow();
  });

  it('supports atomic $inc upsert for worker-side counter writes', async () => {
    const collegeId = oid();
    const date = new Date('2026-05-14T00:00:00Z');

    await LeadScoringStats.findOneAndUpdate(
      { collegeId, date },
      {
        $inc: { totalScored: 1, llmScored: 1, totalLlmCostInr: 1.5, 'gradeDistribution.hot': 1 },
        $set: { modelVersion: 'rules-v1+claude-sonnet-4.5' },
      },
      { upsert: true, new: true },
    );
    await LeadScoringStats.findOneAndUpdate(
      { collegeId, date },
      {
        $inc: { totalScored: 1, rulesOnlyScored: 1, 'gradeDistribution.cold': 1 },
      },
      { upsert: true, new: true },
    );

    const doc = await LeadScoringStats.findOne({ collegeId, date }).lean();
    expect(doc!.totalScored).toBe(2);
    expect(doc!.llmScored).toBe(1);
    expect(doc!.rulesOnlyScored).toBe(1);
    expect(doc!.totalLlmCostInr).toBe(1.5);
    expect(doc!.gradeDistribution.hot).toBe(1);
    expect(doc!.gradeDistribution.cold).toBe(1);
    expect(doc!.modelVersion).toBe('rules-v1+claude-sonnet-4.5');
  });
});
