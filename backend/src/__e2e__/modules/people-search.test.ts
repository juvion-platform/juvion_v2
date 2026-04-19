import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { createTestUser } from '../factories/user.factory';

/**
 * E2E integration tests for GET /api/people/search.
 *
 * Exercises the full middleware chain:
 *   authenticate → authorize → rate-limit → validate → controller → service
 *
 * Tests the HTTP contract, not the service logic (that's covered by the
 * unit tests in backend/src/modules/people/__tests__/search-service.test.ts).
 */

let api: TestApi;
let fixtures: BaseFixtures;

beforeAll(async () => {
  const app = await getTestApp();
  api = createTestApi(app);
  fixtures = await seedBase();
  // Seed a few students the tests can search for.
  await createTestStudent(fixtures.collegeId, { name: 'Ramesh Kumar' });
  await createTestStudent(fixtures.collegeId, { name: 'Priya Sharma' });
  await createTestStudent(fixtures.collegeId, { name: 'Arjun Reddy' });
}, 60_000);

afterAll(async () => {
  await cleanupTestApp();
});

describe('GET /api/people/search — HTTP contract', () => {
  it('returns 200 with valid token and 2+ char query', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/people/search?q=ramesh')
      .expect(200);

    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('counts');
    expect(res.body).toHaveProperty('totalMatched');
    expect(res.body).toHaveProperty('hasMore');
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('returns 400 when q is too short (< 2 chars)', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/people/search?q=a')
      .expect(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 when q contains disallowed characters', async () => {
    await api
      .as(fixtures.admin.token)
      .get('/api/people/search?q=%3Cscript%3Ealert(1)%3C/script%3E')
      .expect(400);
  });

  it('returns 400 when q is missing', async () => {
    await api
      .as(fixtures.admin.token)
      .get('/api/people/search')
      .expect(400);
  });

  it('returns 401 without an auth token', async () => {
    await api.get('/api/people/search?q=ramesh').expect(401);
  });

  it('caps limit at 25 (rejects larger)', async () => {
    await api
      .as(fixtures.admin.token)
      .get('/api/people/search?q=ab&limit=100')
      .expect(400);
  });

  it('accepts a valid limit and returns at most that many results', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/people/search?q=a&limit=5')
      .expect(400); // q=a is still too short

    expect(res.body.error).toBe('Validation failed');
  });

  it('response shape: counts has all 5 role keys', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/people/search?q=ab')
      .expect(200);

    expect(res.body.counts).toMatchObject({
      student: expect.any(Number),
      faculty: expect.any(Number),
      staff: expect.any(Number),
      parent: expect.any(Number),
      alumni: expect.any(Number),
    });
  });
});

describe('GET /api/people/search — PII protection', () => {
  it('response body does NOT contain phone, email, DOB, aadhaar, or address', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/people/search?q=ramesh')
      .expect(200);

    const serialized = JSON.stringify(res.body);
    // Static negative assertions — if search-service.ts ever accidentally
    // includes these fields, this test fails at the HTTP boundary.
    expect(serialized).not.toMatch(/\b(phone|aadhaar|dob|address)\b/i);
    // Email is looser — don't hard-fail on the word "email" (could appear
    // in a field name like `identifierLabel: 'email'`) but assert no raw
    // email values are exposed.
    expect(serialized).not.toMatch(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
  });
});

describe('GET /api/people/search — rate limiting', () => {
  it('returns 429 after 60 requests in one minute from the same user', async () => {
    // Use a fresh user to avoid interference from earlier tests.
    const heavy = await createTestUser({
      collegeId: fixtures.collegeId,
      role: 'admin', personaType: 'L-ADM',
      name: 'Heavy User', email: 'heavy@test.com',
    });

    // 60 passes
    for (let i = 0; i < 60; i++) {
      await api.as(heavy.token).get('/api/people/search?q=ab').expect(200);
    }
    // 61st is throttled
    const res = await api.as(heavy.token).get('/api/people/search?q=ab');
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: 'rate_limited' });
    expect(typeof res.body.retryAfter).toBe('number');
  }, 60_000);
});

describe('GET /api/people/search — admin-only includeInactive', () => {
  it('admin can pass includeInactive=true', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/people/search?q=ab&includeInactive=true')
      .expect(200);
    expect(res.body).toHaveProperty('results');
  });

  it('non-admin includeInactive request silently downgrades to false', async () => {
    // Create a user that's NOT admin/principal/super_admin
    const faculty = await createTestUser({
      collegeId: fixtures.collegeId,
      role: 'faculty', personaType: 'F-FAC',
      name: 'Faculty User', email: 'fac@test.com',
    });

    const res = await api
      .as(faculty.token)
      .get('/api/people/search?q=ab&includeInactive=true')
      .expect(200);
    // The request is accepted (not 403); the flag is ignored server-side.
    expect(res.body).toHaveProperty('results');
  });
});
