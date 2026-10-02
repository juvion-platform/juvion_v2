import rateLimit from 'express-rate-limit';
import { Request, RequestHandler } from 'express';

/**
 * Notification receipts are session-less, HMAC-gated and arrive in bursts (one per
 * phone after an Urgent push, mostly from one campus NAT), so they skip the global
 * per-IP cap; their own `receiptsLimiter` (juvi-app/middleware/rate-limits.ts) applies.
 */
export const RECEIPTS_PATH = '/api/juvi-app/v1/notifications/receipts';

export const skipGlobalRateLimit = (req: Request): boolean => req.path === RECEIPTS_PATH;

/** The app-wide per-IP limit, mounted at the root of app.ts. */
export function globalRateLimit(max: number): RequestHandler {
  return rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false, skip: skipGlobalRateLimit });
}
