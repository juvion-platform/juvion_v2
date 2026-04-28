/**
 * Tests for the `authenticate` middleware. Covers:
 *   - Dev bypass (NODE_ENV=development, no Authorization header)
 *   - Sentinel `req.user.id` is a 24-char ObjectId hex (not a string
 *     literal) so models that type `userId: ObjectId` (e.g.
 *     SituationDismissal, AgentAction) can cast it without throwing
 *   - Default DEV_COLLEGE_ID + x-college-id header override
 *   - JWT path: valid token → req.user + req.collegeId populated
 *   - JWT path: invalid token → 401
 *   - JWT path: super_admin with x-college-id → header wins
 *   - JWT path: non-super_admin with x-college-id → token wins
 *   - JWT path: missing collegeId for non-superadmin → 400
 *   - Production (NODE_ENV !== 'development') without token → 401
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

import { authenticate, AuthRequest } from '../authenticate';

// ── Helpers ────────────────────────────────────────────────────────────

function makeReq(opts: {
  headers?: Record<string, string | undefined>;
  query?: Record<string, string>;
} = {}): AuthRequest {
  return {
    headers: opts.headers ?? {},
    query: opts.query ?? {},
  } as unknown as AuthRequest;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  return res as unknown as { statusCode: number; body: unknown } & {
    status: (code: number) => unknown;
    json: (payload: unknown) => unknown;
  };
}

// Capture original env so we restore after each test
const ORIG_ENV = { ...process.env };
function resetEnv() {
  delete process.env.NODE_ENV;
  delete process.env.DEV_COLLEGE_ID;
  delete process.env.JWT_SECRET;
}

beforeEach(() => {
  resetEnv();
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

// ── Dev bypass ─────────────────────────────────────────────────────────

describe('authenticate — dev bypass', () => {
  it('NODE_ENV=development, no token → populates req.user with sentinel ObjectId-hex id', () => {
    process.env.NODE_ENV = 'development';
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user?.id).toBeDefined();
  });

  it('dev-user.id is a valid 24-char ObjectId hex string', () => {
    process.env.NODE_ENV = 'development';
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    authenticate(req, res as never, next);

    // The fix that prompted these tests: id MUST cast to ObjectId
    // without throwing so SituationDismissal / AgentAction writes
    // succeed in dev.
    const id = req.user!.id;
    expect(id).toMatch(/^[a-f0-9]{24}$/);
    expect(() => new Types.ObjectId(id)).not.toThrow();
  });

  it('dev-user.role is super_admin', () => {
    process.env.NODE_ENV = 'development';
    const req = makeReq();
    authenticate(req, makeRes() as never, vi.fn());
    expect(req.user?.role).toBe('super_admin');
  });

  it('uses DEV_COLLEGE_ID env default when no x-college-id header', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_COLLEGE_ID = '000000000000000000000042';
    const req = makeReq();
    authenticate(req, makeRes() as never, vi.fn());
    expect(req.collegeId).toBe('000000000000000000000042');
  });

  it('uses fallback collegeId when DEV_COLLEGE_ID is unset', () => {
    process.env.NODE_ENV = 'development';
    const req = makeReq();
    authenticate(req, makeRes() as never, vi.fn());
    expect(req.collegeId).toBe('000000000000000000000001');
  });

  it('x-college-id header overrides the env default in dev', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_COLLEGE_ID = '000000000000000000000042';
    const req = makeReq({ headers: { 'x-college-id': '000000000000000000000099' } });
    authenticate(req, makeRes() as never, vi.fn());
    expect(req.collegeId).toBe('000000000000000000000099');
  });

  it('dev bypass is SKIPPED if a Bearer token IS provided (falls through to JWT path)', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'test-secret';
    // Sign a real token so it passes the JWT verify
    const token = jwt.sign(
      { id: 'real-user-id', role: 'admin', collegeId: '000000000000000000000001', name: 'Real', email: 'r@x', personaType: 'L-ADMIN' },
      'test-secret',
    );
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn();
    authenticate(req, makeRes() as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.id).toBe('real-user-id');
  });
});

// ── JWT path ───────────────────────────────────────────────────────────

describe('authenticate — JWT path', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
  });

  it('valid token → req.user + req.collegeId populated, next() called', () => {
    const token = jwt.sign(
      { id: 'u1', role: 'admin', collegeId: 'c1', name: 'A', email: 'a@x', personaType: 'L-ADMIN' },
      'test-secret',
    );
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn();
    authenticate(req, makeRes() as never, next);
    expect(req.user?.id).toBe('u1');
    expect(req.collegeId).toBe('c1');
    expect(next).toHaveBeenCalledOnce();
  });

  it('missing token → 401', () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    authenticate(req, res as never, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('invalid token → 401', () => {
    const req = makeReq({ headers: { authorization: 'Bearer not-a-real-jwt' } });
    const res = makeRes();
    const next = vi.fn();
    authenticate(req, res as never, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('super_admin: x-college-id header overrides the token-encoded collegeId', () => {
    const token = jwt.sign(
      { id: 'u1', role: 'super_admin', collegeId: 'c1', name: 'A', email: 'a@x', personaType: 'L-ADMIN' },
      'test-secret',
    );
    const req = makeReq({
      headers: { authorization: `Bearer ${token}`, 'x-college-id': 'c2' },
    });
    authenticate(req, makeRes() as never, vi.fn());
    expect(req.collegeId).toBe('c2');
  });

  it('non-super_admin: x-college-id header is IGNORED (token wins)', () => {
    const token = jwt.sign(
      { id: 'u1', role: 'admin', collegeId: 'c1', name: 'A', email: 'a@x', personaType: 'L-ADMIN' },
      'test-secret',
    );
    const req = makeReq({
      headers: { authorization: `Bearer ${token}`, 'x-college-id': 'c2' },
    });
    authenticate(req, makeRes() as never, vi.fn());
    expect(req.collegeId).toBe('c1');
  });

  it('non-super_admin without collegeId in token → 400', () => {
    const token = jwt.sign(
      { id: 'u1', role: 'admin', name: 'A', email: 'a@x', personaType: 'L-ADMIN' },
      'test-secret',
    );
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = vi.fn();
    authenticate(req, res as never, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('super_admin without collegeId is allowed (for /colleges route etc.)', () => {
    const token = jwt.sign(
      { id: 'u1', role: 'super_admin', name: 'A', email: 'a@x', personaType: 'L-ADMIN' },
      'test-secret',
    );
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = vi.fn();
    authenticate(req, res as never, next);
    // collegeId stays undefined; next() still fires
    expect(req.collegeId).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});

// ── Production: dev bypass guard ──────────────────────────────────────

describe('authenticate — dev bypass disabled in production', () => {
  it('NODE_ENV=production, no token → 401 (no dev fallback)', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    authenticate(req, res as never, next);
    expect(res.statusCode).toBe(401);
    expect(req.user).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('NODE_ENV unset, no token → 401 (no dev fallback)', () => {
    process.env.JWT_SECRET = 'test-secret';
    const req = makeReq();
    const res = makeRes();
    authenticate(req, res as never, vi.fn());
    expect(res.statusCode).toBe(401);
  });
});
