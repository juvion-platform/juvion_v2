/**
 * fee-billing-service — pin-driven semester-installment invoice generation (007).
 *
 * The bridge from a *pinned* student to *billable dues*: turns the annual fee frozen
 * on a student's fee pin into a per-semester invoice + StudentFeeAccount balance, so
 * a payment can later reduce it and the dashboard can show real Accounts Receivable.
 *
 * DELIBERATELY separate from `fee-lifecycle-service.generateSemesterInvoice`, which
 * carries lazy-pin/caller-FSI baggage, bills the full annual amount, and has no
 * idempotency guard. This module is the narrow, pin-first, semester-split path.
 *
 * Key design points (see .sdd/specs/007-fee-billing-payment-ar + GATE-2 resolution):
 *  - Pin selection is BY YEAR (`resolvePinYearForExistingStudent`, robust for
 *    batch-less imported students), guarded by an academic-year match against the
 *    semester (skip `pinned-to-different-ay` rather than bill silently).
 *  - Idempotency keys on `Invoice.isSemesterInstallment`, NEVER `type:'fee'`
 *    (exam-fee invoices are also `type:'fee'` with a semesterId — G2-C1).
 *  - The annual total splits `floor + remainder` across two semesters so the two
 *    independent invoices sum EXACTLY to the annual figure.
 *  - The Invoice→lineItems→account writes use compensating rollback (no transactions
 *    on this harness), or a mid-write failure would cement a wrong `already-billed`.
 */
import { Types } from 'mongoose';
import crypto from 'crypto';

import { Student } from '../../models/people/Student';
import { Semester } from '../../models/academic-structure/Semester';
import { FeeStructureInstance } from '../../models/finance/FeeStructureInstance';
import { Invoice } from '../../models/finance/Invoice';
import { InvoiceLineItem } from '../../models/finance/InvoiceLineItem';
import { StudentFeeAccount } from '../../models/finance/StudentFeeAccount';
import { resolvePinYearForExistingStudent } from '../people/student-import-pin';
import { resolveActivePin } from './fee-pin-service';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

/** Indian UG programmes run two semesters per academic year, so an annually-authored
 *  fee is billed in two equal installments. NICE-TO-HAVE (later): derive per
 *  programme/regulation, or split at the component level. v1 = equal halves. */
export const SEMESTER_INSTALLMENTS_PER_YEAR = 2;

const DUE_DAYS = 30;

export type BillOutcome =
  | { kind: 'generated'; studentId: string; invoiceId: string; amount: number; yearAssumed: number; derivedFrom: 'calendar' | 'admission' }
  | { kind: 'already-billed'; studentId: string; invoiceId: string }
  | { kind: 'no-active-pin'; studentId: string }
  | { kind: 'pinned-to-different-ay'; studentId: string }
  | { kind: 'skipped'; studentId: string; reason: 'no-amount' | 'unsupported-semester-number' }
  | { kind: 'error'; studentId: string; error: string };

interface ScaledLine {
  feeComponentId?: Types.ObjectId;
  description: string;
  netAmount: number;
}

/** `INV-<ts>-<hex>` — re-declared locally to avoid coupling to the private helper
 *  in fee-lifecycle-service. */
function generateInvoiceNumber(): string {
  return `INV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Scale the pinned components down to this installment, allocating the rounding
 * remainder to the LARGEST line so the lines sum EXACTLY to `installment` (never
 * push the ±₹1 down a level). Falls back to a single line when the pin froze no
 * components.
 */
function buildScaledLineItems(
  components: Array<{ feeComponentId?: Types.ObjectId; name: string; amount: number }>,
  annual: number,
  installment: number,
): ScaledLine[] {
  if (components.length === 0) {
    return [{ description: 'Semester installment', netAmount: installment }];
  }
  const scaled: ScaledLine[] = components.map((c) => ({
    feeComponentId: c.feeComponentId,
    description: c.name,
    netAmount: Math.floor((c.amount * installment) / annual),
  }));
  const remainder = installment - scaled.reduce((s, l) => s + l.netAmount, 0);
  if (remainder !== 0) {
    const largest = scaled.reduce((a, b) => (b.netAmount > a.netAmount ? b : a));
    largest.netAmount += remainder;
  }
  return scaled;
}

/**
 * Generate (or dry-run) one semester-installment invoice for a single student.
 * NEVER throws for business-rule misses — returns a typed `BillOutcome` so a batch
 * can report per-student. Throws only for a genuinely bad request (missing
 * student/semester), which the batch pre-filters.
 */
export async function generateSemesterInstallmentForStudent(
  collegeId: string,
  data: { studentId: string; semesterId: string },
  performedBy: string,
  opts: { dryRun?: boolean } = {},
): Promise<BillOutcome> {
  const { studentId, semesterId } = data;

  const student = await Student.findOne({ _id: studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');

  const semester = await Semester.findOne({ _id: semesterId, collegeId }).lean();
  if (!semester) throw new AppError(404, 'Semester not found');

  if (semester.number !== 1 && semester.number !== 2) {
    return { kind: 'skipped', studentId, reason: 'unsupported-semester-number' };
  }
  const semesterAcademicYearId = String(semester.academicYearId);

  // ── Pin selection BY YEAR (a) — robust for batch-less imported students.
  const { yearOfStudy, derivedFrom } = await resolvePinYearForExistingStudent(
    studentId,
    student.studyYearAtAdmission,
  );
  const pin = await resolveActivePin(studentId, yearOfStudy);
  if (!pin) return { kind: 'no-active-pin', studentId };

  // ── (b) guard: the pin's FSI must belong to the semester's academic year.
  const fsi = await FeeStructureInstance.findOne({
    _id: pin.feeStructureInstanceId,
    collegeId,
  }).lean();
  if (!fsi) {
    return { kind: 'error', studentId, error: `Pin references missing FeeStructureInstance ${String(pin.feeStructureInstanceId)}` };
  }
  if (String(fsi.academicYearId) !== semesterAcademicYearId) {
    return { kind: 'pinned-to-different-ay', studentId };
  }

  // ── Idempotency — keyed on the discriminator, NOT type:'fee' (G2-C1).
  const existing = await Invoice.findOne({
    collegeId,
    studentId,
    semesterId,
    isSemesterInstallment: true,
  }).select('_id').lean();
  if (existing) return { kind: 'already-billed', studentId, invoiceId: String(existing._id) };

  // ── Amount — frozen snapshot preferred; FSI total as fallback; never bill 0.
  const annual = pin.snapshotTotalAmount ?? fsi.totalAmount ?? 0;
  if (!annual || annual <= 0) return { kind: 'skipped', studentId, reason: 'no-amount' };

  const first = Math.floor(annual / SEMESTER_INSTALLMENTS_PER_YEAR);
  const installment = semester.number === 1 ? first : annual - first;

  if (opts.dryRun) {
    return { kind: 'generated', studentId, invoiceId: '', amount: installment, yearAssumed: yearOfStudy, derivedFrom };
  }

  const components = (pin.snapshotComponents ?? []).map((c) => ({
    feeComponentId: c.feeComponentId as Types.ObjectId,
    name: c.name,
    amount: c.amount,
  }));
  const lines = buildScaledLineItems(components, annual, installment);

  const invoice = await Invoice.create({
    collegeId,
    invoiceNumber: generateInvoiceNumber(),
    studentId,
    type: 'fee',
    isSemesterInstallment: true,
    items: lines.map((l) => ({ description: l.description, amount: l.netAmount })),
    totalAmount: installment,
    netPayable: installment,
    dueDate: new Date(Date.now() + DUE_DAYS * 24 * 60 * 60 * 1000),
    status: 'generated',
    semesterId,
  });

  // ── Compensating rollback: no transactions on this harness, so a failure after
  //    the invoice persists must delete it (and any lines), or the idempotency skip
  //    would cement a bill with no balance credit and no way to self-heal.
  try {
    for (const l of lines) {
      await InvoiceLineItem.create({
        collegeId,
        invoiceId: invoice._id,
        feeComponentId: l.feeComponentId,
        description: l.description,
        grossAmount: l.netAmount,
        scholarshipAllocated: 0,
        concessionApplied: 0,
        netAmount: l.netAmount,
        status: 'active',
        sourcePinId: pin._id,
      });
    }
    await StudentFeeAccount.findOneAndUpdate(
      { collegeId, studentId },
      { $inc: { totalDue: installment, balance: installment } },
      { upsert: true },
    );
  } catch (e) {
    await InvoiceLineItem.deleteMany({ collegeId, invoiceId: invoice._id });
    await Invoice.deleteOne({ _id: invoice._id, collegeId });
    return { kind: 'error', studentId, error: e instanceof Error ? e.message : String(e) };
  }

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: String(invoice._id),
    entityName: invoice.invoiceNumber,
    studentId,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { kind: 'generated', studentId, invoiceId: String(invoice._id), amount: installment, yearAssumed: yearOfStudy, derivedFrom };
}
