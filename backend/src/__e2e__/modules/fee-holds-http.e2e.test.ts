/**
 * e2e HTTP tests for Task 8 (Fee Analytics & Alerts API — holds slice).
 *
 * Covers:
 *   - GET  /api/finance/holds                    (list; query filters)
 *   - POST /api/finance/holds/:id/activate       (pending → active)
 *   - POST /api/finance/holds/:id/waive          (pending|active → released)
 *   - POST /api/finance/students/:id/pause-escalation
 *
 * Uses the shared `__e2e__` harness (`createTestApi` + `seedBase`) per the
 * explicit T8 directive. `RBAC_ENFORCE='false'` in the harness means the
 * `authorize()` middleware is a pass-through — role-gating lives in the
 * dedicated authorize middleware suite.
 *
 * Spec: .captain/specs/fee-collection-analytics-and-alerts/spec.md §Journey 4, 5
 * Plan: .captain/specs/fee-collection-analytics-and-alerts/plan.md §1.8
 * Task: .captain/specs/fee-collection-analytics-and-alerts/tasks.md §Task 8
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';

import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { Invoice } from '../../models/finance/Invoice';

let api: TestApi;
let fx: BaseFixtures;

async function seedHoldFixture(holdStatus: 'pending_approval' | 'active' | 'released' = 'pending_approval'): Promise<{
  studentId: string;
  defaulterId: string;
  holdId: string;
}> {
  const s = await createTestStudent(fx.collegeId, {
    programmeId: String(fx.btech._id),
    branchId: String(fx.cseBranch._id),
    batchId: String(fx.batch._id),
  });

  const inv = await Invoice.create({
    collegeId: fx.collegeId,
    invoiceNumber: `T8-H-${Date.now()}-${Math.random()}`,
    studentId: s.student._id,
    type: 'fee',
    items: [{ description: 'Tuition', amount: 60000 }],
    totalAmount: 60000,
    dueDate: new Date(Date.now() - 40 * 86_400_000),
    status: 'overdue',
    issuedDate: new Date(Date.now() - 60 * 86_400_000),
  });

  const defaulter = await DefaulterRecord.create({
    collegeId: fx.collegeId,
    studentId: s.student._id,
    invoiceId: inv._id,
    overdueAmount: 60000,
    daysOverdue: 40,
    escalationStage: 'stage_4',
  });

  const hold = await FinancialHold.create({
    collegeId: fx.collegeId,
    studentId: s.student._id,
    defaulterRecordId: defaulter._id,
    holdType: 'exam_debarment',
    holdStatus,
    effectiveDate: new Date(),
    ...(holdStatus === 'released'
      ? {
          releasedBy: new Types.ObjectId(),
          releaseDate: new Date(),
          releaseReason: 'prev',
        }
      : {}),
    ...(holdStatus === 'active' ? { approvedBy: new Types.ObjectId() } : {}),
  });

  return {
    studentId: String(s.student._id),
    defaulterId: String(defaulter._id),
    holdId: String(hold._id),
  };
}

beforeAll(async () => {
  const app = await getTestApp();
  api = createTestApi(app);
  fx = await seedBase();
}, 60_000);

afterAll(async () => {
  await cleanupTestApp();
});

// Ensure cross-test isolation for hold/defaulter collections only
// (keeps the base fixture — college, users, programmes — alive).
beforeEach(async () => {
  await FinancialHold.deleteMany({});
  await DefaulterRecord.deleteMany({});
  await Invoice.deleteMany({});
});

// ═══════════════════════════════════════════════════════════════════
//  GET /api/finance/holds
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/finance/holds', () => {
  it('200 returns a list scoped to the caller college with default ordering', async () => {
    await seedHoldFixture('pending_approval');
    await seedHoldFixture('active');
    await seedHoldFixture('released');

    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/holds')
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body.total).toBe(3);
    expect(res.body.items[0].holdStatus).toBe('pending_approval');
  });

  it('200 filters by status', async () => {
    await seedHoldFixture('pending_approval');
    await seedHoldFixture('active');
    await seedHoldFixture('released');

    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/holds?status=active')
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].holdStatus).toBe('active');
  });

  it('400 on invalid status value', async () => {
    await api
      .as(fx.admin.token)
      .get('/api/finance/holds?status=bogus')
      .expect(400);
  });

  it('401 without auth', async () => {
    await api.get('/api/finance/holds').expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  POST /api/finance/holds/:id/activate
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/finance/holds/:id/activate', () => {
  it('200 transitions pending_approval → active', async () => {
    const { holdId } = await seedHoldFixture('pending_approval');

    const res = await api
      .as(fx.principal.token)
      .post(`/api/finance/holds/${holdId}/activate`)
      .send({})
      .expect(200);

    expect(res.body.holdStatus).toBe('active');
    expect(res.body).toHaveProperty('approvedBy');
    expect(res.body).toHaveProperty('effectiveDate');
  });

  it('409 when hold is already active', async () => {
    const { holdId } = await seedHoldFixture('active');
    await api
      .as(fx.principal.token)
      .post(`/api/finance/holds/${holdId}/activate`)
      .send({})
      .expect(409);
  });

  it('404/409 on unknown hold id', async () => {
    const fakeId = new Types.ObjectId().toString();
    const res = await api
      .as(fx.principal.token)
      .post(`/api/finance/holds/${fakeId}/activate`)
      .send({});
    expect([404, 409]).toContain(res.status);
  });

  it('401 without auth', async () => {
    const { holdId } = await seedHoldFixture('pending_approval');
    await api
      .post(`/api/finance/holds/${holdId}/activate`)
      .send({})
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  POST /api/finance/holds/:id/waive
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/finance/holds/:id/waive', () => {
  it('200 waives a pending_approval hold with a reason', async () => {
    const { holdId } = await seedHoldFixture('pending_approval');

    const res = await api
      .as(fx.principal.token)
      .post(`/api/finance/holds/${holdId}/waive`)
      .send({ reason: 'Financial hardship' })
      .expect(200);

    expect(res.body.holdStatus).toBe('released');
    expect(res.body.releaseReason).toBe('Financial hardship');
  });

  it('200 waives an active hold', async () => {
    const { holdId } = await seedHoldFixture('active');

    const res = await api
      .as(fx.principal.token)
      .post(`/api/finance/holds/${holdId}/waive`)
      .send({ reason: 'Paid in full' })
      .expect(200);

    expect(res.body.holdStatus).toBe('released');
  });

  it('400 when reason is empty', async () => {
    const { holdId } = await seedHoldFixture('pending_approval');
    await api
      .as(fx.principal.token)
      .post(`/api/finance/holds/${holdId}/waive`)
      .send({ reason: '' })
      .expect(400);
  });

  it('400 when reason is missing', async () => {
    const { holdId } = await seedHoldFixture('pending_approval');
    await api
      .as(fx.principal.token)
      .post(`/api/finance/holds/${holdId}/waive`)
      .send({})
      .expect(400);
  });

  it('409 when hold is already released', async () => {
    const { holdId } = await seedHoldFixture('released');
    await api
      .as(fx.principal.token)
      .post(`/api/finance/holds/${holdId}/waive`)
      .send({ reason: 'again' })
      .expect(409);
  });

  it('401 without auth', async () => {
    const { holdId } = await seedHoldFixture('pending_approval');
    await api
      .post(`/api/finance/holds/${holdId}/waive`)
      .send({ reason: 'no token' })
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  POST /api/finance/students/:id/pause-escalation
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/finance/students/:id/pause-escalation', () => {
  it('200 sets autoEscalationPaused on every DefaulterRecord for the student', async () => {
    const { studentId } = await seedHoldFixture('pending_approval');

    const until = new Date(Date.now() + 14 * 86_400_000);
    const res = await api
      .as(fx.admin.token)
      .post(`/api/finance/students/${studentId}/pause-escalation`)
      .send({ pausedUntil: until.toISOString() })
      .expect(200);

    expect(res.body).toHaveProperty('updated');
    expect(res.body.updated).toBeGreaterThanOrEqual(1);

    // Verify the record reflects the paused date
    const records = await DefaulterRecord.find({ studentId });
    expect(records.length).toBeGreaterThanOrEqual(1);
    for (const r of records) {
      expect(r.autoEscalationPaused).toBeTruthy();
      expect(new Date(r.autoEscalationPaused as Date).getTime()).toBe(until.getTime());
    }
  });

  it('400 when pausedUntil is missing', async () => {
    const { studentId } = await seedHoldFixture('pending_approval');
    await api
      .as(fx.admin.token)
      .post(`/api/finance/students/${studentId}/pause-escalation`)
      .send({})
      .expect(400);
  });

  it('400 when pausedUntil is not a valid date', async () => {
    const { studentId } = await seedHoldFixture('pending_approval');
    await api
      .as(fx.admin.token)
      .post(`/api/finance/students/${studentId}/pause-escalation`)
      .send({ pausedUntil: 'not-a-date' })
      .expect(400);
  });

  it('404 when student has no defaulter record', async () => {
    const s = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });
    const until = new Date(Date.now() + 14 * 86_400_000);
    await api
      .as(fx.admin.token)
      .post(`/api/finance/students/${String(s.student._id)}/pause-escalation`)
      .send({ pausedUntil: until.toISOString() })
      .expect(404);
  });

  it('401 without auth', async () => {
    const { studentId } = await seedHoldFixture('pending_approval');
    await api
      .post(`/api/finance/students/${studentId}/pause-escalation`)
      .send({ pausedUntil: new Date(Date.now() + 86_400_000).toISOString() })
      .expect(401);
  });
});
