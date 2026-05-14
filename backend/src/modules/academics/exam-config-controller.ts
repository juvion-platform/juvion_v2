/**
 * exam-config-controller — HTTP layer for the seven exam-administration
 * master-data entities. Strategic Gap 6 Phase A.
 *
 * All handlers thin-wrap exam-config-service. Mounted under
 * /api/academics/exam-config/* in routes.ts.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as svc from './exam-config-service';

// Small helpers to keep handler bodies tight.
const collegeId = (req: AuthRequest) => req.collegeId!;
const performedBy = (req: AuthRequest) => req.user?.name || 'unknown';
function pageLimit(req: AuthRequest): { page: number; limit: number } {
  return {
    page: parseInt(String(req.query.page || '1'), 10) || 1,
    limit: parseInt(String(req.query.limit || '20'), 10) || 20,
  };
}

// ─── ExamRoom ───────────────────────────────────────────────────
export async function listExamRooms(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = pageLimit(req);
    res.json(await svc.listExamRooms(collegeId(req), page, limit, req.query.status as string | undefined));
  } catch (e) { next(e); }
}
export async function getExamRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.getExamRoom(collegeId(req), id));
  } catch (e) { next(e); }
}
export async function createExamRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await svc.createExamRoom(collegeId(req), req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function updateExamRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.updateExamRoom(collegeId(req), id, req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function deleteExamRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.deleteExamRoom(collegeId(req), id, performedBy(req)));
  } catch (e) { next(e); }
}

// ─── Evaluator ──────────────────────────────────────────────────
export async function listEvaluators(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = pageLimit(req);
    res.json(await svc.listEvaluators(collegeId(req), page, limit, req.query.status as string | undefined, req.query.kind as string | undefined));
  } catch (e) { next(e); }
}
export async function getEvaluator(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.getEvaluator(collegeId(req), id));
  } catch (e) { next(e); }
}
export async function createEvaluator(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await svc.createEvaluator(collegeId(req), req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function updateEvaluator(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.updateEvaluator(collegeId(req), id, req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function deleteEvaluator(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.deleteEvaluator(collegeId(req), id, performedBy(req)));
  } catch (e) { next(e); }
}

// ─── GradeTemplate ──────────────────────────────────────────────
export async function listGradeTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = pageLimit(req);
    res.json(await svc.listGradeTemplates(collegeId(req), page, limit));
  } catch (e) { next(e); }
}
export async function getGradeTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.getGradeTemplate(collegeId(req), id));
  } catch (e) { next(e); }
}
export async function createGradeTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await svc.createGradeTemplate(collegeId(req), req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function updateGradeTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.updateGradeTemplate(collegeId(req), id, req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function deleteGradeTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.deleteGradeTemplate(collegeId(req), id, performedBy(req)));
  } catch (e) { next(e); }
}

// ─── ExamCentreTemplate ─────────────────────────────────────────
export async function listExamCentreTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = pageLimit(req);
    res.json(await svc.listExamCentreTemplates(collegeId(req), page, limit));
  } catch (e) { next(e); }
}
export async function getExamCentreTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.getExamCentreTemplate(collegeId(req), id));
  } catch (e) { next(e); }
}
export async function createExamCentreTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await svc.createExamCentreTemplate(collegeId(req), req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function updateExamCentreTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.updateExamCentreTemplate(collegeId(req), id, req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function deleteExamCentreTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.deleteExamCentreTemplate(collegeId(req), id, performedBy(req)));
  } catch (e) { next(e); }
}

// ─── QuestionPaperSchema ────────────────────────────────────────
export async function listQuestionPapers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = pageLimit(req);
    res.json(await svc.listQuestionPapers(collegeId(req), page, limit, req.query.status as string | undefined));
  } catch (e) { next(e); }
}
export async function getQuestionPaper(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.getQuestionPaper(collegeId(req), id));
  } catch (e) { next(e); }
}
export async function createQuestionPaper(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await svc.createQuestionPaper(collegeId(req), req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function updateQuestionPaper(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.updateQuestionPaper(collegeId(req), id, req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function deleteQuestionPaper(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.deleteQuestionPaper(collegeId(req), id, performedBy(req)));
  } catch (e) { next(e); }
}

// ─── SignatureType ──────────────────────────────────────────────
export async function listSignatureTypes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ items: await svc.listSignatureTypes(collegeId(req)) });
  } catch (e) { next(e); }
}
export async function getSignatureType(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.getSignatureType(collegeId(req), id));
  } catch (e) { next(e); }
}
export async function createSignatureType(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await svc.createSignatureType(collegeId(req), req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function updateSignatureType(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.updateSignatureType(collegeId(req), id, req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function deleteSignatureType(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.deleteSignatureType(collegeId(req), id, performedBy(req)));
  } catch (e) { next(e); }
}

// ─── MoocSubject ────────────────────────────────────────────────
export async function listMoocSubjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = pageLimit(req);
    res.json(await svc.listMoocSubjects(collegeId(req), page, limit, req.query.status as string | undefined));
  } catch (e) { next(e); }
}
export async function getMoocSubject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.getMoocSubject(collegeId(req), id));
  } catch (e) { next(e); }
}
export async function createMoocSubject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await svc.createMoocSubject(collegeId(req), req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function updateMoocSubject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.updateMoocSubject(collegeId(req), id, req.body, performedBy(req)));
  } catch (e) { next(e); }
}
export async function deleteMoocSubject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await svc.deleteMoocSubject(collegeId(req), id, performedBy(req)));
  } catch (e) { next(e); }
}
