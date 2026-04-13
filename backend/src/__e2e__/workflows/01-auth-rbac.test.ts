import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';

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

describe('Workflow 01 — Auth & RBAC', () => {
  let studentToken: string;

  // Step 1: Admin login returns token + permissions (non-empty array)
  it('admin login returns token and non-empty permissions', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'test123' })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('permissions');
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('admin@test.com');
  });

  // Step 2: Wrong password returns 401
  it('wrong password returns 401', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' })
      .expect(401);

    expect(res.body).toHaveProperty('error');
  });

  // Step 3: GET /me with valid token returns profile
  it('GET /api/auth/me with valid token returns user profile', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/auth/me')
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('role');
    expect(res.body.role).toBe('admin');
  });

  // Step 4: Admin can access finance endpoints (RBAC pass-through — RBAC_ENFORCE=false)
  it('admin can access finance endpoints (RBAC pass-through)', async () => {
    // RBAC_ENFORCE is 'false' by default in tests — authorize is a pass-through
    await api
      .as(fixtures.admin.token)
      .get('/api/finance/fee-structures')
      .expect(200);
  });

  // Steps 5 & 6: RBAC_ENFORCE=true tests
  describe('with RBAC_ENFORCE=true', () => {
    beforeAll(async () => {
      // Create a student user for RBAC tests
      const { token } = await createTestStudent(fixtures.collegeId);
      studentToken = token;
    });

    afterAll(() => {
      // Restore RBAC_ENFORCE to false after these tests
      process.env.RBAC_ENFORCE = 'false';
    });

    // Step 5: student gets self-scoped finance access (200)
    it('student gets self-scoped finance read access (200)', async () => {
      process.env.RBAC_ENFORCE = 'true';
      try {
        // Student has: { role: 'student', module: 'finance', action: 'read', scope: { selfOnly: true } }
        const res = await api
          .as(studentToken)
          .get('/api/finance/fee-structures')
          .expect(200);

        expect(res.body).toHaveProperty('items');
      } finally {
        process.env.RBAC_ENFORCE = 'false';
      }
    });

    // Step 6: student is denied HR access (403)
    it('student is denied HR access (403)', async () => {
      process.env.RBAC_ENFORCE = 'true';
      try {
        // Student has no policy for hr module → should be denied
        const res = await api
          .as(studentToken)
          .get('/api/hr/leave-types')
          .expect(403);

        expect(res.body).toHaveProperty('error');
      } finally {
        process.env.RBAC_ENFORCE = 'false';
      }
    });
  });

  // Step 7: Token refresh returns new token + permissions
  it('POST /api/auth/refresh returns new token and permissions', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/auth/refresh')
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('permissions');
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });

  // Step 8: Rate limiter triggers after too many bad login attempts
  // Rate limit: 10/15min. Prior tests in this file consumed ~2 (1 good, 1 bad).
  // Send 9 more bad requests to push total over the 10-attempt threshold.
  it('rate limiter returns 429 after too many login attempts', async () => {
    const badLoginPayload = { email: 'admin@test.com', password: 'badpassword' };

    // Send enough attempts to exhaust the remaining quota and trigger 429
    // We've already sent 2 login requests in this test file (steps 1 and 2).
    // Send 9 more to guarantee we cross the 10-request limit.
    let got429 = false;
    for (let i = 0; i < 10; i++) {
      const res = await api.post('/api/auth/login').send(badLoginPayload);
      if (res.status === 429) {
        got429 = true;
        break;
      }
    }

    expect(got429).toBe(true);
  });
});
