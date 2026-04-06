import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, collegeId } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const cid = collegeId || req.headers['x-college-id'] as string || undefined;
    const result = await service.login(email, password, cid);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.getMe(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
