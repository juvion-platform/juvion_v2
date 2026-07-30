/**
 * Fee-pinning through the whole import engine — preview to commit
 * (006-import-fee-pin T4–T8).
 *
 * The unit-level guarantees live in people/__tests__/student-import-pin.test.ts.
 * What is proved here is what only the engine can prove: that the academic
 * year is decided once and frozen, that pin outcomes are reported on their
 * own axis, and — the load-bearing one — that no pin outcome can move a row's
 * outcome or the job's status (plan §2 invariant, E20).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { AcademicYear } from '../../../models/academic-structure/AcademicYear';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { Student } from '../../../models/people/Student';

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

import { uploadAndValidate, commitImportJob } from '../bulk-import-service';

const oid = () => new mongoose.Types.ObjectId();

let collegeId: string;
let programmeId: mongoose.Types.ObjectId;
let currentAyId: mongoose.Types.ObjectId;

const HEADER = 'name*,phone*,programmeCode*,admissionYear*,rollNumber,studyYearAtAdmission';

async function preview(rows: string[], academicYearId?: string) {
  return uploadAndValidate({
    collegeId,
    performedBy: 'tester',
    entityType: 'student',
    fileBuffer: Buffer.from([HEADER, ...rows].join('\n')),
    fileName: 'students.csv',
    declaredMime: 'text/csv',
    ...(academicYearId ? { academicYearId } : {}),
  });
}

async function importRows(rows: string[], academicYearId?: string) {
  const p = await preview(rows, academicYearId);
  const job = await commitImportJob(collegeId, String(p.job._id), 'tester');
  return { preview: p, job };
}

async function makeFsi(opts: {
  academicYearId: mongoose.Types.ObjectId;
  totalAmount?: number;
  yearOfStudy?: number;
}) {
  const payload: Record<string, unknown> = {
    collegeId,
    academicYearId: opts.academicYearId,
    programmeId,
    status: 'active',
    totalAmount: opts.totalAmount ?? 125000,
    approvedAt: new Date(),
  };
  if (opts.yearOfStudy) payload.yearOfStudy = opts.yearOfStudy;
  return FeeStructureInstance.create(payload);
}

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

beforeEach(async () => {
  collegeId = String(oid());
  const regulationId = oid();
  programmeId = oid();
  await Regulation.create({
    _id: regulationId, collegeId, code: 'R20', name: 'R20', effectiveFromYear: 2020,
    totalCredits: 160, maxYears: 4,
  });
  await Programme.create({
    _id: programmeId, collegeId, code: 'BTCSE', name: 'BTech CSE', level: 'UG',
    durationYears: 4, regulationId,
  });
  await Branch.create({
    collegeId, code: 'CSE', name: 'Computer Science', programmeId, departmentId: oid(), intake: 60,
  });
  const ay = await AcademicYear.create({
    collegeId, code: 'AY2025-26', label: 'AY2025-26',
    startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'), isCurrent: true,
  });
  currentAyId = ay._id as mongoose.Types.ObjectId;
});

describe('import fee-pin — preview', () => {
  it('resolves the current academic year once and echoes it', async () => {
    await makeFsi({ academicYearId: currentAyId });
    const p = await preview(['Aarav,9876500001,BTCSE,2025,R1,1']);

    expect(p.pinContext?.academicYearId).toBe(String(currentAyId));
    expect(p.pinContext?.warning).toBeUndefined();
    expect(String(p.job.pinAcademicYearId)).toBe(String(currentAyId));
  });

  it('shows the resolved pin year and amount per row', async () => {
    await makeFsi({ academicYearId: currentAyId, totalAmount: 125000 });
    const p = await preview(['Aarav,9876500001,BTCSE,2025,R1,2']);

    expect(p.previewRows[0]?.notes?.join(' ')).toContain('will pin Year 2');
    expect(p.previewRows[0]?.notes?.join(' ')).toContain('1,25,000');
    expect(p.sideEffectTotals.pinWillPin).toBe(1);
    expect(p.sideEffectTotals.pinAmount).toBe(125000);
  });

  // E21 — a blank column silently means Year 1, so the year has to be visible.
  it('reports Year 1 when studyYearAtAdmission is blank', async () => {
    await makeFsi({ academicYearId: currentAyId });
    const p = await preview(['Aarav,9876500001,BTCSE,2025,R1,']);

    expect(p.previewRows[0]?.notes?.join(' ')).toContain('will pin Year 1');
  });

  // The drawer renders a per-row Fee structure column from this rather than
  // parsing the note string.
  it('carries a structured pinPreview on each row', async () => {
    await makeFsi({ academicYearId: currentAyId, totalAmount: 125000 });
    const p = await preview([
      'Aarav,9876500001,BTCSE,2025,R1,2',
      'Priya,9876500002,BTCSE,2025,R2,3',
    ]);

    expect(p.previewRows[0]?.pinPreview).toEqual({
      yearOfStudy: 2, willPin: true, totalAmount: 125000,
    });
    // Year 3 has no structure of its own but the wildcard-year one matches.
    expect(p.previewRows[1]?.pinPreview?.yearOfStudy).toBe(3);
  });

  it('reports why a row will not pin', async () => {
    await makeFsi({ academicYearId: currentAyId, yearOfStudy: 3 });
    const p = await preview(['Aarav,9876500001,BTCSE,2025,R1,1']);

    expect(p.previewRows[0]?.pinPreview).toMatchObject({
      yearOfStudy: 1, willPin: false, reason: 'no matching fee structure',
    });
  });

  it('counts rows that will import unpinned', async () => {
    await makeFsi({ academicYearId: currentAyId, yearOfStudy: 3 });
    const p = await preview(['Aarav,9876500001,BTCSE,2025,R1,1']);

    expect(p.sideEffectTotals.pinNoMatch).toBe(1);
    expect(p.previewRows[0]?.notes?.join(' ')).toContain('will import unpinned');
  });

  // E23 — two years flagged current is a data bug; guessing would bind a whole
  // cohort to an arbitrary year with nothing showing it happened.
  it('refuses to guess when two academic years are flagged current', async () => {
    await AcademicYear.create({
      collegeId, code: 'AY2026-27', label: 'AY2026-27',
      startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30'), isCurrent: true,
    });
    const p = await preview(['Aarav,9876500001,BTCSE,2025,R1,1']);

    expect(p.pinContext?.academicYearId).toBeNull();
    expect(p.pinContext?.warning).toMatch(/ambiguous|flagged as current/i);
    expect(p.job.pinAcademicYearId).toBeUndefined();
  });

  // E2 — distinct from "no fee structure": different problem, different owner.
  it('warns rather than errors when no academic year is current', async () => {
    await AcademicYear.updateMany({ collegeId }, { $set: { isCurrent: false } });
    const p = await preview(['Aarav,9876500001,BTCSE,2025,R1,1']);

    expect(p.pinContext?.warning).toMatch(/no current academic year/i);
    expect(p.errorCount).toBe(0);
  });

  // E16 — loading next year's intake ahead of time.
  it('honours an explicitly chosen academic year', async () => {
    const next = await AcademicYear.create({
      collegeId, code: 'AY2026-27', label: 'AY2026-27',
      startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30'),
    });
    await makeFsi({ academicYearId: currentAyId, totalAmount: 100000 });
    await makeFsi({
      academicYearId: next._id as mongoose.Types.ObjectId, totalAmount: 200000,
    });

    const p = await preview(['Aarav,9876500001,BTCSE,2025,R1,1'], String(next._id));

    expect(p.pinContext?.academicYearId).toBe(String(next._id));
    expect(p.sideEffectTotals.pinAmount).toBe(200000);
  });

  it('rejects an academic year belonging to another college', async () => {
    const foreign = await AcademicYear.create({
      collegeId: String(oid()), code: 'X', label: 'X',
      startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'),
    });
    await expect(preview(['Aarav,9876500001,BTCSE,2025,R1,1'], String(foreign._id)))
      .rejects.toThrow(/not found for this college/i);
  });
});

describe('import fee-pin — commit', () => {
  it('pins imported students and reports the roll-up', async () => {
    const fsi = await makeFsi({ academicYearId: currentAyId, totalAmount: 125000 });
    const { job } = await importRows([
      'Aarav,9876500001,BTCSE,2025,R1,1',
      'Priya,9876500002,BTCSE,2025,R2,1',
    ]);

    expect(job.successCount).toBe(2);
    expect(job.pinSummary?.pinned).toBe(2);
    expect(job.pinSummary?.totalPinnedAmount).toBe(250000);

    const students = await Student.find({ collegeId }).lean();
    expect(students).toHaveLength(2);
    for (const s of students) {
      expect(s.feePins?.[0]?.pinnedBy).toBe('system:import');
      expect(String(s.feePins?.[0]?.feeStructureInstanceId)).toBe(String(fsi._id));
    }
  });

  // E20 — the invariant. A file where nothing pins is still a clean import.
  it('reports completed with no failures when no row can be pinned', async () => {
    const { job } = await importRows(['Aarav,9876500001,BTCSE,2025,R1,1']);

    expect(job.status).toBe('completed');
    expect(job.successCount).toBe(1);
    expect(job.failureCount).toBe(0);
    expect(job.blockedCount).toBe(0);
    expect(job.pinSummary?.noMatch).toBe(1);
    expect(job.pinSummary?.pinned).toBe(0);
    expect(await Student.countDocuments({ collegeId })).toBe(1);
  });

  // E6 / E24 — re-running a file must not churn pins or double-create.
  it('re-importing the same file pins nothing new', async () => {
    await makeFsi({ academicYearId: currentAyId });
    const rows = ['Aarav,9876500001,BTCSE,2025,R1,1'];
    await importRows(rows);
    const { job } = await importRows(rows);

    expect(job.pinSummary?.pinned).toBe(0);
    expect(job.pinSummary?.alreadyPinned).toBe(1);
    expect(await Student.countDocuments({ collegeId })).toBe(1);
    const student = await Student.findOne({ collegeId }).lean();
    expect(student?.feePins).toHaveLength(1);
  });

  // E7 — the recovery path: publish the structure, re-upload the same file.
  it('re-importing after the structure is published pins the student', async () => {
    const rows = ['Aarav,9876500001,BTCSE,2025,R1,1'];
    const first = await importRows(rows);
    expect(first.job.pinSummary?.noMatch).toBe(1);

    await makeFsi({ academicYearId: currentAyId, totalAmount: 125000 });
    const second = await importRows(rows);

    expect(second.job.pinSummary?.pinned).toBe(1);
    const student = await Student.findOne({ collegeId }).lean();
    expect(student?.feePins).toHaveLength(1);
  });

  // The frozen year is what makes preview and commit agree.
  it('commits against the year frozen at preview, not whatever is current now', async () => {
    const next = await AcademicYear.create({
      collegeId, code: 'AY2026-27', label: 'AY2026-27',
      startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30'),
    });
    const currentFsi = await makeFsi({ academicYearId: currentAyId, totalAmount: 100000 });
    await makeFsi({ academicYearId: next._id as mongoose.Types.ObjectId, totalAmount: 200000 });

    const p = await preview(['Aarav,9876500001,BTCSE,2025,R1,1']);
    // The college flips its current year between preview and commit.
    await AcademicYear.updateOne({ _id: currentAyId }, { $set: { isCurrent: false } });
    await AcademicYear.updateOne({ _id: next._id }, { $set: { isCurrent: true } });
    const job = await commitImportJob(collegeId, String(p.job._id), 'tester');

    expect(job.pinSummary?.pinned).toBe(1);
    const student = await Student.findOne({ collegeId }).lean();
    expect(String(student?.feePins?.[0]?.feeStructureInstanceId)).toBe(String(currentFsi._id));
  });

  it('records the per-row pin outcome on the job', async () => {
    await makeFsi({ academicYearId: currentAyId, totalAmount: 125000 });
    const { job } = await importRows(['Aarav,9876500001,BTCSE,2025,R1,1']);

    expect(job.results[0]?.pinOutcome?.kind).toBe('pinned');
    expect(job.results[0]?.pinOutcome?.totalAmount).toBe(125000);
  });
});
