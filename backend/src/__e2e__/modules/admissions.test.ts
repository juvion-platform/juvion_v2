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

describe('Admissions — Inquiries CRUD', () => {
  let inquiryId: string;

  it('POST /api/admissions/inquiries — creates an inquiry', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/admissions/inquiries')
      .send({
        name: 'Ravi Kumar',
        phone: '9876543210',
        source: 'walk-in',
        status: 'new',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.name).toBe('Ravi Kumar');
    expect(res.body.source).toBe('walk-in');
    inquiryId = res.body._id;
  });

  it('GET /api/admissions/inquiries — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/admissions/inquiries')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/admissions/inquiries/:id — returns inquiry by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/admissions/inquiries/${inquiryId}`)
      .expect(200);

    expect(res.body._id).toBe(inquiryId);
    expect(res.body.name).toBe('Ravi Kumar');
  });

  it('PUT /api/admissions/inquiries/:id — updates status', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/admissions/inquiries/${inquiryId}`)
      .send({ status: 'contacted' })
      .expect(200);

    expect(res.body.status).toBe('contacted');
  });

  it('DELETE /api/admissions/inquiries/:id — deletes inquiry', async () => {
    await api
      .as(fixtures.admin.token)
      .delete(`/api/admissions/inquiries/${inquiryId}`)
      .expect(200);
  });

  it('GET /api/admissions/inquiries/:id — 404 after delete', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/admissions/inquiries/${inquiryId}`)
      .expect(404);

    expectError(res.body);
  });
});

describe('Admissions — Applicants CRUD', () => {
  let applicantId: string;

  it('POST /api/admissions/applicants — creates an applicant', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/admissions/applicants')
      .send({
        applicationNumber: 'APP-2024-001',
        name: 'Priya Sharma',
        phone: '9123456789',
        quota: 'convener',
        status: 'submitted',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.applicationNumber).toBe('APP-2024-001');
    expect(res.body.quota).toBe('convener');
    applicantId = res.body._id;
  });

  it('GET /api/admissions/applicants — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/admissions/applicants')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/admissions/applicants/:id — returns applicant by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/admissions/applicants/${applicantId}`)
      .expect(200);

    expect(res.body._id).toBe(applicantId);
    expect(res.body.name).toBe('Priya Sharma');
  });

  it('PUT /api/admissions/applicants/:id — updates applicant', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/admissions/applicants/${applicantId}`)
      .send({ status: 'under_review' })
      .expect(200);

    expect(res.body.status).toBe('under_review');
  });
});

describe('Admissions — Auth & Validation', () => {
  it('GET /api/admissions/inquiries — 401 without token', async () => {
    await api.get('/api/admissions/inquiries').expect(401);
  });

  it('POST /api/admissions/inquiries — 400 for missing required fields', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/admissions/inquiries')
      .send({ name: 'No Source' })
      .expect(400);

    expectError(res.body);
  });

  it('POST /api/admissions/applicants — 400 for missing required fields', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/admissions/applicants')
      .send({ name: 'No App Number' })
      .expect(400);

    expectError(res.body);
  });
});
