import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { Person, Parent, Student } from '../../models';

let api: TestApi;
let fixtures: BaseFixtures;
let studentId: string;

// IDs created during the workflow
let tuitionLineItemId: string;
let labLineItemId: string;

beforeAll(async () => {
  const app = await getTestApp();
  api = createTestApi(app);
  fixtures = await seedBase();

  // Create a student
  const studentData = await createTestStudent(fixtures.collegeId, {
    programmeId: String(fixtures.btech._id),
    branchId: String(fixtures.cseBranch._id),
  });
  studentId = String(studentData.student._id);

  // Set up fee-responsible guardian (required by assertStudentFeeGuardianReady)
  const guardianPerson = await Person.create({
    collegeId: fixtures.collegeId,
    name: 'Fee Guardian 03',
    phone: '9333300003',
    gender: 'female',
  });
  const guardian = await Parent.create({
    collegeId: fixtures.collegeId,
    personId: guardianPerson._id,
    relationship: 'mother',
    isFeeResponsible: true,
  });
  await Student.findByIdAndUpdate(studentData.student._id, {
    feeResponsibleParentId: guardian._id,
  });
});

afterAll(async () => {
  await cleanupTestApp();
});

describe('Workflow 03 — Fee Payment Lifecycle', () => {
  let feeStructureId: string;

  it('01 — creates a fee structure (tuition: 50000, lab: 10000)', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/finance/fee-structures')
      .send({
        academicYearId: String(fixtures.ay._id),
        programmeId: String(fixtures.btech._id),
        year: 1,
        components: [
          { name: 'Tuition Fee', amount: 50000, isRefundable: false },
          { name: 'Lab Fee', amount: 10000, isRefundable: false },
        ],
        totalAmount: 60000,
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.totalAmount).toBe(60000);
    expect(res.body.components).toHaveLength(2);
    feeStructureId = res.body._id;
  });

  it('02 — creates tuition fee line item for student', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/finance/fee-line-items')
      .send({
        studentId,
        feeStructureId,
        component: 'Tuition Fee',
        academicYearId: String(fixtures.ay._id),
        amount: 50000,
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.component).toBe('Tuition Fee');
    expect(res.body.amount).toBe(50000);
    tuitionLineItemId = res.body._id;
  });

  it('03 — creates lab fee line item for student', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/finance/fee-line-items')
      .send({
        studentId,
        feeStructureId,
        component: 'Lab Fee',
        academicYearId: String(fixtures.ay._id),
        amount: 10000,
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.component).toBe('Lab Fee');
    expect(res.body.amount).toBe(10000);
    labLineItemId = res.body._id;
  });

  it('04 — both line items are pending', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/finance/fee-line-items?studentId=${studentId}`)
      .expect(200);

    expect(res.body).toHaveProperty('items');
    const items: any[] = res.body.items;
    expect(items).toHaveLength(2);

    const tuition = items.find((i: any) => i._id === tuitionLineItemId);
    const lab = items.find((i: any) => i._id === labLineItemId);

    expect(tuition).toBeDefined();
    expect(tuition.status).toBe('pending');
    expect(tuition.paidAmount ?? 0).toBe(0);

    expect(lab).toBeDefined();
    expect(lab.status).toBe('pending');
    expect(lab.paidAmount ?? 0).toBe(0);
  });

  it('05 — partial payment of 30000 against tuition', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/finance/payments')
      .send({
        studentId,
        amount: 30000,
        paymentMode: 'online',
        transactionRef: 'TXN-03-001',
        status: 'success',
        allocations: [
          { lineItemId: tuitionLineItemId, amount: 30000 },
        ],
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.amount).toBe(30000);
    expect(res.body.paymentMode).toBe('online');
  });

  it('06 — tuition line item is partial (paidAmount=30000)', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/finance/fee-line-items/${tuitionLineItemId}`)
      .expect(200);

    expect(res.body.status).toBe('partial');
    expect(res.body.paidAmount).toBe(30000);
  });

  it('07 — remaining payment of 20000 against tuition', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/finance/payments')
      .send({
        studentId,
        amount: 20000,
        paymentMode: 'upi',
        transactionRef: 'TXN-03-002',
        status: 'success',
        allocations: [
          { lineItemId: tuitionLineItemId, amount: 20000 },
        ],
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.amount).toBe(20000);
  });

  it('08 — tuition line item is fully paid (paidAmount=50000)', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/finance/fee-line-items/${tuitionLineItemId}`)
      .expect(200);

    expect(res.body.status).toBe('paid');
    expect(res.body.paidAmount).toBe(50000);
  });

  it('09 — pay lab fee in full (10000)', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/finance/payments')
      .send({
        studentId,
        amount: 10000,
        paymentMode: 'cash',
        status: 'success',
        allocations: [
          { lineItemId: labLineItemId, amount: 10000 },
        ],
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.amount).toBe(10000);
  });

  it('10 — lab fee line item is fully paid (paidAmount=10000)', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/finance/fee-line-items/${labLineItemId}`)
      .expect(200);

    expect(res.body.status).toBe('paid');
    expect(res.body.paidAmount).toBe(10000);
  });
});
