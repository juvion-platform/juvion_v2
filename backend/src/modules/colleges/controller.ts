import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import { AppError } from '../../middleware/errorHandler';
import * as service from './service';
import { updateSpendLimits } from '../platform/spend-limits/service';

const who = (req: AuthRequest) => req.user?.name || 'System';

export async function stats(_req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats()); } catch (err) { next(err); }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, status } = req.query as any;
    res.json(await service.listColleges(Number(page) || 1, Number(limit) || 20, search, status));
  } catch (err) { next(err); }
}

export async function get(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getCollege(req.params.id as string)); } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCollege(req.body, who(req))); } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateCollege(req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteCollege(req.params.id as string, who(req))); } catch (err) { next(err); }
}

/**
 * L6 — `PATCH /api/colleges/:id/ai-spend-limits`.
 *
 * Thin wrapper over `updateSpendLimits` from the spend-limits service.
 * The service already handles:
 *   - 404 when the college is missing
 *   - DB write-back of the new values
 *   - cache invalidation (limits + spend)
 *   - AuditLog with field-level from→to deltas
 *   - return shape `{ aiSpendLimits, currentSpend }`
 *
 * We attach the userId as the audit `performedBy` so admins can be
 * traced individually rather than collapsed under "System".
 */
export async function updateAiSpendLimits(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const collegeId = req.params.id as string;
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Not authenticated');

    const result = await updateSpendLimits(
      collegeId,
      {
        weeklyInr: req.body.weeklyInr,
        alertThresholdPct: req.body.alertThresholdPct,
      },
      userId,
    );
    res.json(result);
  } catch (err) { next(err); }
}
