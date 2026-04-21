import mongoose from 'mongoose';
import { Student } from '../../models/people/Student';
import { Batch } from '../../models/academic-structure/Batch';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { Programme } from '../../models/academic-structure/Programme';
import { AppError } from '../../middleware/errorHandler';

/**
 * Task 20 — Canonical year-of-study resolver.
 *
 * Computes a student's current year-of-study by combining:
 *   - their Batch.admissionYear (canonical admission-cohort year), and
 *   - the academic-year context (explicit `opts.academicYearId` OR the
 *     currently-active AY at the student's college picked via
 *     `startDate <= asOf <= endDate`).
 *
 * Year-of-study = AY.startYear - batch.admissionYear + 1
 *
 * Consumers (post-T20):
 *   - T8  admission pinning — callers supply `academicYearId` from workflow
 *   - T9  promotion         — callers supply `academicYearId` from Semester
 *   - T10 invoice           — callers supply `academicYearId` from Semester
 *   - T11 stale-pin check   — callers omit `academicYearId`, expect the
 *                              active AY at college to be picked automatically
 *
 * Spec traceability: OQ-6 (no FSI.yearOfStudy column — Year-of-study is a
 * per-student derivation, not an FSI attribute), OQ-7 (Batch has no
 * academicYearId — callers must provide the AY context), OQ-11 (this
 * helper unifies the four ad-hoc derivations).
 *
 * Lateral-entry handling: some colleges admit students directly into
 * Year 2 (and rarely Year 3). `Student.studyYearAtAdmission` (T21)
 * carries this value; callers that pre-date the field default to `1`.
 * Helper defaults to `1` when the field is missing / null for extra
 * safety.
 *
 * Year-back handling: students who repeat a year are still *calendar*-
 * equivalent to their batch mates — this helper returns the CALENDAR
 * year-of-study. The academic progress for a year-back student is
 * modelled at the pin-lifecycle level (T5) which preserves the original
 * Year-N pin. See spec §Journey 5.
 *
 * Graduated handling: when AY.startYear exceeds admissionYear +
 * durationYears, we clamp the returned `yearOfStudy` to `durationYears`
 * and flag `isGraduated: true`. Callers can decide whether to treat
 * graduation as a terminal case or continue (e.g., the nightly audit
 * may want to report on alumni, but invoice generation should not
 * usually run).
 */

export interface ResolveYearOfStudyOpts {
  /** Explicit academic-year context. Preferred when caller has one from
   * workflow (Semester.academicYearId, entryPoint.academicYearId). */
  academicYearId?: string;
  /** Used only when academicYearId is omitted — picks the AY whose
   * [startDate, endDate] range includes `asOf`. Defaults to `new Date()`. */
  asOf?: Date;
}

export interface YearOfStudyResult {
  /** Clamped to `[1, durationYears]`. */
  yearOfStudy: number;
  /** True when raw yearOfStudy exceeded the programme's durationYears. */
  isGraduated: boolean;
  academicYearId: string;
  academicYearLabel: string;
  batchAdmissionYear: number;
  programmeDurationYears: number;
}

/** Extract the starting calendar year of an AcademicYear.
 *
 * Prefers `startDate.getFullYear()`; falls back to parsing the label
 * ("2024-25") for data where startDate is absent. */
function getAyStartYear(ay: {
  startDate?: Date | null;
  label?: string | null;
}): number {
  if (ay.startDate instanceof Date && !Number.isNaN(ay.startDate.getTime())) {
    return ay.startDate.getFullYear();
  }
  if (typeof ay.label === 'string') {
    const m = ay.label.match(/(\d{4})/);
    if (m && m[1]) return Number.parseInt(m[1], 10);
  }
  throw new AppError(
    500,
    'AcademicYear has neither a valid startDate nor a parseable label',
  );
}

export async function resolveStudentYearOfStudy(
  studentId: string,
  opts: ResolveYearOfStudyOpts = {},
): Promise<YearOfStudyResult> {
  if (!mongoose.isValidObjectId(studentId)) {
    throw new AppError(400, 'Invalid studentId');
  }

  const student = await Student.findById(studentId).lean();
  if (!student) throw new AppError(404, 'Student not found');

  // ── Resolve Batch → admissionYear ─────────────────────────────────
  if (!student.batchId) {
    throw new AppError(
      400,
      `Student ${studentId} has no batchId — cannot derive year-of-study`,
    );
  }
  const batch = await Batch.findById(student.batchId).lean();
  if (!batch) {
    throw new AppError(
      404,
      `Batch ${String(student.batchId)} not found for student ${studentId}`,
    );
  }
  const admissionYear = batch.admissionYear;

  // ── Resolve AcademicYear context ──────────────────────────────────
  const asOf = opts.asOf ?? new Date();
  interface AyShape {
    _id: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    label: string;
  }
  let ay: AyShape;

  if (opts.academicYearId) {
    if (!mongoose.isValidObjectId(opts.academicYearId)) {
      throw new AppError(400, 'Invalid academicYearId');
    }
    const found = await AcademicYear.findById(opts.academicYearId).lean();
    if (!found) {
      throw new AppError(
        404,
        `AcademicYear ${opts.academicYearId} not found`,
      );
    }
    ay = found as unknown as AyShape;
  } else {
    // Pick the AY whose [startDate, endDate] window contains `asOf` at
    // the student's college. If >1 matches, pick the most recent by
    // startDate (should be unique in practice — log/ignore anomalies).
    const matches = await AcademicYear.find({
      collegeId: student.collegeId,
      startDate: { $lte: asOf },
      endDate: { $gte: asOf },
    })
      .sort({ startDate: -1 })
      .limit(1)
      .lean();
    const first = matches[0];
    if (!first) {
      throw new AppError(
        404,
        'No active AcademicYear found for the student at the given date — supply opts.academicYearId explicitly',
      );
    }
    ay = first as unknown as AyShape;
  }

  const ayStartYear = getAyStartYear(ay);

  // ── Resolve Programme → durationYears ─────────────────────────────
  // Prefer Student.programmeId, fall back to Batch.programmeId.
  const programmeId = student.programmeId ?? batch.programmeId;
  let durationYears = 4; // Default for BTech / standard UG; OQ-6.
  if (programmeId) {
    const prog = await Programme.findById(programmeId).lean();
    if (prog && typeof prog.durationYears === 'number' && prog.durationYears > 0) {
      durationYears = prog.durationYears;
    }
  }

  // ── Arithmetic ────────────────────────────────────────────────────
  // Lateral entry: honour `studyYearAtAdmission` (schema field, T21).
  // Common case is `2` for BTech lateral entry. Default `1` when the
  // field is null/undefined (records older than T21's backfill or
  // corrupted data).
  const studyYearAtAdmission = student.studyYearAtAdmission ?? 1;
  const lateralOffset = studyYearAtAdmission - 1;

  const raw = ayStartYear - admissionYear + 1 + lateralOffset;

  if (raw < 1) {
    throw new AppError(
      400,
      `Derived year-of-study (${raw}) is < 1 for student ${studentId}: admissionYear=${admissionYear}, AY.startYear=${ayStartYear}. Admission year appears to be AFTER the supplied academic year.`,
    );
  }

  const isGraduated = raw > durationYears;
  const yearOfStudy = isGraduated ? durationYears : raw;

  return {
    yearOfStudy,
    isGraduated,
    academicYearId: String(ay._id),
    academicYearLabel: ay.label,
    batchAdmissionYear: admissionYear,
    programmeDurationYears: durationYears,
  };
}
