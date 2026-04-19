import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

/**
 * Per-user rate-limit factory.
 *
 * Wraps `express-rate-limit` with:
 *   - Per-user keyGenerator (keyed on req.user.id, NOT IP)
 *   - JSON 429 response shape: { error: 'rate_limited', retryAfter: <seconds> }
 *   - Pass-through when req.user is unset (unauthenticated paths fall
 *     back to the global per-IP limit in app.ts — this middleware is
 *     intended to layer on top of, not replace, that backstop)
 *
 * Usage:
 *   router.get('/search',
 *     authenticate,
 *     authorize('people', 'read'),
 *     createUserRateLimit({ max: 60, windowMs: 60_000 }),
 *     validate(searchQuerySchema, 'query'),
 *     searchController,
 *   );
 */

export interface UserRateLimitOptions {
  max: number;       // max requests per user per window
  windowMs: number;  // window size in milliseconds
}

interface ReqWithUser {
  user?: { id?: string };
}

export function createUserRateLimit(
  opts: UserRateLimitOptions,
): (req: Request, res: Response, next: NextFunction) => void {
  const limiter = rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      const userId = (req as unknown as ReqWithUser).user?.id;
      // If no user (pre-auth or public route), return a constant key
      // combined with IP so we don't share a single unauth bucket across
      // everyone on the internet. See pass-through branch below.
      return userId ?? `__unauth_${req.ip ?? 'unknown'}`;
    },
    // Don't count requests that we deliberately skip (unauth path).
    skip: (req: Request): boolean => {
      return !(req as unknown as ReqWithUser).user?.id;
    },
    handler: (_req: Request, res: Response, _next: NextFunction, options: Options): void => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      res.status(429).json({
        error: 'rate_limited',
        message: `Too many requests. Retry in ${retryAfter}s.`,
        retryAfter,
      });
    },
  });

  return limiter;
}
