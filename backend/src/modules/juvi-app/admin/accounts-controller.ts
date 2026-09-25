import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/authenticate';
import { deactivateAccount } from '../accounts/provisioning-service';
import { accountsQuerySchema, objectId } from './schemas';
import * as svc from './accounts-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

export async function listAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.listAccounts(req.collegeId!, accountsQuerySchema.parse(req.query))); } catch (e) { next(e); }
}
export async function deactivate(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await deactivateAccount(req.collegeId!, objectId.parse(req.params.id), 'admin', who(req))); } catch (e) { next(e); }
}
export async function resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.resetPassword(req.collegeId!, objectId.parse(req.params.id), who(req))); } catch (e) { next(e); }
}
export async function revealCredential(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.revealCredential(req.collegeId!, objectId.parse(req.params.id), who(req))); } catch (e) { next(e); }
}
