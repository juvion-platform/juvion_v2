/**
 * Finance bulk-pin (006-import-fee-pin §5.3).
 *
 * Clears the unpinned tail the Pin Coverage report surfaces. Import pins what
 * it can at upload time; this is for the students it could not — because the
 * structure had not been published yet, or because nobody ever pinned them.
 *
 * Delegates every write to `pinStudentForYear`, the same function the import
 * commit uses, so the two can never disagree about what "already pinned"
 * means. A divergence there would be invisible until a re-run silently
 * churned pins that import considers settled.
 *
 * `dryRun` is the Finance sign-off step, mirroring the flow
 * `backfill-fee-pins.ts` documents: review the list, then run it for real.
 */
import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import { Student } from '../../models/people/Student';
import { Person } from '../../models/people/Person';
import {
  pinStudentForYear,
  resolvePinYearForExistingStudent,
  previewPinYearAvailability,
  BULK_PIN_ACTOR,
  type PinFeasibility,
} from '../people/student-import-pin';

/** Above this, the CLI backfill is the right tool — this runs in one request. */
export const BULK_PIN_MAX_STUDENTS = 1000;

export interface BulkPinFilter {
  programmeId?: string;
  branchId?: string;
  quota?: string;
  category?: string;
}

export interface BulkPinInput {
  studentIds?: string[];
  filter?: BulkPinFilter;
  academicYearId?: string;
  dryRun?: boolean;
}

export interface BulkPinRow {
  studentId: string;
  name: string;
  rollNumber?: string;
  yearOfStudy: number;
  outcome: PinFeasibility['kind'];
  message?: string;
  totalAmount?: number;
  /** True when the year came from admission rather than the batch calendar. */
  yearAssumed: boolean;
}

export interface BulkPinResult {
  dryRun: boolean;
  considered: number;
  pinned: number;
  alreadyPinned: number;
  noMatch: number;
  skipped: number;
  errors: number;
  totalPinnedAmount: number;
  /** True when more students matched than this run would touch. */
  capped: boolean;
  rows: BulkPinRow[];
}

function describe(outcome: PinFeasibility): string | undefined {
  if (outcome.kind === 'no-match' || outcome.kind === 'error') return outcome.message;
  if (outcome.kind === 'skipped') return outcome.reason;
  return undefined;
}

export async function bulkPinStudents(
  collegeId: string,
  input: BulkPinInput,
  performedBy: string,
): Promise<BulkPinResult> {
  const hasIds = Array.isArray(input.studentIds) && input.studentIds.length > 0;
  if (!hasIds && !input.filter) {
    throw new AppError(400, 'Supply studentIds or a filter — refusing to pin every student.');
  }
  if (hasIds && input.studentIds!.length > BULK_PIN_MAX_STUDENTS) {
    throw new AppError(
      400,
      `Too many students (${input.studentIds!.length}). Maximum per call is `
      + `${BULK_PIN_MAX_STUDENTS}; use the backfill script for a larger run.`,
    );
  }
  if (input.academicYearId && !Types.ObjectId.isValid(input.academicYearId)) {
    throw new AppError(400, 'academicYearId is not a valid id.');
  }

  const query: Record<string, unknown> = { collegeId, status: 'active' };
  if (hasIds) {
    const invalid = input.studentIds!.find((id) => !Types.ObjectId.isValid(id));
    if (invalid) throw new AppError(400, `"${invalid}" is not a valid student id.`);
    query._id = { $in: input.studentIds };
  }
  if (input.filter?.programmeId) query.programmeId = input.filter.programmeId;
  if (input.filter?.branchId) query.branchId = input.filter.branchId;
  if (input.filter?.quota) query.quota = input.filter.quota;
  if (input.filter?.category) query.category = input.filter.category;

  // One extra so "there were more than we will touch" is a fact, not a guess.
  const students = await Student.find(query)
    .select('_id personId rollNumber studyYearAtAdmission')
    .limit(BULK_PIN_MAX_STUDENTS + 1)
    .lean();
  const capped = students.length > BULK_PIN_MAX_STUDENTS;
  const batch = capped ? students.slice(0, BULK_PIN_MAX_STUDENTS) : students;

  const persons = batch.length
    ? await Person.find({ collegeId, _id: { $in: batch.map((s) => s.personId) } })
      .select('_id name').lean()
    : [];
  const nameById = new Map(persons.map((p) => [String(p._id), p.name]));

  const result: BulkPinResult = {
    dryRun: Boolean(input.dryRun),
    considered: batch.length,
    pinned: 0,
    alreadyPinned: 0,
    noMatch: 0,
    skipped: 0,
    errors: 0,
    totalPinnedAmount: 0,
    capped,
    rows: [],
  };

  for (const student of batch) {
    const studentId = String(student._id);
    const year = await resolvePinYearForExistingStudent(
      studentId,
      student.studyYearAtAdmission,
    );
    const academicYearId = input.academicYearId ?? year.academicYearId;

    const outcome: PinFeasibility = input.dryRun
      ? await previewPinYearAvailability(studentId, year.yearOfStudy, {
        collegeId, academicYearId,
      })
      : await pinStudentForYear(studentId, year.yearOfStudy, {
        collegeId,
        ...(academicYearId ? { academicYearId } : {}),
        pinnedBy: BULK_PIN_ACTOR,
        remarks: `bulk-pin by ${performedBy}`,
        logLabel: 'bulk-pin',
      });

    if (outcome.kind === 'pinned') {
      result.pinned += 1;
      result.totalPinnedAmount += outcome.totalAmount;
    } else if (outcome.kind === 'already-pinned') result.alreadyPinned += 1;
    else if (outcome.kind === 'no-match') result.noMatch += 1;
    else if (outcome.kind === 'skipped') result.skipped += 1;
    else result.errors += 1;

    result.rows.push({
      studentId,
      name: nameById.get(String(student.personId)) ?? '',
      ...(student.rollNumber ? { rollNumber: student.rollNumber } : {}),
      yearOfStudy: year.yearOfStudy,
      outcome: outcome.kind,
      ...(describe(outcome) ? { message: describe(outcome) } : {}),
      ...(outcome.kind === 'pinned' ? { totalAmount: outcome.totalAmount } : {}),
      yearAssumed: year.derivedFrom === 'admission',
    });
  }

  return result;
}
