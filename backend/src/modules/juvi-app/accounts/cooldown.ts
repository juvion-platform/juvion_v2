import { createHash } from 'node:crypto';
import redis from '../../../config/redis';

export const COOLDOWN_MAX_FAILURES = 5;
export const COOLDOWN_WINDOW_SECONDS = 600;

/** Hash so the identifier itself never lands in Redis or logs. */
export function cooldownKey(collegeId: string, identifier: string): string {
  const h = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
  return `juvi:login-fail:${collegeId}:${h}`;
}

export async function getCooldown(collegeId: string, identifier: string): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  try {
    const k = cooldownKey(collegeId, identifier);
    const n = Number.parseInt((await redis.get(k)) ?? '0', 10);
    if (n < COOLDOWN_MAX_FAILURES) return { blocked: false, retryAfterSeconds: 0 };
    const ttl = await redis.ttl(k);
    return { blocked: true, retryAfterSeconds: Math.max(1, ttl) };
  } catch {
    // Redis unavailable: never lock everyone out; the per-IP limiter still applies.
    return { blocked: false, retryAfterSeconds: 0 };
  }
}

export async function recordFailure(collegeId: string, identifier: string): Promise<void> {
  try {
    const k = cooldownKey(collegeId, identifier);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, COOLDOWN_WINDOW_SECONDS);
  } catch { /* non-fatal */ }
}

export async function clearFailures(collegeId: string, identifier: string): Promise<void> {
  try { await redis.del(cooldownKey(collegeId, identifier)); } catch { /* non-fatal */ }
}
