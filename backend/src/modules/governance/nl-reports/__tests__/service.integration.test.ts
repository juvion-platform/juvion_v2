import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import mongoose from 'mongoose';

/**
 * 003-nl-report-queries Task 3.5 — orchestrator integration tests.
 *
 *   - happy: cap pass → LLM matched → validator pass → runReport → persisted
 *     NlReportQuery (matched) + audit log
 *   - LLM refused: persisted as refused with reason
 *   - cap reached: no LLM call, persisted as refused with reason 'cap_reached'
 *   - LLM parse failure: refused, no run
 *   - validator failure (bad date range): refused, no run
 *   - 30s dedup: 2nd identical question returns cached response, no new LLM/run
 *   - runReport status !== 'success' (defensive §10/M-2): refused, run still
 *     persisted by runReport but NlReportQuery captures refusal
 *   - multi-tenancy: stats only counts current college
 */

const { completeMock, tryClaimMock, redisGetMock, redisSetexMock, runReportMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  tryClaimMock: vi.fn(),
  redisGetMock: vi.fn(),
  redisSetexMock: vi.fn().mockResolvedValue('OK'),
  runReportMock: vi.fn(),
}));

vi.mock('../../../juvi/finance-agent/llm-client', () => ({
  createLLMClient: () => ({ provider: 'claude', complete: completeMock, stream: () => ({}) }),
}));

vi.mock('../cap-guard', () => ({
  tryClaimNlReportSlot: tryClaimMock,
  readNlReportCap: () => 30,
}));

vi.mock('../../../../config/redis', () => ({
  default: { get: redisGetMock, setex: redisSetexMock },
}));

vi.mock('../../report-service', async (orig) => {
  const actual = await orig<typeof import('../../report-service')>();
  return {
    ...actual,
    runReport: runReportMock,
  };
});

import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { NlReportQuery } from '../../../../models/governance/NlReportQuery';
import { AuditLog } from '../../../../shared/audit';

import { nlQuery, getNlReportStats } from '../service';

const oid = () => new mongoose.Types.ObjectId();

const happyResponse = (text: string) => ({
  text,
  inputTokens: 100, outputTokens: 30, costInr: 0.4,
  model: 'claude-sonnet-4-5', provider: 'claude' as const, durationMs: 500,
});

const matchedLlmJson = JSON.stringify({
  status: 'matched',
  reportCode: 'admissions-funnel',
  params: { from: '2026-04-01', to: '2026-04-30' },
  rationale: 'April funnel question maps directly to admissions-funnel.',
});

describe('nlQuery — integration', () => {
  beforeAll(async () => {
    await setupMongo();
    await NlReportQuery.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });
  beforeEach(() => {
    completeMock.mockReset();
    tryClaimMock.mockReset();
    redisGetMock.mockReset();
    redisSetexMock.mockClear();
    runReportMock.mockReset();
  });

  it('happy path: matched → runReport → persisted + audit', async () => {
    redisGetMock.mockResolvedValueOnce(null);
    tryClaimMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 30 });
    completeMock.mockResolvedValueOnce(happyResponse(matchedLlmJson));
    const runId = oid();
    runReportMock.mockResolvedValueOnce({ _id: runId, status: 'success', result: [{ a: 1 }], summary: {} });

    const collegeId = String(oid());
    const r = await nlQuery(collegeId, 'how did the april funnel look', 'admin-1');

    expect(r.status).toBe('matched');
    if (r.status === 'matched') {
      expect(r.reportCode).toBe('admissions-funnel');
      expect(r.params).toEqual({ from: '2026-04-01', to: '2026-04-30' });
      expect(String(r.runId)).toBe(String(runId));
    }
    // runReport called with 5 positional args (004 §10.10 — 5th arg authScope).
    // Slice C passes ADMIN_FULL_SCOPE; slice E will wire the real authScope through.
    expect(runReportMock).toHaveBeenCalledWith(
      collegeId,
      'admissions-funnel',
      { from: '2026-04-01', to: '2026-04-30' },
      'admin-1',
      expect.objectContaining({ departmentOnly: false, selfOnly: false }),
    );
    // Persisted
    const docs = await NlReportQuery.find({ collegeId }).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.status).toBe('matched');
    expect(docs[0]!.selectedReport).toBe('admissions-funnel');
    // Audit
    const audits = await AuditLog.find({ action: 'ai_nl_report_query', collegeId }).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]!.performedBy).toBe('admin-1');
    // Cached
    expect(redisSetexMock).toHaveBeenCalledTimes(1);
  });

  it('LLM refuses: persisted as refused', async () => {
    redisGetMock.mockResolvedValueOnce(null);
    tryClaimMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 30 });
    completeMock.mockResolvedValueOnce(happyResponse(JSON.stringify({
      status: 'refused', reason: 'No supported report matches that question.',
    })));
    const collegeId = String(oid());
    const r = await nlQuery(collegeId, 'show me the library overdue list', 'admin-1');
    expect(r.status).toBe('refused');
    if (r.status === 'refused') expect(r.reason).toMatch(/no supported/i);
    expect(runReportMock).not.toHaveBeenCalled();
    const docs = await NlReportQuery.find({ collegeId }).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.status).toBe('refused');
  });

  it('cap reached: no LLM call, persisted with reason "cap_reached"', async () => {
    redisGetMock.mockResolvedValueOnce(null);
    tryClaimMock.mockResolvedValueOnce({ allowed: false, count: 30, cap: 30 });
    const collegeId = String(oid());
    const r = await nlQuery(collegeId, 'q', 'admin-1');
    expect(r.status).toBe('refused');
    if (r.status === 'refused') expect(r.reason).toBe('cap_reached');
    expect(completeMock).not.toHaveBeenCalled();
    const docs = await NlReportQuery.find({ collegeId }).lean();
    expect(docs[0]!.capReached).toBe(true);
  });

  it('LLM parse failure: refused', async () => {
    redisGetMock.mockResolvedValueOnce(null);
    tryClaimMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 30 });
    completeMock.mockResolvedValueOnce(happyResponse('not valid json'));
    const collegeId = String(oid());
    const r = await nlQuery(collegeId, 'q', 'admin-1');
    expect(r.status).toBe('refused');
    expect(runReportMock).not.toHaveBeenCalled();
  });

  it('validator failure (date out of range): refused, no runReport', async () => {
    redisGetMock.mockResolvedValueOnce(null);
    tryClaimMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 30 });
    completeMock.mockResolvedValueOnce(happyResponse(JSON.stringify({
      status: 'matched',
      reportCode: 'admissions-funnel',
      params: { from: '2015-01-01', to: '2015-12-31' },
      rationale: 'r',
    })));
    const collegeId = String(oid());
    const r = await nlQuery(collegeId, 'q', 'admin-1');
    expect(r.status).toBe('refused');
    if (r.status === 'refused') expect(r.reason).toMatch(/5 years/i);
    expect(runReportMock).not.toHaveBeenCalled();
  });

  it('30s dedup: 2nd identical question returns cached without new LLM/run', async () => {
    // First call: cache miss, LLM, run, cache write
    redisGetMock.mockResolvedValueOnce(null);
    tryClaimMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 30 });
    completeMock.mockResolvedValueOnce(happyResponse(matchedLlmJson));
    runReportMock.mockResolvedValueOnce({ _id: oid(), status: 'success', result: [], summary: {} });
    const collegeId = String(oid());
    const r1 = await nlQuery(collegeId, 'april funnel', 'admin-1');

    // Second call: cache hit
    redisGetMock.mockResolvedValueOnce(JSON.stringify({ ...r1, isDuplicate: false }));
    const r2 = await nlQuery(collegeId, 'april funnel', 'admin-1');

    expect((r2 as { isDuplicate?: boolean }).isDuplicate).toBe(true);
    // Only one LLM and one run across both calls
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(runReportMock).toHaveBeenCalledTimes(1);
  });

  it('runReport.status !== success (GATE 3 M-2): converts to refused', async () => {
    redisGetMock.mockResolvedValueOnce(null);
    tryClaimMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 30 });
    completeMock.mockResolvedValueOnce(happyResponse(matchedLlmJson));
    runReportMock.mockResolvedValueOnce({ _id: oid(), status: 'unimplemented' });
    const collegeId = String(oid());
    const r = await nlQuery(collegeId, 'q', 'admin-1');
    expect(r.status).toBe('refused');
    if (r.status === 'refused') expect(r.reason).toBe('report_run_failed');
  });
});

describe('getNlReportStats', () => {
  beforeAll(async () => { await setupMongo(); await NlReportQuery.syncIndexes(); }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('aggregates by status + by report (matched only), scoped to collegeId', async () => {
    const collegeA = oid();
    const collegeB = oid();
    const now = new Date();
    const baseDoc = {
      generatedAt: now,
      performedBy: 'a',
      llmModel: 'm',
      promptVersion: 'p',
      costInr: 0.5,
    };
    await NlReportQuery.create([
      { collegeId: collegeA, question: 'q1', status: 'matched', selectedReport: 'admissions-funnel', ...baseDoc },
      { collegeId: collegeA, question: 'q2', status: 'matched', selectedReport: 'admissions-funnel', ...baseDoc },
      { collegeId: collegeA, question: 'q3', status: 'refused', reason: 'x', ...baseDoc },
      { collegeId: collegeB, question: 'q4', status: 'matched', selectedReport: 'admissions-funnel', ...baseDoc },
    ]);

    const stats = await getNlReportStats(String(collegeA), 'today');
    expect(stats.totalQueries).toBe(3); // college A only
    expect(stats.matched).toBe(2);
    expect(stats.refused).toBe(1);
    expect(stats.llmCostInr).toBeCloseTo(1.5, 4);
    expect(stats.byReport).toHaveLength(1);
    expect(stats.byReport[0]).toMatchObject({ reportCode: 'admissions-funnel', count: 2 });
  });
});
