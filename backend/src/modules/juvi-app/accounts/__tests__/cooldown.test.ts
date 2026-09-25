import { describe, it, expect, vi, beforeEach } from 'vitest';
const redisMock = vi.hoisted(() => ({ get: vi.fn(), incr: vi.fn(), expire: vi.fn(), ttl: vi.fn(), del: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));
import { getCooldown, recordFailure, clearFailures, cooldownKey } from '../cooldown';

beforeEach(() => vi.clearAllMocks());

describe('cooldown', () => {
  it('keys by college and a hash of the lower-cased identifier, never the raw value', () => {
    const k = cooldownKey('c1', '21CS1042');
    expect(k).toMatch(/^juvi:login-fail:c1:[0-9a-f]{64}$/);
    expect(k).toBe(cooldownKey('c1', '21cs1042'));
    expect(k).not.toContain('21CS1042');
  });

  it('is not blocked under five failures', async () => {
    redisMock.get.mockResolvedValue('4');
    expect(await getCooldown('c1', 'x')).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });

  it('is blocked at five with the remaining ttl', async () => {
    redisMock.get.mockResolvedValue('5'); redisMock.ttl.mockResolvedValue(321);
    expect(await getCooldown('c1', 'x')).toEqual({ blocked: true, retryAfterSeconds: 321 });
  });

  it('recordFailure increments and sets the window only on the first failure', async () => {
    redisMock.incr.mockResolvedValue(1);
    await recordFailure('c1', 'x');
    expect(redisMock.expire).toHaveBeenCalledWith(expect.any(String), 600);
    redisMock.incr.mockResolvedValue(2); redisMock.expire.mockClear();
    await recordFailure('c1', 'x');
    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('allows sign-in when Redis is down', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));
    expect(await getCooldown('c1', 'x')).toEqual({ blocked: false, retryAfterSeconds: 0 });
    redisMock.del.mockRejectedValue(new Error('down'));
    await expect(clearFailures('c1', 'x')).resolves.toBeUndefined();
  });
});
