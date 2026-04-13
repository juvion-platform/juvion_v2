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

describe('People — Students', () => {
  let studentData: Awaited<ReturnType<typeof createTestStudent>>;
  let studentId: string;

  beforeAll(async () => {
    studentData = await createTestStudent(fixtures.collegeId, {
      branchId: String(fixtures.cseBranch._id),
      batchId: String(fixtures.batch._id),
    });
    studentId = String(studentData.student._id);
  });

  it('GET /api/people/students — returns paginated list with at least one student', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/people/students')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/people/students/:id — returns student by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/people/students/${studentId}`)
      .expect(200);

    expect(res.body._id).toBe(studentId);
  });

  it('PUT /api/people/students/:id — updates student', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/people/students/${studentId}`)
      .send({ status: 'active' })
      .expect(200);

    expect(res.body._id).toBe(studentId);
  });

  it('GET /api/people/students/:id — 404 for non-existent ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/people/students/000000000000000000000099')
      .expect(404);

    expectError(res.body);
  });
});

describe('People — Persons', () => {
  let personId: string;

  it('GET /api/people/persons — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/people/persons')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
    personId = res.body.items[0]._id;
  });

  it('GET /api/people/persons/:id — returns person by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/people/persons/${personId}`)
      .expect(200);

    expect(res.body._id).toBe(personId);
  });
});

describe('People — Auth', () => {
  it('GET /api/people/students — 401 without token', async () => {
    await api.get('/api/people/students').expect(401);
  });

  it('GET /api/people/persons — 401 without token', async () => {
    await api.get('/api/people/persons').expect(401);
  });
});
