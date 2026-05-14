import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 001-ai-lead-scoring — Task 3.2
 * Wraps the Juvi LLM client with a 12s abort guard and a JSON-only
 * response contract. Returns null on any failure path (parse error,
 * abort, upstream error) so the orchestrator can fall back to
 * rules-only. Cost is propagated for the LeadScoringStats counter.
 */

const { completeMock } = vi.hoisted(() => ({ completeMock: vi.fn() }));

vi.mock('../../../juvi/finance-agent/llm-client', () => ({
  createLLMClient: () => ({ provider: 'claude', complete: completeMock, stream: () => ({}) }),
}));

import { computeLLMScore, LLM_TIMEOUT_MS } from '../llm-scorer';

beforeEach(() => {
  completeMock.mockReset();
});

describe('computeLLMScore', () => {
  const promptMessages = [
    { role: 'system' as const, content: 'sys' },
    { role: 'user' as const, content: 'user' },
  ];

  it('returns parsed score, factors and costInr on happy path', async () => {
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({
        score: 76,
        factors: [
          { label: 'High intent walk-in', weight: 22 },
          { label: 'MPC fit for B.Tech CSE', weight: 18 },
        ],
        summary: 'Engaged lead, strong fit',
      }),
      inputTokens: 320,
      outputTokens: 80,
      costInr: 1.5,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      durationMs: 3200,
    });

    const r = await computeLLMScore(promptMessages);
    expect(r).not.toBeNull();
    expect(r!.score).toBe(76);
    expect(r!.factors).toHaveLength(2);
    expect(r!.factors[0]).toEqual({ label: 'High intent walk-in', weight: 22, source: 'llm' });
    expect(r!.costInr).toBe(1.5);
    expect(r!.summary).toBe('Engaged lead, strong fit');
  });

  it('clamps score to 0..100 even if the model returns out-of-range', async () => {
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({ score: 250, factors: [], summary: 'over' }),
      inputTokens: 1, outputTokens: 1, costInr: 0, model: 'm', provider: 'claude', durationMs: 1,
    });
    const r = await computeLLMScore(promptMessages);
    expect(r!.score).toBe(100);
  });

  it('returns null on malformed JSON', async () => {
    completeMock.mockResolvedValueOnce({
      text: 'sorry I cannot do that today',
      inputTokens: 10, outputTokens: 5, costInr: 0.1, model: 'm', provider: 'claude', durationMs: 100,
    });
    const r = await computeLLMScore(promptMessages);
    expect(r).toBeNull();
  });

  it('returns null on schema mismatch (missing required keys)', async () => {
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({ score: 50 }), // missing factors + summary
      inputTokens: 5, outputTokens: 5, costInr: 0.1, model: 'm', provider: 'claude', durationMs: 50,
    });
    const r = await computeLLMScore(promptMessages);
    expect(r).toBeNull();
  });

  it('returns null when the LLM client throws', async () => {
    completeMock.mockRejectedValueOnce(new Error('upstream 503'));
    const r = await computeLLMScore(promptMessages);
    expect(r).toBeNull();
  });

  it('strips ```json fences if the model adds them anyway', async () => {
    completeMock.mockResolvedValueOnce({
      text: '```json\n{ "score": 65, "factors": [{"label":"x","weight":5}], "summary":"y" }\n```',
      inputTokens: 1, outputTokens: 1, costInr: 0, model: 'm', provider: 'claude', durationMs: 1,
    });
    const r = await computeLLMScore(promptMessages);
    expect(r!.score).toBe(65);
  });

  it('forwards a caller-supplied AbortSignal to the LLM client', async () => {
    completeMock.mockResolvedValueOnce({
      text: '{"score":50,"factors":[],"summary":"x"}',
      inputTokens: 1, outputTokens: 1, costInr: 0, model: 'm', provider: 'claude', durationMs: 1,
    });
    const ctrl = new AbortController();
    await computeLLMScore(promptMessages, { abortSignal: ctrl.signal });
    const opts = completeMock.mock.calls[0]![1] as { abortSignal?: AbortSignal };
    expect(opts.abortSignal).toBe(ctrl.signal);
  });

  it('exposes the 12s timeout constant', () => {
    expect(LLM_TIMEOUT_MS).toBe(12_000);
  });
});
