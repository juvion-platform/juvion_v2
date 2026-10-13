import { createHash } from 'node:crypto';
import redis from '../../../config/redis';
import { normaliseJuviId } from './juvi-id';

export const COOLDOWN_MAX_FAILURES = 5;
export const COOLDOWN_WINDOW_SECONDS = 600;

/**
 * Keyed by the Juvi ID alone, hashed so the value itself never lands in Redis or logs.
 *
 * There is no college to scope by — the college comes *from* the ID — and nothing to vary to
 * escape the budget, which keying by college used to allow (spec §7). The consequence is stated
 * there deliberately: someone who knows an ID can spend its owner's budget for the window.
 */
export function cooldownKey(juviId: string): string {
  const h = createHash('sha256').update(normaliseJuviId(juviId)).digest('hex');
  return `juvi:login-fail:${h}`;
}

export async function getCooldown(juviId: string): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  try {
    const k = cooldownKey(juviId);
    const n = Number.parseInt((await redis.get(k)) ?? '0', 10);
    if (n < COOLDOWN_MAX_FAILURES) return { blocked: false, retryAfterSeconds: 0 };
    const ttl = await redis.ttl(k);
    return { blocked: true, retryAfterSeconds: Math.max(1, ttl) };
  } catch {
    // Redis unavailable: never lock everyone out; the per-IP limiter still applies.
    return { blocked: false, retryAfterSeconds: 0 };
  }
}

export async function recordFailure(juviId: string): Promise<void> {
  try {
    const k = cooldownKey(juviId);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, COOLDOWN_WINDOW_SECONDS);
  } catch { /* non-fatal */ }
}

export async function clearFailures(juviId: string): Promise<void> {
  try { await redis.del(cooldownKey(juviId)); } catch { /* non-fatal */ }
}
