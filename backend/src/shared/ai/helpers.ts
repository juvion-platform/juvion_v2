/**
 * Task A4 — Orchestrator helpers (fee-analytics-ai-native).
 *
 * Pure utilities consumed by `service.ts`. Extracted to keep the
 * orchestrator focused on per-endpoint flow + to make these helpers
 * independently testable.
 *
 *   - `withBoundedConcurrency`  — hard-cap parallel async tasks
 *   - `tryParseJson`            — fence-strip + JSON.parse + Zod-validate
 *   - `stripJsonFences`         — strip Markdown ```json fences before parse
 *   - `trimTurnsForBudget`      — drop oldest turns until under token budget
 *   - `truncateNarrative`       — clamp to N sentences / M chars
 */

import type { ZodType } from 'zod';

// ── Bounded concurrency ────────────────────────────────────────────────

/**
 * Run a list of async tasks with a hard concurrency cap. No external dep.
 * Errors are surfaced via PromiseSettledResult — caller decides how to
 * react. Order of input items is preserved in the result array.
 */
export async function withBoundedConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  if (limit < 1) {
    throw new Error('withBoundedConcurrency: limit must be >= 1');
  }
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        const item = items[i] as T;
        const value = await worker(item, i);
        results[i] = { status: 'fulfilled', value };
      } catch (e) {
        results[i] = {
          status: 'rejected',
          reason: e,
        };
      }
    }
  }
  const runners: Promise<void>[] = [];
  for (let k = 0; k < Math.min(limit, items.length); k++) {
    runners.push(next());
  }
  await Promise.all(runners);
  return results;
}

// ── JSON validation ────────────────────────────────────────────────────

/**
 * Strip surrounding markdown fences (```json ... ``` or ``` ... ```) so
 * JSON.parse doesn't reject on prose-wrapped LLM output.
 */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const m = fence.exec(trimmed);
  if (m && m[1]) return m[1].trim();
  return trimmed;
}

export interface JsonValidateResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

/**
 * Parse JSON + validate against a Zod schema. Returns a tagged result
 * instead of throwing so the caller can implement retry / fallback flows.
 */
export function tryParseJson<T>(
  text: string,
  schema: ZodType<T>,
): JsonValidateResult<T> {
  try {
    const stripped = stripJsonFences(text);
    const parsed = JSON.parse(stripped);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, value: result.data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Turn budget guard ─────────────────────────────────────────────────

/**
 * Trim oldest turns while keeping the prefix budget under the supplied
 * token budget. Estimate = char/charPerToken (default 4).
 *
 * Pairs (user/assistant) are dropped in chronological order; the most-
 * recent N turns are retained. Returns a new array (input untouched).
 */
export function trimTurnsForBudget(
  turns: ReadonlyArray<{ role: string; content: string }>,
  budgetTokens: number,
  charPerToken: number = 4,
): Array<{ role: string; content: string }> {
  const totalEstimate = (s: string) => Math.ceil(s.length / charPerToken);
  let total = turns.reduce((a, t) => a + totalEstimate(t.content), 0);
  const work = turns.slice();
  while (total > budgetTokens && work.length > 0) {
    const first = work.shift();
    if (!first) break;
    total -= totalEstimate(first.content);
  }
  return work.map((t) => ({ role: t.role, content: t.content }));
}

// ── Narrative truncation ──────────────────────────────────────────────

/**
 * Clamp a narrative to at most `maxSentences` sentences and `maxChars`
 * characters. Used by the forecast-narrative flow per AC ("if > 300
 * chars or > 3 sentences, truncate + flag").
 */
export function truncateNarrative(
  text: string,
  maxSentences: number = 3,
  maxChars: number = 300,
): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  let trimmed = sentences.slice(0, maxSentences).join(' ');
  if (trimmed.length > maxChars) {
    trimmed = trimmed.slice(0, maxChars).trimEnd() + '…';
  }
  return trimmed;
}
