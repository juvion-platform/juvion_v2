/**
 * fee-quota-controller — thin HTTP adapters for the per-college
 * `FeeQuota` catalog. All business logic lives in
 * `fee-quota-service.ts`.
 *
 * Routes served (under /api/finance):
 *   - GET    /fee-quotas        ?page=&limit=&status=
 *   - POST   /fee-quotas        { code, name, description?, status? }
 *   - GET    /fee-quotas/:id
 *   - PATCH  /fee-quotas/:id    { code?, name?, description?, status? }
 *   - DELETE /fee-quotas/:id    → 204
 */

import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/authenticate';
import * as quotaService from './fee-quota-service';
import { FeeQuotaStatus } from '../../models/finance/FeeQuota';

const who = (req: AuthRequest) => req.user?.id || req.user?.name || 'system';

export async function listFeeQuotas(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { page, limit, status } = req.query as {
      page?: string;
      limit?: string;
      status?: FeeQuotaStatus;
    };
    const opts: quotaService.ListQuotasOpts = {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    };
    if (status) opts.status = status;
    const result = await quotaService.listQuotas(req.collegeId!, opts);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createFeeQuota(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const doc = await quotaService.createQuota(
      req.collegeId!,
      req.body as quotaService.CreateQuotaInput,
      who(req),
    );
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function getFeeQuota(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const doc = await quotaService.getQuota(
      req.collegeId!,
      req.params.id as string,
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function updateFeeQuota(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const doc = await quotaService.updateQuota(
      req.collegeId!,
      req.params.id as string,
      req.body as quotaService.UpdateQuotaInput,
      who(req),
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function deleteFeeQuota(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await quotaService.deleteQuota(
      req.collegeId!,
      req.params.id as string,
      who(req),
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
