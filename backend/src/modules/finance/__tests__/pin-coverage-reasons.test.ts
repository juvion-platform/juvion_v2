/**
 * `getCoverage` reason discriminant, rollup and pagination
 * (006-import-fee-pin T10).
 *
 * The report existed but said only "these students have no pin", which is not
 * actionable: publishing a fee structure, assigning a batch and clicking
 * re-pin are three different jobs owned by three different people. Each
 * reason below is one of those jobs.
 *
 * Covers E4/F12 (a batch-less student is `year-unresolvable`, not a silent
 * year 0) and E22 (pinned but unpayable for want of a fee-responsible
 * guardian).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { Person } from '../../../models/people/Person';
import { Parent } from '../../../models/people/Parent';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Batch } from '../../../models/academic-structure/Batch';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { AcademicYear } from '../../../models/academic-structure/AcademicYear';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock' }),
}));

import { getCoverage, PIN_MISSING_REASONS } from '../fee-pin-audit-service';
import { pinYear } from '../fee-pin-service';

const oid = () => new mongoose.Types.ObjectId();

let collegeId: mongoose.Types.ObjectId;
let programmeId: mongoose.Types.ObjectId;
let branchId: mongoose.Types.ObjectId;
let batchId: mongoose.Types.ObjectId;
let academicYearId: mongoose.Types.ObjectId;

/**
 * `resolveStudentYearOfStudy` picks the AcademicYear whose window contains
 * TODAY, so the fixture is built around the clock rather than fixed dates —
 * otherwise the suite silently starts reporting every student as
 * `year-unresolvable` the moment real time leaves a hardcoded window.
 * Admission one year before the AY start makes every batched student Year 2.
 */
const EXPECTED_YEAR = 2;
const AY_START_YEAR = new Date().getFullYear();
const ADMISSION_YEAR = AY_START_YEAR - 1;

async function makeStudent(opts: {
  name: string;
  withBatch?: boolean;
  quota?: string;
  feeResponsible?: boolean;
} ) {
  const person = await Person.create({
    collegeId, name: opts.name, phone: `98${Math.floor(Math.random() * 100000000)}`,
  });
  let feeResponsibleParentId: mongoose.Types.ObjectId | undefined;
  if (opts.feeResponsible) {
    const gp = await Person.create({ collegeId, name: `${opts.name} guardian`, phone: '9000000000' });
    const parent = await Parent.create({ collegeId, personId: gp._id, relationship: 'guardian' });
    feeResponsibleParentId = parent._id as mongoose.Types.ObjectId;
  }
  return Student.create({
    collegeId,
    personId: person._id,
    admissionYear: ADMISSION_YEAR,
    status: 'active',
    programmeId,
    branchId,
    quota: opts.quota ?? 'convener',
    category: 'OC',
    ...(opts.withBatch === false ? {} : { batchId }),
    ...(feeResponsibleParentId ? { feeResponsibleParentId } : {}),
  });
}

async function makeFsi(quota = 'convener') {
  return FeeStructureInstance.create({
    collegeId, academicYearId, programmeId, status: 'active',
    quota, totalAmount: 100000, approvedAt: new Date(),
  });
}

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

beforeEach(async () => {
  collegeId = oid();
  const regulationId = oid();
  programmeId = oid();
  await Regulation.create({
    _id: regulationId, collegeId, code: 'R20', name: 'R20',
    effectiveFromYear: 2020, totalCredits: 160, maxYears: 4,
  });
  await Programme.create({
    _id: programmeId, collegeId, code: 'BTECH', name: 'BTech', level: 'UG',
    durationYears: 4, regulationId,
  });
  const branch = await Branch.create({
    collegeId, code: 'CSE', name: 'CSE', programmeId, departmentId: oid(), intake: 60,
  });
  branchId = branch._id as mongoose.Types.ObjectId;
  const batch = await Batch.create({
    collegeId, code: 'B1', name: 'B1', admissionYear: ADMISSION_YEAR, programmeId, regulationId,
  });
  batchId = batch._id as mongoose.Types.ObjectId;
  const ay = await AcademicYear.create({
    collegeId,
    code: `AY${AY_START_YEAR}`,
    label: `AY${AY_START_YEAR}`,
    // Spans the whole calendar year so it always contains "now".
    startDate: new Date(Date.UTC(AY_START_YEAR, 0, 1)),
    endDate: new Date(Date.UTC(AY_START_YEAR, 11, 31)),
    isCurrent: true,
  });
  academicYearId = ay._id as mongoose.Types.ObjectId;
});

describe('getCoverage — reasons', () => {
  it('flags a student with no publishable structure as no-matching-structure', async () => {
    await makeStudent({ name: 'Aarav' });

    const report = await getCoverage(String(collegeId));

    expect(report.counts['no-matching-structure']).toBe(1);
    expect(report.students[0]).toMatchObject({
      name: 'Aarav',
      reason: 'no-matching-structure',
      programmeCode: 'BTECH',
      branchCode: 'CSE',
      quota: 'convener',
      yearOfStudy: EXPECTED_YEAR,
    });
  });

  // The one-click case: Finance has done its job, nobody pressed the button.
  it('flags a student as never-pinned when a structure would match', async () => {
    await makeFsi();
    await makeStudent({ name: 'Priya' });

    const report = await getCoverage(String(collegeId));

    expect(report.counts['never-pinned']).toBe(1);
    expect(report.counts['no-matching-structure']).toBe(0);
  });

  // E4 / F12 — previously a silent currentYearOfStudy: 0.
  it('flags a batch-less student as year-unresolvable', async () => {
    await makeFsi();
    await makeStudent({ name: 'Rohan', withBatch: false });

    const report = await getCoverage(String(collegeId));

    expect(report.counts['year-unresolvable']).toBe(1);
    expect(report.students[0]?.yearOfStudy).toBe(0);
  });

  // E22 — pinned is not payable.
  it('flags a pinned student with no fee-responsible guardian', async () => {
    await makeFsi();
    const student = await makeStudent({ name: 'Aisha' });
    await pinYear(String(student._id), EXPECTED_YEAR, {
      pinnedBy: 'tester', academicYearId, enqueueCommitmentSheet: false,
    });

    const report = await getCoverage(String(collegeId));

    expect(report.counts['no-fee-responsible-guardian']).toBe(1);
    // Still counted as covered — the pin exists; only payment is blocked.
    expect(report.studentsWithActivePinForCurrentYear).toBe(1);
    expect(report.coveragePercent).toBe(100);
  });

  it('says nothing about a pinned student who has a fee-responsible guardian', async () => {
    await makeFsi();
    const student = await makeStudent({ name: 'Nikhil', feeResponsible: true });
    await pinYear(String(student._id), EXPECTED_YEAR, {
      pinnedBy: 'tester', academicYearId, enqueueCommitmentSheet: false,
    });

    const report = await getCoverage(String(collegeId));

    expect(report.total).toBe(0);
    expect(report.coveragePercent).toBe(100);
  });
});

describe('getCoverage — rollup, filter and pagination', () => {
  it('collapses students onto their axes so one task is one row', async () => {
    await makeStudent({ name: 'A' });
    await makeStudent({ name: 'B' });
    await makeStudent({ name: 'C', quota: 'management' });

    const report = await getCoverage(String(collegeId));

    expect(report.groups).toHaveLength(2);
    expect(report.groups[0]).toMatchObject({
      reason: 'no-matching-structure', programmeCode: 'BTECH', branchCode: 'CSE',
      quota: 'convener', count: 2,
    });
    expect(report.groups[1]?.count).toBe(1);
  });

  it('filters to one reason', async () => {
    await makeStudent({ name: 'A' });
    await makeStudent({ name: 'B', withBatch: false });

    const report = await getCoverage(String(collegeId), { reason: 'year-unresolvable' });

    expect(report.total).toBe(1);
    expect(report.students[0]?.reason).toBe('year-unresolvable');
    // Counts stay whole-population so the header does not change with the filter.
    expect(report.counts['no-matching-structure']).toBe(1);
  });

  it('accepts a set of reasons, which is how the audit worker asks for missing pins', async () => {
    await makeFsi();
    const pinnedNoGuardian = await makeStudent({ name: 'Pinned' });
    await pinYear(String(pinnedNoGuardian._id), EXPECTED_YEAR, {
      pinnedBy: 'tester', academicYearId, enqueueCommitmentSheet: false,
    });
    await makeStudent({ name: 'Unpinned' });

    const report = await getCoverage(String(collegeId), { reason: PIN_MISSING_REASONS });

    expect(report.total).toBe(1);
    expect(report.students[0]?.name).toBe('Unpinned');
  });

  it('paginates without changing the totals', async () => {
    for (const name of ['A', 'B', 'C']) await makeStudent({ name });

    const first = await getCoverage(String(collegeId), { page: 1, limit: 2 });
    const second = await getCoverage(String(collegeId), { page: 2, limit: 2 });

    expect(first.students).toHaveLength(2);
    expect(second.students).toHaveLength(1);
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
    expect(second.page).toBe(2);
  });

  it('never reports on another college', async () => {
    await makeStudent({ name: 'Mine' });
    const otherCollege = oid();
    const otherPerson = await Person.create({
      collegeId: otherCollege, name: 'Theirs', phone: '9111111111',
    });
    await Student.create({
      collegeId: otherCollege, personId: otherPerson._id, admissionYear: ADMISSION_YEAR,
      status: 'active', programmeId,
    });

    const report = await getCoverage(String(collegeId));

    expect(report.totalActiveStudents).toBe(1);
    expect(report.students.map((s) => s.name)).toEqual(['Mine']);
  });
});
