/**
 * e2e HTTP tests for Task 12 (Fee Configuration API).
 *
 * Path NOTE: Task 12 spec prescribes
 *   backend/src/modules/finance/__tests__/fee-configuration-http.test.ts
 * but the supertest + mongo-memory-server harness lives under the
 * `__e2e__` tree (its globalSetup boots the in-memory mongod). Placing
 * the test here is the smallest-deviation path that honors the spec's
 * explicit directive to reuse `backend/src/__e2e__/helpers/request.ts`
 * + `seedBase()`.
 *
 * Coverage per spec (§Task 12):
 *   - 200 happy paths for each endpoint
 *   - 400 on validation errors
 *   - 401 without auth
 *   - 404 on missing student / component
 *   - Role enforcement is RBAC-gated via `authorize('finance','approve')`
 *     etc.; RBAC_ENFORCE='false' in the test harness so 403 is not
 *     exercised here (same convention as all other e2e suites). See
 *     `middleware/__tests__/authorize.test.ts` for the policy-engine
 *     coverage that backs the route-level gates.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';

import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import {
  Student,
} from '../../models/people/Student';
import { FeeStructureInstance } from '../../models/finance/FeeStructureInstance';
import { FeeComponentTemplate } from '../../models/finance/FeeComponentTemplate';
import { Invoice } from '../../models/finance/Invoice';

let api: TestApi;
let fx: BaseFixtures;

async function createActiveFSI(opts: {
  collegeId: string;
  programmeId: string;
  branchId?: string;
  academicYearId: string;
  totalAmount?: number;
  category?: string;
  quota?: string;
}) {
  return FeeStructureInstance.create({
    collegeId: opts.collegeId,
    programmeId: opts.programmeId,
    branchId: opts.branchId,
    academicYearId: opts.academicYearId,
    status: 'active',
    totalAmount: opts.totalAmount ?? 100000,
    category: opts.category,
    quota: opts.quota,
    approvedAt: new Date(),
  });
}

async function pinStudentDirect(opts: {
  studentId: string;
  yearOfStudy: number;
  feeStructureInstanceId: string;
}) {
  // Write a pin directly rather than going through the service — some
  // tests want a deterministic, queue-free pin state.
  const s = await Student.findById(opts.studentId);
  if (!s) throw new Error('student not found in fixture');
  s.feePins.push({
    yearOfStudy: opts.yearOfStudy,
    feeStructureInstanceId: new Types.ObjectId(opts.feeStructureInstanceId),
    pinnedAt: new Date(),
    pinnedBy: 'test-seed',
    reason: 'initial',
    archivedAt: null,
  } as never);
  await s.save();
  return s.feePins[s.feePins.length - 1]!;
}

beforeAll(async () => {
  const app = await getTestApp();
  api = createTestApi(app);
  fx = await seedBase();
});

afterAll(async () => {
  await cleanupTestApp();
});

// ═══════════════════════════════════════════════════════════════════
//  GET /students/:id/pins
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/finance/students/:id/pins', () => {
  let studentId: string;

  beforeAll(async () => {
    const s = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });
    studentId = String(s.student._id);
    const fsi = await createActiveFSI({
      collegeId: fx.collegeId,
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      academicYearId: String(fx.ay._id),
    });
    await pinStudentDirect({
      studentId,
      yearOfStudy: 1,
      feeStructureInstanceId: String(fsi._id),
    });
  });

  it('200 returns pins for a valid student (auth + valid id)', async () => {
    const res = await api
      .as(fx.admin.token)
      .get(`/api/finance/students/${studentId}/pins`)
      .expect(200);
    expect(res.body).toHaveProperty('pins');
    expect(Array.isArray(res.body.pins)).toBe(true);
    expect(res.body.pins.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pins[0]).toMatchObject({ yearOfStudy: 1 });
  });

  it('401 without auth token', async () => {
    await api.get(`/api/finance/students/${studentId}/pins`).expect(401);
  });

  it('404 on missing student', async () => {
    const fakeId = new Types.ObjectId().toString();
    await api
      .as(fx.admin.token)
      .get(`/api/finance/students/${fakeId}/pins`)
      .expect(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  POST /students/:id/pins/re-pin
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/finance/students/:id/pins/re-pin', () => {
  let studentId: string;
  let fsiId: string;

  beforeAll(async () => {
    const s = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });
    studentId = String(s.student._id);
    const fsi = await createActiveFSI({
      collegeId: fx.collegeId,
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      academicYearId: String(fx.ay._id),
    });
    fsiId = String(fsi._id);
  });

  it('201 creates a new pin (happy path)', async () => {
    const res = await api
      .as(fx.principal.token)
      .post(`/api/finance/students/${studentId}/pins/re-pin`)
      .send({
        yearOfStudy: 1,
        targetFeeStructureInstanceId: fsiId,
        reason: 'admin_override',
        remarks: 'audit requested',
      })
      .expect(201);
    expect(res.body).toHaveProperty('pin');
    expect(res.body.pin).toMatchObject({ yearOfStudy: 1 });
  });

  it('400 on missing required fields', async () => {
    await api
      .as(fx.principal.token)
      .post(`/api/finance/students/${studentId}/pins/re-pin`)
      .send({ yearOfStudy: 1 })
      .expect(400);
  });

  it('400 on invalid enum reason', async () => {
    await api
      .as(fx.principal.token)
      .post(`/api/finance/students/${studentId}/pins/re-pin`)
      .send({
        yearOfStudy: 1,
        targetFeeStructureInstanceId: fsiId,
        reason: 'bogus-reason',
      })
      .expect(400);
  });

  it('401 without auth', async () => {
    await api
      .post(`/api/finance/students/${studentId}/pins/re-pin`)
      .send({
        yearOfStudy: 1,
        targetFeeStructureInstanceId: fsiId,
        reason: 'admin_override',
      })
      .expect(401);
  });

  it('404 on missing student', async () => {
    const fakeId = new Types.ObjectId().toString();
    await api
      .as(fx.principal.token)
      .post(`/api/finance/students/${fakeId}/pins/re-pin`)
      .send({
        yearOfStudy: 1,
        targetFeeStructureInstanceId: fsiId,
        reason: 'admin_override',
      })
      .expect(404);
  });

  it('404 on missing target FeeStructureInstance', async () => {
    const fakeFsi = new Types.ObjectId().toString();
    await api
      .as(fx.principal.token)
      .post(`/api/finance/students/${studentId}/pins/re-pin`)
      .send({
        yearOfStudy: 1,
        targetFeeStructureInstanceId: fakeFsi,
        reason: 'admin_override',
      })
      .expect(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  POST /students/:id/commitment-sheet/regenerate
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/finance/students/:id/commitment-sheet/regenerate', () => {
  let studentId: string;

  beforeAll(async () => {
    const s = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });
    studentId = String(s.student._id);
  });

  it('404 when student has no pins and pinId omitted', async () => {
    await api
      .as(fx.admin.token)
      .post(`/api/finance/students/${studentId}/commitment-sheet/regenerate`)
      .send({})
      .expect(404);
  });

  it('404 when pinId references a pin the student does not own', async () => {
    const bogusPinId = new Types.ObjectId().toString();
    await api
      .as(fx.admin.token)
      .post(`/api/finance/students/${studentId}/commitment-sheet/regenerate`)
      .send({ pinId: bogusPinId })
      .expect(404);
  });

  it('400 when pinId is present but not a string', async () => {
    await api
      .as(fx.admin.token)
      .post(`/api/finance/students/${studentId}/commitment-sheet/regenerate`)
      .send({ pinId: 12345 })
      .expect(400);
  });

  it('401 without auth', async () => {
    await api
      .post(`/api/finance/students/${studentId}/commitment-sheet/regenerate`)
      .send({})
      .expect(401);
  });

  it('404 on missing student', async () => {
    const fakeId = new Types.ObjectId().toString();
    await api
      .as(fx.admin.token)
      .post(`/api/finance/students/${fakeId}/commitment-sheet/regenerate`)
      .send({})
      .expect(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  POST /students/:id/transfer-programme
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/finance/students/:id/transfer-programme', () => {
  let studentId: string;

  beforeAll(async () => {
    const s = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });
    studentId = String(s.student._id);
  });

  it('400 on missing required fields', async () => {
    await api
      .as(fx.principal.token)
      .post(`/api/finance/students/${studentId}/transfer-programme`)
      .send({ reason: 'error' })
      .expect(400);
  });

  it('401 without auth', async () => {
    await api
      .post(`/api/finance/students/${studentId}/transfer-programme`)
      .send({
        newProgrammeId: String(fx.btech._id),
        effectiveYearOfStudy: 1,
        academicYearId: String(fx.ay._id),
        reason: 'branch swap',
      })
      .expect(401);
  });

  it('404 on missing student', async () => {
    const fakeId = new Types.ObjectId().toString();
    await api
      .as(fx.principal.token)
      .post(`/api/finance/students/${fakeId}/transfer-programme`)
      .send({
        newProgrammeId: String(fx.btech._id),
        effectiveYearOfStudy: 1,
        academicYearId: String(fx.ay._id),
        reason: 'test',
      })
      .expect(404);
  });

  it('422 when new programme has no active fee structure', async () => {
    // Same programme (so no structure lookup needed for the student's
    // existing combo) but new branch with no FSI — pinYear fails.
    // Use the OTHER branch (ece) so the transfer actually mutates
    // something; since no FSI has been seeded for (btech, ece) the
    // pin lookup returns null → 422.
    await api
      .as(fx.principal.token)
      .post(`/api/finance/students/${studentId}/transfer-programme`)
      .send({
        newProgrammeId: String(fx.btech._id),
        newBranchId: String(fx.eceBranch._id),
        effectiveYearOfStudy: 1,
        academicYearId: String(fx.ay._id),
        reason: 'branch change',
      })
      .expect(422);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GET /component-template + component CRUD
// ═══════════════════════════════════════════════════════════════════
describe('Component template endpoints', () => {
  let customComponentId: string;

  beforeAll(async () => {
    // Seed a handful of template components (default + custom).
    await FeeComponentTemplate.create([
      {
        collegeId: fx.collegeId,
        componentKey: 'tuition_fee',
        displayLabel: 'Tuition Fee',
        category: 'academic',
        isRefundable: false,
        defaultOneTime: false,
        applicableToYears: [],
        displayOrder: 10,
        isDefault: true,
      },
      {
        collegeId: fx.collegeId,
        componentKey: 'library_fee',
        displayLabel: 'Library Fee',
        category: 'infrastructure',
        isRefundable: false,
        defaultOneTime: false,
        applicableToYears: [1, 2],
        displayOrder: 20,
        isDefault: true,
      },
    ]);
  });

  it('GET 200 lists all components', async () => {
    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/component-template')
      .expect(200);
    expect(res.body).toHaveProperty('components');
    expect(Array.isArray(res.body.components)).toBe(true);
    expect(res.body.components.length).toBeGreaterThanOrEqual(2);
  });

  it('GET 200 filters by category', async () => {
    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/component-template?category=academic')
      .expect(200);
    for (const c of res.body.components) {
      expect(c.category).toBe('academic');
    }
  });

  it('GET 200 filters by applicableToYear', async () => {
    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/component-template?applicableToYear=2')
      .expect(200);
    // library_fee (applicable to 1,2) + tuition_fee (empty = all years)
    const keys = res.body.components.map((c: { componentKey: string }) => c.componentKey);
    expect(keys).toContain('library_fee');
    expect(keys).toContain('tuition_fee');
  });

  it('GET 401 without auth', async () => {
    await api.get('/api/finance/component-template').expect(401);
  });

  it('POST 201 creates a custom component', async () => {
    const res = await api
      .as(fx.admin.token)
      .post('/api/finance/component-template/components')
      .send({
        componentKey: 'custom_fee',
        displayLabel: 'Custom Fee',
        category: 'student_life',
        isRefundable: false,
        defaultOneTime: false,
      })
      .expect(201);
    expect(res.body).toMatchObject({
      componentKey: 'custom_fee',
      isDefault: false,
    });
    customComponentId = res.body._id;
  });

  it('POST 400 on invalid body (missing componentKey)', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/finance/component-template/components')
      .send({
        displayLabel: 'No Key',
        category: 'student_life',
      })
      .expect(400);
  });

  it('POST 400 on invalid category enum', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/finance/component-template/components')
      .send({
        componentKey: 'bad_fee',
        displayLabel: 'Bad',
        category: 'bogus',
      })
      .expect(400);
  });

  it('POST 401 without auth', async () => {
    await api
      .post('/api/finance/component-template/components')
      .send({
        componentKey: 'another_fee',
        displayLabel: 'X',
        category: 'academic',
      })
      .expect(401);
  });

  it('PUT 200 updates displayLabel on a custom component', async () => {
    const res = await api
      .as(fx.admin.token)
      .put(`/api/finance/component-template/components/${customComponentId}`)
      .send({ displayLabel: 'Renamed Custom Fee' })
      .expect(200);
    expect(res.body.displayLabel).toBe('Renamed Custom Fee');
  });

  it('PUT 400 when body includes an unexpected non-matching field shape', async () => {
    await api
      .as(fx.admin.token)
      .put(`/api/finance/component-template/components/${customComponentId}`)
      .send({ applicableToYears: 'not-an-array' })
      .expect(400);
  });

  it('PUT 404 on unknown component id', async () => {
    const fakeId = new Types.ObjectId().toString();
    await api
      .as(fx.admin.token)
      .put(`/api/finance/component-template/components/${fakeId}`)
      .send({ displayLabel: 'Ghost' })
      .expect(404);
  });

  it('DELETE 204 removes a custom component', async () => {
    await api
      .as(fx.admin.token)
      .delete(`/api/finance/component-template/components/${customComponentId}`)
      .expect(204);
  });

  it('DELETE 404 on unknown component id', async () => {
    const fakeId = new Types.ObjectId().toString();
    await api
      .as(fx.admin.token)
      .delete(`/api/finance/component-template/components/${fakeId}`)
      .expect(404);
  });

  it('DELETE 401 without auth', async () => {
    const fakeId = new Types.ObjectId().toString();
    await api
      .delete(`/api/finance/component-template/components/${fakeId}`)
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Pin-audit endpoints
// ═══════════════════════════════════════════════════════════════════
describe('Pin-audit endpoints', () => {
  beforeAll(async () => {
    // Ensure at least one student + pin + invoice for a non-empty
    // aggregation payload.
    const s = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });
    const fsi = await createActiveFSI({
      collegeId: fx.collegeId,
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      academicYearId: String(fx.ay._id),
      totalAmount: 80000,
    });
    await pinStudentDirect({
      studentId: String(s.student._id),
      yearOfStudy: 1,
      feeStructureInstanceId: String(fsi._id),
    });
    // Mismatch invoice: pinnedTotal=80000 vs invoice.totalAmount=85000.
    await Invoice.create({
      collegeId: fx.collegeId,
      invoiceNumber: `T12-INV-${Date.now()}`,
      studentId: s.student._id,
      type: 'fee',
      items: [{ description: 'Tuition', amount: 85000 }],
      totalAmount: 85000,
      dueDate: new Date(),
      status: 'generated',
    });
  });

  it('GET 200 /pin-audit/coverage returns coverage payload', async () => {
    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/pin-audit/coverage')
      .expect(200);
    expect(res.body).toHaveProperty('totalActiveStudents');
    expect(res.body).toHaveProperty('studentsWithActivePinForCurrentYear');
    expect(res.body).toHaveProperty('coveragePercent');
    expect(Array.isArray(res.body.studentsMissingPin)).toBe(true);
    expect(res.body.collegeId).toBe(fx.collegeId);
  });

  it('GET 401 /pin-audit/coverage without auth', async () => {
    await api.get('/api/finance/pin-audit/coverage').expect(401);
  });

  it('GET 200 /pin-audit/invariants surfaces pinnedTotal vs invoiceTotal mismatches', async () => {
    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/pin-audit/invariants')
      .expect(200);
    expect(res.body).toHaveProperty('totalInvoicesChecked');
    expect(Array.isArray(res.body.mismatches)).toBe(true);
    // At least one mismatch from the seeded invoice in beforeAll.
    expect(res.body.mismatches.length).toBeGreaterThanOrEqual(1);
    const first = res.body.mismatches[0];
    expect(first).toHaveProperty('invoiceId');
    expect(first).toHaveProperty('pinnedTotal');
    expect(first).toHaveProperty('invoiceTotal');
    expect(first).toHaveProperty('delta');
  });

  it('GET 401 /pin-audit/invariants without auth', async () => {
    await api.get('/api/finance/pin-audit/invariants').expect(401);
  });
});
