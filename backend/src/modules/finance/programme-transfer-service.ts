/**
 * programme-transfer-service (Task 11 — Fee Configuration)
 *
 * Wraps a programme-level change for a student + an automatic fee-pin
 * rebind for the effective year-of-study into a single rollback-safe
 * operation.
 *
 * Rationale (spec §Journey 4, §AC Rebind rules, plan §1.7):
 *   - Programme transfer at Year N means the student starts owing fees
 *     under the NEW programme's Year-N structure going forward.
 *   - Prior-year pins (year < effectiveYearOfStudy) represent historical
 *     record and MUST be preserved.
 *   - If the new programme has no matching active FeeStructureInstance
 *     for Year N, the whole transfer is aborted and the student is
 *     returned to their pre-call state. No half-written Student doc.
 *
 * Transaction strategy: the in-memory test harness does not run a replica
 * set, so mongoose transactions (`session.withTransaction`) are not
 * available. We implement a compensating manual rollback: snapshot the
 * programme/branch/regulation triple + the previous-active-pin before
 * applying changes; on any failure, restore the snapshot. The narrow
 * mutation surface (three scalar fields + one pin push) makes this safe.
 */

import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import { Student, IStudent, IFeePin } from '../../models/people/Student';
import * as feePinService from './fee-pin-service';
import { FeeStructureNotFoundError } from './fee-pin-service';

export interface ProgrammeTransferInput {
  studentId: string;
  newProgrammeId: string;
  newBranchId?: string;
  newRegulationId?: string;
  effectiveYearOfStudy: number;
  academicYearId: string;
  reason: string;
  performedBy: string;
}

export interface ProgrammeTransferResult {
  student: IStudent;
  oldPin: IFeePin | null;
  newPin: IFeePin;
}

function sameId(a: unknown, b: unknown): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return String(a) === String(b);
}

export async function transferProgramme(
  input: ProgrammeTransferInput,
): Promise<ProgrammeTransferResult> {
  const student = await Student.findById(input.studentId);
  if (!student) throw new AppError(404, 'Student not found');

  // Snapshot pre-change state for compensating rollback.
  const snapshot = {
    programmeId: student.programmeId,
    branchId: student.branchId,
    regulationId: student.regulationId,
  };

  const isSameProgramme = sameId(snapshot.programmeId, input.newProgrammeId);
  const isSameBranch =
    input.newBranchId === undefined ||
    sameId(snapshot.branchId, input.newBranchId);
  const isSameRegulation =
    input.newRegulationId === undefined ||
    sameId(snapshot.regulationId, input.newRegulationId);

  // No-op path: caller requested a transfer that changes nothing. Return
  // the currently active pin (if any) and skip the archive/re-pin dance.
  if (isSameProgramme && isSameBranch && isSameRegulation) {
    const active = student.feePins.find(
      (p) =>
        p.yearOfStudy === input.effectiveYearOfStudy && !p.archivedAt,
    );
    if (active) {
      return {
        student,
        oldPin: null,
        newPin: (active.toObject?.() as IFeePin) ?? (active as IFeePin),
      };
    }
    // Same programme, no existing pin → fall through to pinYear; still a
    // legitimate operation (commits a fresh pin).
  }

  // Locate the currently-active pin for this year (will become oldPin).
  const activeBefore = student.feePins.find(
    (p) => p.yearOfStudy === input.effectiveYearOfStudy && !p.archivedAt,
  );
  const oldPinSnapshot: IFeePin | null = activeBefore
    ? ((activeBefore.toObject?.() as IFeePin) ?? (activeBefore as IFeePin))
    : null;

  // Apply programme/branch/regulation changes.
  student.programmeId = new Types.ObjectId(
    input.newProgrammeId,
  ) as unknown as IStudent['programmeId'];
  if (input.newBranchId !== undefined) {
    student.branchId = new Types.ObjectId(
      input.newBranchId,
    ) as unknown as IStudent['branchId'];
  }
  if (input.newRegulationId !== undefined) {
    student.regulationId = new Types.ObjectId(
      input.newRegulationId,
    ) as unknown as IStudent['regulationId'];
  }
  await student.save();

  let newPin: IFeePin;
  try {
    newPin = await feePinService.pinYear(
      input.studentId,
      input.effectiveYearOfStudy,
      {
        pinnedBy: input.performedBy,
        reason: 'programme_transfer',
        remarks: input.reason,
        academicYearId: input.academicYearId,
        enqueueCommitmentSheet: true,
      },
    );
  } catch (err) {
    // Compensating rollback: restore programme/branch/regulation and
    // ensure the previously-active pin is still active.
    await rollbackStudent(input.studentId, snapshot, oldPinSnapshot);
    if (err instanceof FeeStructureNotFoundError) {
      throw new AppError(
        422,
        `Programme transfer blocked: ${err.message}`,
      );
    }
    throw err;
  }

  // Post-commit reconciliation: concurrent transfers may have raced
  // through pinYear's internal reconcile and each ended up pushing an
  // active pin. Enforce the invariant (at most one active pin per
  // (studentId, yearOfStudy)) with a final last-writer-wins pass. This
  // is idempotent and cheap.
  await reconcileActivePins(input.studentId, input.effectiveYearOfStudy);

  const reloaded = await Student.findById(input.studentId);

  // Re-read the old pin from the reloaded doc so its archivedAt reflects
  // the post-pin state (pinYear archives any prior active pin for the
  // same yearOfStudy).
  let oldPinAfter: IFeePin | null = null;
  if (oldPinSnapshot && reloaded) {
    const match = reloaded.feePins.find(
      (p) => String(p._id) === String(oldPinSnapshot._id),
    );
    if (match) {
      oldPinAfter = (match.toObject?.() as IFeePin) ?? (match as IFeePin);
    }
  }

  return {
    student: reloaded ?? student,
    oldPin: oldPinAfter,
    newPin,
  };
}

async function reconcileActivePins(
  studentId: string,
  yearOfStudy: number,
): Promise<void> {
  const doc = await Student.findById(studentId);
  if (!doc) return;
  const actives = doc.feePins.filter(
    (p) => p.yearOfStudy === yearOfStudy && !p.archivedAt,
  );
  if (actives.length <= 1) return;
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
  await doc.save();
}

async function rollbackStudent(
  studentId: string,
  snapshot: {
    programmeId?: IStudent['programmeId'];
    branchId?: IStudent['branchId'];
    regulationId?: IStudent['regulationId'];
  },
  oldPinSnapshot: IFeePin | null,
): Promise<void> {
  const doc = await Student.findById(studentId);
  if (!doc) return;
  doc.programmeId = snapshot.programmeId;
  doc.branchId = snapshot.branchId;
  doc.regulationId = snapshot.regulationId;

  // Restore prior-active pin (if any). The failure happened at pinYear,
  // which may or may not have archived the old pin before throwing.
  // Defensive: re-activate by matching _id.
  if (oldPinSnapshot) {
    const match = doc.feePins.find(
      (p) => String(p._id) === String(oldPinSnapshot._id),
    );
    if (match && match.archivedAt) {
      match.archivedAt = null;
      match.archiveReason = undefined;
    }
  }
  await doc.save();
}
