import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';

let api: TestApi;
let fixtures: BaseFixtures;

beforeAll(async () => {
  const app = await getTestApp();
  api = createTestApi(app);
  fixtures = await seedBase();
});

afterAll(async () => {
  await cleanupTestApp();
});

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const res = await api.get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('2.0.0');
  });
});

describe('POST /api/auth/login', () => {
  it('returns token and permissions for valid admin credentials', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'test123' })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('permissions');
    expect(res.body.user.role).toBe('admin');
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions.length).toBeGreaterThan(0);
  });

  it('returns 401 for wrong password', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrong-password' })
      .expect(401);

    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 for non-existent email', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'test123' })
      .expect(401);

    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/auth/me', () => {
  it('returns user profile with valid token', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/auth/me')
      .expect(200);

    expect(res.body.email).toBe('admin@test.com');
    expect(res.body.role).toBe('admin');
  });

  it('returns 401 without token', async () => {
    await api.get('/api/auth/me').expect(401);
  });

  it('returns 401 with invalid token', async () => {
    await api
      .as('invalid-token-value')
      .get('/api/auth/me')
      .expect(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns new token and permissions', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/auth/refresh')
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('permissions');
    expect(typeof res.body.token).toBe('string');
  });
});

// ─── 010 — personas on the session, token version revocation ───────────────
describe('010 personas + token version', () => {
  it('login and /me carry personas and permissions', async () => {
    const login = await api.post('/api/auth/login').send({ email: 'admin@test.com', password: 'test123' }).expect(200);
    expect(login.body.user.personas).toEqual(['L-ADMIN']);
    const me = await api.as(login.body.token).get('/api/auth/me').expect(200);
    expect(me.body.personas).toEqual(['L-ADMIN']);
    expect(me.body.permissions).toContain('platform:read');
  });

  it('a token minted before the version bump is rejected', async () => {
    const { bumpTokenVersion } = await import('../../shared/rbac/token-version');
    const login = await api.post('/api/auth/login').send({ email: 'admin@test.com', password: 'test123' }).expect(200);
    await api.as(login.body.token).get('/api/auth/me').expect(200);
    await bumpTokenVersion(login.body.user.id);
    await api.as(login.body.token).get('/api/auth/me').expect(401);
    const again = await api.post('/api/auth/login').send({ email: 'admin@test.com', password: 'test123' }).expect(200);
    await api.as(again.body.token).get('/api/auth/me').expect(200);
  });
});
