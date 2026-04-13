import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
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

describe('Welfare — Student Grievances', () => {
  let grievanceId: string;
  let studentData: Awaited<ReturnType<typeof createTestStudent>>;

  beforeAll(async () => {
    studentData = await createTestStudent(fixtures.collegeId);
  });

  it('POST /api/welfare/student-grievances — creates a grievance', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/welfare/student-grievances')
      .send({
        studentId: String(studentData.student._id),
        category: 'academic',
        subject: 'Grade dispute',
        description: 'My marks were incorrectly recorded.',
        priority: 'high',
        status: 'open',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.subject).toBe('Grade dispute');
    expect(res.body.category).toBe('academic');
    grievanceId = res.body._id;
  });

  it('GET /api/welfare/student-grievances — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/welfare/student-grievances')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/welfare/student-grievances/:id — returns grievance by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/welfare/student-grievances/${grievanceId}`)
      .expect(200);

    expect(res.body._id).toBe(grievanceId);
    expect(res.body.subject).toBe('Grade dispute');
  });

  it('PUT /api/welfare/student-grievances/:id — updates status', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/welfare/student-grievances/${grievanceId}`)
      .send({ status: 'in_progress', resolution: 'Under review by academic committee' })
      .expect(200);

    expect(res.body.status).toBe('in_progress');
  });

  it('DELETE /api/welfare/student-grievances/:id — deletes grievance', async () => {
    await api
      .as(fixtures.admin.token)
      .delete(`/api/welfare/student-grievances/${grievanceId}`)
      .expect(200);
  });

  it('GET /api/welfare/student-grievances/:id — 404 after delete', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/welfare/student-grievances/${grievanceId}`)
      .expect(404);

    expectError(res.body);
  });
});

describe('Welfare — Auth & Validation', () => {
  it('GET /api/welfare/student-grievances — 401 without token', async () => {
    await api.get('/api/welfare/student-grievances').expect(401);
  });

  it('POST /api/welfare/student-grievances — 400 for missing required fields', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/welfare/student-grievances')
      .send({ subject: 'No student ID' })
      .expect(400);

    expectError(res.body);
  });
});
