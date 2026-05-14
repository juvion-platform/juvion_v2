/**
 * LLM scorer — wraps the Juvi LLM client with:
 *   1. A 12s AbortController guard (spec §10.8).
 *   2. JSON-only response parsing with a strict schema check.
 *   3. Graceful null-on-failure return so the orchestrator can fall
 *      back to rules-only with `scoreRationale.llmFallback: true`.
 *
 * The caller (orchestrator) is responsible for:
 *   - Building the masked prompt via `prompt.ts`
 *   - Deciding whether to call this at all (cap-guard gate)
 *   - Composing the AbortSignal with worker-level cancellation if needed
 */

import { createLLMClient, type LLMMessage } from '../../juvi/finance-agent/llm-client';
import type { ScoreFactor } from './rule-scorer';

export const LLM_TIMEOUT_MS = 12_000;

export interface LLMScoreResult {
  score: number;
  factors: ScoreFactor[];
  summary: string;
  costInr: number;
}

export interface LLMScorerOptions {
  /** Optional caller-supplied signal; we layer our 12s timer on top of it. */
  abortSignal?: AbortSignal;
}

interface RawLlmPayload {
  score: number;
  factors: Array<{ label: string; weight: number }>;
  summary: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function parseStrict(raw: string): RawLlmPayload | null {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;
  if (typeof obj.score !== 'number') return null;
  if (typeof obj.summary !== 'string') return null;
  if (!Array.isArray(obj.factors)) return null;
  const factors: Array<{ label: string; weight: number }> = [];
  for (const f of obj.factors) {
    if (!f || typeof f !== 'object') return null;
    const ff = f as Record<string, unknown>;
    if (typeof ff.label !== 'string' || typeof ff.weight !== 'number') return null;
    factors.push({ label: ff.label, weight: ff.weight });
  }
  return { score: obj.score, factors, summary: obj.summary };
}

export async function computeLLMScore(
  messages: LLMMessage[],
  opts: LLMScorerOptions = {},
): Promise<LLMScoreResult | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
  if (opts.abortSignal) {
    if (opts.abortSignal.aborted) ctrl.abort();
    else opts.abortSignal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }

  try {
    const client = createLLMClient();
    const resp = await client.complete(messages, { abortSignal: opts.abortSignal ?? ctrl.signal });
    const parsed = parseStrict(resp.text);
    if (!parsed) return null;
    return {
      score: clamp(Math.round(parsed.score), 0, 100),
      factors: parsed.factors.map((f) => ({ label: f.label, weight: f.weight, source: 'llm' })),
      summary: parsed.summary,
      costInr: resp.costInr,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
