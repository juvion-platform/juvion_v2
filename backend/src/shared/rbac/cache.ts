import redis from '../../config/redis';
import { PolicyDoc } from './types';

const CACHE_TTL = 300; // 5 minutes

function cacheKey(collegeId: string, role: string): string {
  return `rbac:${collegeId}:${role}`;
}

export async function getCachedPolicies(collegeId: string, role: string): Promise<PolicyDoc[] | null> {
  try {
    const cached = await redis.get(cacheKey(collegeId, role));
    if (!cached) return null;
    return JSON.parse(cached) as PolicyDoc[];
  } catch (_e) {
    return null; // cache miss on error
  }
}

export async function setCachedPolicies(collegeId: string, role: string, policies: PolicyDoc[]): Promise<void> {
  try {
    await redis.set(cacheKey(collegeId, role), JSON.stringify(policies), 'EX', CACHE_TTL);
  } catch (_e) {
    // Non-fatal: proceed without cache
  }
}

export async function invalidatePolicies(collegeId: string): Promise<void> {
  try {
    const keys = await redis.keys(`rbac:${collegeId}:*`);
    for (const key of keys) {
      await redis.del(key);
    }
  } catch (_e) {
    // Non-fatal
  }
}

export async function invalidateAllDefaults(): Promise<void> {
  try {
    const keys = await redis.keys('rbac:defaults:*');
    for (const key of keys) {
      await redis.del(key);
    }
  } catch (_e) {
    // Non-fatal
  }
}
