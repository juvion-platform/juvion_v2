import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';

const disabled = () =>
  process.env.E2E_TESTING === '1' || process.env.E2E_TESTING === 'true' || process.env.NODE_ENV === 'test';

function limiter(max: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: disabled,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'COOLDOWN', message: 'Too many requests. Try again in a minute.', retryAfterSeconds: 60 } });
    },
  });
}

/** 10 sign-in attempts per minute per IP, on top of the per-identifier cooldown. */
export const signInLimiter = limiter(10);
/** 20 institution lookups per minute per IP. */
export const institutionLookupLimiter = limiter(20);
