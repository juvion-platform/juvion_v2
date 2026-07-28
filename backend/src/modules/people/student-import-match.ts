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
import type { ResolvedRefs } from './student-import-refs';

export type ImportRowAction = 'create' | 'update' | 'blocked';

/**
 * The matched student's fee-axis values, carried on the match result so the
 * caller can decide whether the row would move an axis without a second
 * query. See `feeAxisConflicts` below for why that matters.
 */
export interface MatchedFeeAxes {
  programmeId?: string;
  branchId?: string;
  quota?: string;
  category?: string;
}

export interface MatchResult {
  action: ImportRowAction;
  studentId?: string;
  reason?: string;
  /** Present only when a live student matched (`action === 'update'`). */
  existing?: MatchedFeeAxes;
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

  type FoundStudent = {
    _id: unknown;
    status?: string;
    isSealed?: boolean;
    programmeId?: unknown;
    branchId?: unknown;
    quota?: string;
    category?: string;
  };
  // Fee axes ride along on every projection so the caller can compare them
  // without a follow-up read — see feeAxisConflicts().
  const SELECT = '_id status isSealed programmeId branchId quota category';
  let found: FoundStudent | null = null;

  // 1. rollNumber — the college's own unique identifier.
  if (rollNumber) {
    found = await Student.findOne({ collegeId, rollNumber })
      .select(SELECT).lean() as FoundStudent | null;
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
        .select(SELECT).lean() as FoundStudent | null;
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
      }).select(SELECT).lean() as FoundStudent | null;
    }
  }

  if (!found) return { action: 'create' };

  if (found.isSealed) {
    return { action: 'blocked', studentId: String(found._id), reason: 'record is sealed' };
  }
  if (found.status && BLOCKED_STATUSES.includes(found.status)) {
    return { action: 'blocked', studentId: String(found._id), reason: `record is ${found.status}` };
  }

  return {
    action: 'update',
    studentId: String(found._id),
    existing: {
      programmeId: found.programmeId == null ? undefined : String(found.programmeId),
      branchId: found.branchId == null ? undefined : String(found.branchId),
      quota: found.quota,
      category: found.category,
    },
  };
}

/**
 * The natural keys a row presents, for the engine's whole-file duplicate
 * check (`ImportSchemaDefinition.naturalKeys`). Lives next to
 * `matchExistingStudent` on purpose: the two must consult the same keys or
 * the check misses exactly the collisions it exists to catch.
 *
 * EVERY key the row carries is emitted, not just the highest-precedence one,
 * because `matchExistingStudent` FALLS THROUGH: a row whose rollNumber finds
 * nothing is then tried on aadhaar, then on phone + admissionYear. So two
 * rows with different roll numbers but the same family phone and admission
 * year still collide at commit — row 2 lands on the student row 1 created
 * and overwrites it.
 *
 * Order matches the matcher's precedence, so when a row collides on more
 * than one key the operator is told about the strongest one.
 */
export function studentNaturalKeys(
  row: Record<string, unknown>,
): Array<{ label: string; value: string }> {
  const keys: Array<{ label: string; value: string }> = [];

  const rollNumber = cell(row, 'rollNumber');
  if (rollNumber) keys.push({ label: 'rollNumber', value: rollNumber });

  const aadhaar = cell(row, 'aadhaar');
  if (aadhaar) keys.push({ label: 'aadhaar', value: aadhaar });

  const phone = cell(row, 'phone');
  const admissionYear = cell(row, 'admissionYear');
  if (phone && admissionYear) {
    keys.push({ label: 'phone + admissionYear', value: `${phone} / ${admissionYear}` });
  }

  return keys;
}

/**
 * Owner ruling A — import never moves a fee axis on an existing student.
 *
 * `Student.feePins[]` binds to a FeeStructureInstance selected on
 * programmeId (exact), plus branchId / quota / category as wildcardable axes
 * (CLAUDE.md, Fee-Pin Pipeline). The platform already refuses to let the
 * generic student update move any of them silently:
 *
 *   - `programmeId` → hard 403 in people/service.ts:437, which names the
 *     programme-transfer endpoint as the only correct route, because a
 *     transfer must archive the old pin and re-pin atomically.
 *   - `branchId` / `quota` / `category` → people/service.ts:499 either
 *     auto-rebinds the pin or marks it stale so FeePinsPanel can prompt.
 *
 * The import can do neither. `programmeCode` is mandatory on every row, so
 * a re-import used to perform an unguarded programme transfer, leaving the
 * pin bound to the old programme with no `staleSince` marker to find it by.
 * Rather than teach the importer to rebind pins, the row is Blocked and the
 * operator is pointed at the workflow that does it properly. Nothing is
 * written.
 *
 * Only axes the row actually SUPPLIES are compared, matching the spec's
 * "the row's supplied fields are applied" — except `programmeCode`, which is
 * always supplied. An unset-to-set move counts as a change for every axis,
 * exactly as `feeAxisChanged` treats it in people/service.ts.
 *
 * Returns one human-readable reason per conflicting axis; empty means the
 * row may proceed as a normal update.
 */
export function feeAxisConflicts(
  existing: MatchedFeeAxes,
  refs: ResolvedRefs,
  row: Record<string, unknown>,
): string[] {
  const conflicts: string[] = [];

  if (String(refs.programmeId) !== String(existing.programmeId ?? '')) {
    conflicts.push(
      existing.programmeId
        ? 'programme change is not allowed on import — this student is already enrolled in a '
          + 'different programme. Use the Programme Transfer screen, which rebinds the fee pin '
          + 'atomically, then re-run the import.'
        // Setting a programme where there was none is still a programme move
        // that people/service.ts:437 refuses, so import refuses it too — but
        // say what is actually on file rather than claim a different one.
        : 'programme change is not allowed on import — this student has no programme on file '
          + "and programme is a fee axis. Set it on the student's record in People → Students "
          + '(or use Programme Transfer if they already hold a fee pin), then re-run the import.',
    );
  }

  // Optional axes: only a column the row actually carries can conflict.
  if (cell(row, 'branchCode') && String(refs.branchId ?? '') !== String(existing.branchId ?? '')) {
    conflicts.push(
      'branch change is not allowed on import — branch is a fee axis. Change it on the '
      + "student's record in People → Students so the fee pin is rebound or flagged stale, "
      + 'then re-run the import.',
    );
  }

  const quota = cell(row, 'quota');
  if (quota && quota !== (existing.quota ?? '')) {
    conflicts.push(
      'quota change is not allowed on import — quota is a fee axis. Change it on the '
      + "student's record in People → Students so the fee pin is rebound or flagged stale, "
      + 'then re-run the import.',
    );
  }

  const category = cell(row, 'category');
  if (category && category !== (existing.category ?? '')) {
    conflicts.push(
      'category change is not allowed on import — category is a fee axis. Change it on the '
      + "student's record in People → Students so the fee pin is rebound or flagged stale, "
      + 'then re-run the import.',
    );
  }

  return conflicts;
}
