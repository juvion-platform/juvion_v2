import { Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { settingsPatchSchema, onboardingAdvanceSchema, objectId } from './schemas';
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
