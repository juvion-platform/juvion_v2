import { describe, it, expect } from 'vitest';

import { blend, RULE_WEIGHT, LLM_WEIGHT } from '../blender';

/**
 * 001-ai-lead-scoring — Task 2.3
 * Blends rule and LLM components per spec §3:
 *   blended = clamp(0, 100, round(0.6*rule + 0.4*llm))
 * When llmScore is null, returns the rule score unchanged.
 */

describe('blend', () => {
  it('exposes the canonical 0.6 / 0.4 weights', () => {
    expect(RULE_WEIGHT).toBe(0.6);
    expect(LLM_WEIGHT).toBe(0.4);
    expect(RULE_WEIGHT + LLM_WEIGHT).toBeCloseTo(1, 5);
  });

  it('blends rule and llm with the canonical weights', () => {
    expect(blend({ ruleScore: 60, llmScore: 80 }).blendedScore).toBe(68); // 36 + 32
    expect(blend({ ruleScore: 100, llmScore: 0 }).blendedScore).toBe(60);
    expect(blend({ ruleScore: 0, llmScore: 100 }).blendedScore).toBe(40);
  });

  it('rounds to an integer', () => {
    expect(blend({ ruleScore: 55, llmScore: 76 }).blendedScore).toBe(Math.round(0.6 * 55 + 0.4 * 76));
  });

  it('clamps to [0, 100]', () => {
    expect(blend({ ruleScore: 200, llmScore: 200 }).blendedScore).toBe(100);
    expect(blend({ ruleScore: -50, llmScore: -50 }).blendedScore).toBe(0);
  });

  it('falls back to rule score when llmScore is null', () => {
    const r = blend({ ruleScore: 72, llmScore: null });
    expect(r.blendedScore).toBe(72);
    expect(r.usedLlm).toBe(false);
  });

  it('reports usedLlm = true when llmScore is a number', () => {
    expect(blend({ ruleScore: 50, llmScore: 50 }).usedLlm).toBe(true);
  });
});
