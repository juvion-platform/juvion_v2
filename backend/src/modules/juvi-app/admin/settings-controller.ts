import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/authenticate';
import * as settings from './settings-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

export async function getSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await settings.getSettings(req.collegeId!)); } catch (e) { next(e); }
}
export async function updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await settings.updateSettings(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
