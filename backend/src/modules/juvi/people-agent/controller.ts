/**
 * 008 Phase 3 — People agent HTTP handlers.
 *
 * Thin. Cross-college enforcement lives in the service (it needs the DB), and
 * spend gating plus audit live in the LLM client, so these only resolve the
 * caller and delegate.
 */
import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middleware/authenticate';
import { AppError } from '../../../middleware/errorHandler';
import * as service from './service';

function getUserId(req: AuthRequest): string {
  const id = req.user?.id;
  if (!id) throw new AppError(401, 'Not authenticated');
  return String(id);
}

export async function alertNarrationsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { alertIds } = req.body as { alertIds: string[] };
    res.json({
      narrations: await service.handleAlertNarrations(req.collegeId!, getUserId(req), alertIds),
    });
  } catch (e) { next(e); }
}

export async function outreachDraftsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { studentIds } = req.body as { studentIds: string[] };
    res.json({
      drafts: await service.handleOutreachDrafts(req.collegeId!, getUserId(req), studentIds),
    });
  } catch (e) { next(e); }
}

export async function approveOutreachHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { approved } = req.body as { approved: service.ApprovedOutreach[] };
    res.json(await service.handleApproveOutreach(req.collegeId!, getUserId(req), approved));
  } catch (e) { next(e); }
}
