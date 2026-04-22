/**
 * fee-analytics-controller (Task 8 — Fee Collection Analytics & Alerts)
 *
 * Thin HTTP adapters over `fee-analytics-service`. Two endpoints:
 *   - GET /api/finance/analytics/dashboard  → getDashboardHandler
 *   - GET /api/finance/analytics/defaulters → getDefaultersHandler
 *
 * Controllers build the `AuthScope` contract the service expects. For HOD
 * callers, `hodProgrammeIds` is resolved from
 * `req.authScope.departmentId` via a `Branch.find(...).distinct(...)`
 * lookup — Branch is the bridge between Department and Programme in
 * this codebase. For admins / super_admins, `hodProgrammeIds` stays
 * undefined (no restriction).
 *
 * Spec: .captain/specs/fee-collection-analytics-and-alerts/spec.md §Journey 1
 * Plan: .captain/specs/fee-collection-analytics-and-alerts/plan.md §1.4, §1.8
 */

import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/authenticate';
import * as feeAnalyticsService from './fee-analytics-service';
import type { AuthScope } from './fee-analytics-service';
import { Branch } from '../../models/academic-structure/Branch';

/**
 * Resolve the AuthScope object the service layer expects. Only HODs get
 * a restrictive programme scope; all other roles see the entire college.
 * Requires an authenticated request (ensured by `authenticate` middleware).
 */
async function buildAuthScope(req: AuthRequest): Promise<AuthScope> {
  const role = req.user?.role ?? 'anonymous';
  const collegeId = req.collegeId!;

  let hodProgrammeIds: string[] | undefined;
  if (role === 'hod') {
    const deptId = req.authScope?.departmentId;
    if (deptId) {
      // Every Branch is associated with one programme + (optionally) one
      // department. HOD scope = all programmes whose branches live under
      // the HOD's department.
      const programmeIds = await Branch.find({
        collegeId,
        departmentId: deptId,
      }).distinct('programmeId');
      hodProgrammeIds = programmeIds.map((p) => String(p));
    } else {
      // HOD without a resolved departmentId → restrictive empty scope.
      hodProgrammeIds = [];
    }
  }

  return { role, collegeId, hodProgrammeIds };
}

/**
 * GET /api/finance/analytics/dashboard
 * Query: dashboardQuerySchema (from, to, programmeIds[], branchIds[],
 * batchIds[], academicYearId)
 */
export async function getDashboardHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = (req as unknown as {
      validatedQuery: {
        from: Date;
        to: Date;
        programmeIds?: string[];
        branchIds?: string[];
        batchIds?: string[];
        academicYearId?: string;
      };
    }).validatedQuery;

    const auth = await buildAuthScope(req);
    const payload = await feeAnalyticsService.getDashboard(
      req.collegeId!,
      {
        from: q.from,
        to: q.to,
        programmeIds: q.programmeIds,
        branchIds: q.branchIds,
        batchIds: q.batchIds,
        academicYearId: q.academicYearId,
      },
      auth,
    );
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/finance/analytics/defaulters
 * Query: defaultersQuerySchema (limit, offset, sort)
 */
export async function getDefaultersHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = (req as unknown as {
      validatedQuery: {
        limit?: number;
        offset?: number;
        sort?: 'overdueAmount' | 'daysOverdue';
      };
    }).validatedQuery;

    const auth = await buildAuthScope(req);
    const result = await feeAnalyticsService.getDefaulters(
      req.collegeId!,
      { limit: q.limit, offset: q.offset, sort: q.sort },
      auth,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
