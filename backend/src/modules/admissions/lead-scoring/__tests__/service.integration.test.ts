import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import mongoose from 'mongoose';

/**
 * 001-ai-lead-scoring — Task 3.3 (service orchestrator integration).
 *
 * End-to-end through a real (in-memory) Mongo:
 *   - happy path: LLM scores, Inquiry doc + scoreRationale persisted,
 *     audit log emitted, daily stats incremented
 *   - debounce: 2nd call within 60s is a no-op
 *   - cap hit: rules-only fallback, scoreRationale.llmSkipped = true
 *   - LLM parse failure: rules-only fallback, scoreRationale.llmFallback = true
 *   - multi-tenancy: scoring inquiry from college A doesn't touch college B
 */

const { completeMock, incrMock, expireMock, decrMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  incrMock: vi.fn(),
  expireMock: vi.fn().mockResolvedValue(1),
  decrMock: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../../juvi/finance-agent/llm-client', () => ({
  createLLMClient: () => ({ provider: 'claude', complete: completeMock, stream: () => ({}) }),
}));

vi.mock('../../../../config/redis', () => ({
  default: { incr: incrMock, expire: expireMock, decr: decrMock },
}));

import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { Inquiry } from '../../../../models/admissions/Inquiry';
import { LeadInteraction } from '../../../../models/admissions/LeadInteraction';
import { LeadScoringStats } from '../../../../models/admissions/LeadScoringStats';
import { AuditLog } from '../../../../shared/audit';

import { scoreInquiry } from '../service';

const oid = () => new mongoose.Types.ObjectId();

const happyLlmText = JSON.stringify({
  score: 78,
  factors: [
    { label: 'High intent walk-in', weight: 22 },
    { label: 'Strong academic fit', weight: 18 },
  ],
  summary: 'Strong lead with clear intent',
});

const llmResponse = (text: string) => ({
  text,
  inputTokens: 320,
  outputTokens: 80,
  costInr: 1.5,
  model: 'claude-sonnet-4-5',
  provider: 'claude',
  durationMs: 3200,
});

describe('scoreInquiry — integration', () => {
  beforeAll(async () => {
    await setupMongo();
    await Inquiry.syncIndexes();
    await LeadScoringStats.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
  });
  beforeEach(() => {
    completeMock.mockReset();
    incrMock.mockReset();
    expireMock.mockClear();
    decrMock.mockClear();
  });

  it('happy path: blends rule + LLM, writes Inquiry, audit log, stats', async () => {
    incrMock.mockResolvedValueOnce(1); // under cap
    completeMock.mockResolvedValueOnce(llmResponse(happyLlmText));

    const collegeId = oid();
    const inq = await Inquiry.create({
      collegeId,
      name: 'Test',
      phone: '+91-9000000000',
      source: 'walk-in',
      interPercentage: 82,
      programmeInterest: 'B.Tech CSE',
    });

    const result = await scoreInquiry(String(collegeId), String(inq._id), 'user-1', { trigger: 'manual' });

    expect(result.skipped).toBeFalsy();
    expect(result.rationale!.llmScore).toBe(78);
    expect(result.rationale!.ruleScore).toBeGreaterThan(0);
    expect(result.rationale!.blendedScore).toBe(Math.round(0.6 * result.rationale!.ruleScore + 0.4 * 78));
    expect(result.rationale!.llmFallback).toBeFalsy();
    expect(result.rationale!.llmSkipped).toBeFalsy();
    expect(result.rationale!.llmCostInr).toBe(1.5);

    // Inquiry doc persisted
    const reloaded = await Inquiry.findById(inq._id).lean();
    expect(reloaded!.leadScore).toBe(result.rationale!.blendedScore);
    expect(reloaded!.scoreRationale).toBeDefined();
    expect(reloaded!.lastScoredAt).toBeInstanceOf(Date);

    // Audit log emitted
    const audit = await AuditLog.find({ entityType: 'Inquiry', entityId: String(inq._id) }).lean();
    const aiEntry = audit.find((a) => a.action === 'ai_score_computed');
    expect(aiEntry).toBeDefined();
    expect(aiEntry!.performedBy).toBe('user-1');

    // Stats incremented
    const stats = await LeadScoringStats.findOne({ collegeId }).lean();
    expect(stats).toBeDefined();
    expect(stats!.totalScored).toBe(1);
    expect(stats!.llmScored).toBe(1);
    expect(stats!.rulesOnlyScored).toBe(0);
    expect(stats!.totalLlmCostInr).toBeCloseTo(1.5, 4);
  });

  it('debounce: a 2nd score within 60s is a no-op', async () => {
    incrMock.mockResolvedValueOnce(1);
    completeMock.mockResolvedValueOnce(llmResponse(happyLlmText));

    const collegeId = oid();
    const inq = await Inquiry.create({
      collegeId, name: 'X', phone: '+91-9111111111', source: 'website',
    });

    await scoreInquiry(String(collegeId), String(inq._id), 'user-1', { trigger: 'create' });

    incrMock.mockResolvedValueOnce(2); // would-be-allowed but we should never call this
    completeMock.mockResolvedValueOnce(llmResponse(happyLlmText));

    const second = await scoreInquiry(String(collegeId), String(inq._id), 'user-1', { trigger: 'interaction' });

    expect(second.skipped).toBe(true);
    expect(second.skipReason).toBe('debounce');
    // Exactly one LLM call across both invocations
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  it('cap reached: rules-only fallback with llmSkipped=true', async () => {
    incrMock.mockResolvedValueOnce(501); // over a cap of 500
    process.env.LEAD_SCORE_DAILY_LLM_CAP = '500';

    const collegeId = oid();
    const inq = await Inquiry.create({
      collegeId, name: 'X', phone: '+91-9222222222', source: 'walk-in', interPercentage: 75,
    });

    const result = await scoreInquiry(String(collegeId), String(inq._id), 'user-1', { trigger: 'manual' });
    expect(completeMock).not.toHaveBeenCalled();
    expect(result.rationale!.llmSkipped).toBe(true);
    expect(result.rationale!.llmScore).toBeNull();
    expect(result.rationale!.blendedScore).toBe(result.rationale!.ruleScore);

    const stats = await LeadScoringStats.findOne({ collegeId }).lean();
    expect(stats!.llmScored).toBe(0);
    expect(stats!.rulesOnlyScored).toBe(1);
    expect(stats!.llmCapHit).toBe(true);
  });

  it('LLM parse failure: rules-only fallback with llmFallback=true', async () => {
    incrMock.mockResolvedValueOnce(1);
    completeMock.mockResolvedValueOnce(llmResponse('garbage not json'));

    const collegeId = oid();
    const inq = await Inquiry.create({
      collegeId, name: 'X', phone: '+91-9333333333', source: 'phone', interPercentage: 65,
    });

    const result = await scoreInquiry(String(collegeId), String(inq._id), 'user-1', { trigger: 'manual' });
    expect(result.rationale!.llmFallback).toBe(true);
    expect(result.rationale!.llmScore).toBeNull();
    expect(result.rationale!.blendedScore).toBe(result.rationale!.ruleScore);
  });

  it('multi-tenancy: cannot score an inquiry from another college', async () => {
    const collegeA = oid();
    const collegeB = oid();
    const inq = await Inquiry.create({
      collegeId: collegeA, name: 'X', phone: '+91-9444444444', source: 'walk-in',
    });

    await expect(
      scoreInquiry(String(collegeB), String(inq._id), 'user-1', { trigger: 'manual' }),
    ).rejects.toThrow();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('uses recent interactions in scoring', async () => {
    incrMock.mockResolvedValueOnce(1);
    completeMock.mockResolvedValueOnce(llmResponse(happyLlmText));

    const collegeId = oid();
    const inq = await Inquiry.create({
      collegeId, name: 'X', phone: '+91-9555555555', source: 'walk-in',
    });
    // A positive interaction
    await LeadInteraction.create({
      collegeId, inquiryId: inq._id,
      type: 'walk_in', direction: 'inbound', channel: 'manual',
      summary: 'Came to campus',
      outcome: 'visit_scheduled',
      performedBy: 'officer-1',
    });

    const result = await scoreInquiry(String(collegeId), String(inq._id), 'user-1', { trigger: 'interaction' });
    // The rule scorer should credit the positive outcome
    const positiveFactor = result.rationale!.factors.find((f) => f.label.toLowerCase().includes('positive'));
    expect(positiveFactor).toBeDefined();
  });
});
