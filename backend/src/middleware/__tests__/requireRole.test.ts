import { describe, it, expect, vi } from 'vitest';
import type { Response, NextFunction } from 'express';

import { requireRole } from '../requireRole';
import type { AuthRequest } from '../authenticate';

/**
 * 003-nl-report-queries Task 1.1 — declarative role-gate middleware.
 *
 * Covers spec §10.1:
 *   - 401 when no req.user
 *   - 403 when role not in the allow-list
 *   - next() when role is in the allow-list
 *   - works for both single-role and multi-role allow-lists
 */

function mockReq(user?: { role: string; id?: string }): AuthRequest {
  return { user } as unknown as AuthRequest;
}

function mockRes(): Response & { _status?: number; _body?: unknown } {
  const res: any = {};
  res.status = (code: number) => { res._status = code; return res; };
  res.json = (body: unknown) => { res._body = body; return res; };
  return res;
}

describe('requireRole', () => {
  it('responds 401 when there is no authenticated user', () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = vi.fn();
    requireRole(['admin'])(req, res, next as NextFunction);
    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when the role is not in the allow-list', () => {
    const req = mockReq({ role: 'staff' });
    const res = mockRes();
    const next = vi.fn();
    requireRole(['admin', 'super_admin'])(req, res, next as NextFunction);
    expect(res._status).toBe(403);
    expect(res._body).toEqual({ error: 'Required role missing' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the role matches', () => {
    const req = mockReq({ role: 'admin' });
    const res = mockRes();
    const next = vi.fn();
    requireRole(['admin', 'super_admin'])(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBeUndefined();
  });

  it('works for a single-role allow-list', () => {
    const req = mockReq({ role: 'super_admin' });
    const res = mockRes();
    const next = vi.fn();
    requireRole(['super_admin'])(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
  });

  it('readonly array is accepted (no `as const` needed at call site)', () => {
    const roles: ReadonlyArray<string> = ['admin'];
    const req = mockReq({ role: 'admin' });
    const res = mockRes();
    const next = vi.fn();
    requireRole(roles)(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
  });
});
