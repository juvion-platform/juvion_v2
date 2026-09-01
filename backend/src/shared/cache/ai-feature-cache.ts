/**
 * Server-side daily cache for AI-derived finance-agent features.
 *
 * Uses the existing Redis singleton. Keys include today's UTC date so
 * entries expire automatically at midnight UTC without needing explicit
 * eviction — they simply become unreachable to the read path and expire
 * via the `EX` TTL set at write time.
 *
 * Three cached features (keyed by collegeId + date):
 *   - Forecast narrative   juvi:ai:forecast:{collegeId}:{YYYY-MM-DD}:{YYYY-MM}
 *   - Situations           juvi:ai:situations:{collegeId}:{YYYY-MM-DD}
 *   - Risk scores          juvi:ai:risk:{collegeId}:{studentId}:{YYYY-MM-DD}
 *
 * Chat (SSE) is never cached — see controller.ts.
 */

import redis from '../../config/redis';

function secondsUntilMidnightUTC(): number {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.ceil((midnight.getTime() - Date.now()) / 1000));
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function forecastCacheKey(collegeId: string, monthYYYYMM: string): string {
  return `juvi:ai:forecast:${collegeId}:${todayUTC()}:${monthYYYYMM}`;
}

export function situationsCacheKey(collegeId: string): string {
  return `juvi:ai:situations:${collegeId}:${todayUTC()}`;
}

export function riskScoreCacheKey(collegeId: string, studentId: string): string {
  return `juvi:ai:risk:${collegeId}:${studentId}:${todayUTC()}`;
}

/**
 * Generic namespaced key so a new AI surface does not have to edit this file
 * to get a cache slot. `collegeId` stays the first interpolated segment, which
 * is what keeps tenants from colliding.
 *
 *   aiCacheKey('people-narration', collegeId, alertId)
 *     -> juvi:ai:people-narration:<collegeId>:<alertId>:<YYYY-MM-DD>
 */
export function aiCacheKey(
  namespace: string,
  collegeId: string,
  ...parts: string[]
): string {
  const tail = parts.length > 0 ? `${parts.join(':')}:` : '';
  return `juvi:ai:${namespace}:${collegeId}:${tail}${todayUTC()}`;
}

export interface AICacheEntry<T> {
  data: T;
  cachedAt: string;
}

export async function getAICache<T>(key: string): Promise<AICacheEntry<T> | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as AICacheEntry<T>;
  } catch {
    return null;
  }
}

export async function setAICache<T>(key: string, data: T): Promise<string> {
  const cachedAt = new Date().toISOString();
  const ttl = secondsUntilMidnightUTC();
  try {
    const entry: AICacheEntry<T> = { data, cachedAt };
    await redis.set(key, JSON.stringify(entry), 'EX', ttl);
  } catch {
    // Non-fatal — response was already computed.
  }
  return cachedAt;
}

export async function deleteAICache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // Non-fatal.
  }
}

/**
 * Drops every `juvi:ai:*` entry.
 *
 * Needed by tests, which would otherwise see one test's cached AI output
 * served to the next (the keys are per-college-per-day, so within a run they
 * collide). Also usable operationally to force a re-generation before the
 * midnight TTL. Uses SCAN rather than KEYS so it never blocks Redis.
 */
export async function clearAICache(): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'juvi:ai:*', 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch {
    // Non-fatal — a cache we cannot clear is still only a cache.
  }
}

/**
 * Parallel-fetch cache entries for a list of students.
 * Returns a Map of studentId → AICacheEntry; misses are absent.
 */
export async function batchGetAICache<T>(
  pairs: Array<{ studentId: string; key: string }>,
): Promise<Map<string, AICacheEntry<T>>> {
  const result = new Map<string, AICacheEntry<T>>();
  if (pairs.length === 0) return result;
  try {
    const raws = await Promise.all(pairs.map((p) => redis.get(p.key)));
    for (let i = 0; i < pairs.length; i++) {
      const raw = raws[i] ?? null;
      if (raw) {
        try {
          result.set(pairs[i]!.studentId, JSON.parse(raw) as AICacheEntry<T>);
        } catch {
          // Malformed entry — treat as miss.
        }
      }
    }
  } catch {
    // Redis error — treat all as misses.
  }
  return result;
}

/**
 * Write per-student cache entries via a single Redis pipeline.
 * Returns the ISO timestamp written to all entries.
 */
export async function batchSetAICache<T>(
  entries: Array<{ key: string; data: T }>,
): Promise<string> {
  const cachedAt = new Date().toISOString();
  const ttl = secondsUntilMidnightUTC();
  try {
    const pipeline = redis.pipeline();
    for (const { key, data } of entries) {
      const entry: AICacheEntry<T> = { data, cachedAt };
      pipeline.set(key, JSON.stringify(entry), 'EX', ttl);
    }
    await pipeline.exec();
  } catch {
    // Non-fatal.
  }
  return cachedAt;
}
