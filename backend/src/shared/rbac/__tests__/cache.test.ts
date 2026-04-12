import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedPolicies, setCachedPolicies, invalidatePolicies } from '../cache';

// Mock redis
vi.mock('../../../config/redis', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

import redis from '../../../config/redis';

describe('RBAC Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCachedPolicies returns null on cache miss', async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await getCachedPolicies('college1', 'faculty');
    expect(result).toBeNull();
    expect(redis.get).toHaveBeenCalledWith('rbac:college1:faculty');
  });

  it('getCachedPolicies returns parsed policies on cache hit', async () => {
    const policies = [{ role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true }];
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(policies));
    const result = await getCachedPolicies('college1', 'faculty');
    expect(result).toEqual(policies);
  });

  it('setCachedPolicies stores JSON with TTL', async () => {
    const policies = [{ role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true }];
    await setCachedPolicies('college1', 'faculty', policies as any);
    expect(redis.set).toHaveBeenCalledWith('rbac:college1:faculty', JSON.stringify(policies), 'EX', 300);
  });

  it('invalidatePolicies deletes matching keys', async () => {
    (redis.keys as ReturnType<typeof vi.fn>).mockResolvedValue(['rbac:college1:faculty', 'rbac:college1:admin']);
    await invalidatePolicies('college1');
    expect(redis.keys).toHaveBeenCalledWith('rbac:college1:*');
    expect(redis.del).toHaveBeenCalledTimes(2);
  });
});
