import { describe, it, expect, vi, beforeEach } from 'vitest';

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), incr: vi.fn(), expire: vi.fn(), ttl: vi.fn(), del: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));

import {
  deletionVerifyKey, getDeletionVerifyDelayMs, recordDeletionVerifyFailure, clearDeletionVerifyFailures,
  DELETION_VERIFY_MAX_FREE_ATTEMPTS, DELETION_VERIFY_MAX_DELAY_MS,
} from '../deletion-verify-budget';
import { getCooldown, cooldownKey } from '../cooldown';

beforeEach(() => vi.clearAllMocks());

const keysUsed = () => [...redisMock.get.mock.calls, ...redisMock.incr.mock.calls, ...redisMock.del.mock.calls].map((c) => String(c[0]));

/**
 * 011-account-deletion T8(b) — Story 3 AC6: the public verification's per-identifier control.
 *
 * This is **not** a limiter, and the difference is the whole point. Sign-in's cooldown is a hard
 * block read *before* any credential check, so reusing it here would let an unauthenticated
 * attacker lock a victim out of the app with five bogus deletion requests — and would let a user's
 * own typo do the same. So this budget has no verdict at all: its only output is a number of
 * milliseconds to wait. A hard block is unrepresentable, which is stronger than a rule against one.
 *
 * It also has its own key namespace, so it can never spend the sign-in lockout budget.
 */
describe('deletion-verify budget (011 T8)', () => {
  it('keys by college and a hash of the identifier, never the identifier', () => {
    const k = deletionVerifyKey('c1', '21CS1042');
    expect(k).toMatch(/^juvi:deletion-verify:c1:[0-9a-f]{64}$/);
    expect(k).toBe(deletionVerifyKey('c1', '21cs1042'));
    expect(k).not.toContain('21CS1042');
    // Key-disjoint from the sign-in budget by construction, not by discipline.
    expect(k).not.toBe(cooldownKey('c1', '21CS1042'));
  });

  it('waits for no one below the free-attempt threshold', async () => {
    redisMock.get.mockResolvedValue(String(DELETION_VERIFY_MAX_FREE_ATTEMPTS - 1));
    expect(await getDeletionVerifyDelayMs('c1', 'x')).toBe(0);
  });

  it('backs off once the threshold is met, and caps rather than growing without bound', async () => {
    const delayAt = async (n: number) => { redisMock.get.mockResolvedValue(String(n)); return getDeletionVerifyDelayMs('c1', 'x'); };

    const first = await delayAt(DELETION_VERIFY_MAX_FREE_ATTEMPTS);
    const second = await delayAt(DELETION_VERIFY_MAX_FREE_ATTEMPTS + 1);
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);

    // Growth is capped: an attacker must not be able to park a request open indefinitely.
    expect(await delayAt(50)).toBe(DELETION_VERIFY_MAX_DELAY_MS);
    expect(await delayAt(5_000)).toBe(DELETION_VERIFY_MAX_DELAY_MS);
  });

  it('has no way to refuse: the worst case is a bounded wait, and Redis being down is no wait at all', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));
    expect(await getDeletionVerifyDelayMs('c1', 'x')).toBe(0);

    // Fail-open on the write too — a counter that cannot be written must not fail the request.
    redisMock.incr.mockRejectedValue(new Error('down'));
    await expect(recordDeletionVerifyFailure('c1', 'x')).resolves.toBeUndefined();
  });

  it('increments its own counter and sets the window only on the first failure', async () => {
    redisMock.incr.mockResolvedValue(1);
    await recordDeletionVerifyFailure('c1', 'x');
    expect(redisMock.expire).toHaveBeenCalledWith(expect.stringMatching(/^juvi:deletion-verify:/), expect.any(Number));

    redisMock.incr.mockResolvedValue(2); redisMock.expire.mockClear();
    await recordDeletionVerifyFailure('c1', 'x');
    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('clears its own counter on a success', async () => {
    await clearDeletionVerifyFailures('c1', 'x');
    expect(redisMock.del).toHaveBeenCalledWith(deletionVerifyKey('c1', 'x'));
  });

  it('leaves the sign-in lockout budget untouched after five failed verifications', async () => {
    redisMock.incr.mockResolvedValue(1);
    for (let i = 0; i < 5; i++) await recordDeletionVerifyFailure('c1', 'victim@x.test');

    // The assertion that matters: not one write landed in the sign-in namespace, so the victim can
    // still sign in to their own app.
    expect(keysUsed().length).toBeGreaterThan(0);
    expect(keysUsed().every((k) => k.startsWith('juvi:deletion-verify:'))).toBe(true);
    expect(keysUsed().some((k) => k.startsWith('juvi:login-fail:'))).toBe(false);
    expect(await getCooldown('c1', 'victim@x.test')).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });
});
