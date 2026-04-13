import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestFaculty } from '../factories/academic.factory';
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

describe('Academics — Courses', () => {
  let courseId: string;

  it('POST /api/academics/courses — creates a course', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/courses')
      .send({
        code: 'CS201',
        name: 'Data Structures',
        regulationId: String(fixtures.regulation._id),
        departmentId: String(fixtures.cse._id),
        credits: 4,
        lectureHrs: 3,
        tutorialHrs: 1,
        practicalHrs: 0,
        type: 'theory',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.code).toBe('CS201');
    expect(res.body.name).toBe('Data Structures');
    courseId = res.body._id;
  });

  it('GET /api/academics/courses — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/academics/courses')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/academics/courses/:id — returns course by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/academics/courses/${courseId}`)
      .expect(200);

    expect(res.body._id).toBe(courseId);
    expect(res.body.code).toBe('CS201');
  });

  it('PUT /api/academics/courses/:id — updates course', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/academics/courses/${courseId}`)
      .send({ credits: 3 })
      .expect(200);

    expect(res.body.credits).toBe(3);
  });

  it('DELETE /api/academics/courses/:id — deletes course', async () => {
    await api
      .as(fixtures.admin.token)
      .delete(`/api/academics/courses/${courseId}`)
      .expect(200);
  });
});

describe('Academics — Course Offerings', () => {
  let offeringId: string;
  let facultyData: Awaited<ReturnType<typeof createTestFaculty>>;
  let courseId: string;

  beforeAll(async () => {
    facultyData = await createTestFaculty(fixtures.collegeId, {
      departmentId: String(fixtures.cse._id),
    });
    // Create a course to use
    const courseRes = await api
      .as(fixtures.admin.token)
      .post('/api/academics/courses')
      .send({
        code: 'CS301',
        name: 'Algorithms',
        regulationId: String(fixtures.regulation._id),
        departmentId: String(fixtures.cse._id),
        credits: 4,
        type: 'theory',
      });
    courseId = courseRes.body._id;
  });

  it('POST /api/academics/offerings — creates a course offering', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/offerings')
      .send({
        courseId,
        semesterId: String(fixtures.sem1._id),
        sectionId: String(fixtures.cseSection._id),
        facultyId: String(facultyData.faculty._id),
        maxEnrollment: 60,
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.courseId).toBe(courseId);
    offeringId = res.body._id;
  });

  it('GET /api/academics/offerings — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/academics/offerings')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/academics/offerings/:id — returns offering by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/academics/offerings/${offeringId}`)
      .expect(200);

    expect(res.body._id).toBe(offeringId);
  });
});

describe('Academics — Auth & Validation', () => {
  it('GET /api/academics/courses — 401 without token', async () => {
    await api.get('/api/academics/courses').expect(401);
  });

  it('POST /api/academics/courses — 400 for missing required fields', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/courses')
      .send({ name: 'Incomplete Course' })
      .expect(400);

    expectError(res.body);
  });
});
