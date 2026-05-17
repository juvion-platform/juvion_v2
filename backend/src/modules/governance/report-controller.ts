/**
 * report-controller — HTTP layer for the declarative report engine.
 * Strategic Gap 4 Phase A. Mounted under /api/governance/reports/* .
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as svc from './report-service';
import * as nlSvc from './nl-reports/service';
import { nlStatsRangeSchema } from './validation';

const collegeId = (req: AuthRequest) => req.collegeId!;
const performedBy = (req: AuthRequest) => req.user?.name || 'unknown';

export async function listDefinitionsHandler(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(svc.listDefinitions());
  } catch (e) { next(e); }
}

export async function getDefinitionHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { code } = req.params as { code: string };
    res.json(svc.getDefinition(code));
  } catch (e) { next(e); }
}

export async function listRunsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const limit = parseInt(String(req.query.limit || '20'), 10) || 20;
    const code = req.query.definitionCode as string | undefined;
    res.json(await svc.listRuns(collegeId(req), page, limit, code));
  } catch (e) { next(e); }
}

export async function getRunHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.getRun(collegeId(req), id));
  } catch (e) { next(e); }
}

export async function runReportHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { code } = req.params as { code: string };
    const params = (req.body?.parameters as Record<string, unknown>) || {};
    // 004 §10.10 — REST endpoint still behind requireRole(admin/super_admin) per
    // spec §4 item 8 (out of scope to upgrade); pass ADMIN_FULL_SCOPE sentinel so
    // the eligibility gate is a no-op for these admin-only callers.
    const doc = await svc.runReport(collegeId(req), code, params, performedBy(req), svc.ADMIN_FULL_SCOPE);
    res.json(doc);
  } catch (e) { next(e); }
}

// ─── 003-ai-nl-report-queries ────────────────────────────

export async function nlQueryHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { question } = req.body as { question: string };
    const result = await nlSvc.nlQuery(collegeId(req), question, performedBy(req));
    res.json(result);
  } catch (e) { next(e); }
}

export async function nlStatsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = nlStatsRangeSchema.safeParse(req.query.range ?? 'today');
    const range = parsed.success ? parsed.data : 'today';
    res.json(await nlSvc.getNlReportStats(collegeId(req), range));
  } catch (e) { next(e); }
}
