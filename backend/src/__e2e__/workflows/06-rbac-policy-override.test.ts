/**
 * Workflow 06 — RBAC Policy Override
 *
 * Verifies that college-specific RBAC policies can override system defaults:
 *   1. Student has no hr:read by default
 *   2. Student is denied GET /api/hr/employees (403)
 *   3. Admin creates override policy: student → hr:read allow
 *   4. Student re-logs in → permissions include 'hr:read'
 *   5. Student can now GET /api/hr/employees (200)
 *   6. Admin deletes the override policy
 *   7. Student re-logs in → permissions no longer include 'hr:read'
 *   8. System default policies (createdBy: 'seed') cannot be deleted → 403
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { Policy } from '../../models/platform/Policy';

let api: TestApi;
let fixtures: BaseFixtures;

// shared state across sequential steps
let studentToken: string;
let studentEmail: string;
let overridePolicyId: string;

const STUDENT_PASSWORD = 'test123';

beforeAll(async () => {
  // getTestApp() may set RBAC_ENFORCE = 'false' on first init; set after
  const app = await getTestApp();
  process.env.RBAC_ENFORCE = 'true';
  api = createTestApi(app);
  fixtures = await seedBase();
});

afterAll(async () => {
  process.env.RBAC_ENFORCE = 'false';
  await cleanupTestApp();
});

describe('Workflow 06 — RBAC Policy Override', () => {
  // ── Step 1: Create student, login → no hr:read ───────────────
  it('Step 1: Create student and login → permissions do NOT include hr:read', async () => {
    const { user, token } = await createTestStudent(fixtures.collegeId);
    studentToken = token;
    studentEmail = user.email as string;

    // Login fresh to get permissions resolved
    const res = await api
      .post('/api/auth/login')
      .send({ email: studentEmail, password: STUDENT_PASSWORD, collegeId: fixtures.collegeId })
      .expect(200);

    expect(res.body).toHaveProperty('permissions');
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions).not.toContain('hr:read');

    // Use the freshly issued token for subsequent requests
    studentToken = res.body.token;
  });

  // ── Step 2: Student cannot access HR employees ───────────────
  it('Step 2: GET /api/hr/employees → 403 for student (no hr:read policy)', async () => {
    await api
      .as(studentToken)
      .get('/api/hr/employees')
      .expect(403);
  });

  // ── Step 3: Admin creates college-specific override policy ────
  it('Step 3: Admin creates college-specific policy: student → hr:read allow (priority 650)', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/platform/rbac-policies')
      .send({
        role: 'student',
        module: 'hr',
        action: 'read',
        effect: 'allow',
        priority: 650,
        description: 'E2E test override: student can read HR',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.role).toBe('student');
    expect(res.body.module).toBe('hr');
    expect(res.body.action).toBe('read');
    expect(res.body.effect).toBe('allow');
    expect(res.body.priority).toBe(650);
    overridePolicyId = res.body._id;
  });

  // ── Step 4: Student logs in again → permissions include hr:read
  it('Step 4: Student logs in again → permissions now include hr:read', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: studentEmail, password: STUDENT_PASSWORD, collegeId: fixtures.collegeId })
      .expect(200);

    expect(res.body).toHaveProperty('permissions');
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions).toContain('hr:read');

    // Use the refreshed token
    studentToken = res.body.token;
  });

  // ── Step 5: Student can now access HR employees ──────────────
  it('Step 5: GET /api/hr/employees → 200 for student (hr:read override active)', async () => {
    await api
      .as(studentToken)
      .get('/api/hr/employees')
      .expect(200);
  });

  // ── Step 6: Admin deletes the override policy ────────────────
  it('Step 6: Admin deletes the override policy', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .delete(`/api/platform/rbac-policies/${overridePolicyId}`)
      .expect(200);

    expect(res.body).toHaveProperty('message');
  });

  // ── Step 7: Student logs in again → hr:read gone ─────────────
  it('Step 7: Student logs in again → permissions no longer include hr:read', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: studentEmail, password: STUDENT_PASSWORD, collegeId: fixtures.collegeId })
      .expect(200);

    expect(res.body).toHaveProperty('permissions');
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions).not.toContain('hr:read');

    studentToken = res.body.token;
  });

  // ── Step 8: System default policies cannot be deleted ────────
  it('Step 8: DELETE system default policy → 403 (seed policies are protected)', async () => {
    const seedPolicy = await Policy.findOne({ createdBy: 'seed' });
    expect(seedPolicy).not.toBeNull();

    const seedId = String(seedPolicy!._id);

    const res = await api
      .as(fixtures.admin.token)
      .delete(`/api/platform/rbac-policies/${seedId}`)
      .expect(403);

    expect(res.body).toHaveProperty('error');
  });
});
