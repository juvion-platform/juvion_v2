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

function dayKey(collegeId: string, when: Date): string {
  const day = when.toISOString().slice(0, 10);
  return `lead-score:llm-count:${collegeId}:${day}`;
}

export async function tryClaimLLMSlot(
  collegeId: string,
  cap: number,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const key = dayKey(collegeId, now);
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
