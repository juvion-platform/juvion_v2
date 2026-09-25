import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signInLimiter } from '../rate-limits';

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
