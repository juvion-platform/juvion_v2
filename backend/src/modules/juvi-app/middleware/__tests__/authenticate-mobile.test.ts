import { describe, it, expect, vi, beforeEach } from 'vitest';

const sess = vi.hoisted(() => ({ verifyAccessToken: vi.fn(), getSessionState: vi.fn(), touchSession: vi.fn().mockResolvedValue(undefined) }));
const cfg = vi.hoisted(() => ({ getJuviConfig: vi.fn(), isVersionBelow: (c: string, m: string) => c < m }));
const account = vi.hoisted(() => ({ findById: vi.fn(), updateOne: vi.fn().mockResolvedValue({}) }));
const redisMock = vi.hoisted(() => ({ set: vi.fn().mockResolvedValue('OK') }));
vi.mock('../../accounts/session-service', () => sess);
vi.mock('../../config/institution-config', () => cfg);
vi.mock('../../../../models/juvi/JuviAccount', () => ({ JuviAccount: account }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));

import { authenticateMobile } from '../authenticate-mobile';
import { MobileApiError } from '../../errors';

const claims = { sub: 'u1', sid: 's1', aid: 'a1', cid: 'c1', role: 'student', kind: 'student', typ: 'mobile' };
const activeAccount = { _id: 'a1', collegeId: 'c1', status: 'active', kind: 'student', studentId: 'st1' };
const enabledCfg = { enabled: true, paused: false, minAppVersion: { android: '1.0.0' }, supportContact: { name: 'Office' } };

function req(headers: Record<string, string> = {}) {
  return { headers: { authorization: 'Bearer t', 'x-juvi-app-version': '1.0.0', 'x-juvi-platform': 'android', ...headers } } as any;
}
async function run(r: any) {
  const next = vi.fn();
  await authenticateMobile(r, {} as any, next);
  return next.mock.calls[0]?.[0] as MobileApiError | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  sess.verifyAccessToken.mockReturnValue(claims);
  sess.getSessionState.mockResolvedValue({ state: 'active' });
  account.findById.mockReturnValue({ lean: () => Promise.resolve(activeAccount) });
  cfg.getJuviConfig.mockResolvedValue(enabledCfg);
});

describe('authenticateMobile', () => {
  it('sets req.mobile and calls next with no error on the happy path', async () => {
    const r = req();
    expect(await run(r)).toBeUndefined();
    expect(r.mobile).toMatchObject({ userId: 'u1', accountId: 'a1', sessionId: 's1', collegeId: 'c1', kind: 'student', studentId: 'st1' });
  });

  it('401 SESSION_INVALIDATED missing when there is no bearer', async () => {
    const e = await run(req({ authorization: '' }));
    expect(e?.code).toBe('SESSION_INVALIDATED');
    expect(e?.detail).toEqual({ reason: 'missing' });
  });

  it('propagates TOKEN_EXPIRED from the verifier', async () => {
    sess.verifyAccessToken.mockImplementation(() => { throw new MobileApiError(401, 'TOKEN_EXPIRED', 'x'); });
    expect((await run(req()))?.code).toBe('TOKEN_EXPIRED');
  });

  it('401 with the revoke reason when the session is revoked', async () => {
    sess.getSessionState.mockResolvedValue({ state: 'revoked', reason: 'signed_out_elsewhere' });
    const e = await run(req());
    expect(e?.code).toBe('SESSION_INVALIDATED');
    expect(e?.detail).toEqual({ reason: 'signed_out_elsewhere' });
  });

  it('403 ACCOUNT_DEACTIVATED with support contact', async () => {
    account.findById.mockReturnValue({ lean: () => Promise.resolve({ ...activeAccount, status: 'deactivated' }) });
    const e = await run(req());
    expect(e?.statusCode).toBe(403);
    expect(e?.code).toBe('ACCOUNT_DEACTIVATED');
    expect(e?.detail).toEqual({ supportContact: { name: 'Office' } });
  });

  it('401 when the token college does not match the account', async () => {
    account.findById.mockReturnValue({ lean: () => Promise.resolve({ ...activeAccount, collegeId: 'other' }) });
    expect((await run(req()))?.code).toBe('SESSION_INVALIDATED');
  });

  it('503 INSTITUTION_PAUSED with the configured message', async () => {
    cfg.getJuviConfig.mockResolvedValue({ ...enabledCfg, paused: true, pausedMessage: 'Back Monday' });
    const e = await run(req());
    expect(e?.statusCode).toBe(503);
    expect(e?.detail).toEqual({ message: 'Back Monday' });
  });

  it('426 UPDATE_REQUIRED when below the platform minimum', async () => {
    cfg.getJuviConfig.mockResolvedValue({ ...enabledCfg, minAppVersion: { android: '1.2.0' } });
    const e = await run(req({ 'x-juvi-app-version': '1.1.0' }));
    expect(e?.statusCode).toBe(426);
    expect(e?.detail).toMatchObject({ minVersion: '1.2.0', storeUrl: expect.stringContaining('play.google.com') });
  });

  it('does not gate when the client sends no version header', async () => {
    cfg.getJuviConfig.mockResolvedValue({ ...enabledCfg, minAppVersion: { android: '9.0.0' } });
    expect(await run(req({ 'x-juvi-app-version': '' }))).toBeUndefined();
  });
});
