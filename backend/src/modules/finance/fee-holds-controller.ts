/**
 * fee-holds-controller (Task 8 — Fee Collection Analytics & Alerts)
 *
 * Thin HTTP adapters over `fee-holds-service` plus the pause-escalation
 * mutation (which lives alongside holds because it's part of the same
 * Principal / Finance-Officer approval workflow).
 *
 *   - GET  /api/finance/holds                           → listHoldsHandler
 *   - POST /api/finance/holds/:id/activate              → activateHoldHandler
 *   - POST /api/finance/holds/:id/waive                 → waiveHoldHandler
 *   - POST /api/finance/students/:id/pause-escalation   → pauseEscalationHandler
 *
 * Business logic sits in:
 *   - `fee-holds-service` (T4) for list / activate / waive
 *   - `fee-holds-controller` (this file) for pause-escalation — it's a
 *     simple `updateMany` on DefaulterRecord + audit; lifting it into a
 *     dedicated service would add ceremony without value.
 *
 * Spec: .captain/specs/fee-collection-analytics-and-alerts/spec.md §Journey 4, 5
 * Plan: .captain/specs/fee-collection-analytics-and-alerts/plan.md §1.8
 */

import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/authenticate';
import { AppError } from '../../middleware/errorHandler';
import * as feeHoldsService from './fee-holds-service';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { createAuditLog } from '../../shared/audit';
import { FieldChange } from '../../shared/types';

const who = (req: AuthRequest): string => req.user?.id || req.user?.name || 'system';

// ═══ List ═════════════════════════════════════════════════════

/**
 * GET /api/finance/holds — paginated list with default ordering.
 * Query validation: holdsListQuerySchema (status, studentId, limit, offset)
 */
export async function listHoldsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = (req as unknown as {
      validatedQuery: {
        status?: 'pending_approval' | 'active' | 'released';
        studentId?: string;
        limit?: number;
        offset?: number;
      };
    }).validatedQuery;

    const result = await feeHoldsService.listHolds(req.collegeId!, {
      status: q.status,
      studentId: q.studentId,
      limit: q.limit,
      offset: q.offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ═══ Activate ═════════════════════════════════════════════════

/**
 * POST /api/finance/holds/:id/activate — transition pending_approval → active.
 * Principal / super_admin only (enforced at the route layer via authorize).
 */
export async function activateHoldHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const updated = await feeHoldsService.activateHold(
      req.collegeId!,
      String(id),
      who(req),
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ═══ Waive ════════════════════════════════════════════════════

/**
 * POST /api/finance/holds/:id/waive — transition pending|active → released.
 * Body validation: waiveHoldSchema (reason).
 */
export async function waiveHoldHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason: string };
    const updated = await feeHoldsService.waiveHold(
      req.collegeId!,
      String(id),
      who(req),
      reason,
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ═══ Pause escalation ═════════════════════════════════════════

/**
 * POST /api/finance/students/:id/pause-escalation — set
 * `DefaulterRecord.autoEscalationPaused` on every record for the student.
 * Cron checks this field and skips the student if the value is a future
 * date. 404 if the student has no DefaulterRecord (pausing a non-
 * defaulter is a no-op that the UI should never surface).
 */
export async function pauseEscalationHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id: studentId } = req.params;
    const { pausedUntil } = req.body as { pausedUntil: Date };

    const collegeId = req.collegeId!;
    const records = await DefaulterRecord.find({ collegeId, studentId });
    if (records.length === 0) {
      throw new AppError(404, 'No defaulter record for this student');
    }

    // Capture prior paused-until values for audit `from`.
    const priorById = new Map<string, Date | null | undefined>();
    for (const r of records) {
      priorById.set(String(r._id), r.autoEscalationPaused ?? null);
    }

    await DefaulterRecord.updateMany(
      { collegeId, studentId },
      { $set: { autoEscalationPaused: pausedUntil } },
    );

    // Emit one audit entry per record. Keeps per-record history for the
    // `DefaulterRecord` entityType consistent with other mutations.
    for (const r of records) {
      const oldValue = priorById.get(String(r._id)) ?? null;
      const changes: FieldChange[] = [
        {
          field: 'autoEscalationPaused',
          displayName: 'Auto-Escalation Paused Until',
          oldValue: oldValue,
          newValue: pausedUntil,
        },
      ];
      await createAuditLog({
        collegeId,
        entityType: 'DefaulterRecord',
        entityId: String(r._id),
        entityName: `DefaulterRecord:${r.escalationStage}`,
        studentId: String(r.studentId),
        action: 'update',
        changes,
        performedBy: who(req),
      });
    }

    res.json({
      updated: records.length,
      studentId: String(studentId),
      pausedUntil,
    });
  } catch (err) {
    next(err);
  }
}
