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
import { Person } from '../../models/people/Person';
import { Programme } from '../../models/academic-structure/Programme';
import { Branch } from '../../models/academic-structure/Branch';
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

/**
 * `yearOfStudy` is carried by every variant reachable AFTER the pin year is
 * resolved (`:117`), so the console can show a year on every row an operator can
 * act on. It is absent only on `unsupported-semester-number`, which returns
 * before resolution, and on an `error` raised by the batch's own catch.
 */
export type BillOutcome =
  | { kind: 'generated'; studentId: string; invoiceId: string; amount: number; yearAssumed: number; derivedFrom: 'calendar' | 'admission' }
  | { kind: 'already-billed'; studentId: string; invoiceId: string; yearOfStudy: number }
  | { kind: 'no-active-pin'; studentId: string; yearOfStudy: number }
  | { kind: 'pinned-to-different-ay'; studentId: string; yearOfStudy: number }
  | { kind: 'skipped'; studentId: string; reason: 'no-amount' | 'unsupported-semester-number'; yearOfStudy?: number }
  | { kind: 'error'; studentId: string; error: string; yearOfStudy?: number };

/** Flattened `BillOutcome['kind']`, splitting `skipped` into its two reasons. */
export type BillRowOutcome =
  | 'generated' | 'already-billed' | 'no-active-pin' | 'pinned-to-different-ay'
  | 'no-amount' | 'unsupported-semester-number' | 'error';

/**
 * One student, as the billing console renders them. Deliberately the same
 * vocabulary as the writer — no parallel naming to keep in sync.
 */
export interface BillRow {
  studentId: string;
  name: string;
  rollNumber?: string;
  programmeCode?: string;
  branchCode?: string;
  /** 0 when it could not be derived — rendered as an em dash, never guessed. */
  yearOfStudy: number;
  /** The installment this run would raise. 0 on every non-billable row. */
  amount: number;
  outcome: BillRowOutcome;
  error?: string;
}

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
  opts: { dryRun?: boolean; dueDate?: Date } = {},
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
  if (!pin) return { kind: 'no-active-pin', studentId, yearOfStudy };

  // ── (b) guard: the pin's FSI must belong to the semester's academic year.
  const fsi = await FeeStructureInstance.findOne({
    _id: pin.feeStructureInstanceId,
    collegeId,
  }).lean();
  if (!fsi) {
    return { kind: 'error', studentId, yearOfStudy, error: `Pin references missing FeeStructureInstance ${String(pin.feeStructureInstanceId)}` };
  }
  if (String(fsi.academicYearId) !== semesterAcademicYearId) {
    return { kind: 'pinned-to-different-ay', studentId, yearOfStudy };
  }

  // ── Idempotency — keyed on the discriminator, NOT type:'fee' (G2-C1).
  const existing = await Invoice.findOne({
    collegeId,
    studentId,
    semesterId,
    isSemesterInstallment: true,
  }).select('_id').lean();
  if (existing) return { kind: 'already-billed', studentId, invoiceId: String(existing._id), yearOfStudy };

  // ── Amount — frozen snapshot preferred; FSI total as fallback; never bill 0.
  const annual = pin.snapshotTotalAmount ?? fsi.totalAmount ?? 0;
  if (!annual || annual <= 0) return { kind: 'skipped', studentId, reason: 'no-amount', yearOfStudy };

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
    // Operator-supplied deadline when the college has announced one; otherwise
    // the standing +30 days. A past date is legal — a late-entered installment
    // is genuinely overdue on arrival.
    dueDate: opts.dueDate ?? new Date(Date.now() + DUE_DAYS * 24 * 60 * 60 * 1000),
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

/** One semester's billing run, as the console's history table renders it. */
export interface BillingHistoryRow {
  semesterId: string;
  semesterLabel: string;
  invoiceCount: number;
  totalBilled: number;
  firstGeneratedAt: Date;
  /** Later than `first` when bills were topped up after the original run. */
  lastGeneratedAt: Date;
  /**
   * How many students COULD be billed for this semester — active students whose
   * non-archived pin belongs to the semester's academic year. Against
   * `invoiceCount` this answers "is this semester finished?", which counts alone
   * never could.
   *
   * The academic-year condition is not arbitrary: it mirrors the guard the
   * writer applies (`fsi.academicYearId !== semester.academicYearId` →
   * `pinned-to-different-ay`), so this counts exactly the students a run would
   * actually bill. 0 when the semester document is gone.
   */
  pinnedStudents: number;
}

/**
 * What has been billed, per semester — the answer to "did we bill Sem 1, and
 * for how much".
 *
 * Derived entirely from invoices that already exist, so it works retroactively
 * over every bill ever generated. There is deliberately no `BillingRun` model:
 * one would only describe runs made after it shipped, leaving today's invoices
 * invisible, and would add a write to a money path to answer a question the
 * invoices already answer.
 *
 * Deliberately reports only what was BILLED. Collections and outstanding come
 * from `StudentFeeAccount` on the finance dashboard; computing them a second
 * time here is how two screens start disagreeing about money.
 */
export async function getBillingHistory(collegeId: string): Promise<BillingHistoryRow[]> {
  const groups = await Invoice.aggregate<{
    _id: Types.ObjectId;
    invoiceCount: number;
    totalBilled: number;
    firstGeneratedAt: Date;
    lastGeneratedAt: Date;
  }>([
    {
      $match: {
        // Cast is load-bearing: aggregate() does not auto-cast the string, and a
        // raw one silently matches nothing (G2-M5).
        collegeId: new Types.ObjectId(collegeId),
        isSemesterInstallment: true,
        // Excludes rows the partial index tolerates but that would otherwise
        // collapse into a meaningless `null` bucket.
        semesterId: { $type: 'objectId' },
        // `cancelled` means the bill should not have existed. `written_off` and
        // `disputed` ARE counted — those were genuinely raised, and hiding them
        // would understate what the college billed.
        status: { $ne: 'cancelled' },
      },
    },
    {
      $group: {
        _id: '$semesterId',
        invoiceCount: { $sum: 1 },
        totalBilled: { $sum: { $ifNull: ['$netPayable', '$totalAmount'] } },
        firstGeneratedAt: { $min: '$createdAt' },
        lastGeneratedAt: { $max: '$createdAt' },
      },
    },
    { $sort: { lastGeneratedAt: -1 } },
  ]);

  if (groups.length === 0) return [];

  const semesters = await Semester.find({
    collegeId,
    _id: { $in: groups.map((g) => g._id) },
  }).select({ _id: 1, number: 1, year: 1, academicYearId: 1 }).lean();
  const byId = new Map(semesters.map((s) => [String(s._id), s]));

  // ── Billable population per academic year, for the coverage figure.
  //
  // Counted per DISTINCT academic year rather than per row: a college bills two
  // semesters from the same year, so this is one or two counts for the whole
  // table, not one per semester.
  const ayIds = [...new Set(semesters.map((s) => String(s.academicYearId)))];
  const fsis = await FeeStructureInstance.find({
    collegeId,
    academicYearId: { $in: ayIds },
  }).select({ _id: 1, academicYearId: 1 }).lean();

  const fsiByAy = new Map<string, Types.ObjectId[]>();
  for (const f of fsis) {
    const key = String(f.academicYearId);
    if (!fsiByAy.has(key)) fsiByAy.set(key, []);
    fsiByAy.get(key)!.push(f._id as Types.ObjectId);
  }

  const pinnedByAy = new Map<string, number>();
  for (const ay of ayIds) {
    const ids = fsiByAy.get(ay) ?? [];
    pinnedByAy.set(ay, ids.length === 0 ? 0 : await Student.countDocuments({
      collegeId,
      status: 'active',
      feePins: { $elemMatch: { archivedAt: null, feeStructureInstanceId: { $in: ids } } },
    }));
  }

  return groups.map((g) => {
    const sem = byId.get(String(g._id));
    return {
      semesterId: String(g._id),
      // A deleted semester must not erase money that was billed — fall back to
      // the raw id rather than dropping the row.
      semesterLabel: sem ? `Semester ${sem.number} — ${sem.year}` : String(g._id),
      invoiceCount: g.invoiceCount,
      totalBilled: g.totalBilled,
      firstGeneratedAt: g.firstGeneratedAt,
      lastGeneratedAt: g.lastGeneratedAt,
      pinnedStudents: sem ? (pinnedByAy.get(String(sem.academicYearId)) ?? 0) : 0,
    };
  });
}

export interface BatchBillInput {
  semesterId: string;
  /** Explicit students (individual / selected-rows path). Omit to bill everyone pinned. */
  studentIds?: string[];
  /** Optional narrowing: only bill students whose resolved year equals this. */
  yearOfStudy?: number;
  /** Fee axes — narrow the cohort without naming every student. */
  programmeId?: string;
  branchId?: string;
  /** Announced deadline. Omit for the standing +30 days. */
  dueDate?: Date;
  dryRun?: boolean;
}

export interface BatchBillResult {
  dryRun: boolean;
  generated: number;
  alreadyBilled: number;
  noPin: number;
  pinnedToDifferentAy: number;
  noAmount: number;
  unsupportedSemesterNumber: number;
  errors: Array<{ studentId: string; error: string }>;
  /** One entry per student considered — the console renders these directly. */
  rows: BillRow[];
  /**
   * Σ amount over `generated` rows. The console does NOT render this: its
   * footer sums the SELECTED rows client-side, and this figure is only correct
   * while everything is still ticked. Kept for API consumers and the post-run
   * summary.
   */
  totalAmount: number;
}

/**
 * Attach names and axis codes to rows in bulk — four queries for the whole
 * batch, never one per student. Same shape as `getCoverage`
 * (`fee-pin-audit-service.ts:163-175`).
 */
async function enrichRows(collegeId: string, rows: BillRow[]): Promise<void> {
  if (rows.length === 0) return;

  const students = await Student.find({
    collegeId,
    _id: { $in: rows.map((r) => r.studentId) },
  }).select({ _id: 1, personId: 1, rollNumber: 1, programmeId: 1, branchId: 1 }).lean();

  const [persons, programmes, branches] = await Promise.all([
    Person.find({
      collegeId,
      _id: { $in: students.map((s) => s.personId).filter(Boolean) },
    }).select({ _id: 1, name: 1 }).lean(),
    Programme.find({ collegeId }).select({ _id: 1, code: 1 }).lean(),
    Branch.find({ collegeId }).select({ _id: 1, code: 1 }).lean(),
  ]);

  const nameById = new Map(persons.map((p) => [String(p._id), p.name]));
  const codeOf = (list: Array<{ _id: unknown; code?: string }>, id: unknown) =>
    (id ? list.find((x) => String(x._id) === String(id))?.code : undefined);
  const byId = new Map(students.map((s) => [String(s._id), s]));

  for (const row of rows) {
    const s = byId.get(row.studentId);
    if (!s) continue;
    // A student with no linked Person keeps name '' — the console falls back
    // to the roll number rather than inventing a placeholder.
    row.name = nameById.get(String(s.personId)) ?? '';
    if (s.rollNumber) row.rollNumber = s.rollNumber;
    row.programmeCode = codeOf(programmes, s.programmeId);
    row.branchCode = codeOf(branches, s.branchId);
  }
}

/** Flatten one outcome into the row the console renders. */
function rowFromOutcome(o: BillOutcome): BillRow {
  const base = { studentId: o.studentId, name: '', yearOfStudy: 0, amount: 0 };
  switch (o.kind) {
    case 'generated':
      return { ...base, yearOfStudy: o.yearAssumed, amount: o.amount, outcome: 'generated' };
    case 'skipped':
      return { ...base, yearOfStudy: o.yearOfStudy ?? 0, outcome: o.reason };
    case 'error':
      return { ...base, yearOfStudy: o.yearOfStudy ?? 0, outcome: 'error', error: o.error };
    default:
      return { ...base, yearOfStudy: o.yearOfStudy, outcome: o.kind };
  }
}

/**
 * Generate (or dry-run) semester-installment invoices for a cohort of pinned
 * students. Candidate set = the explicit `studentIds`, else every active student
 * holding a non-archived pin (mirrors the coverage query). Each student runs through
 * `generateSemesterInstallmentForStudent`; a throw on one drops to `errors` and the
 * batch continues. Sequential — demo scale is small, and it keeps the compensating
 * rollback per-student simple.
 */
export async function generateSemesterInstallmentsForPinned(
  collegeId: string,
  input: BatchBillInput,
  performedBy: string,
): Promise<BatchBillResult> {
  const rows: BillRow[] = [];
  const errors: Array<{ studentId: string; error: string }> = [];

  const explicit = Boolean(input.studentIds && input.studentIds.length > 0);
  const axisFilter = {
    ...(input.programmeId ? { programmeId: input.programmeId } : {}),
    ...(input.branchId ? { branchId: input.branchId } : {}),
  };

  let candidates: string[];
  if (explicit) {
    // Dedupe: on a dry run nothing is written, so the idempotency guard cannot
    // catch a repeat — the same student would report `generated` twice and
    // double-count into totalAmount.
    candidates = [...new Set(input.studentIds)];
  } else {
    const pinned = await Student.find({
      collegeId,
      status: 'active',
      ...axisFilter,
      feePins: { $elemMatch: { archivedAt: null } },
    }).select('_id').lean();
    candidates = pinned.map((r) => String(r._id));
  }

  // ── Never-pinned students, as rows rather than candidates.
  //
  // The candidate query above requires a non-archived pin, so a student with
  // `feePins: []` would otherwise produce no row at all and the console could
  // never name them. Selecting them separately keeps this O(1) in queries —
  // widening the candidate set instead would push every active student through
  // the ~4-7 query walk in `generateSemesterInstallmentForStudent` only for it
  // to return `no-active-pin`, which is minutes of work on a large college.
  //
  // Skipped when the caller named the students (they chose the set; a
  // never-pinned id still flows through the loop) and when a year filter is
  // active (their year is deliberately unresolved, so we cannot honestly claim
  // they belong to the requested one).
  if (!explicit && input.yearOfStudy === undefined) {
    const unpinned = await Student.find({
      collegeId,
      status: 'active',
      ...axisFilter,
      feePins: { $not: { $elemMatch: { archivedAt: null } } },
    }).select('_id').lean();
    for (const u of unpinned) {
      rows.push({
        studentId: String(u._id), name: '', yearOfStudy: 0, amount: 0,
        outcome: 'no-active-pin',
      });
    }
  }

  for (const studentId of candidates) {
    try {
      if (input.yearOfStudy !== undefined) {
        const s = await Student.findOne({ _id: studentId, collegeId }).select('studyYearAtAdmission').lean();
        if (!s) { errors.push({ studentId, error: 'Student not found' }); rows.push({ studentId, name: '', yearOfStudy: 0, amount: 0, outcome: 'error', error: 'Student not found' }); continue; }
        const { yearOfStudy } = await resolvePinYearForExistingStudent(studentId, s.studyYearAtAdmission);
        // Filtered out is not the same as skipped — emit no row at all.
        if (yearOfStudy !== input.yearOfStudy) continue;
      }
      const outcome = await generateSemesterInstallmentForStudent(
        collegeId,
        { studentId, semesterId: input.semesterId },
        performedBy,
        { dryRun: input.dryRun, ...(input.dueDate ? { dueDate: input.dueDate } : {}) },
      );
      if (outcome.kind === 'error') errors.push({ studentId, error: outcome.error });
      rows.push(rowFromOutcome(outcome));
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      errors.push({ studentId, error });
      rows.push({ studentId, name: '', yearOfStudy: 0, amount: 0, outcome: 'error', error });
    }
  }

  await enrichRows(collegeId, rows);

  // Counters are a PROJECTION of rows, never a parallel tally — one source of
  // truth, so the summary line and the table cannot drift apart.
  const count = (o: BillRowOutcome) => rows.filter((r) => r.outcome === o).length;

  return {
    dryRun: Boolean(input.dryRun),
    generated: count('generated'),
    alreadyBilled: count('already-billed'),
    noPin: count('no-active-pin'),
    pinnedToDifferentAy: count('pinned-to-different-ay'),
    noAmount: count('no-amount'),
    unsupportedSemesterNumber: count('unsupported-semester-number'),
    errors,
    rows,
    totalAmount: rows.reduce((s, r) => (r.outcome === 'generated' ? s + r.amount : s), 0),
  };
}
