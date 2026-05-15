import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 003-nl-report-queries Task 3.4 — Redis 30s SETEX dedup.
 *
 * Mock the redis singleton; we just verify the key shape, TTL, and
 * cache miss/hit semantics.
 */

const { getMock, setexMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setexMock: vi.fn().mockResolvedValue('OK'),
}));

vi.mock('../../../../config/redis', () => ({
  default: { get: getMock, setex: setexMock },
}));

import { getCachedNlQuery, setCachedNlQuery, DEDUP_TTL_SECONDS } from '../dedup';

beforeEach(() => {
  getMock.mockReset();
  setexMock.mockClear();
});

describe('nl-reports/dedup', () => {
  it('returns null on miss', async () => {
    getMock.mockResolvedValueOnce(null);
    const r = await getCachedNlQuery('college-1', 'what is the funnel');
    expect(r).toBeNull();
  });

  it('returns parsed JSON on hit', async () => {
    getMock.mockResolvedValueOnce(JSON.stringify({ status: 'matched', reportCode: 'x', costInr: 1 }));
    const r = await getCachedNlQuery('college-1', 'what is the funnel');
    expect(r).toEqual({ status: 'matched', reportCode: 'x', costInr: 1 });
  });

  it('uses a key namespaced by college and masked question (different colleges → different keys)', async () => {
    getMock.mockResolvedValue(null);
    await getCachedNlQuery('college-A', 'q');
    await getCachedNlQuery('college-B', 'q');
    expect(getMock.mock.calls[0]![0]).not.toBe(getMock.mock.calls[1]![0]);
    expect(getMock.mock.calls[0]![0]).toContain('nl-report-dedup');
    expect(getMock.mock.calls[0]![0]).toContain('college-A');
    expect(getMock.mock.calls[1]![0]).toContain('college-B');
  });

  it('different questions → different keys', async () => {
    getMock.mockResolvedValue(null);
    await getCachedNlQuery('college-1', 'september funnel');
    await getCachedNlQuery('college-1', 'lead source for the year');
    expect(getMock.mock.calls[0]![0]).not.toBe(getMock.mock.calls[1]![0]);
  });

  it('set uses SETEX with the 30s TTL', async () => {
    await setCachedNlQuery('college-1', 'q', { foo: 'bar' });
    const [key, ttl, value] = setexMock.mock.calls[0]!;
    expect(ttl).toBe(DEDUP_TTL_SECONDS);
    expect(DEDUP_TTL_SECONDS).toBe(30);
    expect(JSON.parse(String(value))).toEqual({ foo: 'bar' });
    expect(key).toContain('nl-report-dedup');
  });

  it('silently survives a redis-down get', async () => {
    getMock.mockRejectedValueOnce(new Error('redis down'));
    const r = await getCachedNlQuery('college-1', 'q');
    expect(r).toBeNull();
  });

  it('silently survives a redis-down set', async () => {
    setexMock.mockRejectedValueOnce(new Error('redis down'));
    await expect(setCachedNlQuery('college-1', 'q', { x: 1 })).resolves.toBeUndefined();
  });
});
