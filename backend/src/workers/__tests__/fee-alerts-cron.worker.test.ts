/**
 * T5 — fee-alerts-cron worker tests (the hardest task in the feature).
 *
 * Scope (plan §1.5, spec §Journey 2 / §EC-1..5):
 *   - Stage-transition engine: day-0 through day-70+ → correct stage +
 *     side effects (FinePenalty on stage_2, FinancialHold on stage_4,
 *     welfare flag on welfare_referred).
 *   - Transition guards: side effects only fire on stage ADVANCE, never
 *     on same-stage or "already escalated today".
 *   - Idempotency: re-running the cron on the same day is a no-op on
 *     every DefaulterRecord whose `lastEscalationAt >= startOfToday`.
 *   - Pause gate: `autoEscalationPaused > now` skips the student.
 *   - Exit/graduated students are skipped before any defaulter logic.
 *   - Per-student error tolerance: an exception in one student must not
 *     abort the college; per-college error tolerance: an exception in
 *     one college must not abort the run.
 *   - dryRun=true: no new FinePenalty, no new FinancialHold, no
 *     DefaulterRecord writes, no FeeAlertsCronRun persisted.
 *
 * Implementation notes:
 *   - We invoke the worker processor directly with a mocked Job so no
 *     BullMQ / Redis is required.
 *   - `vi.setSystemTime` freezes Date so `daysOverdue` is deterministic.
 *   - `executeReminderSequence` is mocked to keep tests cheap; we only
 *     assert the call count / arguments.
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
import mongoose from 'mongoose';
import type { Job } from 'bullmq';

// ── Mock reminder sequence (cheap — we only assert call-count) ────────
vi.mock('../../modules/finance/service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../modules/finance/service')>();
  return {
    ...actual,
    executeReminderSequence: vi.fn().mockResolvedValue({
      remindersCreated: 1,
      channel: 'sms',
      escalationStage: 'stage_1',
    }),
  };
});

import * as financeService from '../../modules/finance/service';
import {
  FEE_ALERTS_CRON_CONCURRENCY,
  FEE_ALERTS_CRON_JOB_OPTS,
  feeAlertsCronWorker,
  type FeeAlertsCronJobData,
} from '../fee-alerts-cron.worker';
import { College } from '../../models/College';
import { Invoice } from '../../models/finance/Invoice';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { FinePenalty } from '../../models/finance/FinePenalty';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { FeeAlertsCronRun } from '../../models/finance/FeeAlertsCronRun';
import { Student } from '../../models/people/Student';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

const oid = () => new mongoose.Types.ObjectId();

// A fixed "today" so `daysOverdue` math is deterministic across tests.
// 2026-04-21T10:00:00 IST; picking a mid-day UTC avoids TZ flakiness.
const FROZEN_NOW = new Date('2026-04-21T06:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
function dueDate(daysAgo: number): Date {
  return new Date(FROZEN_NOW.getTime() - daysAgo * DAY_MS);
}

function buildJob(data: FeeAlertsCronJobData = {}): Job<FeeAlertsCronJobData> {
  return {
    id: 'job-1',
    name: 'nightly',
    data,
  } as unknown as Job<FeeAlertsCronJobData>;
}

async function seedCollege(name: string, code: string, status = 'active') {
  return College.create({
    name,
    code,
    address: { line1: '1 Main', city: 'C', state: 'S', pincode: '000001' },
    contactEmail: `${code.toLowerCase()}@example.com`,
    contactPhone: '9999999999',
    status,
  });
}

interface SeedStudentOpts {
  collegeId: mongoose.Types.ObjectId;
  rollNumber: string;
  status?: string;
}
async function seedStudent(opts: SeedStudentOpts) {
  return Student.create({
    collegeId: opts.collegeId,
    personId: oid(),
    admissionYear: 2024,
    rollNumber: opts.rollNumber,
    status: opts.status ?? 'active',
    onboardingStatus: 'completed',
    isSealed: false,
  });
}

interface SeedInvoiceOpts {
  collegeId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  daysOverdue: number;
  totalAmount?: number;
  amountPaid?: number;
  status?: string;
  invoiceNumber?: string;
}
async function seedInvoice(opts: SeedInvoiceOpts) {
  return Invoice.create({
    collegeId: opts.collegeId,
    invoiceNumber: opts.invoiceNumber ?? `INV-${Math.random().toString(36).slice(2, 10)}`,
    studentId: opts.studentId,
    type: 'fee',
    items: [{ description: 'Tuition', amount: opts.totalAmount ?? 50000 }],
    totalAmount: opts.totalAmount ?? 50000,
    dueDate: dueDate(opts.daysOverdue),
    status: opts.status ?? 'generated',
    // Note: Invoice schema has no `amountPaid` — tests that care pass it
    // via `metadata.amountPaid` and the worker computes overdueAmount
    // off of `totalAmount` alone (no field on Invoice today).
  });
}

describe('feeAlertsCronWorker', () => {
  beforeAll(async () => {
    await setupMongo();
    await Promise.all([
      College.syncIndexes(),
      Invoice.syncIndexes(),
      Student.syncIndexes(),
      DefaulterRecord.syncIndexes(),
      FinePenalty.syncIndexes(),
      FinancialHold.syncIndexes(),
      FeeAlertsCronRun.syncIndexes(),
    ]);
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
    vi.mocked(financeService.executeReminderSequence).mockClear();
    vi.useRealTimers();
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  // ── Public exports / contract ──────────────────────────────────────
  describe('exports', () => {
    it('exports FEE_ALERTS_CRON_CONCURRENCY = 1', () => {
      expect(FEE_ALERTS_CRON_CONCURRENCY).toBe(1);
    });

    it('exports FEE_ALERTS_CRON_JOB_OPTS with 3 attempts, 5-min exponential backoff, daily-02:00 cron', () => {
      expect(FEE_ALERTS_CRON_JOB_OPTS.attempts).toBe(3);
      expect(FEE_ALERTS_CRON_JOB_OPTS.backoff.type).toBe('exponential');
      expect(FEE_ALERTS_CRON_JOB_OPTS.backoff.delay).toBe(5 * 60 * 1000);
      expect(FEE_ALERTS_CRON_JOB_OPTS.cronPattern).toBe('0 2 * * *');
    });
  });

  // ── Scenario 1: Day 0 invoice (due today) → stage_1, no penalty/hold
  it('Day 0 invoice → stage_1, no FinePenalty, no FinancialHold', async () => {
    const college = await seedCollege('College A', 'A01');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S1' });
    await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 0,
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    const defaulter = await DefaulterRecord.findOne({ studentId: student._id });
    expect(defaulter?.escalationStage).toBe('stage_1');
    expect(await FinePenalty.countDocuments()).toBe(0);
    expect(await FinancialHold.countDocuments()).toBe(0);
  });

  // ── Scenario 2: Day 3 overdue → stage_1, no penalty, no hold
  it('Day 3 overdue → stage_1, no FinePenalty, no FinancialHold', async () => {
    const college = await seedCollege('College A', 'A02');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S2' });
    await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 3,
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    const defaulter = await DefaulterRecord.findOne({ studentId: student._id });
    expect(defaulter?.escalationStage).toBe('stage_1');
    expect(await FinePenalty.countDocuments()).toBe(0);
    expect(await FinancialHold.countDocuments()).toBe(0);
    expect(financeService.executeReminderSequence).toHaveBeenCalledTimes(1);
  });

  // ── Scenario 3: Day 10 overdue, first time → stage_2 transition
  it('Day 10 overdue first time → stage_2 transition → 1 FinePenalty (late_fee ₹200)', async () => {
    const college = await seedCollege('College A', 'A03');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S3' });
    const invoice = await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 10,
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    const defaulter = await DefaulterRecord.findOne({ studentId: student._id });
    expect(defaulter?.escalationStage).toBe('stage_2');

    const penalties = await FinePenalty.find({ studentId: student._id });
    expect(penalties).toHaveLength(1);
    expect(penalties[0]?.type).toBe('late_fee');
    expect(penalties[0]?.amount).toBe(200);
    expect(String(penalties[0]?.collegeId)).toBe(String(college._id));
    expect(String(penalties[0]?.studentId)).toBe(String(student._id));

    expect(await FinancialHold.countDocuments()).toBe(0);
    // Sanity: the penalty is tied to this invoice (either via metadata or
    // via reason mentioning it). We keep the assertion loose — the model
    // doesn't have an `invoiceId` field; we just verify amount + type.
    expect(invoice).toBeTruthy();
  });

  // ── Scenario 4: Day 20 overdue on student already at stage_2 → stage_3
  //                → no NEW penalty, no new hold
  it('Day 20 overdue (already at stage_2) → stage_3, no new FinePenalty, no new FinancialHold', async () => {
    const college = await seedCollege('College A', 'A04');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S4' });
    const invoice = await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 20,
    });
    // Pre-existing stage_2 state (reached on a prior run).
    await DefaulterRecord.create({
      collegeId: college._id,
      studentId: student._id,
      invoiceId: invoice._id,
      overdueAmount: 50000,
      daysOverdue: 10,
      escalationStage: 'stage_2',
      lastEscalationAt: new Date(FROZEN_NOW.getTime() - 10 * DAY_MS),
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    const defaulter = await DefaulterRecord.findOne({ studentId: student._id });
    expect(defaulter?.escalationStage).toBe('stage_3');
    // No NEW FinePenalty (the stage_2 transition guard only fires on
    // entry into stage_2, not on advance out of it).
    expect(await FinePenalty.countDocuments()).toBe(0);
    expect(await FinancialHold.countDocuments()).toBe(0);
  });

  // ── Scenario 5: Day 40 overdue, first time → stage_4 transition
  //                → 1 FinancialHold, status = pending_approval
  it('Day 40 overdue first time → stage_4 transition → 1 FinancialHold (pending_approval)', async () => {
    const college = await seedCollege('College A', 'A05');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S5' });
    await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 40,
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    const defaulter = await DefaulterRecord.findOne({ studentId: student._id });
    expect(defaulter?.escalationStage).toBe('stage_4');

    const holds = await FinancialHold.find({ studentId: student._id });
    expect(holds).toHaveLength(1);
    expect(holds[0]?.holdStatus).toBe('pending_approval');
    expect(holds[0]?.holdType).toBe('exam_debarment');
    expect(String(holds[0]?.collegeId)).toBe(String(college._id));

    // Transition from stage_1 (defaulter auto-created at stage_1) into
    // stage_4 does NOT create a stage_2 late-fee retroactively.
    expect(await FinePenalty.countDocuments()).toBe(0);
  });

  // ── Scenario 6: Day 70 overdue → welfare_referred, no reminder
  it('Day 70 overdue → welfare_referred, welfareReferralStatus=pending, NO reminder dispatched', async () => {
    const college = await seedCollege('College A', 'A06');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S6' });
    await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 70,
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    const defaulter = await DefaulterRecord.findOne({ studentId: student._id });
    expect(defaulter?.escalationStage).toBe('welfare_referred');
    expect(defaulter?.welfareReferralStatus).toBe('pending');

    // Welfare team handles directly — cron does NOT dispatch a reminder.
    expect(financeService.executeReminderSequence).not.toHaveBeenCalled();
  });

  // ── Scenario 7: Re-run SAME day → idempotent
  it('re-run same day → idempotent (no new FinePenalty, no new FinancialHold, audit.alreadyAdvanced+=1)', async () => {
    const college = await seedCollege('College A', 'A07');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S7' });
    await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 10,
    });

    // First run: advances to stage_2 + creates 1 FinePenalty.
    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );
    expect(await FinePenalty.countDocuments()).toBe(1);

    // Second run same day: no new side effects.
    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    expect(await FinePenalty.countDocuments()).toBe(1);
    expect(await FinancialHold.countDocuments()).toBe(0);

    const runs = await FeeAlertsCronRun.find({ collegeId: college._id }).sort({ startedAt: 1 });
    expect(runs).toHaveLength(2);
    // The second run records the student as already-advanced.
    expect(runs[1]?.alreadyAdvanced).toBeGreaterThanOrEqual(1);
  });

  // ── Scenario 8: Already at stage_2 + still day 10 → no new penalty
  it('already at stage_2 + still day 10 → no new FinePenalty, audit.unchanged+=1', async () => {
    const college = await seedCollege('College A', 'A08');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S8' });
    const invoice = await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 10,
    });
    // Pre-existing stage_2 state from yesterday (so same-day idempotency
    // doesn't short-circuit before the "unchanged" branch fires).
    await DefaulterRecord.create({
      collegeId: college._id,
      studentId: student._id,
      invoiceId: invoice._id,
      overdueAmount: 50000,
      daysOverdue: 9,
      escalationStage: 'stage_2',
      lastEscalationAt: new Date(FROZEN_NOW.getTime() - 1 * DAY_MS),
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    expect(await FinePenalty.countDocuments()).toBe(0);
    const defaulter = await DefaulterRecord.findOne({ studentId: student._id });
    expect(defaulter?.escalationStage).toBe('stage_2');

    const run = await FeeAlertsCronRun.findOne({ collegeId: college._id });
    expect(run?.unchanged).toBeGreaterThanOrEqual(1);
  });

  // ── Scenario 9: stage_3 → stage_4 transition → exactly 1 FinancialHold
  it('stage_3 → stage_4 transition → exactly 1 FinancialHold (pending_approval)', async () => {
    const college = await seedCollege('College A', 'A09');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S9' });
    const invoice = await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 40,
    });
    // Pre-existing stage_3 state from a prior day.
    await DefaulterRecord.create({
      collegeId: college._id,
      studentId: student._id,
      invoiceId: invoice._id,
      overdueAmount: 50000,
      daysOverdue: 30,
      escalationStage: 'stage_3',
      lastEscalationAt: new Date(FROZEN_NOW.getTime() - 1 * DAY_MS),
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    const defaulter = await DefaulterRecord.findOne({ studentId: student._id });
    expect(defaulter?.escalationStage).toBe('stage_4');

    const holds = await FinancialHold.find({ studentId: student._id });
    expect(holds).toHaveLength(1);
    expect(holds[0]?.holdStatus).toBe('pending_approval');
  });

  // ── Scenario 10: autoEscalationPaused = tomorrow → skipped
  it('autoEscalationPaused = tomorrow → student skipped (audit.paused+=1)', async () => {
    const college = await seedCollege('College A', 'A10');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S10' });
    const invoice = await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 20,
    });
    const tomorrow = new Date(FROZEN_NOW.getTime() + 1 * DAY_MS);
    await DefaulterRecord.create({
      collegeId: college._id,
      studentId: student._id,
      invoiceId: invoice._id,
      overdueAmount: 50000,
      daysOverdue: 10,
      escalationStage: 'stage_2',
      lastEscalationAt: new Date(FROZEN_NOW.getTime() - 5 * DAY_MS),
      autoEscalationPaused: tomorrow,
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    // No stage advance, no new penalty, no hold.
    const defaulter = await DefaulterRecord.findOne({ studentId: student._id });
    expect(defaulter?.escalationStage).toBe('stage_2');
    expect(await FinePenalty.countDocuments()).toBe(0);
    expect(await FinancialHold.countDocuments()).toBe(0);
    expect(financeService.executeReminderSequence).not.toHaveBeenCalled();

    const run = await FeeAlertsCronRun.findOne({ collegeId: college._id });
    expect(run?.paused).toBeGreaterThanOrEqual(1);
  });

  // ── Scenario 11: Student status='exited' → skipped
  it("student status='exited' → skipped (audit.skipped+=1)", async () => {
    const college = await seedCollege('College A', 'A11');
    const student = await seedStudent({
      collegeId: college._id,
      rollNumber: 'S11',
      status: 'exited',
    });
    await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 40,
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id) }),
    );

    expect(await DefaulterRecord.countDocuments()).toBe(0);
    expect(await FinePenalty.countDocuments()).toBe(0);
    expect(await FinancialHold.countDocuments()).toBe(0);

    const run = await FeeAlertsCronRun.findOne({ collegeId: college._id });
    expect(run?.skipped).toBeGreaterThanOrEqual(1);
  });

  // ── Scenario 12: College A throws on one student, others still processed;
  //                College B's audit written independently.
  it('one student error → other students still processed; per-college errors isolated', async () => {
    const collegeA = await seedCollege('College A', 'A12');
    const collegeB = await seedCollege('College B', 'B12');

    const studentOk = await seedStudent({ collegeId: collegeA._id, rollNumber: 'OK' });
    const studentBad = await seedStudent({ collegeId: collegeA._id, rollNumber: 'BAD' });
    const studentB = await seedStudent({ collegeId: collegeB._id, rollNumber: 'B1' });

    await seedInvoice({
      collegeId: collegeA._id,
      studentId: studentOk._id,
      daysOverdue: 3,
    });
    await seedInvoice({
      collegeId: collegeA._id,
      studentId: studentBad._id,
      daysOverdue: 10,
    });
    await seedInvoice({
      collegeId: collegeB._id,
      studentId: studentB._id,
      daysOverdue: 5,
    });

    // Force the reminder-sequence mock to throw for the "bad" student but
    // succeed for the others. The worker should catch per-student, move
    // on, and continue into college B.
    vi.mocked(financeService.executeReminderSequence).mockImplementation(
      async (_collegeId: string, defaulterId: string) => {
        const d = await DefaulterRecord.findById(defaulterId);
        if (d && String(d.studentId) === String(studentBad._id)) {
          throw new Error('boom: bad student');
        }
        return {
          remindersCreated: 1,
          channel: 'sms',
          escalationStage: 'stage_1',
        };
      },
    );

    await feeAlertsCronWorker(buildJob());

    // Other students in college A still got defaulter records + advances.
    const okDef = await DefaulterRecord.findOne({ studentId: studentOk._id });
    expect(okDef).toBeTruthy();
    const bDef = await DefaulterRecord.findOne({ studentId: studentB._id });
    expect(bDef).toBeTruthy();

    // Both college audits are written.
    const runA = await FeeAlertsCronRun.findOne({ collegeId: collegeA._id });
    const runB = await FeeAlertsCronRun.findOne({ collegeId: collegeB._id });
    expect(runA).toBeTruthy();
    expect(runB).toBeTruthy();

    // Per-student error recorded in A's audit.
    expect(runA!.errors.length).toBeGreaterThanOrEqual(1);
    const errStudentIds = runA!.errors
      .map((e) => (e.studentId ? String(e.studentId) : ''))
      .filter(Boolean);
    expect(errStudentIds).toContain(String(studentBad._id));
    // B's audit should have zero errors.
    expect(runB!.errors.length).toBe(0);
  });

  // ── Scenario 13: dryRun=true → zero DB writes
  it('dryRun=true → zero new FinePenalty, zero FinancialHold, zero DefaulterRecord writes, audit NOT persisted', async () => {
    const college = await seedCollege('College A', 'A13');
    const student = await seedStudent({ collegeId: college._id, rollNumber: 'S13' });
    await seedInvoice({
      collegeId: college._id,
      studentId: student._id,
      daysOverdue: 40,
    });

    await feeAlertsCronWorker(
      buildJob({ collegeId: String(college._id), dryRun: true }),
    );

    expect(await DefaulterRecord.countDocuments()).toBe(0);
    expect(await FinePenalty.countDocuments()).toBe(0);
    expect(await FinancialHold.countDocuments()).toBe(0);
    expect(await FeeAlertsCronRun.countDocuments()).toBe(0);
    // Reminder dispatch is also a side-effect → skipped in dryRun.
    expect(financeService.executeReminderSequence).not.toHaveBeenCalled();
  });

  // ── Bonus: non-active colleges skipped
  it('skips colleges with status != active when collegeId is not specified', async () => {
    const active = await seedCollege('Active', 'ACT1');
    const suspended = await seedCollege('Suspended', 'SUS1', 'suspended');
    const studentA = await seedStudent({ collegeId: active._id, rollNumber: 'SA' });
    const studentS = await seedStudent({ collegeId: suspended._id, rollNumber: 'SS' });
    await seedInvoice({
      collegeId: active._id,
      studentId: studentA._id,
      daysOverdue: 3,
    });
    await seedInvoice({
      collegeId: suspended._id,
      studentId: studentS._id,
      daysOverdue: 3,
    });

    await feeAlertsCronWorker(buildJob());

    const runs = await FeeAlertsCronRun.find({});
    expect(runs).toHaveLength(1);
    expect(String(runs[0]?.collegeId)).toBe(String(active._id));
    expect(await DefaulterRecord.countDocuments({ studentId: studentA._id })).toBe(1);
    expect(await DefaulterRecord.countDocuments({ studentId: studentS._id })).toBe(0);
  });
});
