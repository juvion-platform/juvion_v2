import { Request, Response, NextFunction } from 'express';
import redis from '../../../config/redis';
import { JuviAccount, IJuviAccount, AccountKind } from '../../../models/juvi/JuviAccount';
import { verifyAccessToken, getSessionState, touchSession } from '../accounts/session-service';
import { getJuviConfig, isVersionBelow } from '../config/institution-config';
import { MobileApiError } from '../errors';

export interface MobileContext {
  userId: string;
  accountId: string;
  sessionId: string;
  collegeId: string;
  role: string;
  kind: AccountKind;
  studentId?: string;
  facultyId?: string;
  staffId?: string;
  account: IJuviAccount;
}

export interface MobileRequest extends Request { mobile?: MobileContext }

export const STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=in.juvion.juvi',
  // Set JUVI_IOS_STORE_URL once the iOS app is published (Plan 3 / sub-project 7).
  ios: process.env.JUVI_IOS_STORE_URL ?? 'https://apps.apple.com/',
};

const invalid = (reason: string) => new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason });

export async function authenticateMobile(req: MobileRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ') || header.length <= 7) throw invalid('missing');
    const claims = verifyAccessToken(header.slice(7));

    const state = await getSessionState(claims.sid);
    if (state.state !== 'active') throw invalid(state.state === 'revoked' ? state.reason : 'expired');

    const account = await JuviAccount.findById(claims.aid).lean();
    if (!account || String(account.collegeId) !== claims.cid) throw invalid('invalid');

    const cfg = await getJuviConfig(claims.cid);
    if (account.status === 'deactivated') {
      throw new MobileApiError(403, 'ACCOUNT_DEACTIVATED', 'This account is no longer active at your institution.', { supportContact: cfg?.supportContact ?? null });
    }
    if (!cfg || !cfg.enabled) {
      throw new MobileApiError(503, 'INSTITUTION_PAUSED', 'Juvi is not available for your institution right now.', { message: 'Juvi is not available for your institution right now.' });
    }
    if (cfg.paused) {
      throw new MobileApiError(503, 'INSTITUTION_PAUSED', cfg.pausedMessage ?? 'Juvi is paused.', { message: cfg.pausedMessage ?? 'Juvi is paused.' });
    }

    const platform = String(req.headers['x-juvi-platform'] ?? '') as 'android' | 'ios' | '';
    const version = String(req.headers['x-juvi-app-version'] ?? '');
    const min = platform ? cfg.minAppVersion?.[platform] : undefined;
    if (version && min && isVersionBelow(version, min)) {
      throw new MobileApiError(426, 'UPDATE_REQUIRED', 'Please update Juvi to continue.', { minVersion: min, storeUrl: STORE_URLS[platform || 'android'] });
    }

    req.mobile = {
      userId: claims.sub,
      accountId: String(account._id),
      sessionId: claims.sid,
      collegeId: claims.cid,
      role: claims.role,
      kind: account.kind,
      studentId: account.studentId ? String(account.studentId) : undefined,
      facultyId: account.facultyId ? String(account.facultyId) : undefined,
      staffId: account.staffId ? String(account.staffId) : undefined,
      account: account as unknown as IJuviAccount,
    };

    // Activity markers, at most once a minute, never blocking the request.
    void touchSession(claims.sid).catch(() => undefined);
    void touchAccount(String(account._id)).catch(() => undefined);
    next();
  } catch (e) {
    next(e);
  }
}

async function touchAccount(accountId: string): Promise<void> {
  try {
    const ok = await redis.set(`juvi:acct-touch:${accountId}`, '1', 'EX', 60, 'NX');
    if (ok !== 'OK') return;
  } catch { /* if Redis is down, just write */ }
  await JuviAccount.updateOne({ _id: accountId }, { $set: { lastSeenAt: new Date() } });
}

export function requireMobile(req: MobileRequest): MobileContext {
  if (!req.mobile) throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'missing' });
  return req.mobile;
}
