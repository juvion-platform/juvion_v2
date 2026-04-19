import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createUserRateLimit } from '../rateLimitPerUser';

/**
 * T1 rate-limit tests.
 *
 * The factory returns an express-rate-limit middleware keyed on
 * `req.user.id`. Goal: user X's burst does not affect user Y's bucket;
 * the (N+1)st request within the window returns 429.
 */

function buildApp(middleware: express.RequestHandler, fakeUserId?: string) {
  const app = express();
  // Simulate authenticate middleware having set req.user
  app.use((req, _res, next) => {
    if (fakeUserId) (req as unknown as { user: { id: string } }).user = { id: fakeUserId };
    next();
  });
  app.use(middleware);
  app.get('/', (_req, res) => { res.json({ ok: true }); });
  return app;
}

describe('createUserRateLimit', () => {
  it('returns a middleware function', () => {
    const mw = createUserRateLimit({ max: 5, windowMs: 60_000 });
    expect(typeof mw).toBe('function');
  });

  it('allows up to `max` requests from the same user within the window', async () => {
    const mw = createUserRateLimit({ max: 3, windowMs: 60_000 });
    const app = buildApp(mw, 'alice');
    for (let i = 0; i < 3; i++) {
      await request(app).get('/').expect(200);
    }
  });

  it('returns 429 on the (max+1)th request from the same user', async () => {
    const mw = createUserRateLimit({ max: 2, windowMs: 60_000 });
    const app = buildApp(mw, 'alice');
    await request(app).get('/').expect(200);
    await request(app).get('/').expect(200);
    const res = await request(app).get('/');
    expect(res.status).toBe(429);
    // Body is JSON with a structured error (not the default text)
    expect(res.body).toMatchObject({ error: 'rate_limited' });
    expect(typeof res.body.retryAfter).toBe('number');
  });

  it('keeps buckets per-user (alice\'s limit does not affect bob)', async () => {
    const mw = createUserRateLimit({ max: 2, windowMs: 60_000 });

    // Alice hits the limit
    const aliceApp = buildApp(mw, 'alice');
    await request(aliceApp).get('/').expect(200);
    await request(aliceApp).get('/').expect(200);
    await request(aliceApp).get('/').expect(429);

    // Bob starts fresh — should not be rate-limited by alice's bucket
    const bobApp = buildApp(mw, 'bob');
    await request(bobApp).get('/').expect(200);
    await request(bobApp).get('/').expect(200);
  });

  it('falls through when no req.user (no auth) — delegates to existing global limits', async () => {
    // Without a logged-in user, this middleware should not 429 — the
    // global per-IP limit in app.ts is the backstop.
    const mw = createUserRateLimit({ max: 1, windowMs: 60_000 });
    const app = buildApp(mw /* no fakeUserId */);
    await request(app).get('/').expect(200);
    await request(app).get('/').expect(200);
    await request(app).get('/').expect(200);
  });

  it('invokes next() (not response) on successful passes', async () => {
    // Sanity: the middleware calls next(). If it short-circuited we'd
    // never reach the route handler.
    const mw = createUserRateLimit({ max: 5, windowMs: 60_000 });
    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as { user: { id: string } }).user = { id: 'u' };
      next();
    });
    const reached = vi.fn((_req: express.Request, res: express.Response) => { res.json({ ok: true }); });
    app.use(mw);
    app.get('/', reached);
    await request(app).get('/').expect(200);
    expect(reached).toHaveBeenCalledTimes(1);
  });
});
