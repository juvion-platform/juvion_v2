import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as svc from './service';
import * as exitService from './exit-service';
import { ALL_PERSONAS, L1_L2_PERSONAS, L3_SUB_PERSONAS } from '../../shared/rbac/personas';

// ─── Strategic Gap 7 — persona catalog ─────────────────────────────
export async function listPersonas(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ all: ALL_PERSONAS, l1_l2: L1_L2_PERSONAS, l3: L3_SUB_PERSONAS });
  } catch (e) { next(e); }
}

const who = (req: AuthRequest) => req.user?.name || 'System';
const qp = (req: AuthRequest) => {
  const q = req.query as Record<string, string | undefined>;
  return {
    page: +(q.page || '1'),
    limit: +(q.limit || '20'),
    status: q.status,
    search: q.search,
    onboardingStatus: q.onboardingStatus,
    needsAttention: q.needsAttention === 'true' || q.needsAttention === '1',
  };
};

const studentQp = (req: AuthRequest) => {
  const q = qp(req);
  return {
    page: q.page,
    limit: q.limit,
    status: q.status,
    search: q.search,
    onboardingStatus: q.onboardingStatus,
    needsAttention: q.needsAttention,
  };
};

// ─── Dashboard Stats ─────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getDashboardStats(req.collegeId!)); } catch (e) { next(e); }
}

// ─── Persons ─────────────────────────────────────────
export async function listPersons(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listPersons(req.collegeId!, q.page, q.limit, q.search, req.authScope)); } catch (e) { next(e); }
}
export async function getPerson(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getPerson(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createPerson(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createPerson(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updatePerson(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updatePerson(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deletePerson(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deletePerson(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Students ────────────────────────────────────────
export async function listStudents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const q = studentQp(req);
    res.json(await svc.listStudents(req.collegeId!, q.page, q.limit, q.status, q.search, q.onboardingStatus, q.needsAttention, req.authScope));
  } catch (e) { next(e); }
}
export async function getStudent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getStudent(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createStudent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createStudent(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateStudent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateStudent(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteStudent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteStudent(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Faculty ─────────────────────────────────────────
export async function listFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listFaculty(req.collegeId!, q.page, q.limit, q.status, q.search, req.authScope)); } catch (e) { next(e); }
}
export async function getFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getFaculty(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createFaculty(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateFaculty(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteFaculty(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Staff ───────────────────────────────────────────
export async function listStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listStaff(req.collegeId!, q.page, q.limit, q.status, q.search, req.authScope)); } catch (e) { next(e); }
}
export async function getStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getStaff(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createStaff(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateStaff(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteStaff(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Parents ─────────────────────────────────────────
export async function listParents(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listParents(req.collegeId!, q.page, q.limit, q.search, req.authScope)); } catch (e) { next(e); }
}
export async function getParent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getParent(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createParent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createParent(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateParent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateParent(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteParent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteParent(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Organizations ───────────────────────────────────
export async function listOrganizations(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listOrganizations(req.collegeId!, q.page, q.limit, q.search, req.authScope)); } catch (e) { next(e); }
}
export async function getOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getOrganization(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createOrganization(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateOrganization(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteOrganization(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══════════════════════════════════════════════════════════════
// W10 EXIT WORKFLOW CONTROLLERS
// ═══════════════════════════════════════════════════════════════

// ─── Exit Requests ──────────────────────────────────────────
export async function submitExitRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.submitExitRequest(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function getExitRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getExitRequest(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function listExitRequestsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status } = req.query as Record<string, string | undefined>;
    res.json(await exitService.listExitRequests(req.collegeId!, +page!, +limit!, status));
  } catch (e) { next(e); }
}
export async function approveExitRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.approveExitRequest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function rejectExitRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.rejectExitRequest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function cancelExitRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.cancelExitRequest(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}
export async function getExitSummaryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getExitSummary(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

// ─── Student Lifecycle ──────────────────────────────────────
export async function transitionStudentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.transitionStudent(req.collegeId!, req.params.id as string, req.body.status, who(req))); } catch (e) { next(e); }
}
export async function checkGraduationEligibilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.checkGraduationEligibility(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function sealStudentRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.sealStudentRecord(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Clearance ──────────────────────────────────────────────
export async function initiateClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.initiateClearanceWorkflow(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function getClearanceWorkflowCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getClearanceWorkflow(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function listClearanceWorkflowsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status } = req.query as Record<string, string | undefined>;
    res.json(await exitService.listClearanceWorkflows(req.collegeId!, +page!, +limit!, status));
  } catch (e) { next(e); }
}
export async function completeClearanceItemCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.completeClearanceItem(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function waiveClearanceItemCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.waiveClearanceItem(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function listPendingClearanceItemsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { assigneeRole, page = '1', limit = '20' } = req.query as Record<string, string | undefined>;
    res.json(await exitService.listPendingClearanceItems(req.collegeId!, assigneeRole || '', +page!, +limit!));
  } catch (e) { next(e); }
}
export async function getClearanceDashboardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getClearanceDashboard(req.collegeId!)); } catch (e) { next(e); }
}
export async function logEscalationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.logEscalation(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Documents ──────────────────────────────────────────────
export async function listDocumentTemplatesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', type } = req.query as Record<string, string | undefined>;
    res.json(await exitService.listDocumentTemplates(req.collegeId!, +page!, +limit!, type));
  } catch (e) { next(e); }
}
export async function getDocumentTemplateCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getDocumentTemplate(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createDocumentTemplateCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.createDocumentTemplate(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function generateDocumentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.generateDocument(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function signDocumentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.signDocument(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function issueDocumentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.issueDocument(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function revokeDocumentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.revokeDocument(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Alumni ─────────────────────────────────────────────────
export async function createAlumniRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.createAlumniRecord(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function getAlumniCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getAlumni(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function listAlumniCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', programmeId } = req.query as Record<string, string | undefined>;
    res.json(await exitService.listAlumni(req.collegeId!, +page!, +limit!, programmeId));
  } catch (e) { next(e); }
}
