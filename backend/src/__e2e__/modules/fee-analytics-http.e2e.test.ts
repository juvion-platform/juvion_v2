/**
 * e2e HTTP tests for Task 8 (Fee Analytics & Alerts API — analytics slice).
 *
 * Covers:
 *   - GET /api/finance/analytics/dashboard
 *   - GET /api/finance/analytics/defaulters
 *
 * Uses the shared `__e2e__` harness (`createTestApi` + `seedBase`) per the
 * explicit T8 directive. `RBAC_ENFORCE='false'` in the harness means the
 * `authorize()` middleware is a pass-through in this suite — route-level
 * policy gates are covered by the dedicated authorize middleware tests.
 *
 * Spec: .captain/specs/fee-collection-analytics-and-alerts/spec.md
 * Plan: .captain/specs/fee-collection-analytics-and-alerts/plan.md §1.8
 * Task: .captain/specs/fee-collection-analytics-and-alerts/tasks.md §Task 8
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';

import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { Invoice } from '../../models/finance/Invoice';
import { Payment } from '../../models/finance/Payment';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';

let api: TestApi;
let fx: BaseFixtures;

async function seedAnalyticsFixture(): Promise<{
  s1: string; s2: string; s3: string;
}> {
  // 3 students in CSE programme/branch for dashboard KPIs.
  const a = await createTestStudent(fx.collegeId, {
    programmeId: String(fx.btech._id),
    branchId: String(fx.cseBranch._id),
    batchId: String(fx.batch._id),
  });
  const b = await createTestStudent(fx.collegeId, {
    programmeId: String(fx.btech._id),
    branchId: String(fx.cseBranch._id),
    batchId: String(fx.batch._id),
  });
  const c = await createTestStudent(fx.collegeId, {
    programmeId: String(fx.btech._id),
    branchId: String(fx.cseBranch._id),
    batchId: String(fx.batch._id),
  });

  // 1 paid invoice (student a) — generates a collected payment
  const invA = await Invoice.create({
    collegeId: fx.collegeId,
    invoiceNumber: `T8-A-${Date.now()}`,
    studentId: a.student._id,
    type: 'fee',
    items: [{ description: 'Tuition', amount: 50000 }],
    totalAmount: 50000,
    dueDate: new Date(),
    status: 'paid',
    issuedDate: new Date(),
  });
  await Payment.create({
    collegeId: fx.collegeId,
    studentId: a.student._id,
    receiptNumber: `T8-P-A-${Date.now()}`,
    amount: 50000,
    paymentMode: 'upi',
    status: 'success',
  });

  // 2 overdue invoices — for students b and c — with DefaulterRecord entries.
  const invB = await Invoice.create({
    collegeId: fx.collegeId,
    invoiceNumber: `T8-B-${Date.now()}`,
    studentId: b.student._id,
    type: 'fee',
    items: [{ description: 'Tuition', amount: 40000 }],
    totalAmount: 40000,
    dueDate: new Date(Date.now() - 30 * 86_400_000),
    status: 'overdue',
    issuedDate: new Date(Date.now() - 60 * 86_400_000),
  });
  await DefaulterRecord.create({
    collegeId: fx.collegeId,
    studentId: b.student._id,
    invoiceId: invB._id,
    overdueAmount: 40000,
    daysOverdue: 30,
    escalationStage: 'stage_3',
  });

  const invC = await Invoice.create({
    collegeId: fx.collegeId,
    invoiceNumber: `T8-C-${Date.now()}`,
    studentId: c.student._id,
    type: 'fee',
    items: [{ description: 'Tuition', amount: 20000 }],
    totalAmount: 20000,
    dueDate: new Date(Date.now() - 10 * 86_400_000),
    status: 'overdue',
    issuedDate: new Date(Date.now() - 40 * 86_400_000),
  });
  await DefaulterRecord.create({
    collegeId: fx.collegeId,
    studentId: c.student._id,
    invoiceId: invC._id,
    overdueAmount: 20000,
    daysOverdue: 10,
    escalationStage: 'stage_2',
    autoEscalationPaused: new Date(Date.now() + 7 * 86_400_000),
  });

  // Silence unused-var warnings from the happy-path invoice.
  void invA;

  return {
    s1: String(a.student._id),
    s2: String(b.student._id),
    s3: String(c.student._id),
  };
}

beforeAll(async () => {
  const app = await getTestApp();
  api = createTestApi(app);
  fx = await seedBase();
  await seedAnalyticsFixture();
}, 60_000);

afterAll(async () => {
  await cleanupTestApp();
});

// ═══════════════════════════════════════════════════════════════════
//  GET /api/finance/analytics/dashboard
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/finance/analytics/dashboard', () => {
  // Evaluated per-test (not at module-load) so the `to` anchor is always
  // after any timestamps set by beforeAll's seed fixture.
  const fromIso = () => new Date(Date.now() - 90 * 86_400_000).toISOString();
  const toIso = () => new Date(Date.now() + 60_000).toISOString();

  it('200 returns the consolidated dashboard payload', async () => {
    const res = await api
      .as(fx.admin.token)
      .get(`/api/finance/analytics/dashboard?from=${fromIso()}&to=${toIso()}`)
      .expect(200);

    // Shape checks (DashboardV1 per plan §1.4)
    expect(res.body).toHaveProperty('totalOutstanding');
    expect(res.body).toHaveProperty('collectedInRange');
    expect(res.body).toHaveProperty('collectionRatePercent');
    expect(res.body).toHaveProperty('overdueStudentsCount');
    expect(res.body).toHaveProperty('overdueAmount');
    expect(res.body).toHaveProperty('funnelByStage');
    expect(res.body).toHaveProperty('collectionTimeSeries');
    expect(res.body).toHaveProperty('dueVsCollectedByMonth');
    expect(res.body).toHaveProperty('paymentModeBreakdown');
    expect(res.body).toHaveProperty('dueByProgramme');

    // Funnel has exactly 5 stage keys
    expect(res.body.funnelByStage).toMatchObject({
      stage_1: expect.any(Number),
      stage_2: expect.any(Number),
      stage_3: expect.any(Number),
      stage_4: expect.any(Number),
      welfare_referred: expect.any(Number),
    });

    // Our fixture seeded 1 stage_2 + 1 stage_3 → at least 2 stages populated
    expect(res.body.funnelByStage.stage_2 + res.body.funnelByStage.stage_3).toBeGreaterThanOrEqual(2);

    // Collected ≥ 50000 from the fixture's successful payment
    expect(res.body.collectedInRange).toBeGreaterThanOrEqual(50000);

    // 6 monthly buckets in dueVsCollectedByMonth
    expect(res.body.dueVsCollectedByMonth).toHaveLength(6);
  });

  it('200 supports programmeIds filter (array form)', async () => {
    const res = await api
      .as(fx.admin.token)
      .get(
        `/api/finance/analytics/dashboard?from=${fromIso()}&to=${toIso()}` +
          `&programmeIds=${String(fx.btech._id)}`,
      )
      .expect(200);
    expect(res.body).toHaveProperty('funnelByStage');
  });

  it('400 when `from` is missing', async () => {
    await api
      .as(fx.admin.token)
      .get(`/api/finance/analytics/dashboard?to=${toIso()}`)
      .expect(400);
  });

  it('400 when `to` is not a valid date', async () => {
    await api
      .as(fx.admin.token)
      .get(`/api/finance/analytics/dashboard?from=${fromIso()}&to=not-a-date`)
      .expect(400);
  });

  it('401 without auth', async () => {
    await api
      .get(`/api/finance/analytics/dashboard?from=${fromIso()}&to=${toIso()}`)
      .expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GET /api/finance/analytics/defaulters
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/finance/analytics/defaulters', () => {
  it('200 returns a paginated defaulter list', async () => {
    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/analytics/defaulters')
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(2);

    const first = res.body.items[0];
    expect(first).toHaveProperty('studentId');
    expect(first).toHaveProperty('overdueAmount');
    expect(first).toHaveProperty('daysOverdue');
    expect(first).toHaveProperty('escalationStage');
  });

  it('200 honors limit + sort=overdueAmount', async () => {
    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/analytics/defaulters?limit=1&sort=overdueAmount')
      .expect(200);
    expect(res.body.items.length).toBe(1);
    // Higher overdueAmount first
    expect(res.body.items[0].overdueAmount).toBeGreaterThanOrEqual(20000);
  });

  it('200 returns autoEscalationPaused when present', async () => {
    const res = await api
      .as(fx.admin.token)
      .get('/api/finance/analytics/defaulters?limit=50')
      .expect(200);
    const paused = res.body.items.find(
      (it: { autoEscalationPaused?: string | null }) => !!it.autoEscalationPaused,
    );
    expect(paused).toBeDefined();
    expect(typeof paused.autoEscalationPaused).toBe('string');
  });

  it('400 on invalid sort enum', async () => {
    await api
      .as(fx.admin.token)
      .get('/api/finance/analytics/defaulters?sort=bogus')
      .expect(400);
  });

  it('400 on non-numeric limit', async () => {
    await api
      .as(fx.admin.token)
      .get('/api/finance/analytics/defaulters?limit=abc')
      .expect(400);
  });

  it('401 without auth', async () => {
    await api.get('/api/finance/analytics/defaulters').expect(401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Cross-college isolation (defensive)
// ═══════════════════════════════════════════════════════════════════
describe('cross-college isolation', () => {
  it('returns empty results when no data is seeded for the caller college', async () => {
    // Seed a second college with no data and call as super_admin scoped to it.
    const otherId = new Types.ObjectId().toString();
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const to = new Date().toISOString();
    const res = await api
      .as(fx.superAdmin.token)
      .get(`/api/finance/analytics/dashboard?from=${from}&to=${to}`)
      .set('x-college-id', otherId)
      .expect(200);
    expect(res.body.totalOutstanding).toBe(0);
    expect(res.body.collectedInRange).toBe(0);
    expect(res.body.overdueStudentsCount).toBe(0);
  });
});
