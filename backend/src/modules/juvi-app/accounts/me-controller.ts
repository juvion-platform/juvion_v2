import { Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { settingsPatchSchema, onboardingAdvanceSchema, objectId } from './schemas';
import { runAccountDeletion, cancelDeletionRequest } from './deletion-service';
import * as me from './me-service';

export async function getMe(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await me.getMe(requireMobile(req))); } catch (e) { next(e); }
}
export async function getSettings(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await me.getSettings(requireMobile(req))); } catch (e) { next(e); }
}
export async function patchSettings(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await me.updateSettings(requireMobile(req), settingsPatchSchema.parse(req.body))); } catch (e) { next(e); }
}
export async function advanceOnboarding(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await me.advanceOnboarding(requireMobile(req), onboardingAdvanceSchema.parse(req.body).step)); } catch (e) { next(e); }
}
export async function listDevices(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json({ items: await me.listDevices(requireMobile(req)) }); } catch (e) { next(e); }
}
export async function revokeDevice(req: MobileRequest, res: Response, next: NextFunction) {
  try { await me.revokeDevice(requireMobile(req), objectId.parse(req.params.id)); res.status(204).end(); } catch (e) { next(e); }
}
export async function revokeOtherDevices(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json({ revoked: await me.revokeOtherDevices(requireMobile(req)) }); } catch (e) { next(e); }
}
export async function uploadPhoto(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new MobileApiError(400, 'VALIDATION_FAILED', 'No file uploaded');
    res.json(await me.uploadMyPhoto(requireMobile(req), req.file.buffer, req.file.mimetype));
  } catch (e) { next(e); }
}
/**
 * `DELETE /v1/me/account` (011 T5) — the in-app delete. The account comes from the JWT and
 * nowhere else (Story 2 AC1), so the re-read is scoped by the `collegeId` the token carries.
 *
 * Deliberately unconditional: no grace-period check, no `deletionClaimedAt` consultation, no
 * look at `User.isActive`. A pending public request collapses the window rather than blocking
 * this call (plan §7), and an ERP login the college disabled is not a reason to strand the
 * Juvi account.
 */
export async function deleteAccount(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    const account = await JuviAccount.findOne({ _id: ctx.accountId, collegeId: ctx.collegeId });
    if (!account) throw new MobileApiError(404, 'NOT_FOUND', 'Account not found');
    await runAccountDeletion(account);
    res.status(204).end();
  } catch (e) { next(e); }
}
/** `DELETE /v1/me/account/deletion-request` (011 T6) — the explicit *Cancel deletion* action. */
export async function cancelDeletion(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    await cancelDeletionRequest(ctx.collegeId, ctx.accountId);
    res.status(204).end();
  } catch (e) { next(e); }
}
