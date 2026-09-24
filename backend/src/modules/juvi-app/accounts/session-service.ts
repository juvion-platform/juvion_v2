import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import redis from '../../../config/redis';
import { MobileSession, IMobileSession, RevokeReason, MobilePlatform } from '../../../models/juvi/MobileSession';
import { AccountKind } from '../../../models/juvi/JuviAccount';
import { MobileApiError } from '../errors';

export const ACCESS_TOKEN_TTL_SECONDS = 900;
export const REFRESH_TOKEN_TTL_DAYS = 90;
const ACTIVE_CACHE_SECONDS = 60;
const REVOKED_CACHE_SECONDS = ACCESS_TOKEN_TTL_SECONDS;

export interface DeviceInfo { id: string; name: string; platform: MobilePlatform; appVersion: string; osVersion: string }
export interface MobileClaims { sub: string; sid: string; aid: string; cid: string; role: string; kind: AccountKind; typ: 'mobile' }
export interface SessionTokens { accessToken: string; accessExpiresIn: number; refreshToken: string }

const secret = () => process.env.JWT_SECRET || 'dev-secret';
const sessKey = (sid: string) => `juvi:sess:${sid}`;

export function signAccessToken(claims: Omit<MobileClaims, 'typ'>): string {
  return jwt.sign({ ...claims, typ: 'mobile' }, secret(), { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

export function verifyAccessToken(token: string): MobileClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, secret(), { algorithms: ['HS256'] });
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) throw new MobileApiError(401, 'TOKEN_EXPIRED', 'Your session needs refreshing.');
    throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  }
  const c = decoded as Partial<MobileClaims>;
  if (c.typ !== 'mobile' || !c.sub || !c.sid || !c.aid || !c.cid) {
    throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  }
  return c as MobileClaims;
}

export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000);
}

async function cacheState(sid: string, value: string, ttl: number): Promise<void> {
  try { await redis.set(sessKey(sid), value, 'EX', ttl); } catch { /* non-fatal */ }
}

function tokensFor(session: IMobileSession, role: string, kind: AccountKind, refreshToken: string): SessionTokens {
  return {
    accessToken: signAccessToken({ sub: String(session.userId), sid: String(session._id), aid: String(session.accountId), cid: String(session.collegeId), role, kind }),
    accessExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
  };
}

export async function createSession(input: {
  collegeId: string; accountId: string; userId: string; role: string; kind: AccountKind; device: DeviceInfo;
}): Promise<{ session: IMobileSession; tokens: SessionTokens }> {
  // One live session per device: replace an earlier one for the same device id.
  const previous = await MobileSession.find({ accountId: input.accountId, deviceId: input.device.id, revokedAt: null }).select('_id').lean();
  for (const p of previous) await revokeSession(String(p._id), 'sign_out');

  const refreshToken = newRefreshToken();
  const session = await MobileSession.create({
    collegeId: input.collegeId,
    accountId: input.accountId,
    userId: input.userId,
    deviceId: input.device.id,
    deviceName: input.device.name,
    platform: input.device.platform,
    appVersion: input.device.appVersion,
    osVersion: input.device.osVersion,
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshExpiresAt: refreshExpiry(),
    lastActiveAt: new Date(),
  });
  await cacheState(String(session._id), 'active', ACTIVE_CACHE_SECONDS);
  return { session, tokens: tokensFor(session, input.role, input.kind, refreshToken) };
}

/**
 * Rotate on refresh. The old hash is swapped atomically and remembered as
 * `previousRefreshTokenHash`. A later presentation of that old token is a
 * replay of a rotated token — the session is revoked (spec §8). The device id
 * never decides a revocation: it only has to match for a rotation to succeed.
 */
export async function rotateSession(
  refreshToken: string,
  deviceId: string,
  ctx: { role: string; kind: AccountKind },
): Promise<{ session: IMobileSession; tokens: SessionTokens }> {
  const oldHash = hashRefreshToken(refreshToken);
  const next = newRefreshToken();
  const now = new Date();
  const session = await MobileSession.findOneAndUpdate(
    { refreshTokenHash: oldHash, deviceId, revokedAt: null, refreshExpiresAt: { $gt: now } },
    { $set: { refreshTokenHash: hashRefreshToken(next), previousRefreshTokenHash: oldHash, refreshExpiresAt: refreshExpiry(), lastActiveAt: now } },
    { new: true },
  );
  if (session) {
    await cacheState(String(session._id), 'active', ACTIVE_CACHE_SECONDS);
    return { session, tokens: tokensFor(session, ctx.role, ctx.kind, next) };
  }

  // (a) The presented token is the previous token of a live session: replay of a rotated token.
  const replayed = await MobileSession.findOne({ previousRefreshTokenHash: oldHash, revokedAt: null }).select('_id').lean();
  if (replayed) {
    await revokeSession(String(replayed._id), 'token_reuse');
    throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'token_reuse' });
  }

  // (b)/(c) The presented token is the current token of a live session, but the primary query missed:
  // either it has expired, or it came from a different device id.
  const current = await MobileSession.findOne({ refreshTokenHash: oldHash, revokedAt: null }).select('_id deviceId refreshExpiresAt').lean();
  if (current) {
    if (current.refreshExpiresAt <= now) {
      await revokeSession(String(current._id), 'expired');
      throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'expired' });
    }
    // Device mismatch: refuse without revoking; a legitimate device still holds a valid token.
    throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  }

  // (d) Nobody knows this token: nothing to revoke.
  throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'expired' });
}

export async function revokeSession(sessionId: string, reason: RevokeReason): Promise<void> {
  await MobileSession.updateOne({ _id: sessionId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
  // Write-through so the very next request on that device sees it (spec §8).
  await cacheState(sessionId, `revoked:${reason}`, REVOKED_CACHE_SECONDS);
}

export async function revokeOtherSessions(accountId: string, keepSessionId: string | null, reason: RevokeReason): Promise<number> {
  const filter: Record<string, unknown> = { accountId, revokedAt: null };
  if (keepSessionId) filter._id = { $ne: keepSessionId };
  const others = await MobileSession.find(filter).select('_id').lean();
  for (const s of others) await revokeSession(String(s._id), reason);
  return others.length;
}

export async function getSessionState(sessionId: string): Promise<
  { state: 'active' } | { state: 'revoked'; reason: RevokeReason } | { state: 'missing' }
> {
  try {
    const cached = await redis.get(sessKey(sessionId));
    if (cached === 'active') return { state: 'active' };
    if (cached?.startsWith('revoked:')) return { state: 'revoked', reason: cached.slice('revoked:'.length) as RevokeReason };
  } catch { /* fall through to Mongo */ }

  const row = await MobileSession.findById(sessionId).select('revokedAt revokedReason').lean();
  if (!row) return { state: 'missing' };
  if (row.revokedAt) {
    const reason = (row.revokedReason ?? 'expired') as RevokeReason;
    await cacheState(sessionId, `revoked:${reason}`, REVOKED_CACHE_SECONDS);
    return { state: 'revoked', reason };
  }
  await cacheState(sessionId, 'active', ACTIVE_CACHE_SECONDS);
  return { state: 'active' };
}

/** lastActiveAt at most once a minute per session. */
export async function touchSession(sessionId: string): Promise<void> {
  try {
    const ok = await redis.set(`juvi:sess-touch:${sessionId}`, '1', 'EX', 60, 'NX');
    if (ok !== 'OK') return;
  } catch { /* if Redis is down, just write */ }
  await MobileSession.updateOne({ _id: sessionId }, { $set: { lastActiveAt: new Date() } });
}
