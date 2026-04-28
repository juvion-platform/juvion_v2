/**
 * In-process TTL caches for the per-college LLM spend-limit gate.
 *
 * Two parallel maps:
 *   - collegeLimitsCache: per-college aiSpendLimits (small, rarely updated)
 *   - currentSpendCache:  rolling 7-day spend total (recomputed every TTL)
 *
 * Both share the same TTL (default 60s, override with `LLM_BUDGET_CACHE_TTL_SECONDS`).
 * The 60s lag on spend is an explicit tradeoff: max 60s of budget headroom
 * during a burst, in exchange for keeping the LLM hot path off MongoDB
 * aggregations on every call. See plan §1.6.
 *
 * Manual invalidation paths:
 *   - Admin updates limits   → `invalidateLimits(collegeId)` + `invalidateSpend(collegeId)`
 *   - Admin "refresh" button → both (deferred to v2)
 *
 * No automatic spend invalidation on each LLM call — next call within 60s
 * sees stale spend (acceptable; see plan §1.6).
 */

interface CachedEntry<T> {
  value: T;
  expiresAt: number; // epoch ms
}

export interface CachedLimits {
  weeklyInr: number;
  alertThresholdPct: number;
}

export interface CachedSpend {
  spent: number;
  fetchedAt: number; // epoch ms
}

const collegeLimitsCache = new Map<string, CachedEntry<CachedLimits>>();
const currentSpendCache = new Map<string, CachedEntry<CachedSpend>>();

/**
 * Read the TTL fresh on every set so test environments and runtime config
 * changes propagate without a process restart. Falls back to 60s on parse
 * failure or non-positive values.
 */
function ttlMs(): number {
  const raw = process.env.LLM_BUDGET_CACHE_TTL_SECONDS;
  const parsed = raw === undefined ? NaN : parseInt(raw, 10);
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
  return seconds * 1000;
}

function get<T>(map: Map<string, CachedEntry<T>>, key: string): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

function set<T>(map: Map<string, CachedEntry<T>>, key: string, value: T): void {
  map.set(key, { value, expiresAt: Date.now() + ttlMs() });
}

export function getCachedLimits(collegeId: string): CachedLimits | undefined {
  return get(collegeLimitsCache, collegeId);
}

export function setCachedLimits(collegeId: string, value: CachedLimits): void {
  set(collegeLimitsCache, collegeId, value);
}

export function getCachedSpend(collegeId: string): CachedSpend | undefined {
  return get(currentSpendCache, collegeId);
}

export function setCachedSpend(collegeId: string, value: CachedSpend): void {
  set(currentSpendCache, collegeId, value);
}

export function invalidateLimits(collegeId: string): void {
  collegeLimitsCache.delete(collegeId);
}

export function invalidateSpend(collegeId: string): void {
  currentSpendCache.delete(collegeId);
}

/** Test helper — clears both maps. NOT exported via the public surface. */
export function _resetCachesForTest(): void {
  collegeLimitsCache.clear();
  currentSpendCache.clear();
}

/** Test helper — exposes the live TTL value (ms). NOT for production callers. */
export function _ttlMsForTest(): number {
  return ttlMs();
}
