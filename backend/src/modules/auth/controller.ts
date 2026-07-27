import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../middleware/authenticate';
import redis from '../../config/redis';
import * as service from './service';

/**
 * Liveness/readiness probe.
 *
 * Two things this must never do, both of which it previously did:
 *
 * 1. **Reach for mongoose via `await import()`.** Under this workspace's
 *    CommonJS output, `__importStar` copies only own-enumerable properties
 *    onto the namespace, and mongoose exposes `connection` via the prototype
 *    — so `ns.connection` was `undefined` and `.readyState` threw. Static
 *    imports (as everywhere else in the codebase, e.g. config/db.ts) have no
 *    such hazard.
 *
 * 2. **Throw.** This is a bare async route handler, and Express 4 does not
 *    catch rejected promises from those — the rejection went unhandled and
 *    Node terminated the process. A health check that kills the server it is
 *    reporting on is worse than no health check: any orchestrator polling it
 *    would have held the service in a crash loop. Every probe is now inside
 *    a try/catch, and an unreachable dependency degrades the response rather
 *    than propagating.
 */
export async function health(_req: Request, res: Response) {
  let mongoOk = false;
  try {
    // 1 === connected (mongoose ConnectionStates).
    mongoOk = mongoose.connection?.readyState === 1;
  } catch {
    mongoOk = false;
  }

  let redisOk = false;
  try {
    await redis.ping();
    redisOk = true;
  } catch {
    redisOk = false;
  }

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
