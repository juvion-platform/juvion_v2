/**
 * Generate Bills console — the per-student rows the batch now returns.
 *
 * Commit 1 of the console plan
 * (.sdd/specs/007-fee-billing-payment-ar/plan-generate-bills-console.md).
 * Kept OUT of fee-billing-service-007.test.ts on purpose: those 14 cases pin the
 * single-student generator's behaviour, which this commit must not change, so
 * they stay untouched as the safety net for it.
 *
 * The load-bearing cases here:
 *  - a NEVER-pinned student appears as a row at all (step 3b). The batch's
 *    candidate query requires a non-archived pin, so before this such a student
 *    produced no row and the console could never name them. The existing
 *    no-active-pin test calls the SINGLE-student function directly, bypassing
 *    the candidate query, so nothing else exercises this path.
 *  - counters equal a tally of `rows` — they are a projection now, not a
 *    parallel `+= 1`, so the summary line and the table cannot drift.
 *  - duplicate studentIds are deduped. On a dry run nothing is written, so the
 *    idempotency guard cannot catch a repeat and totalAmount would double-count.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Types } from 'mongoose';

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock' }),
}));

import {
  setupMongo, teardownMongo, clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { Person } from '../../../models/people/Person';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Semester } from '../../../models/academic-structure/Semester';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { Invoice } from '../../../models/finance/Invoice';
import { generateSemesterInstallmentsForPinned, getBillingHistory } from '../fee-billing-service';

const COLLEGE = new Types.ObjectId();
const AY = new Types.ObjectId();

let PROG: Types.ObjectId;
let BRANCH: Types.ObjectId;

async function makeCatalog() {
  const p = await Programme.create({
    collegeId: COLLEGE, code: 'BTECH', name: 'Bachelor of Technology',
    level: 'UG', durationYears: 4, regulationId: new Types.ObjectId(),
  });
  const b = await Branch.create({
    collegeId: COLLEGE, code: 'CSE', name: 'Computer Science',
    programmeId: p._id, intake: 60,
  });
  PROG = p._id as Types.ObjectId;
  BRANCH = b._id as Types.ObjectId;
}

async function makeSemester(number = 1, academicYearId = AY) {
  const s = await Semester.create({
    collegeId: COLLEGE, academicYearId, number, year: 2025,
    startDate: new Date('2025-07-01'), endDate: new Date('2025-12-15'),
  });
  return String(s._id);
}

async function makeFsi(totalAmount = 90000, academicYearId = AY) {
  const f = await FeeStructureInstance.create({
    collegeId: COLLEGE, academicYearId, programmeId: PROG,
    yearOfStudy: 1, totalAmount, status: 'active',
  });
  return f._id as Types.ObjectId;
}

/** A student, optionally pinned, optionally with a real Person to name them. */
async function makeStudent(opts: {
  fsiId?: Types.ObjectId;
  name?: string;
  rollNumber?: string;
  programmeId?: Types.ObjectId;
  branchId?: Types.ObjectId;
} = {}) {
  const personId = new Types.ObjectId();
  if (opts.name) {
    await Person.create({
      _id: personId, collegeId: COLLEGE, name: opts.name, phone: '9900000000',
    });
  }
  const s = await Student.create({
    collegeId: COLLEGE, personId, admissionYear: 2025, studyYearAtAdmission: 1,
    status: 'active',
    ...(opts.rollNumber ? { rollNumber: opts.rollNumber } : {}),
    programmeId: opts.programmeId ?? PROG,
    ...(opts.branchId ? { branchId: opts.branchId } : {}),
    feePins: opts.fsiId
      ? [{ yearOfStudy: 1, feeStructureInstanceId: opts.fsiId, pinnedBy: 'test', reason: 'initial' }]
      : [],
  });
  return String(s._id);
}

describe('console rows — enrichment and shape', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('carries name, roll number and axis codes on every row', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    const fsiId = await makeFsi();
    await makeStudent({ fsiId, name: 'Aditya Nair', rollNumber: '25B01A0511', branchId: BRANCH });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, dryRun: true }, 'tester',
    );

    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      name: 'Aditya Nair',
      rollNumber: '25B01A0511',
      programmeCode: 'BTECH',
      branchCode: 'CSE',
      yearOfStudy: 1,
      amount: 45000,
      outcome: 'generated',
    });
  });

  it('leaves the name blank when no Person is linked, rather than inventing one', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    await makeStudent({ fsiId: await makeFsi(), rollNumber: '25B01A0512' });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, dryRun: true }, 'tester',
    );
    expect(r.rows[0]?.name).toBe('');
    expect(r.rows[0]?.rollNumber).toBe('25B01A0512');
  });

  it('totalAmount sums ONLY generated rows', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    const fsiId = await makeFsi();
    await makeStudent({ fsiId, name: 'A' });
    await makeStudent({ fsiId, name: 'B' });
    await makeStudent({ name: 'Unpinned' }); // contributes a row, not an amount

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, dryRun: true }, 'tester',
    );

    expect(r.rows).toHaveLength(3);
    expect(r.totalAmount).toBe(90000); // 2 × 45000
    expect(r.rows.filter((x) => x.outcome !== 'generated').every((x) => x.amount === 0)).toBe(true);
  });

  it('counters are a tally of rows, never a separate count', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    const fsiId = await makeFsi();
    await makeStudent({ fsiId, name: 'A' });
    await makeStudent({ name: 'Unpinned' });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, dryRun: true }, 'tester',
    );

    const tally = (o: string) => r.rows.filter((x) => x.outcome === o).length;
    expect(r.generated).toBe(tally('generated'));
    expect(r.noPin).toBe(tally('no-active-pin'));
    expect(r.alreadyBilled).toBe(tally('already-billed'));
    expect(r.generated + r.noPin).toBe(r.rows.length);
  });
});

describe('console rows — never-pinned students (step 3b)', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('emits a no-active-pin row for a student holding ZERO pins', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    await makeStudent({ name: 'Never Pinned', rollNumber: '25B01A9999' });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, dryRun: true }, 'tester',
    );

    expect(r.noPin).toBe(1);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      name: 'Never Pinned',
      rollNumber: '25B01A9999',
      outcome: 'no-active-pin',
      amount: 0,
      yearOfStudy: 0, // deliberately unresolved — the console renders an em dash
    });
  });

  it('is SKIPPED when a yearOfStudy filter is active — their year is unknown', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    await makeStudent({ name: 'Never Pinned' });
    await makeStudent({ fsiId: await makeFsi(), name: 'Pinned' });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, yearOfStudy: 1, dryRun: true }, 'tester',
    );

    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.outcome).toBe('generated');
    expect(r.noPin).toBe(0);
  });

  it('is SKIPPED when studentIds is explicit — the caller chose the set', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    await makeStudent({ name: 'Never Pinned, not asked for' });
    const pinned = await makeStudent({ fsiId: await makeFsi(), name: 'Pinned' });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, studentIds: [pinned], dryRun: true }, 'tester',
    );

    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.studentId).toBe(pinned);
  });

  it('still classifies a never-pinned student named explicitly, via the loop', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    const unpinned = await makeStudent({ name: 'Never Pinned' });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, studentIds: [unpinned], dryRun: true }, 'tester',
    );

    expect(r.noPin).toBe(1);
    expect(r.rows[0]).toMatchObject({ outcome: 'no-active-pin', yearOfStudy: 1 });
  });
});

describe('console rows — axis filters, dedupe and due date', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('programmeId narrows the cohort', async () => {
    await makeCatalog();
    const other = await Programme.create({
      collegeId: COLLEGE, code: 'MBA', name: 'Master of Business Administration',
      level: 'PG', durationYears: 2, regulationId: new Types.ObjectId(),
    });
    const semesterId = await makeSemester();
    const fsiId = await makeFsi();
    await makeStudent({ fsiId, name: 'BTech student' });
    await makeStudent({ fsiId, name: 'MBA student', programmeId: other._id as Types.ObjectId });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, programmeId: String(PROG), dryRun: true }, 'tester',
    );

    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.name).toBe('BTech student');
  });

  it('branchId narrows the cohort', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    const fsiId = await makeFsi();
    await makeStudent({ fsiId, name: 'CSE student', branchId: BRANCH });
    await makeStudent({ fsiId, name: 'No branch' });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, branchId: String(BRANCH), dryRun: true }, 'tester',
    );

    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.name).toBe('CSE student');
  });

  it('dedupes repeated studentIds so a dry run cannot double-count', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    const id = await makeStudent({ fsiId: await makeFsi(), name: 'Twice' });

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, studentIds: [id, id, id], dryRun: true }, 'tester',
    );

    expect(r.rows).toHaveLength(1);
    expect(r.generated).toBe(1);
    expect(r.totalAmount).toBe(45000);
  });

  it('honours an explicit dueDate, including one already in the past', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    const past = new Date('2020-01-01T00:00:00.000Z');
    await makeStudent({ fsiId: await makeFsi(), name: 'A' });

    await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, dueDate: past }, 'tester',
    );

    const inv = await Invoice.findOne({ collegeId: COLLEGE, isSemesterInstallment: true }).lean();
    expect(inv?.dueDate?.toISOString()).toBe(past.toISOString());
  });

  it('falls back to +30 days when no dueDate is given', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    await makeStudent({ fsiId: await makeFsi(), name: 'A' });

    const before = Date.now();
    await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId }, 'tester');

    const inv = await Invoice.findOne({ collegeId: COLLEGE, isSemesterInstallment: true }).lean();
    const days = (inv!.dueDate.getTime() - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it('reports a row (not a 500) for an id belonging to no student', async () => {
    await makeCatalog();
    const semesterId = await makeSemester();
    const ghost = String(new Types.ObjectId());

    const r = await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, studentIds: [ghost], dryRun: true }, 'tester',
    );

    expect(r.errors).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ studentId: ghost, outcome: 'error' });
  });
});

describe('billing history', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('groups what was billed by semester, with count and total', async () => {
    await makeCatalog();
    const sem1 = await makeSemester(1);
    const sem2 = await makeSemester(2);
    const fsiId = await makeFsi(90000);
    await makeStudent({ fsiId, name: 'A' });
    await makeStudent({ fsiId, name: 'B' });

    await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId: sem1 }, 'tester');
    await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId: sem2 }, 'tester');

    const history = await getBillingHistory(String(COLLEGE));

    expect(history).toHaveLength(2);
    const bySem = new Map(history.map((h) => [h.semesterId, h]));
    // 90000 splits floor+remainder: Sem 1 gets 45000 each, Sem 2 the rest.
    expect(bySem.get(sem1)).toMatchObject({
      semesterLabel: 'Semester 1 — 2025', invoiceCount: 2, totalBilled: 90000,
    });
    expect(bySem.get(sem2)).toMatchObject({ invoiceCount: 2, totalBilled: 90000 });
  });

  it('excludes cancelled invoices but counts written-off ones', async () => {
    await makeCatalog();
    const semesterId = await makeSemester(1);
    const fsiId = await makeFsi(90000);
    await makeStudent({ fsiId, name: 'A' });
    await makeStudent({ fsiId, name: 'B' });
    await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId }, 'tester');

    const [first, second] = await Invoice.find({ collegeId: COLLEGE, isSemesterInstallment: true });
    await Invoice.updateOne({ _id: first!._id }, { status: 'cancelled' });
    await Invoice.updateOne({ _id: second!._id }, { status: 'written_off' });

    const history = await getBillingHistory(String(COLLEGE));

    // Cancelled means the bill should not have existed; written-off was
    // genuinely raised and later resolved, so it stays in the billed figure.
    expect(history[0]).toMatchObject({ invoiceCount: 1, totalBilled: 45000 });
  });

  it('falls back to the raw id when the semester is gone — billed money never vanishes', async () => {
    await makeCatalog();
    const semesterId = await makeSemester(1);
    await makeStudent({ fsiId: await makeFsi(), name: 'A' });
    await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId }, 'tester');

    await Semester.deleteOne({ _id: semesterId });
    const history = await getBillingHistory(String(COLLEGE));

    expect(history).toHaveLength(1);
    expect(history[0]?.semesterLabel).toBe(semesterId);
  });

  it('ignores non-installment invoices entirely', async () => {
    await makeCatalog();
    const semesterId = await makeSemester(1);
    await Invoice.create({
      collegeId: COLLEGE, invoiceNumber: 'EXAM-1', type: 'fee', semesterId,
      totalAmount: 5000, netPayable: 5000, dueDate: new Date(), status: 'generated',
    });

    expect(await getBillingHistory(String(COLLEGE))).toEqual([]);
  });

  it('returns an empty list when nothing has been billed', async () => {
    expect(await getBillingHistory(String(new Types.ObjectId()))).toEqual([]);
  });
});

describe('billing history — coverage', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('reports billed-vs-billable so a half-done semester is visible', async () => {
    await makeCatalog();
    const semesterId = await makeSemester(1);
    const fsiId = await makeFsi(90000);
    const a = await makeStudent({ fsiId, name: 'A' });
    await makeStudent({ fsiId, name: 'B' });
    await makeStudent({ fsiId, name: 'C' });

    // Bill only one of the three pinned students.
    await generateSemesterInstallmentsForPinned(
      String(COLLEGE), { semesterId, studentIds: [a] }, 'tester',
    );

    const [row] = await getBillingHistory(String(COLLEGE));
    expect(row).toMatchObject({ invoiceCount: 1, pinnedStudents: 3 });
  });

  it('counts equal when every pinned student was billed', async () => {
    await makeCatalog();
    const semesterId = await makeSemester(1);
    const fsiId = await makeFsi(90000);
    await makeStudent({ fsiId, name: 'A' });
    await makeStudent({ fsiId, name: 'B' });

    await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId }, 'tester');

    const [row] = await getBillingHistory(String(COLLEGE));
    expect(row?.invoiceCount).toBe(2);
    expect(row?.pinnedStudents).toBe(2);
  });

  it('excludes students pinned to a DIFFERENT academic year — mirrors the writer guard', async () => {
    await makeCatalog();
    const semesterId = await makeSemester(1);           // AY
    const otherAy = new Types.ObjectId();
    const fsiId = await makeFsi(90000);                 // AY
    const otherFsi = await makeFsi(90000, otherAy);     // a different year
    await makeStudent({ fsiId, name: 'Same year' });
    await makeStudent({ fsiId: otherFsi, name: 'Other year' });

    await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId }, 'tester');

    const [row] = await getBillingHistory(String(COLLEGE));
    // Only the same-year student is billable, so coverage reads 1 of 1 — the
    // other-year student is not a shortfall, they are out of scope.
    expect(row).toMatchObject({ invoiceCount: 1, pinnedStudents: 1 });
  });

  it('reports 0 billable when the semester document is gone', async () => {
    await makeCatalog();
    const semesterId = await makeSemester(1);
    await makeStudent({ fsiId: await makeFsi(), name: 'A' });
    await generateSemesterInstallmentsForPinned(String(COLLEGE), { semesterId }, 'tester');

    await Semester.deleteOne({ _id: semesterId });
    const [row] = await getBillingHistory(String(COLLEGE));

    expect(row?.invoiceCount).toBe(1);
    expect(row?.pinnedStudents).toBe(0);
  });
});
