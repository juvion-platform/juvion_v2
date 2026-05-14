/**
 * Score blender: hybrid rule + LLM weighting.
 *
 * Spec: `.sdd/specs/001-ai-lead-scoring/spec.md` §3 / §10.
 *   final = clamp(0, 100, round(0.6 * rule + 0.4 * llm))
 *
 * If `llmScore` is null (rules-only fallback path: LLM cap reached, parse
 * failure, or abort), the rule score is returned as-is and `usedLlm` is
 * false. Callers should mirror that flag onto `scoreRationale.llmFallback`
 * or `llmSkipped` as appropriate.
 */

export const RULE_WEIGHT = 0.6;
export const LLM_WEIGHT = 0.4;

export interface BlendInput {
  ruleScore: number;
  llmScore: number | null;
}

export interface BlendResult {
  blendedScore: number;
  usedLlm: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function blend({ ruleScore, llmScore }: BlendInput): BlendResult {
  if (llmScore === null || llmScore === undefined) {
    return { blendedScore: clamp(Math.round(ruleScore), 0, 100), usedLlm: false };
  }
  const raw = RULE_WEIGHT * ruleScore + LLM_WEIGHT * llmScore;
  return { blendedScore: clamp(Math.round(raw), 0, 100), usedLlm: true };
}
