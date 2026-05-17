/**
 * 003-nl-report-queries §10.10 — 30s idempotency dedup.
 * 004-rbac-nl-queries §10.4 — scope-fingerprint extension.
 *
 * Redis SETEX cache keyed by (collegeId, scopeFingerprint, sha1(maskedQuestion)).
 * Repeat questions within 30s return the cached response with `isDuplicate: true`.
 * Fails OPEN (cache-miss-equivalent) when Redis is unreachable.
 *
 * The scopeFingerprint hashes the full discriminator tuple — role,
 * personaType, both scope flags, and the discriminator values
 * (departmentId, personId, userId). This prevents cross-persona
 * cache leakage:
 *   - two HODs in the same department share (correct: same authorized rows)
 *   - two HODs in different departments differ (different departmentId)
 *   - two counsellors with the same personId but different userIds differ
 *   - admin and HOD in the same college differ (different role + flags)
 */

import { createHash } from 'crypto';

import redis from '../../../config/redis';
import type { AuthScope } from '../../../shared/rbac/types';

export const DEDUP_TTL_SECONDS = 30;

export interface DedupContext {
  role?: string;
  personaType?: string;
  authScope: AuthScope;
}

/**
 * Compose the scope-fingerprint hash. Exported for tests.
 *
 * Includes only fields that meaningfully discriminate the scoped result:
 *   - role + personaType: always (different roles get different cells via
 *     the persona × report matrix, even when scope flags happen to align)
 *   - departmentOnly flag + departmentId: only when departmentOnly is true
 *     (otherwise the runner doesn't filter by branch / dept)
 *   - selfOnly flag + (personId ?? userId): only when selfOnly is true
 *     (mirrors `applyAuthScope`'s fallback to userId when personId is
 *     undefined — keeps two staff users without a Person link distinct)
 *
 * Two HODs in the same department therefore share a fingerprint (same
 * authorized rows → safe to share a cached result), but an HOD vs a
 * counsellor differ on role and an HOD-A vs HOD-B differ on departmentId.
 */
export function scopeFingerprint(ctx: DedupContext): string {
  const s = ctx.authScope;
  const deptSeg = s.departmentOnly ? `dept:${s.departmentId ?? '-'}` : 'dept:-';
  const selfSeg = s.selfOnly ? `self:${s.personId ?? s.userId ?? '-'}` : 'self:-';
  const input = [
    ctx.role ?? '-',
    ctx.personaType ?? '-',
    deptSeg,
    selfSeg,
  ].join('|');
  return createHash('sha1').update(input).digest('hex');
}

function keyFor(collegeId: string, ctx: DedupContext, maskedQuestion: string): string {
  const sf = scopeFingerprint(ctx);
  const qh = createHash('sha1').update(maskedQuestion).digest('hex');
  return `nl-report-dedup:${collegeId}:${sf}:${qh}`;
}

export async function getCachedNlQuery(
  collegeId: string,
  ctx: DedupContext,
  maskedQuestion: string,
): Promise<Record<string, unknown> | null> {
  try {
    const cached = await redis.get(keyFor(collegeId, ctx, maskedQuestion));
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export async function setCachedNlQuery(
  collegeId: string,
  ctx: DedupContext,
  maskedQuestion: string,
  response: Record<string, unknown>,
): Promise<void> {
  try {
    await redis.setex(
      keyFor(collegeId, ctx, maskedQuestion),
      DEDUP_TTL_SECONDS,
      JSON.stringify(response),
    );
  } catch {
    // Fail open — duplicate billing is a worse outcome than a missed cache
    // hit, but a transient Redis hiccup shouldn't break NL queries.
  }
}
