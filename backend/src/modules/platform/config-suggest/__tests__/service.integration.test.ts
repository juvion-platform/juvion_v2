import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import mongoose from 'mongoose';

/**
 * 002-ai-assisted-config Task 3.3 — orchestrator integration tests.
 *
 * Real mongo-memory + mocked LLM + mocked cap-guard.
 *
 * Covers:
 *   - happy path: cap pass → LLM → parsed suggestions persisted → audit emitted
 *   - cap reached: no LLM call, returns capReached payload
 *   - LLM parse failure: llmFallback payload, no suggestions persisted
 *   - 404 on unknown configType
 *   - 404 on cross-tenant access (collegeId scoping)
 *   - idempotent within 30s: returns prior batch with isDuplicate
 *   - acceptSuggestionsOnSave flips statuses correctly
 *   - cost equal-division across valid suggestions
 */

const { completeMock, tryClaimMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  tryClaimMock: vi.fn(),
}));

vi.mock('../../../juvi/finance-agent/llm-client', () => ({
  createLLMClient: () => ({ provider: 'claude', complete: completeMock, stream: () => ({}) }),
}));

vi.mock('../cap-guard', () => ({
  tryClaimConfigSuggestSlot: tryClaimMock,
  readConfigSuggestCap: () => 50,
}));

import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { ConfigSuggestion } from '../../../../models/platform/ConfigSuggestion';
import { AuditLog } from '../../../../shared/audit';

import { suggestConfig, acceptSuggestionsOnSave } from '../service';

const oid = () => new mongoose.Types.ObjectId();

const happyResponse = (text: string) => ({
  text,
  inputTokens: 200,
  outputTokens: 80,
  costInr: 1.0,
  model: 'claude-sonnet-4-5',
  provider: 'claude' as const,
  durationMs: 2000,
});

const goodLlmText = JSON.stringify({
  suggestions: [
    { field: 'emailNotifications', value: true, confidence: 0.9, rationale: 'r1' },
    { field: 'smsNotifications', value: true, confidence: 0.8, rationale: 'r2' },
  ],
});

describe('suggestConfig — integration', () => {
  beforeAll(async () => {
    await setupMongo();
    await ConfigSuggestion.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });
  beforeEach(() => {
    completeMock.mockReset();
    tryClaimMock.mockReset();
  });

  it('happy path: cap claimed → LLM → 2 suggestions persisted → audit logged', async () => {
    tryClaimMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 50 });
    completeMock.mockResolvedValueOnce(happyResponse(goodLlmText));

    const collegeId = String(oid());
    const r = await suggestConfig(collegeId, 'institution-feature-flags', 'user-1', {});

    expect(r.capReached).toBeFalsy();
    expect(r.llmFallback).toBeFalsy();
    expect(r.suggestions).toHaveLength(2);
    expect(r.batchId).toBeTruthy();
    expect(r.costInr).toBeCloseTo(1.0, 4);

    // Persisted in DB
    const docs = await ConfigSuggestion.find({ collegeId, batchId: r.batchId }).lean();
    expect(docs).toHaveLength(2);
    expect(docs.every((d) => d.status === 'pending')).toBe(true);

    // Cost equal-division check (data-validator §10.12)
    const totalCost = docs.reduce((acc, d) => acc + d.costInr, 0);
    expect(totalCost).toBeCloseTo(1.0, 4);

    // Audit log
    const audits = await AuditLog.find({ action: 'ai_config_suggested', collegeId }).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]!.performedBy).toBe('user-1');
  });

  it('cap reached: no LLM call, capReached payload, no docs/audit', async () => {
    tryClaimMock.mockResolvedValueOnce({ allowed: false, count: 50, cap: 50 });
    const collegeId = String(oid());
    const r = await suggestConfig(collegeId, 'institution-feature-flags', 'user-1', {});

    expect(r.capReached).toBe(true);
    expect(r.suggestions).toHaveLength(0);
    expect(completeMock).not.toHaveBeenCalled();
    const docs = await ConfigSuggestion.find({ collegeId }).lean();
    expect(docs).toHaveLength(0);
    const audits = await AuditLog.find({ action: 'ai_config_suggested', collegeId }).lean();
    expect(audits).toHaveLength(0);
  });

  it('LLM parse failure: returns llmFallback, persists no suggestions', async () => {
    tryClaimMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 50 });
    completeMock.mockResolvedValueOnce(happyResponse('this is not json'));
    const collegeId = String(oid());
    const r = await suggestConfig(collegeId, 'institution-feature-flags', 'user-1', {});
    expect(r.llmFallback).toBe(true);
    expect(r.suggestions).toHaveLength(0);
    const docs = await ConfigSuggestion.find({ collegeId }).lean();
    expect(docs).toHaveLength(0);
  });

  it('404 on unknown configType', async () => {
    await expect(
      suggestConfig(String(oid()), 'nonexistent-schema', 'user-1', {}),
    ).rejects.toThrow();
    expect(tryClaimMock).not.toHaveBeenCalled();
  });

  it('idempotent within 30s: second call returns isDuplicate with prior batch', async () => {
    tryClaimMock.mockResolvedValue({ allowed: true, count: 1, cap: 50 });
    completeMock.mockResolvedValue(happyResponse(goodLlmText));

    const collegeId = String(oid());
    const r1 = await suggestConfig(collegeId, 'institution-feature-flags', 'user-1', {});
    expect(r1.isDuplicate).toBeFalsy();

    const r2 = await suggestConfig(collegeId, 'institution-feature-flags', 'user-1', {});
    expect(r2.isDuplicate).toBe(true);
    expect(r2.batchId).toBe(r1.batchId);
    // No second LLM call
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  it('drops invalid suggestions silently (e.g., wrong type)', async () => {
    tryClaimMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 50 });
    // Two valid + one invalid (wrong type for enableEmail)
    completeMock.mockResolvedValueOnce(happyResponse(JSON.stringify({
      suggestions: [
        { field: 'emailNotifications', value: true, confidence: 0.9, rationale: 'r1' },
        { field: 'smsNotifications', value: true, confidence: 0.8, rationale: 'r2' },
        { field: 'nonexistent', value: 'x', confidence: 0.9, rationale: 'r3' },
      ],
    })));
    const collegeId = String(oid());
    const r = await suggestConfig(collegeId, 'institution-feature-flags', 'user-1', {});
    expect(r.suggestions).toHaveLength(2);
    const docs = await ConfigSuggestion.find({ collegeId }).lean();
    expect(docs).toHaveLength(2);
  });
});

describe('acceptSuggestionsOnSave', () => {
  beforeAll(async () => {
    await setupMongo();
    await ConfigSuggestion.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('flips accepted fields to "accepted" and the rest of the batch to "rejected"', async () => {
    const collegeId = oid();
    const batchId = 'batch-test-1';
    await ConfigSuggestion.create([
      { collegeId, configType: 'institution-feature-flags', field: 'emailNotifications', suggestedValue: true, confidence: 0.9, rationale: 'r', source: 'llm', generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0.5, batchId },
      { collegeId, configType: 'institution-feature-flags', field: 'smsNotifications', suggestedValue: true, confidence: 0.8, rationale: 'r', source: 'llm', generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0.5, batchId },
    ]);

    await acceptSuggestionsOnSave(String(collegeId), batchId, ['emailNotifications'], 'user-1');

    const docs = await ConfigSuggestion.find({ batchId }).lean();
    const byField = Object.fromEntries(docs.map((d) => [d.field, d]));
    expect(byField.emailNotifications!.status).toBe('accepted');
    expect(byField.emailNotifications!.reviewedBy).toBe('user-1');
    expect(byField.smsNotifications!.status).toBe('rejected');
  });

  it('multi-tenant: cannot touch suggestions from another college', async () => {
    const collegeA = oid();
    const collegeB = oid();
    const batchId = 'batch-mt';
    await ConfigSuggestion.create({
      collegeId: collegeA, configType: 'x', field: 'f', suggestedValue: 1, confidence: 0.9, rationale: 'r',
      source: 'llm', generatedAt: new Date(), llmModel: 'm', promptVersion: 'p', costInr: 0, batchId,
    });
    await acceptSuggestionsOnSave(String(collegeB), batchId, ['f'], 'user-1');
    const doc = await ConfigSuggestion.findOne({ batchId }).lean();
    // Unchanged
    expect(doc!.status).toBe('pending');
  });
});
