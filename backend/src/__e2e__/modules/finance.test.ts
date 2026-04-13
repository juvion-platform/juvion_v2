import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { expectPaginated, expectError } from '../helpers/assertions';
import { Person, Parent, Student } from '../../models';

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

describe('Finance — Fee Structures', () => {
  let feeStructureId: string;

  it('POST /api/finance/fee-structures — creates a fee structure', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/finance/fee-structures')
      .send({
        academicYearId: String(fixtures.ay._id),
        programmeId: String(fixtures.btech._id),
        year: 1,
        components: [
          { name: 'Tuition Fee', amount: 50000, isRefundable: false },
          { name: 'Lab Fee', amount: 5000, isRefundable: false },
        ],
        totalAmount: 55000,
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.totalAmount).toBe(55000);
    feeStructureId = res.body._id;
  });

  it('GET /api/finance/fee-structures — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/finance/fee-structures')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/finance/fee-structures/:id — returns fee structure by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/finance/fee-structures/${feeStructureId}`)
      .expect(200);

    expect(res.body._id).toBe(feeStructureId);
    expect(res.body.totalAmount).toBe(55000);
  });

  it('PUT /api/finance/fee-structures/:id — updates fee structure', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/finance/fee-structures/${feeStructureId}`)
      .send({ totalAmount: 60000 })
      .expect(200);

    expect(res.body.totalAmount).toBe(60000);
  });

  it('DELETE /api/finance/fee-structures/:id — deletes fee structure', async () => {
    await api
      .as(fixtures.admin.token)
      .delete(`/api/finance/fee-structures/${feeStructureId}`)
      .expect(200);
  });
});

describe('Finance — Payments', () => {
  let studentData: Awaited<ReturnType<typeof createTestStudent>>;
  let paymentId: string;

  beforeAll(async () => {
    studentData = await createTestStudent(fixtures.collegeId);
    // Finance requires feeResponsibleParentId to be set before creating payments
    const parentPerson = await Person.create({
      collegeId: fixtures.collegeId,
      name: 'Finance Test Parent',
      phone: '9111100001',
      gender: 'male',
    });
    const parent = await Parent.create({
      collegeId: fixtures.collegeId,
      personId: parentPerson._id,
      relationship: 'father',
      isFeeResponsible: true,
    });
    await Student.findByIdAndUpdate(studentData.student._id, {
      feeResponsibleParentId: parent._id,
    });
  });

  it('POST /api/finance/payments — creates a payment for a student', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/finance/payments')
      .send({
        studentId: String(studentData.student._id),
        amount: 25000,
        paymentMode: 'online',
        transactionRef: 'TXN-2024-001',
        status: 'success',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.amount).toBe(25000);
    expect(res.body.paymentMode).toBe('online');
    paymentId = res.body._id;
  });

  it('GET /api/finance/payments — returns paginated list', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/finance/payments')
      .expect(200);

    expectPaginated(res.body, { minItems: 1 });
  });

  it('GET /api/finance/payments/:id — returns payment by ID', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/finance/payments/${paymentId}`)
      .expect(200);

    expect(res.body._id).toBe(paymentId);
  });
});

describe('Finance — Auth & Validation', () => {
  it('GET /api/finance/fee-structures — 401 without token', async () => {
    await api.get('/api/finance/fee-structures').expect(401);
  });

  it('POST /api/finance/fee-structures — 400 for missing required fields', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/finance/fee-structures')
      .send({ totalAmount: 10000 })
      .expect(400);

    expectError(res.body);
  });
});
