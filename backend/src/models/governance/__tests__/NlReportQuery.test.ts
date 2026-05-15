import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { NlReportQuery } from '../NlReportQuery';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * 003-nl-report-queries Task 2.0 — model assertions.
 *
 * Covers spec §3 + GATE 2 §10.4 (llmModel rename + reason rename) and §10.12
 * (indexes for stats $facet pipeline).
 */

const oid = () => new mongoose.Types.ObjectId();

describe('NlReportQuery schema', () => {
  beforeAll(async () => {
    await setupMongo();
    await NlReportQuery.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('persists a matched query end-to-end', async () => {
    const collegeId = oid();
    const runId = oid();
    const doc = await NlReportQuery.create({
      collegeId,
      question: 'how did the september funnel compare to august',
      status: 'matched',
      selectedReport: 'admissions-funnel',
      params: { from: '2026-08-01', to: '2026-09-30' },
      runId,
      performedBy: 'admin-1',
      generatedAt: new Date('2026-05-14T10:00:00Z'),
      llmModel: 'claude-sonnet-4-5',
      promptVersion: 'nl-report-prompt-v1',
      costInr: 0.45,
    });

    const loaded = await NlReportQuery.findById(doc._id).lean();
    expect(loaded!.status).toBe('matched');
    expect(loaded!.selectedReport).toBe('admissions-funnel');
    expect(loaded!.params).toEqual({ from: '2026-08-01', to: '2026-09-30' });
    expect(String(loaded!.runId)).toBe(String(runId));
    expect(loaded!.llmModel).toBe('claude-sonnet-4-5');
    expect(loaded!.costInr).toBe(0.45);
  });

  it('persists a refused query without selectedReport / runId', async () => {
    const doc = await NlReportQuery.create({
      collegeId: oid(),
      question: 'show me library overdue books',
      status: 'refused',
      reason: 'Report not supported in v1',
      performedBy: 'admin-1',
      generatedAt: new Date(),
      llmModel: 'claude-sonnet-4-5',
      promptVersion: 'nl-report-prompt-v1',
      costInr: 0.15,
    });
    const loaded = await NlReportQuery.findById(doc._id).lean();
    expect(loaded!.status).toBe('refused');
    expect(loaded!.reason).toBe('Report not supported in v1');
    expect(loaded!.selectedReport).toBeUndefined();
    expect(loaded!.runId).toBeUndefined();
  });

  it('rejects an invalid status (enum enforced)', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      NlReportQuery.create({
        collegeId: oid(), question: 'q', status: 'something-else' as any,
        performedBy: 'a', generatedAt: new Date(),
        llmModel: 'm', promptVersion: 'p', costInr: 0,
      }),
    ).rejects.toThrow();
  });

  it('requires collegeId (multi-tenancy guard)', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      NlReportQuery.create({
        question: 'q', status: 'matched', performedBy: 'a',
        generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0,
      } as any),
    ).rejects.toThrow();
  });

  it('caps question at 500 characters', async () => {
    const long = 'a'.repeat(600);
    await expect(
      NlReportQuery.create({
        collegeId: oid(), question: long, status: 'matched', performedBy: 'a',
        generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0,
      }),
    ).rejects.toThrow();
  });

  it('has compound index { collegeId: 1, generatedAt: -1 }', async () => {
    const indexes = await NlReportQuery.collection.indexes();
    const target = indexes.find((i) => {
      const k = i.key as Record<string, number>;
      return k.collegeId === 1 && k.generatedAt === -1 && Object.keys(k).length === 2;
    });
    expect(target).toBeDefined();
  });

  it('has compound index { collegeId: 1, status: 1, generatedAt: -1 }', async () => {
    const indexes = await NlReportQuery.collection.indexes();
    const target = indexes.find((i) => {
      const k = i.key as Record<string, number>;
      return k.collegeId === 1 && k.status === 1 && k.generatedAt === -1;
    });
    expect(target).toBeDefined();
  });
});
