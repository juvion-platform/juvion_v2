/**
 * `pinImportedStudent` — fee-pinning for the student bulk import
 * (006-import-fee-pin T2).
 *
 * The contract under test is that this function NEVER throws: every failure
 * mode is a return value, because a throw out of `commitOne` would flip the
 * row to `outcome:'error'` and degrade the whole job (plan §2 invariant).
 *
 * Edge cases covered: E1 (no matching structure), E2 (no academic year),
 * E6 (re-import is a no-op, not a churn), E7 (recovery once the structure
 * exists), E15 (an archived pin does not count as active), E19 (unexpected
 * failure is contained), E21 (resolved pin year — blank means Year 1,
 * non-integers are rejected rather than silently coerced).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

import { enqueueFeeCommitmentJob } from '../../../workers/fee-commitment.worker';
import {
  pinImportedStudent,
  resolvePinYearOfStudy,
  IMPORT_PIN_ACTOR,
} from '../student-import-pin';

const oid = () => new mongoose.Types.ObjectId();

const COLLEGE_ID = oid();
const PROGRAMME_ID = oid();
const ACADEMIC_YEAR_ID = oid();

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    collegeId: String(COLLEGE_ID),
    performedBy: 'Registrar Rao',
    academicYearId: String(ACADEMIC_YEAR_ID),
    jobId: 'job-1',
    ...overrides,
  };
}

async function makeFsi(opts: { quota?: string; totalAmount?: number } = {}) {
  return FeeStructureInstance.create({
    collegeId: COLLEGE_ID,
    academicYearId: ACADEMIC_YEAR_ID,
    programmeId: PROGRAMME_ID,
    status: 'active',
    quota: opts.quota ?? 'management',
    totalAmount: opts.totalAmount ?? 315000,
    approvedAt: new Date(),
  });
}

async function makeStudent(opts: { programmeId?: mongoose.Types.ObjectId | null } = {}) {
  const payload: Record<string, unknown> = {
    collegeId: COLLEGE_ID,
    personId: oid(),
    admissionYear: 2025,
    quota: 'management',
    category: 'OC',
    status: 'active',
  };
  if (opts.programmeId !== null) payload.programmeId = opts.programmeId ?? PROGRAMME_ID;
  return Student.create(payload);
}

describe('resolvePinYearOfStudy', () => {
  it('defaults a blank cell to Year 1', () => {
    expect(resolvePinYearOfStudy('')).toEqual({ ok: true, yearOfStudy: 1 });
    expect(resolvePinYearOfStudy(undefined)).toEqual({ ok: true, yearOfStudy: 1 });
    expect(resolvePinYearOfStudy('  ')).toEqual({ ok: true, yearOfStudy: 1 });
  });

  it('accepts a whole year in range, as string or number', () => {
    expect(resolvePinYearOfStudy('2')).toEqual({ ok: true, yearOfStudy: 2 });
    expect(resolvePinYearOfStudy(3)).toEqual({ ok: true, yearOfStudy: 3 });
  });

  // E21 — the field validator allows 2.5 (it is a number in [1,8]), and a
  // fractional year matches no structure at all. Reject it as the typo it is
  // rather than let it surface as "no matching fee structure".
  it('rejects non-integers, zero and out-of-range years', () => {
    for (const bad of ['2.5', '0', '9', '-1', 'two']) {
      const res = resolvePinYearOfStudy(bad);
      expect(res.ok, `expected "${bad}" to be rejected`).toBe(false);
    }
  });
});

describe('pinImportedStudent', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
    vi.mocked(enqueueFeeCommitmentJob).mockClear();
  });

  it('pins a matching student and reports the structure and amount', async () => {
    const fsi = await makeFsi({ totalAmount: 315000 });
    const student = await makeStudent();

    const res = await pinImportedStudent(String(student._id), {}, ctx());

    expect(res.kind).toBe('pinned');
    if (res.kind !== 'pinned') throw new Error('expected pinned');
    expect(res.fsiId).toBe(String(fsi._id));
    expect(res.totalAmount).toBe(315000);

    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins).toHaveLength(1);
    expect(saved?.feePins?.[0]?.pinnedBy).toBe(IMPORT_PIN_ACTOR);
    expect(saved?.feePins?.[0]?.yearOfStudy).toBe(1);
    expect(saved?.feePins?.[0]?.reason).toBe('initial');
  });

  it('records the job and operator in remarks so a pin is traceable to its import', async () => {
    await makeFsi();
    const student = await makeStudent();

    await pinImportedStudent(String(student._id), {}, ctx({ jobId: 'job-42' }));

    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins?.[0]?.remarks).toBe('import job=job-42 by=Registrar Rao');
  });

  // A 500-row intake must not be able to fail on a Redis blip.
  it('does not enqueue a commitment sheet', async () => {
    await makeFsi();
    const student = await makeStudent();

    await pinImportedStudent(String(student._id), {}, ctx());

    expect(enqueueFeeCommitmentJob).not.toHaveBeenCalled();
  });

  it('pins the lateral-entry year when studyYearAtAdmission is supplied', async () => {
    await makeFsi();
    const student = await makeStudent();

    const res = await pinImportedStudent(
      String(student._id),
      { studyYearAtAdmission: '2' },
      ctx(),
    );

    expect(res.kind).toBe('pinned');
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins?.[0]?.yearOfStudy).toBe(2);
  });

  // E6 — re-importing a corrected file must not churn pins.
  it('leaves an existing active pin untouched', async () => {
    await makeFsi();
    const student = await makeStudent();
    const first = await pinImportedStudent(String(student._id), {}, ctx());
    expect(first.kind).toBe('pinned');

    const second = await pinImportedStudent(String(student._id), {}, ctx());

    expect(second.kind).toBe('already-pinned');
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins).toHaveLength(1);
    expect(saved?.feePins?.[0]?.archivedAt ?? null).toBeNull();
  });

  // E15 / E7 — Finance retracted the structure, re-import rebinds.
  it('treats an archived pin as unpinned and pins fresh', async () => {
    await makeFsi();
    const student = await makeStudent();
    await pinImportedStudent(String(student._id), {}, ctx());
    await Student.updateOne(
      { _id: student._id },
      { $set: { 'feePins.0.archivedAt': new Date(), 'feePins.0.archiveReason': 'retracted' } },
    );

    const res = await pinImportedStudent(String(student._id), {}, ctx());

    expect(res.kind).toBe('pinned');
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins).toHaveLength(2);
  });

  // A pin for a different year must not satisfy the guard.
  it('pins a year that has no active pin even when another year does', async () => {
    await makeFsi();
    const student = await makeStudent();
    await pinImportedStudent(String(student._id), {}, ctx());

    const res = await pinImportedStudent(
      String(student._id),
      { studyYearAtAdmission: '2' },
      ctx(),
    );

    expect(res.kind).toBe('pinned');
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins?.map((p) => p.yearOfStudy).sort()).toEqual([1, 2]);
  });

  // E1 — the soft-fail that must not turn the import red.
  it('reports no-match without touching the student when nothing resolves', async () => {
    await makeFsi({ quota: 'convener' });
    const student = await makeStudent();

    const res = await pinImportedStudent(String(student._id), {}, ctx());

    expect(res.kind).toBe('no-match');
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins ?? []).toHaveLength(0);
  });

  // E2 — a college with no current academic year. Distinct from no-match:
  // different problem, different owner.
  it('skips with no-academic-year when the job resolved none', async () => {
    await makeFsi();
    const student = await makeStudent();

    const res = await pinImportedStudent(
      String(student._id),
      {},
      ctx({ academicYearId: undefined }),
    );

    expect(res).toEqual({ kind: 'skipped', reason: 'no-academic-year' });
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins ?? []).toHaveLength(0);
  });

  it('skips with no-programme when the student has none', async () => {
    await makeFsi();
    const student = await makeStudent({ programmeId: null });

    const res = await pinImportedStudent(String(student._id), {}, ctx());

    expect(res).toEqual({ kind: 'skipped', reason: 'no-programme' });
  });

  // E21 — never silently coerce a fractional year into a Year-1 pin.
  it('errors on a non-integer year without writing a pin', async () => {
    await makeFsi();
    const student = await makeStudent();

    const res = await pinImportedStudent(
      String(student._id),
      { studyYearAtAdmission: '2.5' },
      ctx(),
    );

    expect(res.kind).toBe('error');
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins ?? []).toHaveLength(0);
  });

  it('never reaches a student belonging to another college', async () => {
    await makeFsi();
    const student = await makeStudent();

    const res = await pinImportedStudent(
      String(student._id),
      {},
      ctx({ collegeId: String(oid()) }),
    );

    expect(res.kind).toBe('error');
    const saved = await Student.findById(student._id).lean();
    expect(saved?.feePins ?? []).toHaveLength(0);
  });

  // E19 — an unexpected failure is contained as a value, never thrown.
  it('contains an unexpected error rather than throwing', async () => {
    const res = await pinImportedStudent('not-an-object-id', {}, ctx());

    expect(res.kind).toBe('error');
  });
});
