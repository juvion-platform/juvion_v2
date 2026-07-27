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

  // 2. aadhaar — lives on Person, so resolve through it.
  if (!found && aadhaar) {
    const person = await Person.findOne({ collegeId, aadhaar }).select('_id').lean();
    if (person) {
      found = await Student.findOne({ collegeId, personId: person._id })
        .select('_id status isSealed').lean() as FoundStudent | null;
    }
  }

  // 3. phone + admissionYear — weakest key, so it is last and requires both.
  //    Phone alone would collide across siblings sharing a family number.
  if (!found && phone && admissionYear) {
    const person = await Person.findOne({ collegeId, phone }).select('_id').lean();
    if (person) {
      found = await Student.findOne({ collegeId, personId: person._id, admissionYear: Number(admissionYear) })
        .select('_id status isSealed').lean() as FoundStudent | null;
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
