/**
 * 003-nl-report-queries §10.10 — 30s idempotency dedup.
 *
 * Redis SETEX cache keyed by (collegeId, sha1(maskedQuestion)). Repeat
 * questions within 30s return the cached response with `isDuplicate: true`
 * (the caller decorates). Fails OPEN (cache-miss-equivalent) when Redis
 * is unreachable — duplication is a UX concern, not a security one.
 */

import { createHash } from 'crypto';

import redis from '../../../config/redis';

export const DEDUP_TTL_SECONDS = 30;

function keyFor(collegeId: string, maskedQuestion: string): string {
  const h = createHash('sha1').update(maskedQuestion).digest('hex');
  return `nl-report-dedup:${collegeId}:${h}`;
}

export async function getCachedNlQuery(
  collegeId: string,
  maskedQuestion: string,
): Promise<Record<string, unknown> | null> {
  try {
    const cached = await redis.get(keyFor(collegeId, maskedQuestion));
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export async function setCachedNlQuery(
  collegeId: string,
  maskedQuestion: string,
  response: Record<string, unknown>,
): Promise<void> {
  try {
    await redis.setex(
      keyFor(collegeId, maskedQuestion),
      DEDUP_TTL_SECONDS,
      JSON.stringify(response),
    );
  } catch {
    // Fail open — duplicate billing is a worse outcome than a missed cache
    // hit, but a transient Redis hiccup shouldn't break NL queries.
  }
}
