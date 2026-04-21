/**
 * fee-component-template-controller (Task 12 — Fee Configuration)
 *
 * Thin HTTP adapters for the `FeeComponentTemplate` catalog. All
 * business logic lives in `fee-component-template-service.ts`.
 *
 * Routes served:
 *   - GET    /api/finance/component-template
 *   - POST   /api/finance/component-template/components
 *   - PUT    /api/finance/component-template/components/:componentId
 *   - DELETE /api/finance/component-template/components/:componentId
 */

import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/authenticate';
import * as templateService from './fee-component-template-service';
import { FeeComponentTemplateCategory } from '../../models/finance/FeeComponentTemplate';

const who = (req: AuthRequest) => req.user?.id || req.user?.name || 'system';

export async function listTemplateComponents(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { category, applicableToYear } = req.query as {
      category?: FeeComponentTemplateCategory;
      applicableToYear?: string;
    };
    const opts: templateService.ListComponentsOpts = {};
    if (category) opts.category = category;
    if (typeof applicableToYear === 'string' && applicableToYear.length > 0) {
      const parsed = Number(applicableToYear);
      if (Number.isFinite(parsed)) opts.applicableToYear = parsed;
    }
    const components = await templateService.listComponents(
      req.collegeId!,
      opts,
    );
    res.json({ components });
  } catch (err) {
    next(err);
  }
}

export async function createTemplateComponent(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const doc = await templateService.createComponent(
      req.collegeId!,
      req.body as templateService.CreateComponentInput,
      who(req),
    );
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function updateTemplateComponent(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { componentId } = req.params;
    const doc = await templateService.updateComponent(
      req.collegeId!,
      componentId as string,
      req.body as templateService.UpdateComponentInput,
      who(req),
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplateComponent(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { componentId } = req.params;
    await templateService.deleteComponent(
      req.collegeId!,
      componentId as string,
      who(req),
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
