import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 001-ai-lead-scoring — Task 3.1
 * Cap-guard: atomic Redis INCR + EXPIRE-on-first + rollback when over cap.
 * Spec §10.7.
 *
 * We mock the redis singleton at the module level — the cap-guard receives
 * the client by import, not via DI, matching the project's existing pattern.
 */

const { incrMock, expireMock, decrMock } = vi.hoisted(() => ({
  incrMock: vi.fn(),
  expireMock: vi.fn().mockResolvedValue(1),
  decrMock: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../../../config/redis', () => ({
  default: { incr: incrMock, expire: expireMock, decr: decrMock },
}));

import { tryClaimLLMSlot } from '../cap-guard';

beforeEach(() => {
  incrMock.mockReset();
  expireMock.mockClear();
  decrMock.mockClear();
});

describe('tryClaimLLMSlot', () => {
  it('claims slot when under cap', async () => {
    incrMock.mockResolvedValueOnce(1);
    const r = await tryClaimLLMSlot('college-1', 500);
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(1);
    expect(r.cap).toBe(500);
  });

  it('sets a 24h TTL on the FIRST claim and not on subsequent ones', async () => {
    incrMock.mockResolvedValueOnce(1);
    await tryClaimLLMSlot('college-2', 500);
    expect(expireMock).toHaveBeenCalledTimes(1);
    const [, ttl] = expireMock.mock.calls[0]!;
    expect(ttl).toBe(86_400);

    incrMock.mockResolvedValueOnce(2);
    await tryClaimLLMSlot('college-2', 500);
    expect(expireMock).toHaveBeenCalledTimes(1); // still only once
  });

  it('denies slot when over cap AND rolls back the counter', async () => {
    incrMock.mockResolvedValueOnce(501);
    const r = await tryClaimLLMSlot('college-3', 500);
    expect(r.allowed).toBe(false);
    expect(r.count).toBe(500); // rolled back so concurrent reads see the cap
    expect(decrMock).toHaveBeenCalledTimes(1);
  });

  it('uses an isolated key per (college, day)', async () => {
    incrMock.mockResolvedValueOnce(1);
    await tryClaimLLMSlot('college-A', 500, new Date('2026-05-14T10:00:00Z'));
    const keyA = incrMock.mock.calls[0]![0] as string;

    incrMock.mockResolvedValueOnce(1);
    await tryClaimLLMSlot('college-B', 500, new Date('2026-05-14T10:00:00Z'));
    const keyB = incrMock.mock.calls[1]![0] as string;

    incrMock.mockResolvedValueOnce(1);
    await tryClaimLLMSlot('college-A', 500, new Date('2026-05-15T10:00:00Z'));
    const keyADay2 = incrMock.mock.calls[2]![0] as string;

    expect(keyA).not.toBe(keyB);
    expect(keyA).not.toBe(keyADay2);
    expect(keyA).toContain('college-A');
    expect(keyA).toContain('2026-05-14');
  });

  it('returns allowed=false when redis throws (fail-closed for safety)', async () => {
    incrMock.mockRejectedValueOnce(new Error('redis down'));
    const r = await tryClaimLLMSlot('college-4', 500);
    expect(r.allowed).toBe(false);
    expect(r.error).toBeDefined();
  });
});
