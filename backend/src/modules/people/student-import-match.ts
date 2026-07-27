/**
 * Natural-key matching for the student bulk import.
 *
 * The realistic workflow is "fix three rows, re-upload the whole file", so
 * import must be idempotent. Create-only semantics duplicate students with no
 * roll number and hard-fail those with one, against the unique sparse index on
 * (collegeId, rollNumber).
 *
 * Read-only: preview calls this to label rows before anything is written.
 */
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';

export type ImportRowAction = 'create' | 'update' | 'blocked';

export interface MatchResult {
  action: ImportRowAction;
  studentId?: string;
  reason?: string;
}

/**
 * A spreadsheet must never rewrite a record the lifecycle has closed.
 * `isSealed` is checked separately since it is a flag, not a status.
 */
export const BLOCKED_STATUSES: readonly string[] = ['exited', 'alumni', 'graduated'];

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

export async function matchExistingStudent(
  collegeId: string,
  row: Record<string, unknown>,
): Promise<MatchResult> {
  const rollNumber = cell(row, 'rollNumber');
  const aadhaar = cell(row, 'aadhaar');
  const phone = cell(row, 'phone');
  const admissionYear = cell(row, 'admissionYear');

  type FoundStudent = { _id: unknown; status?: string; isSealed?: boolean };
  let found: FoundStudent | null = null;

  // 1. rollNumber — the college's own unique identifier.
  if (rollNumber) {
    found = await Student.findOne({ collegeId, rollNumber })
      .select('_id status isSealed').lean() as FoundStudent | null;
  }

  // 2. aadhaar — lives on Person, so resolve through it. Aadhaar is supposed
  //    to be unique per person, so more than one match is a data-quality
  //    problem rather than a normal case — but check all of them anyway;
  //    the $in form costs nothing and a single findOne would silently pick
  //    an arbitrary one if duplicates exist.
  if (!found && aadhaar) {
    const persons = await Person.find({ collegeId, aadhaar }).select('_id').lean();
    if (persons.length) {
      found = await Student.findOne({ collegeId, personId: { $in: persons.map((p) => p._id) } })
        .select('_id status isSealed').lean() as FoundStudent | null;
    }
  }

  // 3. phone + admissionYear — weakest key, so last, requires both.
  //    A family phone can belong to several people, so check them all.
  if (!found && phone && admissionYear) {
    const persons = await Person.find({ collegeId, phone }).select('_id').lean();
    if (persons.length) {
      found = await Student.findOne({
        collegeId,
        personId: { $in: persons.map((p) => p._id) },
        admissionYear: Number(admissionYear),
      }).select('_id status isSealed').lean() as FoundStudent | null;
    }
  }

  if (!found) return { action: 'create' };

  if (found.isSealed) {
    return { action: 'blocked', studentId: String(found._id), reason: 'record is sealed' };
  }
  if (found.status && BLOCKED_STATUSES.includes(found.status)) {
    return { action: 'blocked', studentId: String(found._id), reason: `record is ${found.status}` };
  }

  return { action: 'update', studentId: String(found._id) };
}
