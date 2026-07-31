/**
 * 007 · T3 — fee-billing-service.generateSemesterInstallmentForStudent.
 *
 * The core generator. Proves the whole outcome tree, plus the two GATE-2 fixes that
 * only a test can lock in: (1) an exam-fee `type:'fee'` invoice for the same
 * (student, semester) does NOT block tuition (idempotency keys on the flag, G2-C1),
 * and (2) a mid-write failure leaves NO orphan invoice/balance (compensating rollback,
 * G2-H2). The floor+remainder split is checked on an odd annual so ±₹1 can't hide.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Types } from 'mongoose';

// Importing fee-pin-service (via the service under test) pulls the commitment-sheet
// worker into the graph; mock it so no BullMQ/Redis connection is attempted.
vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock' }),
}));

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { Semester } from '../../../models/academic-structure/Semester';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { Invoice } from '../../../models/finance/Invoice';
import { InvoiceLineItem } from '../../../models/finance/InvoiceLineItem';
import { StudentFeeAccount } from '../../../models/finance/StudentFeeAccount';
import {
  generateSemesterInstallmentForStudent,
  generateSemesterInstallmentsForPinned,
} from '../fee-billing-service';

const COLLEGE = new Types.ObjectId();
const AY = new Types.ObjectId();
const PROG = new Types.ObjectId();

async function makeSemester(number: number, academicYearId = AY) {
  const s = await Semester.create({
    collegeId: COLLEGE, academicYearId, number, year: 2025,
    startDate: new Date('2025-07-01'), endDate: new Date('2025-12-15'),
  });
  return String(s._id);
}

async function makeFsi(academicYearId = AY, totalAmount = 90000) {
  const f = await FeeStructureInstance.create({
    collegeId: COLLEGE, academicYearId, programmeId: PROG,
    yearOfStudy: 1, totalAmount, status: 'active',
  });
  return f._id as Types.ObjectId;
}

/** A student with one non-archived pin at year 1, no batch (→ admission-year fallback). */
async function makePinnedStudent(opts: {
  fsiId: Types.ObjectId;
  snapshotTotalAmount?: number;
  components?: Array<{ name: string; amount: number }>;
  pins?: boolean;
}) {
  const feePins = opts.pins === false ? [] : [{
    yearOfStudy: 1,
    feeStructureInstanceId: opts.fsiId,
    pinnedBy: 'test',
    reason: 'initial',
    ...(opts.snapshotTotalAmount !== undefined ? { snapshotTotalAmount: opts.snapshotTotalAmount } : {}),
    ...(opts.components ? {
      snapshotComponents: opts.components.map((c) => ({
        feeComponentId: new Types.ObjectId(), name: c.name, amount: c.amount,
        componentType: 'tuition', isRefundable: false,
      })),
    } : {}),
  }];
  const s = await Student.create({
    collegeId: COLLEGE, personId: new Types.ObjectId(), admissionYear: 2025,
    studyYearAtAdmission: 1, status: 'active', feePins,
  });
  return String(s._id);
}

beforeAll(async () => { await setupMongo(); }, 90_000);
afterAll(async () => { await teardownMongo(); }, 30_000);
afterEach(async () => { await clearCollections(); vi.restoreAllMocks(); });

describe('007 T3 — generateSemesterInstallmentForStudent', () => {
  it('bills half the annual for Sem-1 and credits the account', async () => {
    const fsiId = await makeFsi();
    const studentId = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000, components: [{ name: 'Tuition', amount: 90000 }] });
    const semesterId = await makeSemester(1);

    const r = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin');
    expect(r.kind).toBe('generated');
    if (r.kind !== 'generated') return;
    expect(r.amount).toBe(45000);
    expect(r.derivedFrom).toBe('admission'); // no batch → admission-year fallback

    const inv = await Invoice.findById(r.invoiceId).lean();
    expect(inv?.isSemesterInstallment).toBe(true);
    expect(inv?.totalAmount).toBe(45000);
    const acct = await StudentFeeAccount.findOne({ collegeId: COLLEGE, studentId }).lean();
    expect(acct?.balance).toBe(45000);
    expect(acct?.totalDue).toBe(45000);
    const lines = await InvoiceLineItem.find({ invoiceId: r.invoiceId }).lean();
    expect(lines.reduce((s, l) => s + l.netAmount, 0)).toBe(45000);
  });

  it('splits an ODD annual exactly across the two semesters (no ±1)', async () => {
    const fsiId = await makeFsi(AY, 90001);
    const studentId = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90001, components: [{ name: 'Tuition', amount: 90001 }] });
    const sem1 = await makeSemester(1);
    const sem2 = await makeSemester(2);

    const r1 = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId: sem1 }, 'admin');
    const r2 = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId: sem2 }, 'admin');
    const a1 = r1.kind === 'generated' ? r1.amount : 0;
    const a2 = r2.kind === 'generated' ? r2.amount : 0;
    expect(a1).toBe(45000);
    expect(a2).toBe(45001);
    expect(a1 + a2).toBe(90001);
  });

  it('is idempotent: a second run returns already-billed, no duplicate', async () => {
    const fsiId = await makeFsi();
    const studentId = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 });
    const semesterId = await makeSemester(1);

    const first = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin');
    const second = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin');
    expect(second.kind).toBe('already-billed');
    if (first.kind === 'already-billed') return;
    expect(await Invoice.countDocuments({ studentId, isSemesterInstallment: true })).toBe(1);
  });

  it('G2-C1: an exam-fee type:fee invoice for the same (student,semester) does NOT block tuition', async () => {
    const fsiId = await makeFsi();
    const studentId = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 });
    const semesterId = await makeSemester(1);
    // Pre-existing EXAM invoice: type:'fee', same student+semester, but no installment flag.
    await Invoice.create({
      collegeId: COLLEGE, invoiceNumber: 'EXAM-1', type: 'fee', examType: 'regular',
      totalAmount: 1200, dueDate: new Date(), studentId, semesterId,
    });

    const r = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin');
    expect(r.kind).toBe('generated'); // exam invoice must NOT trip the idempotency skip
  });

  it('skips a student with no active pin', async () => {
    const fsiId = await makeFsi();
    const studentId = await makePinnedStudent({ fsiId, pins: false });
    const semesterId = await makeSemester(1);
    const r = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin');
    expect(r.kind).toBe('no-active-pin');
  });

  it('skips pinned-to-different-ay when the pin FSI year ≠ the semester year', async () => {
    const otherAy = new Types.ObjectId();
    const fsiId = await makeFsi(otherAy);                  // pin belongs to a DIFFERENT AY
    const studentId = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 });
    const semesterId = await makeSemester(1, AY);          // semester in the current AY
    const r = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin');
    expect(r.kind).toBe('pinned-to-different-ay');
  });

  it('skips no-amount when neither snapshot nor FSI carries a total', async () => {
    const fsiId = await makeFsi(AY, 0);                    // FSI total 0
    const studentId = await makePinnedStudent({ fsiId });  // pin has no snapshotTotalAmount
    const semesterId = await makeSemester(1);
    const r = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin');
    expect(r.kind).toBe('skipped');
    if (r.kind === 'skipped') expect(r.reason).toBe('no-amount');
  });

  it('skips unsupported-semester-number for a non-{1,2} semester', async () => {
    const fsiId = await makeFsi();
    const studentId = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 });
    const semesterId = await makeSemester(3);
    const r = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin');
    expect(r.kind).toBe('skipped');
    if (r.kind === 'skipped') expect(r.reason).toBe('unsupported-semester-number');
  });

  it('dry-run writes nothing', async () => {
    const fsiId = await makeFsi();
    const studentId = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 });
    const semesterId = await makeSemester(1);
    const r = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin', { dryRun: true });
    expect(r.kind).toBe('generated');
    expect(await Invoice.countDocuments({ studentId })).toBe(0);
    expect(await StudentFeeAccount.countDocuments({ studentId })).toBe(0);
  });

  it('G2-H2: a mid-write failure leaves no orphan invoice or balance', async () => {
    const fsiId = await makeFsi();
    const studentId = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000, components: [{ name: 'Tuition', amount: 90000 }] });
    const semesterId = await makeSemester(1);
    const spy = vi.spyOn(InvoiceLineItem, 'create').mockRejectedValueOnce(new Error('boom') as never);

    const r = await generateSemesterInstallmentForStudent(String(COLLEGE), { studentId, semesterId }, 'admin');
    expect(r.kind).toBe('error');
    expect(await Invoice.countDocuments({ studentId, isSemesterInstallment: true })).toBe(0); // compensated
    expect(await StudentFeeAccount.countDocuments({ studentId })).toBe(0);
    spy.mockRestore();
  });
});

describe('007 T4 — generateSemesterInstallmentsForPinned (batch)', () => {
  it('bills every active pinned student and aggregates the outcomes', async () => {
    const fsiId = await makeFsi();
    const willPin = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 });
    const noPin = await makePinnedStudent({ fsiId, pins: false });
    const semesterId = await makeSemester(1);

    const r = await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId }, 'admin');
    // Candidate set is "active students with a non-archived pin", so the no-pin
    // student is not even a candidate — it isn't counted.
    expect(r.generated).toBe(1);
    expect(r.errors).toHaveLength(0);
    expect(await Invoice.countDocuments({ studentId: willPin, isSemesterInstallment: true })).toBe(1);
    expect(await Invoice.countDocuments({ studentId: noPin })).toBe(0);
  });

  it('honours an explicit studentIds set', async () => {
    const fsiId = await makeFsi();
    const a = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 });
    const b = await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 });
    const semesterId = await makeSemester(1);

    const r = await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId, studentIds: [a] }, 'admin');
    expect(r.generated).toBe(1);
    expect(await Invoice.countDocuments({ studentId: a, isSemesterInstallment: true })).toBe(1);
    expect(await Invoice.countDocuments({ studentId: b, isSemesterInstallment: true })).toBe(0);
  });

  it('dry-run reports counts and writes nothing', async () => {
    const fsiId = await makeFsi();
    await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 });
    const semesterId = await makeSemester(1);

    const r = await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId, dryRun: true }, 'admin');
    expect(r.dryRun).toBe(true);
    expect(r.generated).toBe(1);
    expect(await Invoice.countDocuments({ isSemesterInstallment: true })).toBe(0);
  });

  it('yearOfStudy filter skips students not in that year', async () => {
    const fsiId = await makeFsi();
    await makePinnedStudent({ fsiId, snapshotTotalAmount: 90000 }); // resolves to year 1 (admission fallback)
    const semesterId = await makeSemester(1);

    const r = await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId, yearOfStudy: 3 }, 'admin');
    expect(r.generated).toBe(0); // nobody is in year 3
  });
});
