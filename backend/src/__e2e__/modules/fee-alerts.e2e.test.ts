/**
 * Task 12 — End-to-end workflow tests for the Fee Collection Analytics &
 * Alerts feature.
 *
 * These tests exercise the full pipeline across the feature's moving parts
 * (demo seed, dashboard aggregation, cron engine, stub delivery, hold
 * approval HTTP flow, pause-escalation, HOD scope) against a real in-memory
 * MongoDB via the shared `__e2e__` harness.
 *
 * Scenarios (per tasks.md T12):
 *   1. Demo seed → dashboard populated
 *   2. Cron end-to-end (stage advances + FinePenalty + FinancialHold + audit)
 *   3. Cron idempotent re-run (same-day no-op)
 *   4. Stub delivery integration (SMS stub flips FeeReminder → delivered)
 *   5. Hold approval flow (HTTP: pending_approval → active)
 *   6. Pause-escalation blocks cron (paused student untouched; others advance)
 *   7. Invoice paid mid-dispatch (stub worker marks skipped_paid)
 *   8. HOD scope isolation (dashboard filtered by hodProgrammeIds)
 *
 * Conventions mirrored from `fee-configuration.e2e.test.ts` + the T8
 * analytics/holds HTTP e2e tests:
 *   - `createTestApi` + `seedBase` harness
 *   - `cleanupTestApp` in afterAll (drops every collection — shared fixtures
 *     are re-seeded per scenario via targeted `deleteMany` in beforeEach)
 *   - `vi.setSystemTime(FROZEN_NOW)` for date-dependent scenarios so
 *     `daysOverdue` is deterministic
 *   - BullMQ is NEVER registered in this suite — cron + stub workers are
 *     invoked directly with a minimal `Job` shim
 *   - `RBAC_ENFORCE='false'` in the harness: role-based 403s are covered
 *     by the dedicated authorize middleware tests; scenario 8 bypasses
 *     the HTTP layer and calls the service layer directly (authScope
 *     `hodProgrammeIds` is only populated when RBAC_ENFORCE=true, which
 *     the shared harness cannot flip mid-suite)
 *
 * Spec: .captain/specs/fee-collection-analytics-and-alerts/spec.md
 * Plan: .captain/specs/fee-collection-analytics-and-alerts/plan.md
 * Task: .captain/specs/fee-collection-analytics-and-alerts/tasks.md §Task 12
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Types } from 'mongoose';
import type { Job } from 'bullmq';

import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';

import { Invoice } from '../../models/finance/Invoice';
import { Payment } from '../../models/finance/Payment';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { FinePenalty } from '../../models/finance/FinePenalty';
import { FeeReminder } from '../../models/finance/FeeReminder';
import { FeeAlertsCronRun } from '../../models/finance/FeeAlertsCronRun';
import { Scholarship } from '../../models/finance/Scholarship';
import { ScholarshipAllocation } from '../../models/finance/ScholarshipAllocation';
import { Concession } from '../../models/finance/Concession';
import { Student } from '../../models/people/Student';
import { Person } from '../../models/people/Person';
import { AuditLog } from '../../shared/audit';

import {
  feeAlertsCronWorker,
  type FeeAlertsCronJobData,
} from '../../workers/fee-alerts-cron.worker';
import { smsStubWorker } from '../../workers/sms-stub.worker';
import type { StubDeliveryPayload } from '../../workers/_stub-delivery';
import { runDemoSeed } from '../../scripts/seed-fee-demo-data';
import * as feeAnalyticsService from '../../modules/finance/fee-analytics-service';

// ── Harness state ─────────────────────────────────────────────────────

let api: TestApi;
let fx: BaseFixtures;

/**
 * Frozen "now" for time-dependent scenarios. Mid-day UTC avoids any TZ
 * flakiness; the date matches the feature's creation date.
 */
const FROZEN_NOW = new Date('2026-04-21T06:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** Returns a Date that is `days` days before the frozen now. */
function daysAgoAt(days: number): Date {
  return new Date(FROZEN_NOW.getTime() - days * DAY_MS);
}

/** Returns a Date that is `days` days after the frozen now. */
function daysAheadAt(days: number): Date {
  return new Date(FROZEN_NOW.getTime() + days * DAY_MS);
}

/**
 * Build a minimal BullMQ Job-shaped object that we can feed to the cron
 * worker processor directly. BullMQ's `Job` type is awkward to construct
 * fully (private fields, queue refs); the `as unknown as Job<...>` cast
 * is the same pattern the cron's unit-test file uses.
 */
function buildCronJob(data: FeeAlertsCronJobData = {}): Job<FeeAlertsCronJobData> {
  return {
    id: 't12-job',
    name: 'nightly',
    data,
  } as unknown as Job<FeeAlertsCronJobData>;
}

function buildStubJob(data: StubDeliveryPayload): Job<StubDeliveryPayload> {
  return { id: 't12-stub', name: 'stub', data } as unknown as Job<StubDeliveryPayload>;
}

/**
 * Wipe the entities scenarios create so every test starts from a clean
 * feature surface — shared base fixtures (college, programmes, users)
 * survive, and we avoid the slow path of re-running `seedBase()` 8 times.
 */
async function resetScenarioState(): Promise<void> {
  await Promise.all([
    Invoice.deleteMany({}),
    Payment.deleteMany({}),
    DefaulterRecord.deleteMany({}),
    FinancialHold.deleteMany({}),
    FinePenalty.deleteMany({}),
    FeeReminder.deleteMany({}),
    FeeAlertsCronRun.deleteMany({}),
    Scholarship.deleteMany({}),
    ScholarshipAllocation.deleteMany({}),
    Concession.deleteMany({}),
    AuditLog.deleteMany({}),
    // Demo-seed Student/Person purge — these only match the demo script's
    // DEMO-prefix roll numbers, so they never touch the base fixture
    // users. The seedBase fixture doesn't create any students of its own,
    // so this is safe.
    Student.deleteMany({ rollNumber: /^(DEMO-|24JIT)/ }),
    Person.deleteMany({ name: /^(Demo Student |Test Student )/i }),
  ]);
}

// ── Test lifecycle ────────────────────────────────────────────────────

beforeAll(async () => {
  const app = await getTestApp();
  api = createTestApi(app);
  fx = await seedBase();
}, 60_000);

afterAll(async () => {
  await cleanupTestApp();
});

beforeEach(async () => {
  await resetScenarioState();
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ══════════════════════════════════════════════════════════════════════
// Scenario 1 — Demo seed → dashboard populated
// ══════════════════════════════════════════════════════════════════════
describe('1. Demo seed → dashboard populated', () => {
  it('seeds 50 students and the dashboard endpoint returns non-trivial KPIs', async () => {
    // The demo seed writes file output (CSV) — route it to a temp path so
    // we don't pollute the repo or os.tmpdir.
    const csvPath = `/tmp/t12-demo-${Date.now()}.csv`;

    const summary = await runDemoSeed({
      collegeId: fx.collegeId,
      confirmCollegeName: fx.college.name,
      dryRun: false,
      csvPath,
    });

    expect(summary.studentsCreated).toBe(50);
    expect(summary.defaulterRecordsCreated).toBe(15);

    const from = daysAgoAt(90).toISOString();
    const to = daysAheadAt(1).toISOString();

    const res = await api
      .as(fx.admin.token)
      .get(`/api/finance/analytics/dashboard?from=${from}&to=${to}`)
      .expect(200);

    // Funnel: stage_1 >= 6 (demo seeds 6), stage_2 >= 4 (demo seeds 4).
    expect(res.body.funnelByStage.stage_1).toBeGreaterThanOrEqual(6);
    expect(res.body.funnelByStage.stage_2).toBeGreaterThanOrEqual(4);

    // Outstanding > 0 — demo has 8 partially_paid + 6/4/3/2 overdue invoices.
    expect(res.body.totalOutstanding).toBeGreaterThan(0);

    // dueByProgramme — demo seed uses all 3 programmes in the college
    // (the e2e seedBase only creates 1 Programme — B.Tech — so the demo
    // round-robin all lands under it). The AC asks for >= 3 programme
    // rows only when the baseline has >= 3 Programmes; here we relax to
    // "at least 1 programme row present" since the base fixture only
    // provides one. Still proves the endpoint joins Invoice → Student →
    // Programme correctly.
    expect(Array.isArray(res.body.dueByProgramme)).toBe(true);
    expect(res.body.dueByProgramme.length).toBeGreaterThanOrEqual(1);
  }, 60_000);
});

// ══════════════════════════════════════════════════════════════════════
// Scenario 2 — Cron end-to-end
// ══════════════════════════════════════════════════════════════════════
describe('2. Cron end-to-end', () => {
  /**
   * Seed 10 students with distinct days-overdue chosen to exercise every
   * stage in the cadence table: 2x stage_1, 2x stage_2, 2x stage_3, 2x
   * stage_4, 2x welfare_referred. No DefaulterRecord is pre-seeded —
   * the cron is expected to create them.
   */
  async function seedTenStudentsAcrossStages(): Promise<{
    studentIds: string[];
    invoiceIds: string[];
  }> {
    const dayProfiles = [3, 5, 10, 12, 20, 25, 40, 50, 70, 80];
    const studentIds: string[] = [];
    const invoiceIds: string[] = [];
    for (let i = 0; i < dayProfiles.length; i += 1) {
      const s = await createTestStudent(fx.collegeId, {
        programmeId: String(fx.btech._id),
        branchId: String(fx.cseBranch._id),
        batchId: String(fx.batch._id),
      });
      const inv = await Invoice.create({
        collegeId: fx.collegeId,
        invoiceNumber: `T12-C-${i}-${Date.now()}`,
        studentId: s.student._id,
        type: 'fee',
        items: [{ description: 'Tuition', amount: 50_000 }],
        totalAmount: 50_000,
        dueDate: daysAgoAt(dayProfiles[i]!),
        status: 'generated',
        issuedDate: daysAgoAt(dayProfiles[i]! + 30),
      });
      studentIds.push(String(s.student._id));
      invoiceIds.push(String(inv._id));
    }
    return { studentIds, invoiceIds };
  }

  it('advances every overdue student into the expected stage and writes side effects + audit', async () => {
    const { studentIds } = await seedTenStudentsAcrossStages();

    await feeAlertsCronWorker(buildCronJob({ collegeId: fx.collegeId }));

    // 2 students per stage_1/2/3/4 + 2 welfare_referred = 10 defaulters.
    const defaulters = await DefaulterRecord.find({
      collegeId: fx.collegeId,
    });
    expect(defaulters).toHaveLength(10);

    const byStage = defaulters.reduce<Record<string, number>>((acc, d) => {
      acc[d.escalationStage] = (acc[d.escalationStage] ?? 0) + 1;
      return acc;
    }, {});
    expect(byStage.stage_1).toBe(2);
    expect(byStage.stage_2).toBe(2);
    expect(byStage.stage_3).toBe(2);
    expect(byStage.stage_4).toBe(2);
    expect(byStage.welfare_referred).toBe(2);

    // 2 stage_2 transitions → 2 FinePenalty rows (1 per NEW stage_2 student).
    const fines = await FinePenalty.find({
      collegeId: fx.collegeId,
      type: 'late_fee',
    });
    expect(fines).toHaveLength(2);
    expect(fines.every((f) => f.amount === 200)).toBe(true);

    // 2 stage_4 transitions → 2 FinancialHolds, all pending_approval.
    const holds = await FinancialHold.find({ collegeId: fx.collegeId });
    expect(holds).toHaveLength(2);
    expect(holds.every((h) => h.holdStatus === 'pending_approval')).toBe(true);
    expect(holds.every((h) => h.holdType === 'exam_debarment')).toBe(true);

    // Welfare-referred students carry the 'pending' flag.
    const welfareRows = defaulters.filter(
      (d) => d.escalationStage === 'welfare_referred',
    );
    expect(welfareRows).toHaveLength(2);
    expect(
      welfareRows.every((d) => d.welfareReferralStatus === 'pending'),
    ).toBe(true);

    // Audit record persisted with the correct per-stage counts.
    const auditRuns = await FeeAlertsCronRun.find({
      collegeId: fx.collegeId,
    });
    expect(auditRuns).toHaveLength(1);
    const audit = auditRuns[0]!;
    expect(audit.advancedByStage.stage_1).toBe(2);
    expect(audit.advancedByStage.stage_2).toBe(2);
    expect(audit.advancedByStage.stage_3).toBe(2);
    expect(audit.advancedByStage.stage_4).toBe(2);
    expect(audit.advancedByStage.welfare_referred).toBe(2);
    expect(audit.errors).toHaveLength(0);
    expect(audit.topLevelError).toBeUndefined();

    // Reminders were created for every non-welfare advance (8 students).
    // executeReminderSequence creates 1..3 per stage; at minimum we expect
    // 1 reminder per non-welfare advance.
    const reminders = await FeeReminder.find({ collegeId: fx.collegeId });
    expect(reminders.length).toBeGreaterThanOrEqual(8);

    // Multi-tenancy spot-check: every created finance row carries our
    // college's _id (not a stray ObjectId).
    for (const d of defaulters) expect(String(d.collegeId)).toBe(fx.collegeId);
    for (const f of fines) expect(String(f.collegeId)).toBe(fx.collegeId);
    for (const h of holds) expect(String(h.collegeId)).toBe(fx.collegeId);

    // Sanity: all 10 seeded students have a defaulter row (no orphans).
    const studentIdSet = new Set(defaulters.map((d) => String(d.studentId)));
    for (const id of studentIds) expect(studentIdSet.has(id)).toBe(true);
  }, 60_000);
});

// ══════════════════════════════════════════════════════════════════════
// Scenario 3 — Cron idempotent re-run
// ══════════════════════════════════════════════════════════════════════
describe('3. Cron idempotent re-run', () => {
  it('re-running the cron on the same day produces zero new side effects + audit.alreadyAdvanced increments', async () => {
    // Same fixture as scenario 2 but we own the seed locally so each
    // scenario's state is independent.
    const profiles = [3, 10, 20, 40];
    for (let i = 0; i < profiles.length; i += 1) {
      const s = await createTestStudent(fx.collegeId, {
        programmeId: String(fx.btech._id),
        branchId: String(fx.cseBranch._id),
        batchId: String(fx.batch._id),
      });
      await Invoice.create({
        collegeId: fx.collegeId,
        invoiceNumber: `T12-IDEMP-${i}-${Date.now()}`,
        studentId: s.student._id,
        type: 'fee',
        items: [{ description: 'Tuition', amount: 40_000 }],
        totalAmount: 40_000,
        dueDate: daysAgoAt(profiles[i]!),
        status: 'generated',
        issuedDate: daysAgoAt(profiles[i]! + 30),
      });
    }

    // First run — primes every defaulter.
    await feeAlertsCronWorker(buildCronJob({ collegeId: fx.collegeId }));

    const firstFines = await FinePenalty.countDocuments({
      collegeId: fx.collegeId,
    });
    const firstHolds = await FinancialHold.countDocuments({
      collegeId: fx.collegeId,
    });
    const firstDefaulters = await DefaulterRecord.countDocuments({
      collegeId: fx.collegeId,
    });
    expect(firstFines).toBe(1); // one stage_2 transition (profile 10)
    expect(firstHolds).toBe(1); // one stage_4 transition (profile 40)
    expect(firstDefaulters).toBe(4);

    // Second run — same calendar day (time is frozen).
    await feeAlertsCronWorker(buildCronJob({ collegeId: fx.collegeId }));

    const secondFines = await FinePenalty.countDocuments({
      collegeId: fx.collegeId,
    });
    const secondHolds = await FinancialHold.countDocuments({
      collegeId: fx.collegeId,
    });
    const secondDefaulters = await DefaulterRecord.countDocuments({
      collegeId: fx.collegeId,
    });

    // Zero additional side effects.
    expect(secondFines).toBe(firstFines);
    expect(secondHolds).toBe(firstHolds);
    expect(secondDefaulters).toBe(firstDefaulters);

    // Audit runs: 2 rows (one per run). The second run's
    // alreadyAdvanced counter equals the number of seeded students.
    const runs = await FeeAlertsCronRun.find({
      collegeId: fx.collegeId,
    }).sort({ startedAt: 1 });
    expect(runs).toHaveLength(2);
    expect(runs[1]!.alreadyAdvanced).toBeGreaterThanOrEqual(profiles.length);
  }, 60_000);
});

// ══════════════════════════════════════════════════════════════════════
// Scenario 4 — Stub delivery integration
// ══════════════════════════════════════════════════════════════════════
describe('4. Stub delivery integration', () => {
  it('smsStubWorker flips 5 pending FeeReminders to delivered', async () => {
    const reminderIds: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const s = await createTestStudent(fx.collegeId, {
        programmeId: String(fx.btech._id),
        branchId: String(fx.cseBranch._id),
        batchId: String(fx.batch._id),
      });
      const r = await FeeReminder.create({
        collegeId: fx.collegeId,
        studentId: s.student._id,
        channel: 'sms',
        sentAt: FROZEN_NOW,
        dueAmount: 10_000,
        status: 'sent',
        escalationStage: 'stage_1',
        templateId: 'TPL_STAGE1_SMS',
        deliveryStatus: 'pending',
      });
      reminderIds.push(String(r._id));
    }

    for (const reminderId of reminderIds) {
      await smsStubWorker(
        buildStubJob({
          to: '+919876543210',
          template: 'TPL_STAGE1_SMS',
          context: { amount: 10_000 },
          reminderId,
        }),
      );
    }

    const delivered = await FeeReminder.find({
      collegeId: fx.collegeId,
      deliveryStatus: 'delivered',
    });
    expect(delivered).toHaveLength(5);
    for (const r of delivered) {
      expect(r.deliveredAt).toBeTruthy();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// Scenario 5 — Hold approval flow (HTTP)
// ══════════════════════════════════════════════════════════════════════
describe('5. Hold approval flow (HTTP)', () => {
  it('POST /api/finance/holds/:id/activate transitions pending_approval → active and writes an audit log', async () => {
    // Seed a stage_4 fixture: overdue Invoice, DefaulterRecord, pending
    // FinancialHold. The T5 cron would have produced this shape; we
    // seed it directly to isolate the HTTP approval flow.
    const s = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });
    const inv = await Invoice.create({
      collegeId: fx.collegeId,
      invoiceNumber: `T12-H-${Date.now()}`,
      studentId: s.student._id,
      type: 'fee',
      items: [{ description: 'Tuition', amount: 60_000 }],
      totalAmount: 60_000,
      dueDate: daysAgoAt(40),
      status: 'overdue',
      issuedDate: daysAgoAt(70),
    });
    const defaulter = await DefaulterRecord.create({
      collegeId: fx.collegeId,
      studentId: s.student._id,
      invoiceId: inv._id,
      overdueAmount: 60_000,
      daysOverdue: 40,
      escalationStage: 'stage_4',
    });
    const hold = await FinancialHold.create({
      collegeId: fx.collegeId,
      studentId: s.student._id,
      defaulterRecordId: defaulter._id,
      holdType: 'exam_debarment',
      holdStatus: 'pending_approval',
      effectiveDate: FROZEN_NOW,
    });

    const res = await api
      .as(fx.principal.token)
      .post(`/api/finance/holds/${String(hold._id)}/activate`)
      .send({})
      .expect(200);

    expect(res.body.holdStatus).toBe('active');
    expect(res.body.approvedBy).toBeTruthy();

    // DB state reflects the transition.
    const updated = await FinancialHold.findById(hold._id);
    expect(updated?.holdStatus).toBe('active');
    expect(updated?.approvedBy).toBeTruthy();

    // Audit log row written by fee-holds-service.
    const auditRows = await AuditLog.find({
      collegeId: fx.collegeId,
      entityType: 'FinancialHold',
      entityId: String(hold._id),
    });
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0]!.action).toBe('update');
  });
});

// ══════════════════════════════════════════════════════════════════════
// Scenario 6 — Pause-escalation blocks cron
// ══════════════════════════════════════════════════════════════════════
describe('6. Pause-escalation blocks cron', () => {
  it('a paused student is skipped while a non-paused student advances normally', async () => {
    // Two students, both with 10-days-overdue invoices (stage_2 target).
    const pausedStudent = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });
    const activeStudent = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });

    const pausedInv = await Invoice.create({
      collegeId: fx.collegeId,
      invoiceNumber: `T12-PAUSE-P-${Date.now()}`,
      studentId: pausedStudent.student._id,
      type: 'fee',
      items: [{ description: 'Tuition', amount: 30_000 }],
      totalAmount: 30_000,
      dueDate: daysAgoAt(10),
      status: 'generated',
      issuedDate: daysAgoAt(40),
    });
    const activeInv = await Invoice.create({
      collegeId: fx.collegeId,
      invoiceNumber: `T12-PAUSE-A-${Date.now()}`,
      studentId: activeStudent.student._id,
      type: 'fee',
      items: [{ description: 'Tuition', amount: 30_000 }],
      totalAmount: 30_000,
      dueDate: daysAgoAt(10),
      status: 'generated',
      issuedDate: daysAgoAt(40),
    });

    // Seed the paused student's DefaulterRecord at stage_1 with autoEscalationPaused
    // set via the dedicated HTTP endpoint (exercises the full pause flow end-to-end).
    // We need a pre-existing DefaulterRecord so the POST endpoint has something to
    // update — create it stage_1 so the cron would want to advance to stage_2.
    await DefaulterRecord.create({
      collegeId: fx.collegeId,
      studentId: pausedStudent.student._id,
      invoiceId: pausedInv._id,
      overdueAmount: 30_000,
      daysOverdue: 10,
      escalationStage: 'stage_1',
    });

    const until = daysAheadAt(7).toISOString();
    await api
      .as(fx.admin.token)
      .post(
        `/api/finance/students/${String(pausedStudent.student._id)}/pause-escalation`,
      )
      .send({ pausedUntil: until })
      .expect(200);

    // Run cron.
    await feeAlertsCronWorker(buildCronJob({ collegeId: fx.collegeId }));

    // Paused student should remain at stage_1 with no late fee.
    const pausedDefaulter = await DefaulterRecord.findOne({
      studentId: pausedStudent.student._id,
    });
    expect(pausedDefaulter?.escalationStage).toBe('stage_1');

    const pausedFines = await FinePenalty.countDocuments({
      studentId: pausedStudent.student._id,
    });
    expect(pausedFines).toBe(0);

    // Active student should have advanced to stage_2 + got a late fee.
    const activeDefaulter = await DefaulterRecord.findOne({
      studentId: activeStudent.student._id,
    });
    expect(activeDefaulter?.escalationStage).toBe('stage_2');

    const activeFines = await FinePenalty.countDocuments({
      studentId: activeStudent.student._id,
    });
    expect(activeFines).toBe(1);

    // Audit record reflects the paused skip count.
    const audit = await FeeAlertsCronRun.findOne({
      collegeId: fx.collegeId,
    }).sort({ startedAt: -1 });
    expect(audit?.paused).toBeGreaterThanOrEqual(1);

    // Silence unused-var warnings.
    void activeInv;
  }, 60_000);
});

// ══════════════════════════════════════════════════════════════════════
// Scenario 7 — Invoice paid mid-dispatch
// ══════════════════════════════════════════════════════════════════════
describe('7. Invoice paid mid-dispatch', () => {
  it('stub worker marks the reminder skipped_paid when the invoice is already paid', async () => {
    const s = await createTestStudent(fx.collegeId, {
      programmeId: String(fx.btech._id),
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
    });
    const inv = await Invoice.create({
      collegeId: fx.collegeId,
      invoiceNumber: `T12-PAID-${Date.now()}`,
      studentId: s.student._id,
      type: 'fee',
      items: [{ description: 'Tuition', amount: 10_000 }],
      totalAmount: 10_000,
      dueDate: daysAgoAt(5),
      status: 'generated',
      issuedDate: daysAgoAt(35),
    });
    const reminder = await FeeReminder.create({
      collegeId: fx.collegeId,
      studentId: s.student._id,
      channel: 'sms',
      sentAt: FROZEN_NOW,
      dueAmount: 10_000,
      status: 'sent',
      invoiceId: inv._id,
      escalationStage: 'stage_1',
      templateId: 'TPL_STAGE1_SMS',
      deliveryStatus: 'pending',
    });

    // Simulate the invoice being paid between cron decision and stub
    // dispatch (the edge case the guard in _stub-delivery.ts handles).
    await Invoice.updateOne({ _id: inv._id }, { status: 'paid' });

    await smsStubWorker(
      buildStubJob({
        to: '+919876543210',
        template: 'TPL_STAGE1_SMS',
        context: { amount: 10_000 },
        reminderId: String(reminder._id),
      }),
    );

    const updated = await FeeReminder.findById(reminder._id);
    expect(updated?.deliveryStatus).toBe('skipped_paid');
  });
});

// ══════════════════════════════════════════════════════════════════════
// Scenario 8 — HOD scope isolation
// ══════════════════════════════════════════════════════════════════════
describe('8. HOD scope isolation', () => {
  /**
   * Uses the service layer directly. The shared e2e harness runs with
   * `RBAC_ENFORCE='false'`, which makes `authorize()` a pass-through and
   * never populates `authScope.departmentId` — the controller's HOD
   * resolver would therefore see an empty programmeIds list and return
   * nothing, which exercises a different code path than the HOD-scope
   * one we want to verify here. Calling the service with a hand-built
   * AuthScope exercises the programme-filtering pipeline the HTTP route
   * delegates to and is the most direct test of the HOD isolation
   * invariant.
   */
  it('getDashboard restricts funnel + dueByProgramme to hodProgrammeIds', async () => {
    // Create a second Programme (ECE-specific) and a second Batch under
    // it, so CSE + ECE are legitimately separate programme groups.
    const { Programme } = await import(
      '../../models/academic-structure/Programme'
    );
    const { Batch } = await import('../../models/academic-structure/Batch');

    const eceProgramme = await Programme.create({
      collegeId: fx.collegeId,
      code: 'ECE-UG',
      name: 'B.Tech ECE',
      level: 'UG',
      durationYears: 4,
      regulationId: fx.regulation._id,
      isActive: true,
    });
    const eceBatch = await Batch.create({
      collegeId: fx.collegeId,
      code: 'ECE-2024',
      name: 'ECE 2024',
      admissionYear: 2024,
      programmeId: eceProgramme._id,
      regulationId: fx.regulation._id,
      isActive: true,
    });

    // 5 CSE students with stage_2 defaulters.
    for (let i = 0; i < 5; i += 1) {
      const s = await createTestStudent(fx.collegeId, {
        programmeId: String(fx.btech._id),
        branchId: String(fx.cseBranch._id),
        batchId: String(fx.batch._id),
      });
      const inv = await Invoice.create({
        collegeId: fx.collegeId,
        invoiceNumber: `T12-HOD-CSE-${i}-${Date.now()}`,
        studentId: s.student._id,
        type: 'fee',
        items: [{ description: 'Tuition', amount: 20_000 }],
        totalAmount: 20_000,
        dueDate: daysAgoAt(10),
        status: 'overdue',
        issuedDate: daysAgoAt(40),
      });
      await DefaulterRecord.create({
        collegeId: fx.collegeId,
        studentId: s.student._id,
        invoiceId: inv._id,
        overdueAmount: 20_000,
        daysOverdue: 10,
        escalationStage: 'stage_2',
      });
    }

    // 5 ECE students with stage_3 defaulters.
    for (let i = 0; i < 5; i += 1) {
      const s = await createTestStudent(fx.collegeId, {
        programmeId: String(eceProgramme._id),
        branchId: String(fx.eceBranch._id),
        batchId: String(eceBatch._id),
      });
      const inv = await Invoice.create({
        collegeId: fx.collegeId,
        invoiceNumber: `T12-HOD-ECE-${i}-${Date.now()}`,
        studentId: s.student._id,
        type: 'fee',
        items: [{ description: 'Tuition', amount: 20_000 }],
        totalAmount: 20_000,
        dueDate: daysAgoAt(20),
        status: 'overdue',
        issuedDate: daysAgoAt(40),
      });
      await DefaulterRecord.create({
        collegeId: fx.collegeId,
        studentId: s.student._id,
        invoiceId: inv._id,
        overdueAmount: 20_000,
        daysOverdue: 20,
        escalationStage: 'stage_3',
      });
    }

    // HOD of CSE: restrict to the B.Tech programmeId only.
    const cseHodDashboard = await feeAnalyticsService.getDashboard(
      fx.collegeId,
      {
        from: daysAgoAt(60),
        to: daysAheadAt(1),
      },
      {
        role: 'hod',
        collegeId: fx.collegeId,
        hodProgrammeIds: [String(fx.btech._id)],
      },
    );

    // Only CSE (stage_2) students show up in the funnel.
    expect(cseHodDashboard.funnelByStage.stage_2).toBe(5);
    expect(cseHodDashboard.funnelByStage.stage_3).toBe(0);

    // dueByProgramme contains only the CSE (B.Tech) programme row — no
    // ECE row should appear.
    const programmeIds = cseHodDashboard.dueByProgramme.map(
      (p) => p.programmeId,
    );
    expect(programmeIds).toContain(String(fx.btech._id));
    expect(programmeIds).not.toContain(String(eceProgramme._id));

    // Admin (no HOD scope) sees both programmes.
    const adminDashboard = await feeAnalyticsService.getDashboard(
      fx.collegeId,
      {
        from: daysAgoAt(60),
        to: daysAheadAt(1),
      },
      { role: 'admin', collegeId: fx.collegeId },
    );
    expect(adminDashboard.funnelByStage.stage_2).toBe(5);
    expect(adminDashboard.funnelByStage.stage_3).toBe(5);
    const adminProgrammeIds = adminDashboard.dueByProgramme.map(
      (p) => p.programmeId,
    );
    expect(adminProgrammeIds).toContain(String(fx.btech._id));
    expect(adminProgrammeIds).toContain(String(eceProgramme._id));

    // Silence unused ObjectId warnings if TypeScript complains.
    void new Types.ObjectId();
  }, 60_000);
});
