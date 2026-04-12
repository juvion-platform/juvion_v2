import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the engine and scope-resolver before importing authorize
vi.mock('../../shared/rbac/engine', () => ({
  evaluateAccess: vi.fn(),
}));
vi.mock('../../shared/rbac/scope-resolver', () => ({
  resolveUserScope: vi.fn().mockResolvedValue({}),
}));

import { authorize } from '../authorize';
import { evaluateAccess } from '../../shared/rbac/engine';
import { resolveUserScope } from '../../shared/rbac/scope-resolver';
import { Response, NextFunction } from 'express';

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1', name: 'Test', email: 'test@test.com', role: 'faculty', personaType: 'F-FAC' },
    collegeId: 'college1',
    ...overrides,
  } as any;
}

function mockRes(): Response {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  return res;
}

describe('authorize middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    process.env.RBAC_ENFORCE = 'true';
  });

  it('returns 401 if no user', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const mw = authorize('finance', 'read');
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access when policy evaluates to allow', async () => {
    const req = mockReq();
    const res = mockRes();
    (evaluateAccess as ReturnType<typeof vi.fn>).mockResolvedValue({ effect: 'allow', priority: 700 });
    const mw = authorize('academics', 'read');
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('denies access when policy evaluates to deny', async () => {
    const req = mockReq();
    const res = mockRes();
    (evaluateAccess as ReturnType<typeof vi.fn>).mockResolvedValue({ effect: 'deny', priority: 700 });
    const mw = authorize('finance', 'create');
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies access when no matching policy', async () => {
    const req = mockReq();
    const res = mockRes();
    (evaluateAccess as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const mw = authorize('hr', 'delete');
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows all when RBAC_ENFORCE is false', async () => {
    process.env.RBAC_ENFORCE = 'false';
    const req = mockReq();
    const res = mockRes();
    const mw = authorize('hr', 'delete');
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(evaluateAccess).not.toHaveBeenCalled();
  });

  it('attaches authScope when policy has scope constraints', async () => {
    const req = mockReq();
    const res = mockRes();
    (evaluateAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
      effect: 'allow',
      priority: 700,
      scope: { departmentOnly: true },
    });
    (resolveUserScope as ReturnType<typeof vi.fn>).mockResolvedValue({
      departmentId: 'dept1',
      personId: 'person1',
    });
    const mw = authorize('academics', 'read');
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.authScope).toBeDefined();
    expect(req.authScope.departmentOnly).toBe(true);
    expect(req.authScope.departmentId).toBe('dept1');
    expect(req.authScope.personId).toBe('person1');
  });
});
