import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';
export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.list(req.collegeId!, Number(req.query.page) || 1)); } catch (err) { next(err); }
}
