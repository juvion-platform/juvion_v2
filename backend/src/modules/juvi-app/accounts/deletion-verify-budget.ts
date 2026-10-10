import { createHash } from 'node:crypto';
import redis from '../../../config/redis';

/**
 * The public deletion-verification's per-identifier budget (011 Story 3 AC6).
 *
 * **This is deliberately not a limiter, and it lives in its own file for that reason.** Sign-in's
 * cooldown (`cooldown.ts`) is a hard block that is read *before* any credential check. Reusing it
 * here would let an unauthenticated attacker lock a victim out of the **app** with five bogus
 * deletion requests — and would let a user's own typo do the same. So this module has no verdict
 * to give: its only output is a number of milliseconds to wait. "Never hard-block" is therefore not
 * a rule to follow here, it is unsayable in the types.
 *
 * It is also key-disjoint from the sign-in budget by construction (`getCooldown` reads only
 * `juvi:login-fail:*`), so nothing this module writes can spend the owner's lockout budget.
 *
 * Fail-open throughout: Redis being unreachable means no delay and no counter, never a refusal.
 * The IP limiter (`middleware/rate-limits.ts`) is what actually bounds the request rate.
 */

/** Attempts served at full speed before any delay is applied. */
export const DELETION_VERIFY_MAX_FREE_ATTEMPTS = 5;
/** The window the counter lives in — long enough that a slow guesser cannot reset by waiting. */
export const DELETION_VERIFY_WINDOW_SECONDS = 900;
/** The ceiling on the wait. An attacker must not be able to park a request open indefinitely. */
export const DELETION_VERIFY_MAX_DELAY_MS = 4_000;
const BASE_DELAY_MS = 500;

/** Hashed so the identifier itself never lands in Redis or a log line, as `cooldown.ts:7` does. */
export function deletionVerifyKey(collegeId: string, identifier: string): string {
  const h = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
  return `juvi:deletion-verify:${collegeId}:${h}`;
}

/** Doubling from the threshold, capped. Returns **milliseconds**, never a blocked/not-blocked flag. */
export async function getDeletionVerifyDelayMs(collegeId: string, identifier: string): Promise<number> {
  try {
    const n = Number.parseInt((await redis.get(deletionVerifyKey(collegeId, identifier))) ?? '0', 10);
    if (!Number.isFinite(n) || n < DELETION_VERIFY_MAX_FREE_ATTEMPTS) return 0;
    return Math.min(BASE_DELAY_MS * 2 ** (n - DELETION_VERIFY_MAX_FREE_ATTEMPTS), DELETION_VERIFY_MAX_DELAY_MS);
  } catch {
    // Redis unavailable: delay nothing. A control that fails closed here would be the lockout AC6 forbids.
    return 0;
  }
}

export async function recordDeletionVerifyFailure(collegeId: string, identifier: string): Promise<void> {
  try {
    const k = deletionVerifyKey(collegeId, identifier);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, DELETION_VERIFY_WINDOW_SECONDS);
  } catch { /* non-fatal */ }
}

/** Called on a success, so a person who mistypes twice and then gets it right starts clean. */
export async function clearDeletionVerifyFailures(collegeId: string, identifier: string): Promise<void> {
  try { await redis.del(deletionVerifyKey(collegeId, identifier)); } catch { /* non-fatal */ }
}
