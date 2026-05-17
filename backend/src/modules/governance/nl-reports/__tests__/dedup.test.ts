import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 003-nl-report-queries Task 3.4 — Redis 30s SETEX dedup.
 * 004-rbac-nl-queries §10.4 — scope-fingerprint extension.
 *
 * Mock the redis singleton; verify key shape, TTL, cache miss/hit
 * semantics, AND the §10.4 scope-fingerprint property: same scope
 * inputs share, different scope inputs differ.
 */

const { getMock, setexMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setexMock: vi.fn().mockResolvedValue('OK'),
}));

vi.mock('../../../../config/redis', () => ({
  default: { get: getMock, setex: setexMock },
}));

import {
  getCachedNlQuery,
  setCachedNlQuery,
  scopeFingerprint,
  DEDUP_TTL_SECONDS,
  type DedupContext,
} from '../dedup';
import type { AuthScope } from '../../../../shared/rbac/types';

beforeEach(() => {
  getMock.mockReset();
  setexMock.mockClear();
});

// Helper: admin-equivalent scope context.
function adminCtx(): DedupContext {
  const authScope: AuthScope = {
    departmentOnly: false,
    selfOnly: false,
    userId: 'admin-user',
    resolvedPermissions: [],
  };
  return { role: 'admin', personaType: 'L-ADM', authScope };
}

function hodCtx(opts: { departmentId: string; userId?: string; personaType?: string }): DedupContext {
  return {
    role: 'hod',
    personaType: opts.personaType ?? 'F-HOD',
    authScope: {
      departmentOnly: true,
      selfOnly: false,
      departmentId: opts.departmentId,
      userId: opts.userId ?? 'hod-user',
      resolvedPermissions: [],
    },
  };
}

function counsellorCtx(userId: string): DedupContext {
  return {
    role: 'staff',
    personaType: 'ST-ADM-AC',
    authScope: {
      departmentOnly: false,
      selfOnly: true,
      userId,
      // Note: personId intentionally undefined to exercise the §10.4
      // "fall back to userId" property — both counsellors below have
      // the same personId (undefined) but different userIds.
      resolvedPermissions: [],
    },
  };
}

describe('nl-reports/dedup — base behaviour', () => {
  it('returns null on miss', async () => {
    getMock.mockResolvedValueOnce(null);
    const r = await getCachedNlQuery('college-1', adminCtx(), 'what is the funnel');
    expect(r).toBeNull();
  });

  it('returns parsed JSON on hit', async () => {
    getMock.mockResolvedValueOnce(JSON.stringify({ status: 'matched', reportCode: 'x', costInr: 1 }));
    const r = await getCachedNlQuery('college-1', adminCtx(), 'what is the funnel');
    expect(r).toEqual({ status: 'matched', reportCode: 'x', costInr: 1 });
  });

  it('uses a key namespaced by college (different colleges → different keys)', async () => {
    getMock.mockResolvedValue(null);
    await getCachedNlQuery('college-A', adminCtx(), 'q');
    await getCachedNlQuery('college-B', adminCtx(), 'q');
    expect(getMock.mock.calls[0]![0]).not.toBe(getMock.mock.calls[1]![0]);
    expect(getMock.mock.calls[0]![0]).toContain('nl-report-dedup');
    expect(getMock.mock.calls[0]![0]).toContain('college-A');
    expect(getMock.mock.calls[1]![0]).toContain('college-B');
  });

  it('different questions → different keys', async () => {
    getMock.mockResolvedValue(null);
    await getCachedNlQuery('college-1', adminCtx(), 'september funnel');
    await getCachedNlQuery('college-1', adminCtx(), 'lead source for the year');
    expect(getMock.mock.calls[0]![0]).not.toBe(getMock.mock.calls[1]![0]);
  });

  it('set uses SETEX with the 30s TTL', async () => {
    await setCachedNlQuery('college-1', adminCtx(), 'q', { foo: 'bar' });
    const [key, ttl, value] = setexMock.mock.calls[0]!;
    expect(ttl).toBe(DEDUP_TTL_SECONDS);
    expect(DEDUP_TTL_SECONDS).toBe(30);
    expect(JSON.parse(String(value))).toEqual({ foo: 'bar' });
    expect(key).toContain('nl-report-dedup');
  });

  it('silently survives a redis-down get', async () => {
    getMock.mockRejectedValueOnce(new Error('redis down'));
    const r = await getCachedNlQuery('college-1', adminCtx(), 'q');
    expect(r).toBeNull();
  });

  it('silently survives a redis-down set', async () => {
    setexMock.mockRejectedValueOnce(new Error('redis down'));
    await expect(setCachedNlQuery('college-1', adminCtx(), 'q', { x: 1 })).resolves.toBeUndefined();
  });
});

describe('nl-reports/dedup — §10.4 scope-fingerprint properties', () => {
  it('same-dept HODs share a key (same authorized rows → same cached result)', async () => {
    getMock.mockResolvedValue(null);
    const ctxA = hodCtx({ departmentId: 'dept-X' });
    const ctxB = hodCtx({ departmentId: 'dept-X', userId: 'different-hod' });
    await getCachedNlQuery('college-1', ctxA, 'roster');
    await getCachedNlQuery('college-1', ctxB, 'roster');
    expect(getMock.mock.calls[0]![0]).toBe(getMock.mock.calls[1]![0]);
  });

  it('different-dept HODs get different keys', async () => {
    getMock.mockResolvedValue(null);
    await getCachedNlQuery('college-1', hodCtx({ departmentId: 'dept-X' }), 'roster');
    await getCachedNlQuery('college-1', hodCtx({ departmentId: 'dept-Y' }), 'roster');
    expect(getMock.mock.calls[0]![0]).not.toBe(getMock.mock.calls[1]![0]);
  });

  it('two counsellors with the same personId (undefined) but different userIds get different keys', async () => {
    getMock.mockResolvedValue(null);
    await getCachedNlQuery('college-1', counsellorCtx('counsellor-A'), 'my leads');
    await getCachedNlQuery('college-1', counsellorCtx('counsellor-B'), 'my leads');
    expect(getMock.mock.calls[0]![0]).not.toBe(getMock.mock.calls[1]![0]);
  });

  it('admin and HOD same college → different keys', async () => {
    getMock.mockResolvedValue(null);
    await getCachedNlQuery('college-1', adminCtx(), 'roster');
    await getCachedNlQuery('college-1', hodCtx({ departmentId: 'dept-X' }), 'roster');
    expect(getMock.mock.calls[0]![0]).not.toBe(getMock.mock.calls[1]![0]);
  });

  it('HOD and counsellor same college → different keys', async () => {
    getMock.mockResolvedValue(null);
    await getCachedNlQuery('college-1', hodCtx({ departmentId: 'dept-X' }), 'roster');
    await getCachedNlQuery('college-1', counsellorCtx('counsellor-A'), 'roster');
    expect(getMock.mock.calls[0]![0]).not.toBe(getMock.mock.calls[1]![0]);
  });

  it('scopeFingerprint is deterministic and pure', () => {
    const a = scopeFingerprint(hodCtx({ departmentId: 'dept-X' }));
    const b = scopeFingerprint(hodCtx({ departmentId: 'dept-X' }));
    expect(a).toBe(b);
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
  });
});
