import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { ConfigSuggestion } from '../ConfigSuggestion';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * 002-ai-assisted-config Task 2.0 — model assertions.
 *
 * Covers GATE 2 data-validator follow-ups (spec §10.12):
 *   - `source` enum constraint enforced at the Mongoose layer
 *   - three indexes present
 *   - multi-tenant required collegeId
 */

const oid = () => new mongoose.Types.ObjectId();

describe('ConfigSuggestion schema', () => {
  beforeAll(async () => {
    await setupMongo();
    await ConfigSuggestion.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('persists a full suggestion document', async () => {
    const collegeId = oid();
    const doc = await ConfigSuggestion.create({
      collegeId,
      configType: 'institution-feature-flags',
      field: 'enableEmail',
      suggestedValue: true,
      confidence: 0.82,
      rationale: 'Most 100+ student colleges have email notifications turned on.',
      source: 'llm',
      status: 'pending',
      generatedAt: new Date('2026-05-14T10:00:00Z'),
      llmModel: 'claude-sonnet-4-5',
      promptVersion: 'config-suggest-prompt-v1',
      costInr: 0.15,
      batchId: 'batch-abc-123',
    });

    const loaded = await ConfigSuggestion.findById(doc._id).lean();
    expect(loaded).toBeDefined();
    expect(String(loaded!.collegeId)).toBe(String(collegeId));
    expect(loaded!.field).toBe('enableEmail');
    expect(loaded!.suggestedValue).toBe(true);
    expect(loaded!.confidence).toBe(0.82);
    expect(loaded!.source).toBe('llm');
    expect(loaded!.status).toBe('pending');
    expect(loaded!.batchId).toBe('batch-abc-123');
  });

  it('defaults status to "pending"', async () => {
    const doc = await ConfigSuggestion.create({
      collegeId: oid(),
      configType: 'institution-feature-flags',
      field: 'enableSMS',
      suggestedValue: false,
      confidence: 0.7,
      rationale: 'r',
      source: 'llm',
      generatedAt: new Date(),
      llmModel: 'm',
      promptVersion: 'p',
      costInr: 0.1,
      batchId: 'b',
    });
    expect(doc.status).toBe('pending');
  });

  it('rejects an invalid `source` value (enum enforced)', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ConfigSuggestion.create({
        collegeId: oid(),
        configType: 'x',
        field: 'y',
        suggestedValue: 1,
        confidence: 0.5,
        rationale: 'r',
        source: 'not-a-real-source' as any,
        generatedAt: new Date(),
        llmModel: 'm',
        promptVersion: 'p',
        costInr: 0.1,
        batchId: 'b',
      }),
    ).rejects.toThrow();
  });

  it('rejects an invalid `status` value (enum enforced)', async () => {
    await expect(
      ConfigSuggestion.create({
        collegeId: oid(),
        configType: 'x',
        field: 'y',
        suggestedValue: 1,
        confidence: 0.5,
        rationale: 'r',
        source: 'llm',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: 'mid-air' as any,
        generatedAt: new Date(),
        llmModel: 'm',
        promptVersion: 'p',
        costInr: 0.1,
        batchId: 'b',
      }),
    ).rejects.toThrow();
  });

  it('requires collegeId (multi-tenancy guard)', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ConfigSuggestion.create({
        configType: 'x', field: 'y', suggestedValue: 1, confidence: 0.5,
        rationale: 'r', source: 'llm', generatedAt: new Date(),
        llmModel: 'm', promptVersion: 'p', costInr: 0.1, batchId: 'b',
      } as any),
    ).rejects.toThrow();
  });

  it('clamps confidence to [0, 1]', async () => {
    await expect(
      ConfigSuggestion.create({
        collegeId: oid(),
        configType: 'x', field: 'y', suggestedValue: 1, confidence: 1.5,
        rationale: 'r', source: 'llm', generatedAt: new Date(),
        llmModel: 'm', promptVersion: 'p', costInr: 0.1, batchId: 'b',
      }),
    ).rejects.toThrow();
    await expect(
      ConfigSuggestion.create({
        collegeId: oid(),
        configType: 'x', field: 'y', suggestedValue: 1, confidence: -0.1,
        rationale: 'r', source: 'llm', generatedAt: new Date(),
        llmModel: 'm', promptVersion: 'p', costInr: 0.1, batchId: 'b',
      }),
    ).rejects.toThrow();
  });

  it('has compound index { collegeId: 1, configType: 1, generatedAt: -1 }', async () => {
    const indexes = await ConfigSuggestion.collection.indexes();
    const target = indexes.find((i) => {
      const k = i.key as Record<string, number>;
      return k.collegeId === 1 && k.configType === 1 && k.generatedAt === -1;
    });
    expect(target).toBeDefined();
  });

  it('has compound index { collegeId: 1, status: 1 }', async () => {
    const indexes = await ConfigSuggestion.collection.indexes();
    const target = indexes.find((i) => {
      const k = i.key as Record<string, number>;
      return k.collegeId === 1 && k.status === 1 && Object.keys(k).length === 2;
    });
    expect(target).toBeDefined();
  });

  it('has batch-integrity index { batchId: 1 } (data-validator §10.12)', async () => {
    const indexes = await ConfigSuggestion.collection.indexes();
    const target = indexes.find((i) => {
      const k = i.key as Record<string, number>;
      return k.batchId === 1 && Object.keys(k).length === 1;
    });
    expect(target).toBeDefined();
  });

  it('supports listing pending suggestions by (collegeId, configType, batchId)', async () => {
    const collegeId = oid();
    const batchId = 'batch-test-1';
    await ConfigSuggestion.create([
      { collegeId, configType: 'institution-feature-flags', field: 'a', suggestedValue: true, confidence: 0.9, rationale: 'r', source: 'llm', generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0.1, batchId },
      { collegeId, configType: 'institution-feature-flags', field: 'b', suggestedValue: false, confidence: 0.7, rationale: 'r', source: 'llm', generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0.1, batchId },
      { collegeId, configType: 'notification-templates', field: 'subject', suggestedValue: 's', confidence: 0.6, rationale: 'r', source: 'llm', generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0.1, batchId: 'other' },
    ]);
    const pending = await ConfigSuggestion.find({ collegeId, configType: 'institution-feature-flags', status: 'pending' }).lean();
    expect(pending).toHaveLength(2);
    const batchAll = await ConfigSuggestion.find({ batchId }).lean();
    expect(batchAll).toHaveLength(2);
  });
});
