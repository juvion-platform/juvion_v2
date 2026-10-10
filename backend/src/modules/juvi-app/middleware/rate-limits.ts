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
/**
 * 5 account-deletion verifications per minute per IP (011 Story 3 AC3).
 *
 * Deliberately lower than the sign-in bucket: this route hands an unauthenticated caller a
 * password guess against a real `User`, and a page a person needs once has no legitimate reason to
 * be hit ten times a minute. It is IP-keyed through the same `trust proxy` setting as every other
 * limiter here, so a real deployment must set `TRUST_PROXY_HOPS` — unset means nginx's address is
 * the key and the whole campus shares one bucket. Per-identifier backoff is a separate, non-blocking
 * control (`accounts/deletion-verify-budget.ts`); this one must never become that.
 */
export const deletionVerifyLimiter = limiter(5);
/**
 * 1,200 notification receipt posts per minute per IP: the endpoint has no session
 * (notifications spec §7.2), and an Urgent push to a campus behind one NAT answers
 * in a burst. The global per-IP limit skips this path (middleware/globalRateLimit.ts).
 */
export const receiptsLimiter = limiter(1200);
