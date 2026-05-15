/**
 * Per-college daily LLM cap guard.
 *
 * Spec: `.sdd/specs/001-ai-lead-scoring/spec.md` §10.7.
 *
 * Each call atomically INCRs a Redis counter scoped to (collegeId, UTC day).
 * On the first claim of the day, the key gets a 24h TTL. If the counter
 * exceeds the cap, we DECR to roll back the increment so other races see
 * the true ceiling, and report `allowed: false`.
 *
 * Failure-mode policy: if Redis is unreachable we fail CLOSED (allowed:
 * false). The scoring worker treats that as `llmSkipped: true` and falls
 * back to rules-only — never bills the LLM when we can't account for it.
 */

import redis from '../../../config/redis';

export interface ClaimResult {
  allowed: boolean;
  count: number;
  cap: number;
  error?: Error;
}

function dayKey(collegeId: string, when: Date, namespace: string): string {
  const day = when.toISOString().slice(0, 10);
  return `${namespace}:llm-count:${collegeId}:${day}`;
}

/**
 * Claims one LLM call from the daily per-college cap.
 *
 * The `namespace` argument lets unrelated features (lead scoring, config
 * suggestion, NL reports) keep separate counters without colliding on the
 * same Redis key. Defaults to `'lead-score'` for back-compat with the
 * original single-caller setup (002-ai-assisted-config GATE 3 B-1: this
 * is the 4th positional, not the 3rd, so existing callers passing `now`
 * positionally don't break).
 */
export async function tryClaimLLMSlot(
  collegeId: string,
  cap: number,
  now: Date = new Date(),
  namespace: string = 'lead-score',
): Promise<ClaimResult> {
  const key = dayKey(collegeId, now, namespace);
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 86_400);
    if (count > cap) {
      await redis.decr(key);
      return { allowed: false, count: cap, cap };
    }
    return { allowed: true, count, cap };
  } catch (err) {
    return { allowed: false, count: 0, cap, error: err as Error };
  }
}
