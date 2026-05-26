/**
 * fee-pin-service (Task 5 — Fee Configuration)
 *
 * Central pinning business logic: binds a student to a specific
 * `FeeStructureInstance` for a given year-of-study. Once pinned, the
 * student owes that version's totals for that year even if the college
 * later revises rates (see spec §Journey 7 + plan §1.4–1.7).
 *
 * Public API (all functions take plain ids / POJO opts):
 *   - `pinYear(studentId, yearOfStudy, opts)` — resolve + pin + enqueue sheet
 *   - `rePin(studentId, yearOfStudy, opts)` — admin-driven re-pin to a
 *      supplied target instance
 *   - `archivePin(studentId, pinId, archiveReason)` — idempotent archive
 *   - `resolveActivePin(studentId, yearOfStudy)` — read helper for invoices
 *   - `checkPinValidity(studentId, yearOfStudy)` — stale-pin detector used
 *      by the rebind hook + invoice UI banner
 *   - `resolveMatchingFeeStructureInstance(student, yearOfStudy, opts)` —
 *      preference-matched lookup (exact-branch > null-branch; exact-category
 *      > null-category; quota MUST match; tie-break on `approvedAt`)
 *
 * Invariant (enforced here, NOT in the schema): for any
 * `(studentId, yearOfStudy)`, at most one pin has `archivedAt === null`.
 * `pinYear` / `rePin` always archive any existing active pin for that year
 * before pushing a new one.
 *
 * Spec: .captain/specs/fee-configuration/spec.md
 * Plan: .captain/specs/fee-configuration/plan.md §1.4–1.7, §2.1
 */

import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import {
  Student,
  IStudent,
  IFeePin,
  FeePinReason,
} from '../../models/people/Student';
import {
  FeeStructureInstance,
  IFeeStructureInstance,
} from '../../models/finance/FeeStructureInstance';
import { Batch } from '../../models/academic-structure/Batch';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { enqueueFeeCommitmentJob } from '../../workers/fee-commitment.worker';

// ── Types ─────────────────────────────────────────────────────────────

/**
 * Thrown when `pinYear` cannot find an active FeeStructureInstance for
 * a student's attributes. The constructor packs the combo into the
 * message so operators can reproduce / fix it without spelunking logs.
 */
export class FeeStructureNotFoundError extends AppError {
  public readonly detail: FeeStructureNotFoundDetail;

  constructor(detail: FeeStructureNotFoundDetail) {
    super(404, formatMissingStructureMessage(detail));
    this.name = 'FeeStructureNotFoundError';
    this.detail = detail;
  }
}

export interface FeeStructureNotFoundDetail {
  programmeId: Types.ObjectId | string;
  branchId?: Types.ObjectId | string | null;
  quota?: string;
  category?: string;
  yearOfStudy: number;
  academicYearId?: Types.ObjectId | string;
}

export interface PinYearOpts {
  pinnedBy: string;
  reason?: FeePinReason;
  remarks?: string;
  academicYearId?: Types.ObjectId | string;
  /** Default true. Disabling skips the BullMQ enqueue (used in tests / bulk flows). */
  enqueueCommitmentSheet?: boolean;
}

export interface RePinOpts {
  targetFeeStructureInstanceId: Types.ObjectId | string;
  reason: FeePinReason;
  remarks?: string;
  pinnedBy: string;
  /** Default true. */
  enqueueCommitmentSheet?: boolean;
}

export type PinValidityReason =
  | 'branch_mismatch'
  | 'quota_mismatch'
  | 'category_mismatch'
  | 'programme_mismatch'
  | 'no_active_pin';

export interface PinValidity {
  valid: boolean;
  reason?: PinValidityReason;
  currentPin: IFeePin | null;
  matchingInstance: IFeeStructureInstance | null;
}

export interface ResolveMatchOpts {
  academicYearId?: Types.ObjectId | string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatMissingStructureMessage(d: FeeStructureNotFoundDetail): string {
  const parts = [
    `programme=${String(d.programmeId)}`,
    d.branchId ? `branch=${String(d.branchId)}` : 'branch=<any>',
    d.quota ? `quota=${d.quota}` : 'quota=<any>',
    d.category ? `category=${d.category}` : 'category=<any>',
    `year ${d.yearOfStudy}`,
    d.academicYearId ? `academicYear=${String(d.academicYearId)}` : 'academicYear=<unknown>',
  ];
  return `No approved fee structure for ${parts.join(', ')}. Finance must create and activate a matching FeeStructureInstance before this student can be pinned.`;
}

function asObjectId(id: Types.ObjectId | string): Types.ObjectId {
  return id instanceof Types.ObjectId ? id : new Types.ObjectId(String(id));
}

function sameId(a: unknown, b: unknown): boolean {
  if (!a || !b) return !a && !b;
  return String(a) === String(b);
}

/**
 * Best-effort derivation of the student's current AcademicYear.
 *
 * Pin lookup REQUIRES an academicYearId (FeeStructureInstance is scoped
 * by it). Callers may pass it explicitly via opts; if not, we try to
 * resolve via the student's batch. If still unknown, the resolver
 * receives `undefined` and will return null (which surfaces as
 * FeeStructureNotFoundError with academicYear=<unknown>).
 */
async function deriveAcademicYearId(
  student: IStudent,
  opt?: Types.ObjectId | string,
): Promise<Types.ObjectId | undefined> {
  if (opt) return asObjectId(opt);
  if (!student.batchId) return undefined;
  const batch = await Batch.findById(student.batchId).lean();
  if (!batch) return undefined;
  // Batch does not own academicYearId directly (it tracks admissionYear +
  // regulation). Callers that need precise year-of-study → academic-year
  // mapping must pass `academicYearId` explicitly. Return undefined so
  // the resolver fails cleanly rather than guessing.
  return undefined;
}

/** Convert a Mongoose FeePin subdoc to a plain IFeePin object. */
function toPinPojo(subdoc: IFeePin & { toObject?: () => IFeePin }): IFeePin {
  if (typeof subdoc.toObject === 'function') {
    return subdoc.toObject() as IFeePin;
  }
  return subdoc as IFeePin;
}

// ── Core: resolveMatchingFeeStructureInstance ────────────────────────

/**
 * Find the FeeStructureInstance that should apply to `student` for
 * `yearOfStudy` within the given academic year.
 *
 * Preference rules (matches `resolveFeeStructure` in workflow.handlers
 * semantically; adapted to the FeeStructureInstance model):
 *   1. `collegeId`, `programmeId`, `academicYearId`, `status='active'`
 *      are required filters.
 *   2. `quota` must match exactly — no fallback. A student with
 *      `quota='convener'` NEVER resolves to a `quota='management'`
 *      structure.
 *   3. `branchId`: exact match preferred. If none exists, fall back to
 *      records where the instance's `branchId` is null/absent
 *      (wildcard).
 *   4. `category`: exact match preferred. Null/absent category on the
 *      instance acts as a wildcard default.
 *   5. Preference ordering: most specific wins (branch-exact +
 *      category-exact > branch-exact + category-wild > branch-wild +
 *      category-exact > branch-wild + category-wild). Within a bucket,
 *      tie-break on `approvedAt` descending.
 */
/**
 * Score one wildcardable axis. Returns:
 *   - 2  on exact match (instance has a specific value that equals student's)
 *   - 1  on wildcard (instance is null/absent — accepts any student value)
 *   - 0  on mismatch (instance has a value that disagrees with student's)
 *
 * The caller treats 0 as "drop this candidate". Tying breakers prefer
 * exact (2) over wildcard (1) so the most-specific fee structure wins.
 */
function scoreAxis<T>(docValue: T | null | undefined, studentValue: T | null | undefined): number {
  if (docValue === null || docValue === undefined) return 1; // wildcard
  if (studentValue !== null && studentValue !== undefined && docValue === studentValue) return 2;
  return 0; // mismatch
}

export async function resolveMatchingFeeStructureInstance(
  student: IStudent,
  yearOfStudy: number,
  opts: ResolveMatchOpts = {},
): Promise<IFeeStructureInstance | null> {
  if (!student.programmeId) return null;
  const academicYearId = opts.academicYearId
    ? asObjectId(opts.academicYearId)
    : undefined;
  if (!academicYearId) return null;

  // Base filter: the 4 axes that MUST match exactly. The wildcardable
  // axes (branch, category, quota, yearOfStudy) are evaluated in the
  // scoring loop below so a single null-vs-value contract applies
  // uniformly. Keeping them out of the base filter also lets a single
  // round-trip return both exact-match and wildcard candidates for the
  // same student, which the scorer then orders by specificity.
  const baseFilter: Record<string, unknown> = {
    collegeId: student.collegeId,
    programmeId: student.programmeId,
    academicYearId,
    status: 'active',
  };

  const candidates = await FeeStructureInstance.find(baseFilter);
  if (candidates.length === 0) return null;

  const studentBranch = student.branchId ? String(student.branchId) : null;
  const studentCategory = student.category ?? null;
  const studentQuota = student.quota ?? null;

  type Scored = { doc: IFeeStructureInstance; score: number; approvedAt: number };
  const scored: Scored[] = [];

  for (const doc of candidates) {
    const branchScore = scoreAxis(doc.branchId ? String(doc.branchId) : null, studentBranch);
    if (branchScore === 0) continue;

    const categoryScore = scoreAxis(doc.category ?? null, studentCategory);
    if (categoryScore === 0) continue;

    // §005 fix — quota is now scored alongside branch + category. The
    // pre-§005 base filter included `quota` conditionally, which
    // (a) excluded null-quota wildcard instances when the student had
    // a quota set, and (b) let any FSI through when the student had no
    // quota. Routing quota through the scorer fixes both.
    const quotaScore = scoreAxis(doc.quota ?? null, studentQuota);
    if (quotaScore === 0) continue;

    // §005 fix — yearOfStudy is now a real column on FSI. Wildcard
    // semantics keep legacy FSIs (no yearOfStudy field) working
    // unchanged.
    const yearScore = scoreAxis(typeof doc.yearOfStudy === 'number' ? doc.yearOfStudy : null, yearOfStudy);
    if (yearScore === 0) continue;

    const approvedAt = doc.approvedAt ? doc.approvedAt.getTime() : 0;
    // Specificity ordering: branch (10000) > category (1000) > quota
    // (100) > yearOfStudy (10). Within a tier, exact (2) beats wildcard (1).
    // Powers-of-ten weights guarantee a higher-tier exact always beats
    // any combination of lower-tier exacts.
    const score = branchScore * 10000 + categoryScore * 1000 + quotaScore * 100 + yearScore * 10;
    scored.push({ doc, score, approvedAt });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.approvedAt - a.approvedAt;
  });
  return scored[0]!.doc;
}

// ── previewMatchingFeeStructureInstance ──────────────────────────────

/**
 * Read-only preview: given a raw combination of (programme, branch,
 * quota, category, yearOfStudy) for a college, return the
 * FeeStructureInstance that *would* be pinned without actually
 * pinning anything.
 *
 * Powers the live fee-preview strip on the StudentFormPage Academic
 * Details tab — the operator sees which fee structure their current
 * selection maps to BEFORE clicking Save.
 *
 * No side effects. The returned FSI has `branchId` and `programmeId`
 * populated so the frontend can render human names without a follow-up
 * lookup.
 *
 * Resolves the current AcademicYear (`isCurrent: true`) automatically
 * when one is not passed — mirrors the auto-pin path.
 */
export interface PreviewMatchInput {
  collegeId: Types.ObjectId | string;
  programmeId: Types.ObjectId | string;
  branchId?: Types.ObjectId | string | null;
  quota?: string | null;
  category?: string | null;
  yearOfStudy?: number;
  academicYearId?: Types.ObjectId | string;
}

export interface PreviewMatchResult {
  matched: boolean;
  fsi: IFeeStructureInstance | null;
  academicYearId: string | null;
  reason?: 'no-academic-year' | 'no-matching-fee-structure';
}

export async function previewMatchingFeeStructureInstance(
  input: PreviewMatchInput,
): Promise<PreviewMatchResult> {
  // Resolve the academic year. If the caller passed one, use it.
  // Otherwise look up the college's current AY (same lookup the FSI
  // seed and auto-pin path use).
  let academicYearId: Types.ObjectId | undefined;
  if (input.academicYearId) {
    academicYearId = asObjectId(input.academicYearId);
  } else {
    const ay = await AcademicYear.findOne({
      collegeId: asObjectId(input.collegeId),
      isCurrent: true,
    })
      .select({ _id: 1 })
      .lean<{ _id: Types.ObjectId } | null>();
    academicYearId = ay?._id;
  }

  if (!academicYearId) {
    return {
      matched: false,
      fsi: null,
      academicYearId: null,
      reason: 'no-academic-year',
    };
  }

  // Build a Student-shaped partial that
  // `resolveMatchingFeeStructureInstance` can score against. Only the
  // fee-axis fields it actually reads need to be present.
  const studentLike = {
    collegeId: asObjectId(input.collegeId),
    programmeId: asObjectId(input.programmeId),
    branchId: input.branchId ? asObjectId(input.branchId) : undefined,
    quota: input.quota ?? undefined,
    category: input.category ?? undefined,
  } as unknown as IStudent;

  const fsi = await resolveMatchingFeeStructureInstance(
    studentLike,
    input.yearOfStudy ?? 1,
    { academicYearId },
  );

  if (!fsi) {
    return {
      matched: false,
      fsi: null,
      academicYearId: String(academicYearId),
      reason: 'no-matching-fee-structure',
    };
  }

  // Re-fetch with population so the frontend can show human names
  // for branch / programme without a second round-trip.
  const populated = await FeeStructureInstance.findById(fsi._id)
    .populate('branchId', 'name code')
    .populate('programmeId', 'name code')
    .lean();

  return {
    matched: true,
    fsi: (populated ?? fsi) as IFeeStructureInstance,
    academicYearId: String(academicYearId),
  };
}

// ── pinYear ───────────────────────────────────────────────────────────

export async function pinYear(
  studentId: string,
  yearOfStudy: number,
  opts: PinYearOpts,
): Promise<IFeePin> {
  const student = await Student.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');

  const academicYearId = await deriveAcademicYearId(student, opts.academicYearId);

  const match = await resolveMatchingFeeStructureInstance(student, yearOfStudy, {
    academicYearId,
  });
  if (!match) {
    throw new FeeStructureNotFoundError({
      programmeId: student.programmeId ? String(student.programmeId) : 'unknown',
      branchId: student.branchId ? String(student.branchId) : null,
      quota: student.quota,
      category: student.category,
      yearOfStudy,
      academicYearId: academicYearId ? String(academicYearId) : undefined,
    });
  }

  return commitPin(student, yearOfStudy, {
    feeStructureInstanceId: match._id as Types.ObjectId,
    pinnedBy: opts.pinnedBy,
    reason: opts.reason ?? 'initial',
    remarks: opts.remarks,
    enqueueCommitmentSheet: opts.enqueueCommitmentSheet,
  });
}

// ── rePin ─────────────────────────────────────────────────────────────

export async function rePin(
  studentId: string,
  yearOfStudy: number,
  opts: RePinOpts,
): Promise<IFeePin> {
  const student = await Student.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');

  const targetId = asObjectId(opts.targetFeeStructureInstanceId);
  const target = await FeeStructureInstance.findOne({
    _id: targetId,
    collegeId: student.collegeId,
  });
  if (!target) {
    throw new AppError(
      404,
      `Target FeeStructureInstance ${String(targetId)} not found for this college`,
    );
  }

  return commitPin(student, yearOfStudy, {
    feeStructureInstanceId: target._id as Types.ObjectId,
    pinnedBy: opts.pinnedBy,
    reason: opts.reason,
    remarks: opts.remarks,
    enqueueCommitmentSheet: opts.enqueueCommitmentSheet,
  });
}

// ── archivePin ────────────────────────────────────────────────────────

export async function archivePin(
  studentId: string,
  pinId: string,
  archiveReason: string,
): Promise<void> {
  const student = await Student.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');

  const pin = student.feePins.find((p) => String(p._id) === String(pinId));
  if (!pin) throw new AppError(404, 'Pin not found on student');

  if (pin.archivedAt) return; // idempotent no-op

  pin.archivedAt = new Date();
  pin.archiveReason = archiveReason;
  await student.save();

  await createAuditLog({
    collegeId: String(student.collegeId),
    entityType: 'Student',
    entityId: String(student._id),
    entityName: `Student#${String(student._id)}`,
    studentId: String(student._id),
    action: 'archive',
    changes: [
      {
        field: 'feePins',
        displayName: 'Fee Pin',
        oldValue: { pinId: String(pin._id), archivedAt: null },
        newValue: { pinId: String(pin._id), archivedAt: pin.archivedAt, archiveReason },
      },
    ],
    performedBy: 'system',
  });
}

// ── resolveActivePin ─────────────────────────────────────────────────

export async function resolveActivePin(
  studentId: string,
  yearOfStudy: number,
): Promise<IFeePin | null> {
  const student = await Student.findById(studentId);
  if (!student) return null;
  const match = student.feePins.find(
    (p) => p.yearOfStudy === yearOfStudy && !p.archivedAt,
  );
  return match ? toPinPojo(match) : null;
}

// ── checkPinValidity ─────────────────────────────────────────────────

export async function checkPinValidity(
  studentId: string,
  yearOfStudy: number,
): Promise<PinValidity> {
  const student = await Student.findById(studentId);
  if (!student) {
    return { valid: false, reason: 'no_active_pin', currentPin: null, matchingInstance: null };
  }

  const activeSub = student.feePins.find(
    (p) => p.yearOfStudy === yearOfStudy && !p.archivedAt,
  );
  const currentPin = activeSub ? toPinPojo(activeSub) : null;

  // Always compute what SHOULD currently be pinned for comparison.
  // We don't know which academicYear to use without context — try to
  // infer from the pinned instance.
  let academicYearId: Types.ObjectId | undefined;
  let pinnedInstance: IFeeStructureInstance | null = null;
  if (activeSub) {
    pinnedInstance = await FeeStructureInstance.findById(activeSub.feeStructureInstanceId);
    if (pinnedInstance) {
      academicYearId = pinnedInstance.academicYearId as unknown as Types.ObjectId;
    }
  }

  const matchingInstance = await resolveMatchingFeeStructureInstance(
    student,
    yearOfStudy,
    { academicYearId },
  );

  if (!currentPin || !pinnedInstance) {
    return {
      valid: false,
      reason: 'no_active_pin',
      currentPin,
      matchingInstance,
    };
  }

  // Compare student attributes vs the pinned instance.
  if (!sameId(pinnedInstance.programmeId, student.programmeId)) {
    return { valid: false, reason: 'programme_mismatch', currentPin, matchingInstance };
  }
  // branch: mismatch only when instance has a branch and student's branch
  // differs. Null-branch instances remain valid regardless.
  const docBranch = pinnedInstance.branchId ? String(pinnedInstance.branchId) : null;
  const studentBranch = student.branchId ? String(student.branchId) : null;
  if (docBranch && docBranch !== studentBranch) {
    return { valid: false, reason: 'branch_mismatch', currentPin, matchingInstance };
  }
  // quota: §005 wildcard contract (matches resolveMatchingFeeStructureInstance).
  // FSI.quota=null is a wildcard — valid regardless of student.quota.
  // FSI.quota=X with student.quota !== X → quota_mismatch.
  const docQuota = pinnedInstance.quota ?? null;
  const studentQuota = student.quota ?? null;
  if (docQuota && docQuota !== studentQuota) {
    return { valid: false, reason: 'quota_mismatch', currentPin, matchingInstance };
  }
  // category: mismatch only when instance has a category set and student
  // differs. Null-category instance is a wildcard.
  const docCategory = pinnedInstance.category ?? null;
  const studentCategory = student.category ?? null;
  if (docCategory && docCategory !== studentCategory) {
    return { valid: false, reason: 'category_mismatch', currentPin, matchingInstance };
  }

  return { valid: true, currentPin, matchingInstance };
}

// ── Internal: shared pin commit path ─────────────────────────────────

interface CommitPinInput {
  feeStructureInstanceId: Types.ObjectId;
  pinnedBy: string;
  reason: FeePinReason;
  remarks?: string;
  enqueueCommitmentSheet?: boolean;
}

async function commitPin(
  student: IStudent,
  yearOfStudy: number,
  input: CommitPinInput,
): Promise<IFeePin> {
  const now = new Date();

  // Archive any existing active pin for this yearOfStudy (invariant:
  // at most one active pin per (studentId, yearOfStudy)).
  for (const existing of student.feePins) {
    if (existing.yearOfStudy === yearOfStudy && !existing.archivedAt) {
      existing.archivedAt = now;
      existing.archiveReason = 'replaced';
    }
  }

  student.feePins.push({
    yearOfStudy,
    feeStructureInstanceId: input.feeStructureInstanceId,
    pinnedAt: now,
    pinnedBy: input.pinnedBy,
    reason: input.reason,
    remarks: input.remarks,
    archivedAt: null,
  } as unknown as IFeePin);

  await student.save();

  const pushed = student.feePins[student.feePins.length - 1]!;
  const pushedId = String(pushed._id);

  // Concurrency guard: if two `pinYear` calls raced for the same
  // (studentId, yearOfStudy), each will have archived nothing and
  // pushed its own pin — the final doc ends up with 2+ active pins
  // for the same year. Reconcile with a second atomic pass: last
  // writer wins (the pin with the most recent pinnedAt survives).
  const reconciled = await Student.findById(student._id);
  if (reconciled) {
    const actives = reconciled.feePins.filter(
      (p) => p.yearOfStudy === yearOfStudy && !p.archivedAt,
    );
    if (actives.length > 1) {
      const survivor = actives.reduce((latest, cur) =>
        (cur.pinnedAt?.getTime() ?? 0) >= (latest.pinnedAt?.getTime() ?? 0)
          ? cur
          : latest,
      );
      const now = new Date();
      for (const a of actives) {
        if (String(a._id) !== String(survivor._id)) {
          a.archivedAt = now;
          a.archiveReason = 'replaced';
        }
      }
      await reconciled.save();
    }
  }

  // Re-read the pushed pin from the reconciled doc so its archivedAt
  // reflects whether the current caller was the survivor.
  const finalStudent = reconciled ?? student;
  const finalPushed =
    finalStudent.feePins.find((p) => String(p._id) === pushedId) ?? pushed;
  const pinPojo = toPinPojo(finalPushed);

  await createAuditLog({
    collegeId: String(student.collegeId),
    entityType: 'Student',
    entityId: String(student._id),
    entityName: `Student#${String(student._id)}`,
    studentId: String(student._id),
    action: 'create',
    changes: [
      {
        field: 'feePins',
        displayName: 'Fee Pin',
        oldValue: null,
        newValue: {
          pinId: String(pushed._id),
          yearOfStudy,
          feeStructureInstanceId: String(input.feeStructureInstanceId),
          reason: input.reason,
        },
      },
    ],
    performedBy: input.pinnedBy,
  });

  if (input.enqueueCommitmentSheet !== false) {
    try {
      await enqueueFeeCommitmentJob({
        studentId: String(student._id),
        pinId: String(pushed._id),
      });
    } catch (e) {
      // Enqueue failures must not block the pin itself. The nightly
      // audit job (T17) will surface pins whose commitmentSheetStatus
      // never reaches 'generated'.
      console.warn(
        `[fee-pin-service] enqueueFeeCommitmentJob failed for student=${String(student._id)} pin=${String(pushed._id)}`,
        e,
      );
    }
  }

  return pinPojo;
}
