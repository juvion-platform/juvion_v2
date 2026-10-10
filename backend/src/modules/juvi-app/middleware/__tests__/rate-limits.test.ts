import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signInLimiter, deletionVerifyLimiter } from '../rate-limits';

// The limiters skip themselves under NODE_ENV=test / E2E_TESTING; lift that for these cases.
const ORIG = { NODE_ENV: process.env.NODE_ENV, E2E_TESTING: process.env.E2E_TESTING };
beforeEach(() => {
  process.env.NODE_ENV = 'production';
  delete process.env.E2E_TESTING;
});
afterEach(() => {
  process.env.NODE_ENV = ORIG.NODE_ENV;
  if (ORIG.E2E_TESTING === undefined) delete process.env.E2E_TESTING;
  else process.env.E2E_TESTING = ORIG.E2E_TESTING;
});

function appWith(trustProxy: number | false) {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.post('/sign-in', signInLimiter, (_req, res) => { res.json({ ok: true }); });
  return app;
}

describe('signInLimiter', () => {
  it('answers the 11th sign-in from one IP within a minute with the mobile COOLDOWN envelope', async () => {
    const app = appWith(false);
    for (let i = 0; i < 10; i++) {
      const ok = await request(app).post('/sign-in');
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app).post('/sign-in');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: { code: 'COOLDOWN', message: 'Too many requests. Try again in a minute.', retryAfterSeconds: 60 } });
  });

  it('with trust proxy set, keys on the forwarded client address so phones behind one proxy do not share a bucket', async () => {
    const app = appWith(1);
    for (let i = 0; i < 10; i++) {
      const ok = await request(app).post('/sign-in').set('X-Forwarded-For', '203.0.113.10');
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app).post('/sign-in').set('X-Forwarded-For', '203.0.113.10');
    expect(blocked.status).toBe(429);
    const other = await request(app).post('/sign-in').set('X-Forwarded-For', '203.0.113.20');
    expect(other.status).toBe(200);
  });
});

/**
 * 011 T8(a) — Story 3 AC3.
 *
 * The public deletion-verification route takes an unauthenticated password guess, so it carries
 * its own IP limiter rather than borrowing the sign-in one: the two paths have different traffic
 * shapes and a shared bucket would let one starve the other.
 *
 * This suite is the only place the 429 can be asserted — the Playwright job runs with
 * `E2E_TESTING=1`, which switches every limiter off (`rate-limits.ts:4-5`).
 */
describe('deletionVerifyLimiter', () => {
  function appWith(trustProxy: number | false) {
    const app = express();
    app.set('trust proxy', trustProxy);
    app.post('/account-deletion', deletionVerifyLimiter, (_req, res) => { res.json({ ok: true }); });
    return app;
  }

  it('blocks the sixth request from one IP within a minute, in the mobile error envelope', async () => {
    const app = appWith(false);
    for (let i = 0; i < 5; i++) {
      const ok = await request(app).post('/account-deletion');
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app).post('/account-deletion');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: { code: 'COOLDOWN', message: 'Too many requests. Try again in a minute.', retryAfterSeconds: 60 } });
  });

  it('keys on the forwarded client address once trust proxy is set', async () => {
    const app = appWith(1);
    for (let i = 0; i < 5; i++) {
      await request(app).post('/account-deletion').set('X-Forwarded-For', '203.0.113.10');
    }
    const blocked = await request(app).post('/account-deletion').set('X-Forwarded-For', '203.0.113.10');
    expect(blocked.status).toBe(429);
    // A different phone behind the same nginx is a different bucket — otherwise one shared bucket
    // would throttle the whole campus on a Play-mandated path.
    const other = await request(app).post('/account-deletion').set('X-Forwarded-For', '203.0.113.20');
    expect(other.status).toBe(200);
  });

  it('is its own limiter, not the sign-in one shared by reference', () => {
    expect(deletionVerifyLimiter).not.toBe(signInLimiter);
  });
});
