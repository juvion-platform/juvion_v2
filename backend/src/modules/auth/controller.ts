import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

export async function health(_req: Request, res: Response) {
  const mongoose = await import('mongoose');
  const redis = (await import('../../config/redis')).default;

  const mongoOk = mongoose.connection.readyState === 1;
  let redisOk = false;
  try {
    await redis.ping();
    redisOk = true;
  } catch (_e) { /* redis down */ }

  const status = mongoOk && redisOk ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    mongodb: mongoOk ? 'connected' : 'disconnected',
    redis: redisOk ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
  });
}

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

export async function refresh(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.refreshToken(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
