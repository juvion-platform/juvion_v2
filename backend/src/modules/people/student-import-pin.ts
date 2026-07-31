/**
 * Fee-pinning for the student bulk import (006-import-fee-pin §3).
 *
 * Kept out of `student-import-service.ts`, which owns a different concern
 * (Person / Parent / Student writes plus their compensating rollback).
 *
 * `pinImportedStudent` NEVER throws. That is the whole point of the module,
 * not a defensive habit: `commitImportJob` turns any throw out of `commitOne`
 * into `outcome:'error'` for that row, which inflates `failureCount` and
 * degrades the job to `partial`/`failed`. A college that simply has not
 * published next year's fee structures yet would turn a perfectly clean
 * 500-student import red. Every failure mode is therefore a return value, so
 * a pin outcome can never change a row's outcome (plan §2 invariant).
 *
 * No `createAuditLog` here — `pinYear` → `commitPin` already writes one per
 * pin, and logging again would double-count every imported student in the
 * fee-pin audit trail.
 */
import { Student } from '../../models/people/Student';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import * as feePinService from '../finance/fee-pin-service';
import { resolveStudentYearOfStudy } from '../finance/resolve-year-of-study';

/**
 * Stable actor string. Must stay a literal: `backfill-fee-pins.ts`'s
 * `--rollback-pins-created-by=` matches `pin.pinnedBy` by exact equality, so
 * folding the job id in here would make import-created pins un-rollbackable.
 * Provenance lives in `remarks` instead.
 */
export const IMPORT_PIN_ACTOR = 'system:import';

/** Mirrors the `feePins.yearOfStudy` schema bound on Student. */
const MAX_YEAR_OF_STUDY = 8;

/**
 * Ceiling on how many rows one import will auto-pin. Beyond it the students
 * still import, unpinned, and the remainder is a Finance bulk-pin job.
 *
 * Commit is a synchronous HTTP request that already does several writes per
 * row; pinning adds ~5 round trips on top of each one. A 10,000-row file
 * would hit a gateway timeout long before it hit a correctness problem. The
 * truncation is always logged and reported — silent truncation would read as
 * full coverage, which is worse than not pinning at all.
 */
export const IMPORT_AUTO_PIN_MAX_ROWS = 2000;

export type PinOutcome =
  | { kind: 'pinned'; pinId: string; fsiId: string; totalAmount: number }
  | { kind: 'already-pinned'; fsiId: string }
  | { kind: 'no-match'; message: string }
  | { kind: 'skipped'; reason: 'no-academic-year' | 'no-programme' | 'row-cap' }
  | { kind: 'error'; message: string };

/**
 * Mutable per-job allowance, decremented by each row that actually attempts a
 * pin. Lives on the commit context because the row handler is stateless and
 * the engine is the only thing that spans rows.
 */
export interface PinBudget {
  remaining: number;
}

export type ImportPinAcademicYear =
  | { ok: true; academicYearId: string; label: string }
  | { ok: false; reason: 'none-current' | 'ambiguous-current'; message: string };

/**
 * Decide, once per job, which academic year the whole file pins against.
 *
 * Resolved once rather than per row on purpose: a long import that straddled
 * an academic-year rollover would otherwise split one cohort across two
 * years, and nothing downstream would show that it had happened.
 *
 * An ambiguous `isCurrent` (two years flagged — a data bug, but a real one)
 * is refused rather than guessed. `findOne` would pick an arbitrary year and
 * bind the entire cohort to it silently; making the operator name the year
 * turns an invisible wrong answer into a visible question.
 */
export async function resolveImportPinAcademicYear(
  collegeId: string,
): Promise<ImportPinAcademicYear> {
  const current = await AcademicYear.find({ collegeId, isCurrent: true })
    .select('_id label code')
    .lean();

  if (current.length === 0) {
    return {
      ok: false,
      reason: 'none-current',
      message:
        'No current academic year is set for this college, so imported students '
        + 'cannot be pinned to a fee structure. Set one, or choose an academic '
        + 'year for this import.',
    };
  }
  if (current.length > 1) {
    return {
      ok: false,
      reason: 'ambiguous-current',
      message:
        `${current.length} academic years are flagged as current, so the fee `
        + 'structure to pin against is ambiguous. Choose an academic year for '
        + 'this import, or fix the flags.',
    };
  }

  const only = current[0]!;
  return { ok: true, academicYearId: String(only._id), label: only.label ?? only.code ?? '' };
}

export interface PinImportContext {
  collegeId: string;
  performedBy: string;
  /**
   * Resolved once per job and frozen on the ImportJob (§4.3), never per row —
   * a long import must not straddle an academic-year rollover and split a
   * cohort. Absent means the job could not resolve one at all.
   */
  academicYearId?: string;
  jobId: string;
  /** Absent outside commit — preview attempts no pins, so it needs no budget. */
  pinBudget?: PinBudget;
}

export type YearOfStudyResolution =
  | { ok: true; yearOfStudy: number }
  | { ok: false; error: string };

/**
 * Resolve the year a row should pin at.
 *
 * `studyYearAtAdmission` is an optional column, so a blank cell legitimately
 * means "direct admission, Year 1". Anything else present must be a whole
 * year in range: the field validator (`validNumber({min:1,max:8})`) lets
 * `2.5` through, and `2.5` matches no fee structure at all — it would surface
 * as a baffling "no matching fee structure" rather than the typo it is.
 *
 * Shared with the preview hook so the year shown to the operator is provably
 * the year the commit will pin at (E21).
 */
export function resolvePinYearOfStudy(raw: unknown): YearOfStudyResolution {
  const cell = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
  if (!cell) return { ok: true, yearOfStudy: 1 };

  const parsed = Number(cell);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_YEAR_OF_STUDY) {
    return {
      ok: false,
      error:
        `studyYearAtAdmission must be a whole number between 1 and ${MAX_YEAR_OF_STUDY} `
        + `— got "${cell}"`,
    };
  }
  return { ok: true, yearOfStudy: parsed };
}

/** Actor recorded on pins written by the Finance bulk-pin action. */
export const BULK_PIN_ACTOR = 'system:bulk-pin';

export interface PinAttemptContext {
  collegeId: string;
  /** Absent means the caller could not settle one; every attempt is skipped. */
  academicYearId?: string;
  /** Stable literal — `--rollback-pins-created-by` matches it exactly. */
  pinnedBy: string;
  remarks: string;
  pinBudget?: PinBudget;
  /** Identifies the caller in the warning log when a pin fails unexpectedly. */
  logLabel: string;
}

/**
 * Pin one student for one year, or explain why not. Never throws.
 *
 * Shared by the import commit and the Finance bulk-pin action so the two can
 * never drift on what "already pinned" means — the guard below is the only
 * definition of it.
 */
export async function pinStudentForYear(
  studentId: string,
  yearOfStudy: number,
  ctx: PinAttemptContext,
): Promise<PinOutcome> {
  try {
    if (!ctx.academicYearId) return { kind: 'skipped', reason: 'no-academic-year' };

    const student = await Student.findOne({ _id: studentId, collegeId: ctx.collegeId })
      .select('feePins programmeId')
      .lean();
    if (!student) return { kind: 'error', message: 'Student not found' };
    if (!student.programmeId) return { kind: 'skipped', reason: 'no-programme' };

    // `commitPin` archives whatever active pin exists for the year and pushes
    // a replacement even when the structure is identical, so an unguarded
    // re-run would churn every pin and fill the audit trail with no-op
    // replacements.
    //
    // Deliberately not "re-pin when the structure differs" — that means
    // either an axis moved (which import refuses outright) or Finance
    // superseded the structure, and the second is a Finance decision that
    // belongs on the Re-pin screen with a reason attached.
    const active = (student.feePins ?? []).find(
      (pin) => pin.yearOfStudy === yearOfStudy && !pin.archivedAt,
    );
    if (active) return { kind: 'already-pinned', fsiId: String(active.feeStructureInstanceId) };

    // Checked after the guard so a student needing no work costs no budget —
    // a re-run over 3,000 students should not exhaust the allowance on the
    // ones already pinned.
    if (ctx.pinBudget) {
      if (ctx.pinBudget.remaining <= 0) return { kind: 'skipped', reason: 'row-cap' };
      ctx.pinBudget.remaining -= 1;
    }

    const pinned = await feePinService.pinYear(studentId, yearOfStudy, {
      pinnedBy: ctx.pinnedBy,
      reason: 'initial',
      academicYearId: ctx.academicYearId,
      // Sheet generation is an explicit bulk action of its own. A 500-student
      // run must not be able to fail on a Redis blip.
      enqueueCommitmentSheet: false,
      remarks: ctx.remarks,
    });

    return {
      kind: 'pinned',
      pinId: String(pinned._id),
      fsiId: String(pinned.feeStructureInstanceId),
      totalAmount: pinned.snapshotTotalAmount ?? 0,
    };
  } catch (err) {
    if ((err as { name?: string }).name === 'FeeStructureNotFoundError') {
      return { kind: 'no-match', message: (err as Error).message };
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[${ctx.logLabel}] student=${studentId} pin failed:`,
      (err as Error).message ?? err,
    );
    return { kind: 'error', message: (err as Error).message ?? 'pin failed' };
  }
}

export async function pinImportedStudent(
  studentId: string,
  typedRow: Record<string, unknown>,
  ctx: PinImportContext,
): Promise<PinOutcome> {
  const year = resolvePinYearOfStudy(typedRow.studyYearAtAdmission);
  if (!year.ok) return { kind: 'error', message: year.error };

  return pinStudentForYear(studentId, year.yearOfStudy, {
    collegeId: ctx.collegeId,
    ...(ctx.academicYearId ? { academicYearId: ctx.academicYearId } : {}),
    pinnedBy: IMPORT_PIN_ACTOR,
    remarks: `import job=${ctx.jobId} by=${ctx.performedBy}`,
    ...(ctx.pinBudget ? { pinBudget: ctx.pinBudget } : {}),
    logLabel: 'import-pin',
  });
}

export interface ExistingStudentPinYear {
  yearOfStudy: number;
  /**
   * `calendar` came from the batch + academic-year maths, which is the real
   * current year. `admission` is the fallback for a student with no batch —
   * correct for one just imported, a guess for one who has been enrolled for
   * years. Callers surface it so the assumption is never invisible.
   */
  derivedFrom: 'calendar' | 'admission';
  academicYearId?: string;
}

/**
 * Year to pin an EXISTING student at.
 *
 * `resolveStudentYearOfStudy` is the canonical answer but hard-fails without a
 * Batch, and batch-less students are exactly the ones bulk import produces
 * (no batch exists for MTECH/MBA in a stock catalogue). Refusing them would
 * make the bulk remedy skip precisely the population it exists to serve, so
 * this falls back to their admission year and reports that it did.
 */
export async function resolvePinYearForExistingStudent(
  studentId: string,
  studyYearAtAdmission?: number,
): Promise<ExistingStudentPinYear> {
  try {
    const resolved = await resolveStudentYearOfStudy(studentId);
    return {
      yearOfStudy: resolved.yearOfStudy,
      derivedFrom: 'calendar',
      academicYearId: resolved.academicYearId,
    };
  } catch {
    return {
      yearOfStudy: studyYearAtAdmission && studyYearAtAdmission >= 1
        ? studyYearAtAdmission
        : 1,
      derivedFrom: 'admission',
    };
  }
}

/**
 * What `pinStudentForYear` WOULD return, without writing anything.
 *
 * Same shape minus `pinId`, which only exists once a pin has been created.
 * `kind: 'pinned'` therefore reads as "would pin" — unambiguous because the
 * only caller is the dry-run branch of bulk-pin, which labels its whole
 * result `dryRun: true`.
 */
export type PinFeasibility =
  | { kind: 'pinned'; fsiId: string; totalAmount: number }
  | Exclude<PinOutcome, { kind: 'pinned' }>;

/**
 * Mirrors `pinStudentForYear`'s decision tree exactly, in the same order, so
 * a dry run cannot promise an outcome the real run would not produce.
 */
export async function previewPinYearAvailability(
  studentId: string,
  yearOfStudy: number,
  ctx: { collegeId: string; academicYearId?: string },
): Promise<PinFeasibility> {
  try {
    if (!ctx.academicYearId) return { kind: 'skipped', reason: 'no-academic-year' };

    const student = await Student.findOne({ _id: studentId, collegeId: ctx.collegeId })
      .select('feePins programmeId branchId quota category')
      .lean();
    if (!student) return { kind: 'error', message: 'Student not found' };
    if (!student.programmeId) return { kind: 'skipped', reason: 'no-programme' };

    const active = (student.feePins ?? []).find(
      (pin) => pin.yearOfStudy === yearOfStudy && !pin.archivedAt,
    );
    if (active) return { kind: 'already-pinned', fsiId: String(active.feeStructureInstanceId) };

    const match = await feePinService.previewMatchingFeeStructureInstance({
      collegeId: ctx.collegeId,
      programmeId: String(student.programmeId),
      ...(student.branchId ? { branchId: String(student.branchId) } : {}),
      ...(student.quota ? { quota: student.quota } : {}),
      ...(student.category ? { category: student.category } : {}),
      yearOfStudy,
      academicYearId: ctx.academicYearId,
    });
    if (!match.matched || !match.fsi) {
      return { kind: 'no-match', message: 'no matching fee structure' };
    }
    return {
      kind: 'pinned',
      fsiId: String(match.fsi._id),
      totalAmount: match.fsi.totalAmount ?? 0,
    };
  } catch (err) {
    return { kind: 'error', message: (err as Error).message ?? 'lookup failed' };
  }
}
