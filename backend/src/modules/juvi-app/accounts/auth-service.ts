import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, IUser } from '../../../models/User';
import { JuviAccount, IJuviAccount } from '../../../models/juvi/JuviAccount';
import { MobileApiError } from '../errors';
import { MobileContext } from '../middleware/authenticate-mobile';
import { getJuviConfig } from '../config/institution-config';
import { resolveIdentifierToUser } from './identifier-resolver';
import { getCooldown, recordFailure, clearFailures } from './cooldown';
import { createSession, findRotatableSession, rotateSession, revokeSession, revokeOtherSessions, signAccessToken, SessionTokens } from './session-service';
import { clearDeletionRequestBestEffort } from './deletion-service';
import { SignInInput, AccountSummary, signInResponseSchema } from './schemas';
import { ONBOARDING_STEPS } from './onboarding';

/** bcrypt work happens even when no user matched, so timing does not reveal existence. */
const DUMMY_HASH = bcrypt.hashSync('juvi-dummy-password-for-timing', 10);
const invalidCredentials = () => new MobileApiError(401, 'INVALID_CREDENTIALS', 'That identifier or password is not right.');
const DEACTIVATED_MESSAGE = 'This account is no longer active at your institution.';

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

/**
 * The credential chain, read-only (011 T7, Story 3 AC2).
 *
 * `signIn` and the public deletion page share exactly this much and no more: the web form cannot
 * call `signIn`, which creates a `MobileSession` and needs a `device` payload it cannot supply.
 *
 * **Read-only is the contract, and it cuts three ways:** no `MobileSession`, no tokens, and no
 * `getCooldown`/`recordFailure` — a failing caller must not be able to spend the owner's sign-in
 * lockout budget, which is the difference between a rate limit and a way to lock someone out of
 * their own app (Story 3 AC6). The caller owns the institution check, the lockout and the session.
 *
 * One generic 401 for every failure mode — unknown identifier, wrong password, no Juvi account —
 * and `bcrypt.compare` runs against `DUMMY_HASH` when nothing matched, so the work is the same
 * either way and the response cannot be used to enumerate identifiers.
 */
export async function verifyCredentials(
  collegeId: string,
  identifier: string,
  password: string,
): Promise<{ user: IUser; account: IJuviAccount }> {
  const user = await resolveIdentifierToUser(collegeId, identifier);
  const account = user ? await JuviAccount.findOne({ collegeId, userId: user._id }) : null;
  const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

  if (!user || !account || !ok) {
    if (user && !account) console.warn('[juvi-app] credentials verified for a user without a JuviAccount', { userId: String(user._id) });
    throw invalidCredentials();
  }
  return { user, account };
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
  if (cfg.paused) {
    throw new MobileApiError(503, 'INSTITUTION_PAUSED', cfg.pausedMessage ?? 'Juvi is paused.', { message: cfg.pausedMessage ?? 'Juvi is paused.' });
  }

  // The verification itself is side-effect free; the lockout budget is sign-in's own concern, so a
  // failed attempt is charged here rather than inside the shared chain.
  let verified: { user: IUser; account: IJuviAccount };
  try {
    verified = await verifyCredentials(input.collegeId, input.identifier, input.password);
  } catch (e) {
    await recordFailure(input.collegeId, input.identifier);
    throw e;
  }
  const { user, account } = verified;
  if (account.status === 'deactivated' || !user.isActive) {
    throw new MobileApiError(403, 'ACCOUNT_DEACTIVATED', DEACTIVATED_MESSAGE, { supportContact: cfg.supportContact ?? null });
  }

  await clearFailures(input.collegeId, input.identifier);
  const { tokens } = await createSession({
    collegeId: input.collegeId, accountId: String(account._id), userId: String(user._id),
    role: user.role, kind: account.kind, device: input.device,
  });
  // Story 4 AC1's safety net: holding the password again is independent evidence of ownership, so
  // any pending public deletion request is dropped. Best-effort — it can never fail the sign-in.
  await clearDeletionRequestBestEffort(input.collegeId, String(account._id));
  return { ...tokens, account: accountSummary(account, user) };
}

export async function refresh(input: { refreshToken: string; deviceId: string }): Promise<SessionTokens> {
  // rotateSession needs role/kind for the token it signs, but those are authoritative on the
  // account and user, not on the caller. Rotate first (validates + swaps the hash), then re-sign
  // the access token with the real values.
  // A disabled ERP login is refused BEFORE rotation, so the client keeps its token and gets the
  // deactivation reason rather than losing the old token with no new one (review M6 shape).
  const live = await findRotatableSession(input.refreshToken, input.deviceId);
  if (live) {
    const owner = await User.findOne({ _id: live.userId, collegeId: live.collegeId }).select('isActive').lean();
    if (owner && owner.isActive === false) {
      const cfg = await getJuviConfig(String(live.collegeId));
      throw new MobileApiError(403, 'ACCOUNT_DEACTIVATED', DEACTIVATED_MESSAGE, { supportContact: cfg?.supportContact ?? null });
    }
  }
  const { session, tokens } = await rotateSession(input.refreshToken, input.deviceId, { role: 'pending', kind: 'student' });
  // Ruling R10: every read of an ERP/Juvi document by id is scoped by collegeId.
  const account = await JuviAccount.findOne({ _id: session.accountId, collegeId: session.collegeId }).select('kind').lean();
  const user = await User.findOne({ _id: session.userId, collegeId: session.collegeId }).select('role isActive').lean();
  if (!account || !user) throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  // Race backstop: deactivated between the pre-check and the rotation.
  if (user.isActive === false) throw new MobileApiError(403, 'ACCOUNT_DEACTIVATED', DEACTIVATED_MESSAGE);
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
  // Story 4 AC1's second safety net, same shape and same reasoning as the sign-in clear: knowing
  // the current password and choosing a new one is an even stronger statement of ownership.
  await clearDeletionRequestBestEffort(ctx.collegeId, ctx.accountId);
}
