import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
const sessionMock = vi.hoisted(() => ({ findById: vi.fn(), updateOne: vi.fn(), updateMany: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn(), findOne: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));
vi.mock('../../../../models/juvi/MobileSession', () => ({ MobileSession: sessionMock }));

import { signAccessToken, verifyAccessToken, hashRefreshToken, newRefreshToken, getSessionState, revokeSession } from '../session-service';
import { MobileApiError } from '../../errors';

const claims = { sub: 'u1', sid: 's1', aid: 'a1', cid: 'c1', role: 'student', kind: 'student' as const };
beforeEach(() => { vi.clearAllMocks(); process.env.JWT_SECRET = 'test-secret'; redisMock.set.mockResolvedValue('OK'); });

describe('access tokens', () => {
  it('signs a 15-minute HS256 token with typ mobile', () => {
    const token = signAccessToken(claims);
    const decoded = jwt.verify(token, 'test-secret') as any;
    expect(decoded.typ).toBe('mobile');
    expect(decoded.exp - decoded.iat).toBe(900);
    expect(verifyAccessToken(token)).toMatchObject({ ...claims, typ: 'mobile' });
  });

  it('rejects ERP tokens without typ mobile', () => {
    const erp = jwt.sign({ id: 'u1', role: 'admin' }, 'test-secret');
    expect(() => verifyAccessToken(erp)).toThrow(MobileApiError);
    try { verifyAccessToken(erp); } catch (e) { expect((e as MobileApiError).code).toBe('SESSION_INVALIDATED'); }
  });

  it('maps expiry to TOKEN_EXPIRED', () => {
    const expired = jwt.sign({ ...claims, typ: 'mobile' }, 'test-secret', { expiresIn: -10 });
    try { verifyAccessToken(expired); throw new Error('no throw'); } catch (e) { expect((e as MobileApiError).code).toBe('TOKEN_EXPIRED'); }
  });
});

describe('refresh tokens', () => {
  it('are 43-char base64url strings hashed with sha256', () => {
    const t = newRefreshToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashRefreshToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(t)).toBe(hashRefreshToken(t));
  });
});

describe('session state cache', () => {
  it('returns active from cache without Mongo', async () => {
    redisMock.get.mockResolvedValue('active');
    expect(await getSessionState('s1')).toEqual({ state: 'active' });
    expect(sessionMock.findById).not.toHaveBeenCalled();
  });

  it('returns revoked reason from cache', async () => {
    redisMock.get.mockResolvedValue('revoked:password_changed');
    expect(await getSessionState('s1')).toEqual({ state: 'revoked', reason: 'password_changed' });
  });

  it('on miss loads Mongo, caches active for 60 s', async () => {
    redisMock.get.mockResolvedValue(null);
    sessionMock.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: 's1', revokedAt: null }) }) });
    expect(await getSessionState('s1')).toEqual({ state: 'active' });
    expect(redisMock.set).toHaveBeenCalledWith('juvi:sess:s1', 'active', 'EX', 60);
  });

  it('on miss with a revoked row caches revoked for 900 s', async () => {
    redisMock.get.mockResolvedValue(null);
    sessionMock.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: 's1', revokedAt: new Date(), revokedReason: 'admin' }) }) });
    expect(await getSessionState('s1')).toEqual({ state: 'revoked', reason: 'admin' });
    expect(redisMock.set).toHaveBeenCalledWith('juvi:sess:s1', 'revoked:admin', 'EX', 900);
  });

  it('revokeSession writes Mongo then Redis synchronously', async () => {
    sessionMock.updateOne.mockResolvedValue({ modifiedCount: 1 });
    await revokeSession('s1', 'sign_out');
    expect(sessionMock.updateOne).toHaveBeenCalledWith({ _id: 's1', revokedAt: null }, { $set: { revokedAt: expect.any(Date), revokedReason: 'sign_out' } });
    expect(redisMock.set).toHaveBeenCalledWith('juvi:sess:s1', 'revoked:sign_out', 'EX', 900);
  });

  it('falls back to Mongo when Redis is down', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));
    sessionMock.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: 's1', revokedAt: null }) }) });
    expect(await getSessionState('s1')).toEqual({ state: 'active' });
  });
});
