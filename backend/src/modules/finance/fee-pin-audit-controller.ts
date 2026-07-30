/**
 * fee-pin-audit-controller (Task 12 — Fee Configuration)
 *
 * Thin HTTP adapters for the audit read endpoints. Delegates to
 * `fee-pin-audit-service.ts`.
 *
 * Routes served:
 *   - GET /api/finance/pin-audit/coverage
 *   - GET /api/finance/pin-audit/invariants
 */

import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/authenticate';
import { AppError } from '../../middleware/errorHandler';
import * as auditService from './fee-pin-audit-service';

/**
 * GET /pin-audit/coverage?collegeId=<id>&page=&limit=&reason=
 *
 * `collegeId` query override is only honored for super_admin; every
 * other caller is scoped to their own college via JWT.
 */
export async function getCoverage(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const collegeId = resolveAuditCollegeId(req);
    const { page, limit, reason } = req.query as {
      page?: string; limit?: string; reason?: string;
    };
    const report = await auditService.getCoverage(collegeId, {
      ...(page ? { page: Number(page) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(reason ? { reason: reason as auditService.CoverageReason } : {}),
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function getInvariants(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const collegeId = resolveAuditCollegeId(req);
    const report = await auditService.getInvariants(collegeId);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

function resolveAuditCollegeId(req: AuthRequest): string {
  const override = (req.query.collegeId as string | undefined) ?? undefined;
  if (override && req.user?.role === 'super_admin') return override;
  if (!req.collegeId) {
    throw new AppError(400, 'collegeId is required');
  }
  return req.collegeId;
}
