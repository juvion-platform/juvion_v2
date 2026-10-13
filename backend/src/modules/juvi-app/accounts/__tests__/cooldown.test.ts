import { describe, it, expect, vi, beforeEach } from 'vitest';
const redisMock = vi.hoisted(() => ({ get: vi.fn(), incr: vi.fn(), expire: vi.fn(), ttl: vi.fn(), del: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));
import { getCooldown, recordFailure, clearFailures, cooldownKey } from '../cooldown';

beforeEach(() => vi.clearAllMocks());

describe('cooldown', () => {
  it('keys by a hash of the normalised Juvi ID, never the raw value', () => {
    const k = cooldownKey('JUV4K7P2M9X');
    expect(k).toMatch(/^juvi:login-fail:[0-9a-f]{64}$/);
    expect(k).not.toContain('JUV4K7P2M9X');
  });

  it('gives one budget to every spelling of the same ID', () => {
    expect(cooldownKey('JUV4K7P2M9X')).toBe(cooldownKey('juv-4k7p-2m9x'));
    expect(cooldownKey('JUV4K7P2M9X')).toBe(cooldownKey(' juv 4k7p 2m9x '));
  });

  it('is not blocked under five failures', async () => {
    redisMock.get.mockResolvedValue('4');
    expect(await getCooldown('JUV4K7P2M9X')).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });

  it('is blocked at five with the remaining ttl', async () => {
    redisMock.get.mockResolvedValue('5'); redisMock.ttl.mockResolvedValue(321);
    expect(await getCooldown('JUV4K7P2M9X')).toEqual({ blocked: true, retryAfterSeconds: 321 });
  });

  it('recordFailure increments and sets the window only on the first failure', async () => {
    redisMock.incr.mockResolvedValue(1);
    await recordFailure('JUV4K7P2M9X');
    expect(redisMock.expire).toHaveBeenCalledWith(expect.any(String), 600);
    redisMock.incr.mockResolvedValue(2); redisMock.expire.mockClear();
    await recordFailure('JUV4K7P2M9X');
    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('allows sign-in when Redis is down', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));
    expect(await getCooldown('JUV4K7P2M9X')).toEqual({ blocked: false, retryAfterSeconds: 0 });
    redisMock.del.mockRejectedValue(new Error('down'));
    await expect(clearFailures('JUV4K7P2M9X')).resolves.toBeUndefined();
  });
});
