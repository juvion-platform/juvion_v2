import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { globalRateLimit, skipGlobalRateLimit, RECEIPTS_PATH } from '../globalRateLimit';
import { receiptsLimiter } from '../../modules/juvi-app/middleware/rate-limits';

// receiptsLimiter skips itself under NODE_ENV=test / E2E_TESTING; lift that so both limiters are live.
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

/** The app.ts order: the global limiter first, then the mobile router with its own receipts limiter. */
function appWith() {
  const app = express();
  app.use(globalRateLimit(100));
  app.post(RECEIPTS_PATH, receiptsLimiter, (_req, res) => { res.json({ accepted: 1, rejected: 0 }); });
  app.get('/api/other', (_req, res) => { res.json({ ok: true }); });
  return app;
}

describe('global rate limit (Ruling R4, review I2)', () => {
  it('skips only the exact receipts path', () => {
    const skip = (path: string) => skipGlobalRateLimit({ path } as express.Request);
    expect(skip('/api/juvi-app/v1/notifications/receipts')).toBe(true);
    expect(skip('/api/juvi-app/v1/notifications/receipts/x')).toBe(false);
    expect(skip('/api/juvi-app/v1/events')).toBe(false);
    expect(skip('/api/juvi-app/v1/notifications')).toBe(false);
  });

  it('lets a burst of receipts from one IP past the 100/min global cap; the receipts limiter stops them at 1,200', async () => {
    // One listening server for every request: supertest's per-request ephemeral server lets a
    // later request land on a port another test worker has since bound, under full-suite load.
    const server = appWith().listen(0);
    try {
      for (let i = 0; i < 1200; i++) {
        const res = await request(server).post(RECEIPTS_PATH);
        if (res.status !== 200) throw new Error(`receipt ${i + 1} got ${res.status}`);
      }
      const blocked = await request(server).post(RECEIPTS_PATH);
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('COOLDOWN');
      // Everything else still shares the 100/min global cap.
      for (let i = 0; i < 100; i++) expect((await request(server).get('/api/other')).status).toBe(200);
      expect((await request(server).get('/api/other')).status).toBe(429);
    } finally {
      server.close();
    }
  }, 30_000);
});
