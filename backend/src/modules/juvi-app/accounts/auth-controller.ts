import { Request, Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { signInSchema, refreshSchema, changePasswordSchema } from './schemas';
import * as auth from './auth-service';

export async function signIn(req: Request, res: Response, next: NextFunction) {
  try { res.json(await auth.signIn(signInSchema.parse(req.body))); } catch (e) { next(e); }
}
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try { res.json(await auth.refresh(refreshSchema.parse(req.body))); } catch (e) { next(e); }
}
export async function signOut(req: MobileRequest, res: Response, next: NextFunction) {
  try { await auth.signOut(requireMobile(req)); res.status(204).end(); } catch (e) { next(e); }
}
export async function changePassword(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const body = changePasswordSchema.parse(req.body);
    await auth.changePassword(requireMobile(req), body.currentPassword, body.newPassword);
    res.status(204).end();
  } catch (e) { next(e); }
}
