import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../../../models/User';
import { JuviAccount, IJuviAccount } from '../../../models/juvi/JuviAccount';
import { MobileApiError } from '../errors';
import { MobileContext } from '../middleware/authenticate-mobile';
import { getJuviConfig } from '../config/institution-config';
import { resolveIdentifierToUser } from './identifier-resolver';
import { getCooldown, recordFailure, clearFailures } from './cooldown';
import { createSession, rotateSession, revokeSession, revokeOtherSessions, signAccessToken, SessionTokens } from './session-service';
import { SignInInput, AccountSummary, signInResponseSchema } from './schemas';
import { ONBOARDING_STEPS } from './onboarding';

/** bcrypt work happens even when no user matched, so timing does not reveal existence. */
const DUMMY_HASH = bcrypt.hashSync('juvi-dummy-password-for-timing', 10);
const invalidCredentials = () => new MobileApiError(401, 'INVALID_CREDENTIALS', 'That identifier or password is not right.');

export function accountSummary(account: IJuviAccount, user: { mustChangePassword?: boolean }): AccountSummary {
  return {
    id: String(account._id),
    kind: account.kind,
    status: account.status,
    onboardingStep: account.onboardingStep,
    onboardingSteps: [...ONBOARDING_STEPS],
    onboardingComplete: Boolean(account.onboardingCompletedAt),
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

export async function signIn(input: SignInInput): Promise<z.infer<typeof signInResponseSchema>> {
  const cooldown = await getCooldown(input.collegeId, input.identifier);
  if (cooldown.blocked) {
    throw new MobileApiError(429, 'COOLDOWN', `Too many attempts. Try again in ${Math.ceil(cooldown.retryAfterSeconds / 60)} minutes.`, { retryAfterSeconds: cooldown.retryAfterSeconds });
  }

  // Ruling R2: an unknown college (no College document) must be indistinguishable from a wrong
  // password — generic 401, not the 503 that a known-but-disabled institution gets.
  const cfg = await getJuviConfig(input.collegeId);
  if (!cfg) {
    await recordFailure(input.collegeId, input.identifier);
    throw invalidCredentials();
  }
  if (!cfg.enabled) {
    throw new MobileApiError(503, 'INSTITUTION_PAUSED', 'Juvi is not available for your institution right now.', { message: 'Juvi is not available for your institution right now.' });
  }

  const user = await resolveIdentifierToUser(input.collegeId, input.identifier);
  const account = user ? await JuviAccount.findOne({ collegeId: input.collegeId, userId: user._id }) : null;
  const ok = await bcrypt.compare(input.password, user?.password ?? DUMMY_HASH);

  if (!user || !account || !ok) {
    await recordFailure(input.collegeId, input.identifier);
    if (user && !account) console.warn('[juvi-app] sign-in for a user without a JuviAccount', { userId: String(user._id) });
    throw invalidCredentials();
  }
  if (account.status === 'deactivated' || !user.isActive) {
    throw new MobileApiError(403, 'ACCOUNT_DEACTIVATED', 'This account is no longer active at your institution.', { supportContact: cfg.supportContact ?? null });
  }

  await clearFailures(input.collegeId, input.identifier);
  const { tokens } = await createSession({
    collegeId: input.collegeId, accountId: String(account._id), userId: String(user._id),
    role: user.role, kind: account.kind, device: input.device,
  });
  return { ...tokens, account: accountSummary(account, user) };
}

export async function refresh(input: { refreshToken: string; deviceId: string }): Promise<SessionTokens> {
  // rotateSession needs role/kind for the token it signs, but those are authoritative on the
  // account and user, not on the caller. Rotate first (validates + swaps the hash), then re-sign
  // the access token with the real values.
  const { session, tokens } = await rotateSession(input.refreshToken, input.deviceId, { role: 'pending', kind: 'student' });
  // Ruling R10: every read of an ERP/Juvi document by id is scoped by collegeId.
  const account = await JuviAccount.findOne({ _id: session.accountId, collegeId: session.collegeId }).select('kind').lean();
  const user = await User.findOne({ _id: session.userId, collegeId: session.collegeId }).select('role').lean();
  if (!account || !user) throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  return {
    ...tokens,
    accessToken: signAccessToken({ sub: String(session.userId), sid: String(session._id), aid: String(session.accountId), cid: String(session.collegeId), role: user.role, kind: account.kind }),
  };
}

export async function signOut(ctx: MobileContext): Promise<void> {
  await revokeSession(ctx.sessionId, 'sign_out');
}

export async function changePassword(ctx: MobileContext, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findOne({ _id: ctx.userId, collegeId: ctx.collegeId });
  if (!user) throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw new MobileApiError(401, 'INVALID_CREDENTIALS', 'Your current password is not right.');
  user.password = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeOtherSessions(ctx.accountId, ctx.sessionId, 'password_changed');
}
