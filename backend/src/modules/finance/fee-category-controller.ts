/**
 * fee-category-controller — thin HTTP adapters for the per-college
 * `FeeCategory` catalog. All business logic lives in
 * `fee-category-service.ts`.
 *
 * Routes served (under /api/finance):
 *   - GET    /fee-categories        ?page=&limit=&status=
 *   - POST   /fee-categories        { code, name, description?, status? }
 *   - GET    /fee-categories/:id
 *   - PATCH  /fee-categories/:id    { code?, name?, description?, status? }
 *   - DELETE /fee-categories/:id    → 204
 */

import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/authenticate';
import * as categoryService from './fee-category-service';
import { FeeCategoryStatus } from '../../models/finance/FeeCategory';

const who = (req: AuthRequest) => req.user?.id || req.user?.name || 'system';

export async function listFeeCategories(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { page, limit, status } = req.query as {
      page?: string;
      limit?: string;
      status?: FeeCategoryStatus;
    };
    const opts: categoryService.ListCategoriesOpts = {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    };
    if (status) opts.status = status;
    const result = await categoryService.listCategories(req.collegeId!, opts);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createFeeCategory(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const doc = await categoryService.createCategory(
      req.collegeId!,
      req.body as categoryService.CreateCategoryInput,
      who(req),
    );
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function getFeeCategory(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const doc = await categoryService.getCategory(
      req.collegeId!,
      req.params.id as string,
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function updateFeeCategory(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const doc = await categoryService.updateCategory(
      req.collegeId!,
      req.params.id as string,
      req.body as categoryService.UpdateCategoryInput,
      who(req),
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function deleteFeeCategory(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await categoryService.deleteCategory(
      req.collegeId!,
      req.params.id as string,
      who(req),
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
