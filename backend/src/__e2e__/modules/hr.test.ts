import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestEmployee, createTestLeaveType } from '../factories/hr.factory';
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

describe('HR — Leave Types', () => {
  let leaveTypeId: string;

  it('POST /api/hr/leave-types — creates a leave type', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/hr/leave-types')
      .send({
        name: 'Casual Leave',
        code: 'CL',
        maxDaysPerYear: 12,
        isCarryForward: false,
        applicableTo: ['all'],
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.name).toBe('Casual Leave');
    expect(res.body.code).toBe('CL');
    leaveTypeId = res.body._id;
  });

  it('GET /api/hr/leave-types — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/hr/leave-types')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/hr/leave-types/:id — returns leave type by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/hr/leave-types/${leaveTypeId}`)
      .expect(200);

    expect(res.body._id).toBe(leaveTypeId);
    expect(res.body.code).toBe('CL');
  });

  it('PUT /api/hr/leave-types/:id — updates leave type', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/hr/leave-types/${leaveTypeId}`)
      .send({ maxDaysPerYear: 15 })
      .expect(200);

    expect(res.body.maxDaysPerYear).toBe(15);
  });

  it('DELETE /api/hr/leave-types/:id — deletes leave type', async () => {
    await api
      .as(fixtures.admin.token)
      .delete(`/api/hr/leave-types/${leaveTypeId}`)
      .expect(200);
  });
});

describe('HR — Leave Applications', () => {
  let employeeData: Awaited<ReturnType<typeof createTestEmployee>>;
  let leaveType: any;
  let leaveApplicationId: string;

  beforeAll(async () => {
    employeeData = await createTestEmployee(fixtures.collegeId, {
      departmentId: String(fixtures.cse._id),
    });
    leaveType = await createTestLeaveType(fixtures.collegeId);
  });

  it('POST /api/hr/leave-applications — creates a leave application', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/hr/leave-applications')
      .send({
        employeeId: String(employeeData.employee._id),
        leaveTypeId: String(leaveType._id),
        fromDate: '2024-08-01',
        toDate: '2024-08-03',
        days: 3,
        reason: 'Personal work',
        status: 'applied',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.days).toBe(3);
    leaveApplicationId = res.body._id;
  });

  it('GET /api/hr/leave-applications — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/hr/leave-applications')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/hr/leave-applications/:id — returns leave application by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/hr/leave-applications/${leaveApplicationId}`)
      .expect(200);

    expect(res.body._id).toBe(leaveApplicationId);
  });

  it('PUT /api/hr/leave-applications/:id — updates leave application', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/hr/leave-applications/${leaveApplicationId}`)
      .send({ status: 'approved' })
      .expect(200);

    expect(res.body.status).toBe('approved');
  });
});

describe('HR — Auth & Validation', () => {
  it('GET /api/hr/leave-types — 401 without token', async () => {
    await api.get('/api/hr/leave-types').expect(401);
  });

  it('POST /api/hr/leave-types — 400 for missing required fields', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/hr/leave-types')
      .send({ name: 'Incomplete' })
      .expect(400);

    expectError(res.body);
  });
});
