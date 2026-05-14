import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { Inquiry } from '../Inquiry';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

/**
 * 001-ai-lead-scoring — schema additions on Inquiry.
 * Plan tasks 1.4 + 1.5. Asserts:
 *   - new `scoreRationale` subdocument persists with all fields
 *   - new `lastScoredAt` Date persists
 *   - three new compound indexes exist for sort/filter performance
 */

const oid = () => new mongoose.Types.ObjectId();

describe('Inquiry — lead-scoring fields', () => {
  beforeAll(async () => {
    await setupMongo();
    await Inquiry.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
  });

  it('persists scoreRationale subdocument and lastScoredAt', async () => {
    const inq = await Inquiry.create({
      collegeId: oid(),
      name: 'Test Lead',
      phone: '+91-9999999999',
      source: 'walk-in',
      leadScore: 72,
      leadGrade: 'warm',
      lastScoredAt: new Date('2026-05-14T10:00:00Z'),
      scoreRationale: {
        ruleScore: 65,
        llmScore: 78,
        blendedScore: 70,
        factors: [
          { label: 'Source: walk-in', weight: 25, source: 'rule' },
          { label: 'High interest in MPC', weight: 22, source: 'llm' },
        ],
        lastInteractionInfluence: { factor: 'visit_scheduled', shift: 8 },
        llmSkipped: false,
        llmFallback: false,
        llmCostInr: 1.23,
        computedAt: new Date('2026-05-14T10:00:00Z'),
        modelVersion: 'rules-v1+claude-sonnet-4.5',
      },
    });

    const loaded = await Inquiry.findById(inq._id).lean();
    expect(loaded).toBeDefined();
    expect(loaded!.lastScoredAt).toBeInstanceOf(Date);
    expect(loaded!.scoreRationale?.ruleScore).toBe(65);
    expect(loaded!.scoreRationale?.llmScore).toBe(78);
    expect(loaded!.scoreRationale?.blendedScore).toBe(70);
    expect(loaded!.scoreRationale?.factors).toHaveLength(2);
    expect(loaded!.scoreRationale?.factors[0]?.source).toBe('rule');
    expect(loaded!.scoreRationale?.factors[1]?.source).toBe('llm');
    expect(loaded!.scoreRationale?.lastInteractionInfluence?.shift).toBe(8);
    expect(loaded!.scoreRationale?.modelVersion).toBe('rules-v1+claude-sonnet-4.5');
  });

  it('accepts null llmScore (rules-only fallback) and llmSkipped flag', async () => {
    const inq = await Inquiry.create({
      collegeId: oid(),
      name: 'Rules-Only Lead',
      phone: '+91-9888888888',
      source: 'website',
      leadScore: 45,
      leadGrade: 'cold',
      lastScoredAt: new Date(),
      scoreRationale: {
        ruleScore: 45,
        llmScore: null,
        blendedScore: 45,
        factors: [{ label: 'Source: website', weight: 12, source: 'rule' }],
        llmSkipped: true,
        computedAt: new Date(),
        modelVersion: 'rules-v1',
      },
    });
    const loaded = await Inquiry.findById(inq._id).lean();
    expect(loaded!.scoreRationale?.llmScore).toBeNull();
    expect(loaded!.scoreRationale?.llmSkipped).toBe(true);
  });

  it('has compound index { collegeId: 1, leadScore: -1 }', async () => {
    const indexes = await Inquiry.collection.indexes();
    const target = indexes.find((i) => {
      const k = i.key as Record<string, number>;
      return k.collegeId === 1 && k.leadScore === -1 && Object.keys(k).length === 2;
    });
    expect(target).toBeDefined();
  });

  it('has compound index { collegeId: 1, leadGrade: 1, leadScore: -1 }', async () => {
    const indexes = await Inquiry.collection.indexes();
    const target = indexes.find((i) => {
      const k = i.key as Record<string, number>;
      return k.collegeId === 1 && k.leadGrade === 1 && k.leadScore === -1;
    });
    expect(target).toBeDefined();
  });

  it('has compound index { collegeId: 1, lastScoredAt: -1 }', async () => {
    const indexes = await Inquiry.collection.indexes();
    const target = indexes.find((i) => {
      const k = i.key as Record<string, number>;
      return k.collegeId === 1 && k.lastScoredAt === -1 && Object.keys(k).length === 2;
    });
    expect(target).toBeDefined();
  });
});
