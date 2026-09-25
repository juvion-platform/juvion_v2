import { Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { objectId } from '../accounts/schemas';
import * as spaces from './spaces-service';

export async function listSpaces(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.listSpaces(requireMobile(req))); } catch (e) { next(e); }
}
export async function getChannel(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.getChannel(requireMobile(req), objectId.parse(req.params.id))); } catch (e) { next(e); }
}
export async function mute(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.setMute(requireMobile(req), objectId.parse(req.params.id), true)); } catch (e) { next(e); }
}
export async function unmute(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.setMute(requireMobile(req), objectId.parse(req.params.id), false)); } catch (e) { next(e); }
}
export async function markRead(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.markRead(requireMobile(req), objectId.parse(req.params.id))); } catch (e) { next(e); }
}
