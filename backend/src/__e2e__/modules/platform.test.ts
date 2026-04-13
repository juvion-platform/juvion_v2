import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { expectPaginated, expectError } from '../helpers/assertions';

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

describe('Platform — Announcements', () => {
  let announcementId: string;

  it('POST /api/platform/announcements — creates an announcement', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/platform/announcements')
      .send({
        title: 'Holiday Notice',
        content: 'College will remain closed on Aug 15th for Independence Day.',
        category: 'general',
        priority: 'normal',
        postedBy: String(fixtures.admin.user._id),
        targetAudience: 'all',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.title).toBe('Holiday Notice');
    expect(res.body.category).toBe('general');
    announcementId = res.body._id;
  });

  it('GET /api/platform/announcements — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/platform/announcements')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/platform/announcements/:id — returns announcement by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/platform/announcements/${announcementId}`)
      .expect(200);

    expect(res.body._id).toBe(announcementId);
    expect(res.body.title).toBe('Holiday Notice');
  });

  it('PUT /api/platform/announcements/:id — updates announcement', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/platform/announcements/${announcementId}`)
      .send({ priority: 'high', isPinned: true })
      .expect(200);

    expect(res.body.priority).toBe('high');
  });

  it('DELETE /api/platform/announcements/:id — deletes announcement', async () => {
    await api
      .as(fixtures.admin.token)
      .delete(`/api/platform/announcements/${announcementId}`)
      .expect(200);
  });

  it('GET /api/platform/announcements/:id — 404 after delete', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/platform/announcements/${announcementId}`)
      .expect(404);

    expectError(res.body);
  });
});

describe('Platform — RBAC Policies', () => {
  let policyId: string;

  it('POST /api/platform/rbac-policies — creates an RBAC policy', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/platform/rbac-policies')
      .send({
        role: 'faculty',
        module: 'academics',
        action: 'read',
        effect: 'allow',
        priority: 100,
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.role).toBe('faculty');
    expect(res.body.module).toBe('academics');
    policyId = res.body._id;
  });

  it('GET /api/platform/rbac-policies — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/platform/rbac-policies')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/platform/rbac-policies/:id — returns policy by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/platform/rbac-policies/${policyId}`)
      .expect(200);

    expect(res.body._id).toBe(policyId);
    expect(res.body.role).toBe('faculty');
  });

  it('DELETE /api/platform/rbac-policies/:id — deletes policy', async () => {
    await api
      .as(fixtures.admin.token)
      .delete(`/api/platform/rbac-policies/${policyId}`)
      .expect(200);
  });
});

describe('Platform — Auth & Validation', () => {
  it('GET /api/platform/announcements — 401 without token', async () => {
    await api.get('/api/platform/announcements').expect(401);
  });

  it('GET /api/platform/rbac-policies — 401 without token', async () => {
    await api.get('/api/platform/rbac-policies').expect(401);
  });

  it('POST /api/platform/announcements — 400 for missing required fields', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/platform/announcements')
      .send({ title: 'Missing fields' })
      .expect(400);

    expectError(res.body);
  });
});
