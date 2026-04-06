import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

export async function stats(_req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats()); } catch (err) { next(err); }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, status } = req.query as any;
    res.json(await service.listColleges(Number(page) || 1, Number(limit) || 20, search, status));
  } catch (err) { next(err); }
}

export async function get(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getCollege(req.params.id as string)); } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCollege(req.body, who(req))); } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateCollege(req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteCollege(req.params.id as string, who(req))); } catch (err) { next(err); }
}
