import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { Batch } from '../../../models/academic-structure/Batch';
import { AcademicYear } from '../../../models/academic-structure/AcademicYear';
import { Programme } from '../../../models/academic-structure/Programme';

import { resolveStudentYearOfStudy } from '../resolve-year-of-study';

/**
 * Task 20 — canonical year-of-study resolver.
 *
 * Covers the 10 scenarios specified in tasks.md §T20.
 */

const oid = () => new mongoose.Types.ObjectId();

interface Fixture {
  collegeId: mongoose.Types.ObjectId;
  programmeId: mongoose.Types.ObjectId;
  regulationId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  academicYearId: mongoose.Types.ObjectId;
  studentId: string;
}

async function seed(opts: {
  admissionYear: number;
  ayStart?: Date;
  ayEnd?: Date;
  ayLabel?: string;
  durationYears?: number;
  studyYearAtAdmission?: number;
  seedProgramme?: boolean;
  seedBatch?: boolean;
  seedAy?: boolean;
}): Promise<Fixture> {
  const collegeId = oid();
  const programmeId = oid();
  const regulationId = oid();
  const batchId = oid();
  const academicYearId = oid();

  if (opts.seedProgramme !== false) {
    await Programme.create({
      _id: programmeId,
      collegeId,
      code: 'BTECH',
      name: 'BTech',
      level: 'UG',
      durationYears: opts.durationYears ?? 4,
      regulationId,
      isActive: true,
    });
  }

  if (opts.seedBatch !== false) {
    await Batch.create({
      _id: batchId,
      collegeId,
      code: `B-${opts.admissionYear}`,
      name: `Batch ${opts.admissionYear}`,
      admissionYear: opts.admissionYear,
      programmeId,
      regulationId,
      isActive: true,
    });
  }

  if (opts.seedAy !== false) {
    await AcademicYear.create({
      _id: academicYearId,
      collegeId,
      code: opts.ayLabel ?? '2024-25',
      label: opts.ayLabel ?? '2024-25',
      startDate: opts.ayStart ?? new Date('2024-06-01'),
      endDate: opts.ayEnd ?? new Date('2025-05-31'),
      isCurrent: true,
      status: 'active',
    });
  }

  const studentDoc: Record<string, unknown> = {
    collegeId,
    personId: oid(),
    admissionYear: opts.admissionYear,
    programmeId,
    batchId: opts.seedBatch === false ? undefined : batchId,
    quota: 'convener',
    category: 'OC',
    status: 'active',
  };
  if (typeof opts.studyYearAtAdmission === 'number') {
    studentDoc.studyYearAtAdmission = opts.studyYearAtAdmission;
  }
  const student = await Student.create(studentDoc);

  return {
    collegeId,
    programmeId,
    regulationId,
    batchId,
    academicYearId,
    studentId: String(student._id),
  };
}

describe('resolveStudentYearOfStudy', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  // ── 1 ──────────────────────────────────────────────────────────────
  it('BTech 2022 admission, current AY 2024-25 → yearOfStudy = 3', async () => {
    const f = await seed({
      admissionYear: 2022,
      ayStart: new Date('2024-06-01'),
      ayEnd: new Date('2025-05-31'),
      ayLabel: '2024-25',
    });
    const result = await resolveStudentYearOfStudy(f.studentId, {
      academicYearId: String(f.academicYearId),
    });
    expect(result.yearOfStudy).toBe(3);
    expect(result.isGraduated).toBe(false);
    expect(result.academicYearLabel).toBe('2024-25');
    expect(result.batchAdmissionYear).toBe(2022);
    expect(result.programmeDurationYears).toBe(4);
  });

  // ── 2 ──────────────────────────────────────────────────────────────
  it('explicit academicYearId override → uses that AY', async () => {
    const f = await seed({
      admissionYear: 2023,
      ayLabel: '2024-25',
      ayStart: new Date('2024-06-01'),
      ayEnd: new Date('2025-05-31'),
    });
    // Seed an additional future AY and pass it as override.
    const futureAyId = oid();
    await AcademicYear.create({
      _id: futureAyId,
      collegeId: f.collegeId,
      code: '2026-27',
      label: '2026-27',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isCurrent: false,
      status: 'planning',
    });
    const result = await resolveStudentYearOfStudy(f.studentId, {
      academicYearId: String(futureAyId),
    });
    expect(result.yearOfStudy).toBe(4); // 2026 - 2023 + 1 = 4
    expect(result.academicYearLabel).toBe('2026-27');
  });

  // ── 3 ──────────────────────────────────────────────────────────────
  it('lateral entry (studyYearAtAdmission=2) → offsets +1', async () => {
    const f = await seed({
      admissionYear: 2023,
      ayStart: new Date('2024-06-01'),
      ayEnd: new Date('2025-05-31'),
      ayLabel: '2024-25',
    });
    // Student.studyYearAtAdmission is not yet in the Mongoose schema —
    // write it directly to the collection so the helper's forward-compat
    // branch is exercised.
    await Student.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(f.studentId) },
      { $set: { studyYearAtAdmission: 2 } },
    );
    const result = await resolveStudentYearOfStudy(f.studentId, {
      academicYearId: String(f.academicYearId),
    });
    // raw = 2024 - 2023 + 1 + (2-1) = 3
    expect(result.yearOfStudy).toBe(3);
  });

  // ── 4 ──────────────────────────────────────────────────────────────
  it('no active AY at college + no academicYearId → throws', async () => {
    const f = await seed({
      admissionYear: 2023,
      // AY window is 2024-25 but asOf is 2030 → no match.
      ayStart: new Date('2024-06-01'),
      ayEnd: new Date('2025-05-31'),
    });
    await expect(
      resolveStudentYearOfStudy(f.studentId, { asOf: new Date('2030-01-01') }),
    ).rejects.toThrow(/No active AcademicYear/);
  });

  // ── 5 ──────────────────────────────────────────────────────────────
  it('admission year > AY start year → throws negative-year error', async () => {
    const f = await seed({
      admissionYear: 2027,
      ayStart: new Date('2024-06-01'),
      ayEnd: new Date('2025-05-31'),
      ayLabel: '2024-25',
    });
    await expect(
      resolveStudentYearOfStudy(f.studentId, {
        academicYearId: String(f.academicYearId),
      }),
    ).rejects.toThrow(/< 1/);
  });

  // ── 6 ──────────────────────────────────────────────────────────────
  it('graduated (raw year exceeds durationYears) → clamps and flags', async () => {
    const f = await seed({
      admissionYear: 2018,
      durationYears: 4,
      ayStart: new Date('2024-06-01'),
      ayEnd: new Date('2025-05-31'),
      ayLabel: '2024-25',
    });
    const result = await resolveStudentYearOfStudy(f.studentId, {
      academicYearId: String(f.academicYearId),
    });
    // raw = 2024 - 2018 + 1 = 7 → clamp to 4
    expect(result.yearOfStudy).toBe(4);
    expect(result.isGraduated).toBe(true);
    expect(result.programmeDurationYears).toBe(4);
  });

  // ── 7 ──────────────────────────────────────────────────────────────
  it('student not found → 404', async () => {
    const fakeId = String(oid());
    await expect(
      resolveStudentYearOfStudy(fakeId, { academicYearId: String(oid()) }),
    ).rejects.toMatchObject({ statusCode: 404, message: /Student not found/ });
  });

  // ── 8 ──────────────────────────────────────────────────────────────
  it('batch not found → clear error', async () => {
    // Seed student with a batchId pointing to a nonexistent Batch doc.
    const collegeId = oid();
    const programmeId = oid();
    const missingBatchId = oid();
    await Programme.create({
      _id: programmeId,
      collegeId,
      code: 'BTECH',
      name: 'BTech',
      level: 'UG',
      durationYears: 4,
      regulationId: oid(),
      isActive: true,
    });
    const academicYearId = oid();
    await AcademicYear.create({
      _id: academicYearId,
      collegeId,
      code: '2024-25',
      label: '2024-25',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2025-05-31'),
      isCurrent: true,
      status: 'active',
    });
    const student = await Student.create({
      collegeId,
      personId: oid(),
      admissionYear: 2023,
      programmeId,
      batchId: missingBatchId,
      status: 'active',
    });
    await expect(
      resolveStudentYearOfStudy(String(student._id), {
        academicYearId: String(academicYearId),
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: /Batch .* not found/,
    });
  });

  // ── 9 ──────────────────────────────────────────────────────────────
  it('Programme.durationYears missing / programme missing → defaults to 4', async () => {
    // Seed batch + AY but skip programme entirely.
    const f = await seed({
      admissionYear: 2023,
      seedProgramme: false,
      ayStart: new Date('2024-06-01'),
      ayEnd: new Date('2025-05-31'),
      ayLabel: '2024-25',
    });
    const result = await resolveStudentYearOfStudy(f.studentId, {
      academicYearId: String(f.academicYearId),
    });
    expect(result.programmeDurationYears).toBe(4);
    expect(result.yearOfStudy).toBe(2);
    expect(result.isGraduated).toBe(false);
  });

  // ── 10 ─────────────────────────────────────────────────────────────
  it('year-back student: returns CALENDAR yearOfStudy, not academic progress', async () => {
    // Year-back handling lives at the pin-lifecycle layer (T5 / Journey 5).
    // This helper just returns the calendar math. If a student admitted
    // 2022 is year-back in 2024-25, they still map to year 3 by calendar
    // (even though academically they may be repeating Year-2). Callers
    // relying on the existing Year-2 pin do NOT invoke this helper to
    // decide which pin applies — the pin service does.
    const f = await seed({
      admissionYear: 2022,
      ayStart: new Date('2024-06-01'),
      ayEnd: new Date('2025-05-31'),
      ayLabel: '2024-25',
    });
    // Mark the student year_back — helper behavior is unchanged.
    await Student.findByIdAndUpdate(f.studentId, { status: 'year_back' });
    const result = await resolveStudentYearOfStudy(f.studentId, {
      academicYearId: String(f.academicYearId),
    });
    expect(result.yearOfStudy).toBe(3);
    expect(result.isGraduated).toBe(false);
  });

  // ── 11 (bonus) ────────────────────────────────────────────────────
  it('picks active AY at college when academicYearId omitted (asOf inside window)', async () => {
    const f = await seed({
      admissionYear: 2022,
      ayStart: new Date('2024-06-01'),
      ayEnd: new Date('2025-05-31'),
      ayLabel: '2024-25',
    });
    const result = await resolveStudentYearOfStudy(f.studentId, {
      asOf: new Date('2024-09-15'),
    });
    expect(result.yearOfStudy).toBe(3);
    expect(result.academicYearId).toBe(String(f.academicYearId));
  });

  // ── 12 (bonus) ────────────────────────────────────────────────────
  it('student without batchId → clear error', async () => {
    const f = await seed({ admissionYear: 2022, seedBatch: false });
    await expect(
      resolveStudentYearOfStudy(f.studentId, {
        academicYearId: String(f.academicYearId),
      }),
    ).rejects.toThrow(/no batchId/);
  });
});
