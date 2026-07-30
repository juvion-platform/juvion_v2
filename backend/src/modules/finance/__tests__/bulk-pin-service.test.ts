/**
 * Finance bulk-pin (006-import-fee-pin T11).
 *
 * The property that matters most is shared behaviour: bulk-pin delegates to
 * `pinStudentForYear`, the same function the import commit uses, so the two
 * cannot drift on what "already pinned" means. A drift there would only show
 * up as pin churn nobody asked for.
 *
 * Also proves the row-level contract: a student that cannot be pinned is
 * reported, never thrown, so one bad student cannot abort a run of a thousand.
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
import { Programme } from '../../../models/academic-structure/Programme';
import { Batch } from '../../../models/academic-structure/Batch';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { AcademicYear } from '../../../models/academic-structure/AcademicYear';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock' }),
}));

import { bulkPinStudents, BULK_PIN_MAX_STUDENTS } from '../bulk-pin-service';

const oid = () => new mongoose.Types.ObjectId();

let collegeId: mongoose.Types.ObjectId;
let programmeId: mongoose.Types.ObjectId;
let batchId: mongoose.Types.ObjectId;
let academicYearId: mongoose.Types.ObjectId;

// The resolver picks the AcademicYear containing TODAY, so the window is built
// from the clock — a hardcoded one silently makes every student batch-less.
const AY_START_YEAR = new Date().getFullYear();
const ADMISSION_YEAR = AY_START_YEAR - 1;
const EXPECTED_YEAR = 2;

async function makeStudent(name: string, opts: { withBatch?: boolean } = {}) {
  const person = await Person.create({
    collegeId, name, phone: `98${Math.floor(Math.random() * 100000000)}`,
  });
  return Student.create({
    collegeId,
    personId: person._id,
    admissionYear: ADMISSION_YEAR,
    status: 'active',
    programmeId,
    quota: 'convener',
    ...(opts.withBatch === false ? {} : { batchId }),
  });
}

async function makeFsi(totalAmount = 100000) {
  return FeeStructureInstance.create({
    collegeId, academicYearId, programmeId, status: 'active',
    quota: 'convener', totalAmount, approvedAt: new Date(),
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
  const batch = await Batch.create({
    collegeId, code: 'B1', name: 'B1', admissionYear: ADMISSION_YEAR, programmeId, regulationId,
  });
  batchId = batch._id as mongoose.Types.ObjectId;
  const ay = await AcademicYear.create({
    collegeId, code: `AY${AY_START_YEAR}`, label: `AY${AY_START_YEAR}`,
    startDate: new Date(Date.UTC(AY_START_YEAR, 0, 1)),
    endDate: new Date(Date.UTC(AY_START_YEAR, 11, 31)),
    isCurrent: true,
  });
  academicYearId = ay._id as mongoose.Types.ObjectId;
});

describe('bulkPinStudents — dry run', () => {
  it('reports what it would pin and writes nothing', async () => {
    await makeFsi(125000);
    const student = await makeStudent('Aarav');

    const res = await bulkPinStudents(
      String(collegeId), { studentIds: [String(student._id)], dryRun: true }, 'Finance Head',
    );

    expect(res.dryRun).toBe(true);
    expect(res.pinned).toBe(1);
    expect(res.totalPinnedAmount).toBe(125000);
    expect(res.rows[0]).toMatchObject({
      name: 'Aarav', yearOfStudy: EXPECTED_YEAR, outcome: 'pinned', yearAssumed: false,
    });

    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins ?? []).toHaveLength(0);
  });

  it('agrees with the real run about a student it cannot pin', async () => {
    const student = await makeStudent('Priya');

    const dry = await bulkPinStudents(
      String(collegeId), { studentIds: [String(student._id)], dryRun: true }, 'Finance Head',
    );
    const real = await bulkPinStudents(
      String(collegeId), { studentIds: [String(student._id)] }, 'Finance Head',
    );

    expect(dry.rows[0]?.outcome).toBe('no-match');
    expect(real.rows[0]?.outcome).toBe('no-match');
    expect(real.pinned).toBe(0);
  });
});

describe('bulkPinStudents — writing', () => {
  it('pins and records the bulk-pin actor', async () => {
    await makeFsi();
    const student = await makeStudent('Rohan');

    const res = await bulkPinStudents(
      String(collegeId), { studentIds: [String(student._id)] }, 'Finance Head',
    );

    expect(res.pinned).toBe(1);
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins?.[0]?.pinnedBy).toBe('system:bulk-pin');
    expect(saved?.feePins?.[0]?.remarks).toBe('bulk-pin by Finance Head');
    expect(saved?.feePins?.[0]?.yearOfStudy).toBe(EXPECTED_YEAR);
  });

  // The shared-guard property — running twice must not churn.
  it('leaves an already-pinned student alone on a second run', async () => {
    await makeFsi();
    const student = await makeStudent('Aisha');
    await bulkPinStudents(String(collegeId), { studentIds: [String(student._id)] }, 'F');

    const second = await bulkPinStudents(
      String(collegeId), { studentIds: [String(student._id)] }, 'F',
    );

    expect(second.alreadyPinned).toBe(1);
    expect(second.pinned).toBe(0);
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins).toHaveLength(1);
  });

  it('selects by filter as well as by id', async () => {
    await makeFsi();
    await makeStudent('A');
    await makeStudent('B');

    const res = await bulkPinStudents(
      String(collegeId), { filter: { programmeId: String(programmeId) } }, 'F',
    );

    expect(res.considered).toBe(2);
    expect(res.pinned).toBe(2);
  });

  // One student that cannot be pinned must not abort the rest.
  it('carries on past a student it cannot pin', async () => {
    await makeFsi();
    const ok = await makeStudent('Fine');
    const noProgramme = await Student.create({
      collegeId,
      personId: (await Person.create({ collegeId, name: 'NoProg', phone: '9333333333' }))._id,
      admissionYear: ADMISSION_YEAR, status: 'active', batchId,
    });

    const res = await bulkPinStudents(
      String(collegeId),
      { studentIds: [String(noProgramme._id), String(ok._id)] },
      'F',
    );

    expect(res.pinned).toBe(1);
    expect(res.skipped).toBe(1);
    expect(res.rows.find((r) => r.studentId === String(noProgramme._id))?.message)
      .toBe('no-programme');
  });

  // E4 — a batch-less student is still pinnable; the assumption is reported.
  it('falls back to the admission year for a batch-less student and says so', async () => {
    await makeFsi();
    const student = await makeStudent('NoBatch', { withBatch: false });
    await Student.updateOne({ _id: student._id }, { $set: { studyYearAtAdmission: 3 } });

    const res = await bulkPinStudents(
      String(collegeId),
      { studentIds: [String(student._id)], academicYearId: String(academicYearId) },
      'F',
    );

    expect(res.rows[0]).toMatchObject({ yearOfStudy: 3, yearAssumed: true });
    expect(res.pinned).toBe(1);
  });

  it('never touches another college', async () => {
    await makeFsi();
    const otherCollege = oid();
    const otherPerson = await Person.create({
      collegeId: otherCollege, name: 'Theirs', phone: '9444444444',
    });
    const theirs = await Student.create({
      collegeId: otherCollege, personId: otherPerson._id, admissionYear: ADMISSION_YEAR,
      status: 'active', programmeId, batchId,
    });

    const res = await bulkPinStudents(
      String(collegeId), { studentIds: [String(theirs._id)] }, 'F',
    );

    expect(res.considered).toBe(0);
    const saved = await Student.findById(theirs._id).lean();
    expect(saved?.feePins ?? []).toHaveLength(0);
  });
});

describe('bulkPinStudents — guards', () => {
  it('refuses a call with neither ids nor a filter', async () => {
    await expect(bulkPinStudents(String(collegeId), {}, 'F'))
      .rejects.toThrow(/refusing to pin every student/i);
  });

  it('refuses more ids than the per-call cap', async () => {
    const ids = Array.from({ length: BULK_PIN_MAX_STUDENTS + 1 }, () => String(oid()));
    await expect(bulkPinStudents(String(collegeId), { studentIds: ids }, 'F'))
      .rejects.toThrow(/Maximum per call/i);
  });

  it('rejects a malformed student id rather than silently skipping it', async () => {
    await expect(bulkPinStudents(String(collegeId), { studentIds: ['nope'] }, 'F'))
      .rejects.toThrow(/not a valid student id/i);
  });
});
