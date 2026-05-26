/**
 * fee-pin-controller (Task 12 — Fee Configuration)
 *
 * Thin HTTP adapters for the pin-management endpoints. All business
 * logic lives in `fee-pin-service.ts`, `fee-commitment-sheet-service.ts`
 * and `programme-transfer-service.ts`.
 *
 * Routes served:
 *   - GET  /api/finance/students/:id/pins
 *   - POST /api/finance/students/:id/pins/re-pin
 *   - POST /api/finance/students/:id/commitment-sheet/regenerate
 *   - POST /api/finance/students/:id/transfer-programme
 */

import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/authenticate';
import { AppError } from '../../middleware/errorHandler';
import { Student } from '../../models/people/Student';
import * as feePinService from './fee-pin-service';
import * as commitmentSheetService from './fee-commitment-sheet-service';
import * as programmeTransferService from './programme-transfer-service';

const who = (req: AuthRequest) => req.user?.id || req.user?.name || 'system';

/**
 * GET /students/:id/pins — return every pin (active + archived) in
 * insertion order for the student, scoped to the caller's college.
 */
export async function listStudentPins(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const student = await Student.findOne({
      _id: id,
      collegeId: req.collegeId,
    }).populate({
      path: 'feePins.feeStructureInstanceId',
      select: 'status totalAmount approvedAt quota category programmeId branchId academicYearId',
    });
    if (!student) throw new AppError(404, 'Student not found');
    res.json({ pins: student.feePins ?? [] });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /students/:id/pins/re-pin — manual re-pin to an admin-chosen
 * target FeeStructureInstance. Principal / super_admin only.
 */
export async function rePinStudent(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const student = await Student.findOne({
      _id: id,
      collegeId: req.collegeId,
    });
    if (!student) throw new AppError(404, 'Student not found');

    const { yearOfStudy, targetFeeStructureInstanceId, reason, remarks } =
      req.body as {
        yearOfStudy: number;
        targetFeeStructureInstanceId: string;
        reason: Parameters<typeof feePinService.rePin>[2]['reason'];
        remarks?: string;
      };

    const pin = await feePinService.rePin(String(student._id), yearOfStudy, {
      targetFeeStructureInstanceId,
      reason,
      remarks,
      pinnedBy: who(req),
    });

    res.status(201).json({ pin });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /students/:id/commitment-sheet/regenerate — enqueue (or run
 * inline via the service) a PDF regeneration for the specified pin.
 * If `pinId` is omitted, regenerates for the student's currently
 * active pin (the one matching the most recent yearOfStudy).
 */
export async function regenerateCommitmentSheet(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const student = await Student.findOne({
      _id: id,
      collegeId: req.collegeId,
    });
    if (!student) throw new AppError(404, 'Student not found');

    const { pinId: bodyPinId } = (req.body ?? {}) as { pinId?: string };

    let pinId = bodyPinId;
    if (!pinId) {
      // Fallback: the most recently pinned active pin.
      const active = (student.feePins ?? []).filter((p) => !p.archivedAt);
      if (active.length === 0) {
        throw new AppError(
          404,
          'Student has no active pin. Supply pinId or pin the student first.',
        );
      }
      const latest = active.reduce((top, cur) =>
        (cur.pinnedAt?.getTime() ?? 0) >= (top.pinnedAt?.getTime() ?? 0)
          ? cur
          : top,
      );
      pinId = String(latest._id);
    } else {
      const exists = (student.feePins ?? []).some(
        (p) => String(p._id) === String(pinId),
      );
      if (!exists) throw new AppError(404, 'Fee pin not found on student');
    }

    const result = await commitmentSheetService.regenerateForPin(
      String(student._id),
      pinId!,
    );
    res.status(201).json({
      documentId: result.documentId,
      pinId,
      pdfBytes: result.pdfBuffer.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /students/:id/transfer-programme — programme transfer with an
 * automatic re-pin for the effective year-of-study. Principal /
 * super_admin only.
 */
export async function transferProgramme(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const student = await Student.findOne({
      _id: id,
      collegeId: req.collegeId,
    });
    if (!student) throw new AppError(404, 'Student not found');

    const {
      newProgrammeId,
      newBranchId,
      newRegulationId,
      effectiveYearOfStudy,
      academicYearId,
      reason,
    } = req.body as {
      newProgrammeId: string;
      newBranchId?: string;
      newRegulationId?: string;
      effectiveYearOfStudy: number;
      academicYearId: string;
      reason: string;
      remarks?: string;
    };

    const result = await programmeTransferService.transferProgramme({
      studentId: String(student._id),
      newProgrammeId,
      newBranchId,
      newRegulationId,
      effectiveYearOfStudy,
      academicYearId,
      reason,
      performedBy: who(req),
    });

    res.status(200).json({
      studentId: String(student._id),
      oldPin: result.oldPin,
      newPin: result.newPin,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /fee-structure-instances/preview-match — read-only preview that
 * resolves the FeeStructureInstance that would be pinned for a given
 * raw (programme, branch, quota, category, yearOfStudy) combination.
 *
 * Powers the live "matching fee structure" strip on the StudentFormPage
 * Academic Details tab so operators see what a save would map to BEFORE
 * clicking Save. Pure read; no audit log; no side effects.
 */
export async function previewMatchingFeeStructure(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      programmeId,
      branchId,
      quota,
      category,
      yearOfStudy,
      academicYearId,
    } = req.query as Record<string, string | undefined>;

    if (!programmeId) {
      throw new AppError(400, 'programmeId is required');
    }

    const yos = yearOfStudy ? Number(yearOfStudy) : 1;
    if (!Number.isFinite(yos) || yos < 1) {
      throw new AppError(400, 'yearOfStudy must be a positive integer');
    }

    const result = await feePinService.previewMatchingFeeStructureInstance({
      collegeId: req.collegeId!,
      programmeId,
      branchId: branchId || null,
      quota: quota || null,
      category: category || null,
      yearOfStudy: yos,
      academicYearId: academicYearId || undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
