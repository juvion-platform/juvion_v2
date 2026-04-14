import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';
import * as ggmService from './ggm-service';
import * as arcDiscService from './arc-disc-service';
import * as iccScstGrcService from './icc-scst-grc-service';
import * as mentCounsCcdService from './ment-couns-ccd-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Hostel Block ════════════════════════════════════════

export async function listHostelBlocks(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listHostelBlocks(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function getHostelBlock(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getHostelBlock(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHostelBlock(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createHostelBlock(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHostelBlock(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateHostelBlock(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHostelBlock(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteHostelBlock(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Hostel Room ═════════════════════════════════════════

export async function listHostelRooms(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, blockId } = req.query as any;
    res.json(await service.listHostelRooms(req.collegeId!, Number(page) || 1, Number(limit) || 20, blockId, req.authScope));
  } catch (err) { next(err); }
}
export async function getHostelRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getHostelRoom(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHostelRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createHostelRoom(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHostelRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateHostelRoom(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHostelRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteHostelRoom(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Hostel Allocation ═══════════════════════════════════

export async function listHostelAllocations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, status } = req.query as any;
    res.json(await service.listHostelAllocations(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getHostelAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getHostelAllocation(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHostelAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createHostelAllocation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHostelAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateHostelAllocation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHostelAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteHostelAllocation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Hostel Visitor Log ══════════════════════════════════

export async function listHostelVisitorLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId } = req.query as any;
    res.json(await service.listHostelVisitorLogs(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, req.authScope));
  } catch (err) { next(err); }
}
export async function getHostelVisitorLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getHostelVisitorLog(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHostelVisitorLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createHostelVisitorLog(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHostelVisitorLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateHostelVisitorLog(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHostelVisitorLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteHostelVisitorLog(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Mess Menu ═══════════════════════════════════════════

export async function listMessMenus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, day } = req.query as any;
    res.json(await service.listMessMenus(req.collegeId!, Number(page) || 1, Number(limit) || 20, day, req.authScope));
  } catch (err) { next(err); }
}
export async function getMessMenu(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getMessMenu(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMessMenu(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMessMenu(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMessMenu(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateMessMenu(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMessMenu(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteMessMenu(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Mess Feedback ═══════════════════════════════════════

export async function listMessFeedbacks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, mealType } = req.query as any;
    res.json(await service.listMessFeedbacks(req.collegeId!, Number(page) || 1, Number(limit) || 20, mealType, req.authScope));
  } catch (err) { next(err); }
}
export async function getMessFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getMessFeedback(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMessFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMessFeedback(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMessFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateMessFeedback(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMessFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteMessFeedback(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Transport Route ═════════════════════════════════════

export async function listTransportRoutes(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listTransportRoutes(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function getTransportRoute(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getTransportRoute(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createTransportRoute(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createTransportRoute(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateTransportRoute(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateTransportRoute(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteTransportRoute(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteTransportRoute(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Transport Allocation ════════════════════════════════

export async function listTransportAllocations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, routeId, status } = req.query as any;
    res.json(await service.listTransportAllocations(req.collegeId!, Number(page) || 1, Number(limit) || 20, routeId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getTransportAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getTransportAllocation(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createTransportAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createTransportAllocation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateTransportAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateTransportAllocation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteTransportAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteTransportAllocation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Health Record ═══════════════════════════════════════

export async function listHealthRecords(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listHealthRecords(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function getHealthRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getHealthRecord(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHealthRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createHealthRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHealthRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateHealthRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHealthRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteHealthRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Medical Visit ═══════════════════════════════════════

export async function listMedicalVisits(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listMedicalVisits(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function getMedicalVisit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getMedicalVisit(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMedicalVisit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMedicalVisit(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMedicalVisit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateMedicalVisit(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMedicalVisit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteMedicalVisit(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Counseling Session ══════════════════════════════════

export async function listCounselingSessions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, type } = req.query as any;
    res.json(await service.listCounselingSessions(req.collegeId!, Number(page) || 1, Number(limit) || 20, type, req.authScope));
  } catch (err) { next(err); }
}
export async function getCounselingSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getCounselingSession(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCounselingSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCounselingSession(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCounselingSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateCounselingSession(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteCounselingSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteCounselingSession(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Crisis Alert ════════════════════════════════════════

export async function listCrisisAlerts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listCrisisAlerts(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getCrisisAlert(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getCrisisAlert(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCrisisAlert(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCrisisAlert(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCrisisAlert(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateCrisisAlert(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteCrisisAlert(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteCrisisAlert(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Anti-Ragging Complaint ══════════════════════════════

export async function listAntiRaggingComplaints(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listAntiRaggingComplaints(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getAntiRaggingComplaint(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAntiRaggingComplaint(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAntiRaggingComplaint(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAntiRaggingComplaint(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAntiRaggingComplaint(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAntiRaggingComplaint(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAntiRaggingComplaint(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAntiRaggingComplaint(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Student Grievance ═══════════════════════════════════

export async function listStudentGrievances(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listStudentGrievances(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getStudentGrievance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStudentGrievance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createStudentGrievance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createStudentGrievance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateStudentGrievance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateStudentGrievance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteStudentGrievance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteStudentGrievance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Insurance Claim ═════════════════════════════════════

export async function listInsuranceClaims(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listInsuranceClaims(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getInsuranceClaim(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getInsuranceClaim(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createInsuranceClaim(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createInsuranceClaim(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateInsuranceClaim(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateInsuranceClaim(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteInsuranceClaim(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteInsuranceClaim(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Parent Meeting ══════════════════════════════════════

export async function listParentMeetings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listParentMeetings(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getParentMeeting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getParentMeeting(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createParentMeeting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createParentMeeting(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateParentMeeting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateParentMeeting(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteParentMeeting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteParentMeeting(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════════
// W06 WORKFLOW CONTROLLERS
// ═══════════════════════════════════════════════════════════════

// ═══ GGM WORKFLOW ════════════════════════════════════════════

export async function fileGrievanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await ggmService.fileGrievance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function triageGrievanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.triageGrievance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function resolveGrievanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.resolveGrievance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function escalateGrievanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.escalateGrievance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function feedbackGrievanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.feedbackGrievance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function closeGrievanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.closeGrievance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function reopenGrievanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.reopenGrievance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function addInternalNoteCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.addInternalNote(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function assignGrievanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.assignGrievance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function detectSystemicPatternsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.detectSystemicPatterns(req.collegeId!, who(req))); } catch (err) { next(err); }
}
export async function getGrievanceAnalyticsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    res.json(await ggmService.getGrievanceAnalytics(req.collegeId!, from || to ? { from, to } : undefined));
  } catch (err) { next(err); }
}
export async function getGrievanceSLADashboardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.getGrievanceSLADashboard(req.collegeId!)); } catch (err) { next(err); }
}
export async function listGrievanceAssignmentsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.listGrievanceAssignments(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getGrievanceAssignmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.getGrievanceAssignment(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function listSystemicPatternsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.listSystemicPatterns(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getSystemicPatternCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.getSystemicPattern(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function reviewSystemicPatternCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await ggmService.reviewSystemicPattern(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// ═══ ARC WORKFLOW ════════════════════════════════════════════

export async function fileARCComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await arcDiscService.fileARCComplaint(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function assessARCComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.assessARCComplaint(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function startARCInvestigationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.startARCInvestigation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordARCWitnessCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.recordARCWitness(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function completeARCInvestigationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.completeARCInvestigation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function scheduleARCHearingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.scheduleARCHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordARCHearingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.recordARCHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function issueARCDecisionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.issueARCDecision(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function executeARCPenaltyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.executeARCPenalty(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function fileARCAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.fileARCAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function decideARCAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.decideARCAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function fileARCFirCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.fileARCFir(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getARCComplaintHistoryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.getARCComplaintHistory(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function generateARCUGCReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await arcDiscService.generateARCUGCReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function listARCComplaintsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.listARCComplaints(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getARCComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.getARCComplaint(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// ═══ DISC WORKFLOW ═══════════════════════════════════════════

export async function fileMisconductReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await arcDiscService.fileMisconductReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function startDisciplinaryInquiryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.startDisciplinaryInquiry(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function completeDisciplinaryInquiryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.completeDisciplinaryInquiry(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function scheduleDisciplinaryHearingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.scheduleDisciplinaryHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordDisciplinaryHearingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.recordDisciplinaryHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function issueDisciplinaryDecisionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.issueDisciplinaryDecision(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function executeDisciplinaryPenaltyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.executeDisciplinaryPenalty(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function fileDisciplinaryAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.fileDisciplinaryAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function decideDisciplinaryAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.decideDisciplinaryAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getDisciplinaryHistoryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.getDisciplinaryHistory(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function getStudentDisciplinaryRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.getStudentDisciplinaryRecord(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}
export async function listMisconductReportsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.listMisconductReports(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getMisconductReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await arcDiscService.getMisconductReport(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// ═══ ICC WORKFLOW ════════════════════════════════════════════

export async function fileICCComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await iccScstGrcService.fileICCComplaint(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function assessICCComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.assessICCComplaint(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function startICCInquiryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.startICCInquiry(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function completeICCInquiryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.completeICCInquiry(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function scheduleICCHearingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.scheduleICCHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordICCHearingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.recordICCHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function issueICCRecommendationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.issueICCRecommendation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function fileICCAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.fileICCAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function decideICCAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.decideICCAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getICCTimelineCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.getICCTimeline(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function getICCDeadlineDashboardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.getICCDeadlineDashboard(req.collegeId!)); } catch (err) { next(err); }
}
export async function generateICCAnnualReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await iccScstGrcService.generateICCAnnualReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function listICCComplaintsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.listICCComplaints(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getICCComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.getICCComplaint(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function listICCAnnualReportsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.listICCAnnualReports(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getICCAnnualReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.getICCAnnualReport(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// ═══ SCST WORKFLOW ═══════════════════════════════════════════

export async function fileSCSTComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await iccScstGrcService.fileSCSTComplaint(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function investigateSCSTComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.investigateSCSTComplaint(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function decideSCSTComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.decideSCSTComplaint(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function referSCSTToPoliceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.referSCSTToPolice(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getSCSTTimelineCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.getSCSTTimeline(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function generateSCSTQuarterlyReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await iccScstGrcService.generateSCSTQuarterlyReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function listSCSTComplaintsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.listSCSTComplaints(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getSCSTComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.getSCSTComplaint(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// ═══ GRC WORKFLOW ════════════════════════════════════════════

export async function fileGRCComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await iccScstGrcService.fileGRCComplaint(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function investigateGRCComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.investigateGRCComplaint(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function scheduleGRCHearingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.scheduleGRCHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordGRCHearingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.recordGRCHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function issueGRCDecisionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.issueGRCDecision(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function appealGRCToOmbudsmanCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.appealGRCToOmbudsman(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getGRCDeadlineDashboardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.getGRCDeadlineDashboard(req.collegeId!)); } catch (err) { next(err); }
}
export async function listGRCComplaintsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.listGRCComplaints(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getGRCComplaintCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await iccScstGrcService.getGRCComplaint(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// ═══ MENTORING WORKFLOW ══════════════════════════════════════

export async function assignMentorCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await mentCounsCcdService.assignMentor(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function bulkAssignMentorsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await mentCounsCcdService.bulkAssignMentors(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordMentorSessionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await mentCounsCcdService.recordMentorSession(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function flagMentorConcernCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await mentCounsCcdService.flagMentorConcern(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function escalateConcernToCCDCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.escalateConcernToCCD(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function referToCounsellingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await mentCounsCcdService.referToCounselling(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function getMentorEngagementAnalyticsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.query as { academicYearId?: string };
    res.json(await mentCounsCcdService.getMentorEngagementAnalytics(req.collegeId!, academicYearId ? { academicYearId } : undefined));
  } catch (err) { next(err); }
}
export async function getMyMenteesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getMyMentees(req.collegeId!, req.params.mentorId as string)); } catch (err) { next(err); }
}
export async function getAtRiskMenteesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.query as { academicYearId?: string };
    res.json(await mentCounsCcdService.getAtRiskMentees(req.collegeId!, academicYearId ? { academicYearId } : undefined));
  } catch (err) { next(err); }
}
export async function listMentorAssignmentsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, mentorId, academicYearId, status } = req.query as any;
    res.json(await mentCounsCcdService.listMentorAssignments(req.collegeId!, Number(page) || 1, Number(limit) || 20, { mentorId, academicYearId, status }));
  } catch (err) { next(err); }
}
export async function getMentorAssignmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getMentorAssignment(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function updateMentorAssignmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.updateMentorAssignment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function listMentorSessionsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, mentorId, studentId, assignmentId } = req.query as any;
    res.json(await mentCounsCcdService.listMentorSessions(req.collegeId!, Number(page) || 1, Number(limit) || 20, { mentorId, studentId, assignmentId }));
  } catch (err) { next(err); }
}
export async function getMentorSessionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getMentorSession(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function listMentorConcernsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, mentorId, status, severity } = req.query as any;
    res.json(await mentCounsCcdService.listMentorConcerns(req.collegeId!, Number(page) || 1, Number(limit) || 20, { studentId, mentorId, status, severity }));
  } catch (err) { next(err); }
}
export async function getMentorConcernCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getMentorConcern(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function updateMentorConcernCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.updateMentorConcern(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// ═══ COUNSELLING WORKFLOW ════════════════════════════════════

export async function updateCounsellingReferralCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.updateCounsellingReferral(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function closeCounsellingReferralCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.closeCounsellingReferral(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getCounsellingAggregateReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    res.json(await mentCounsCcdService.getCounsellingAggregateReport(req.collegeId!, from || to ? { from, to } : undefined));
  } catch (err) { next(err); }
}
export async function listCounsellingReferralsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, status, referralSource } = req.query as any;
    res.json(await mentCounsCcdService.listCounsellingReferrals(req.collegeId!, Number(page) || 1, Number(limit) || 20, { studentId, status, referralSource }));
  } catch (err) { next(err); }
}
export async function getCounsellingReferralCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getCounsellingReferral(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function getFollowUpDashboardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getFollowUpDashboard(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ CCD WORKFLOW ════════════════════════════════════════════

export async function ingestRiskSignalCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await mentCounsCcdService.ingestRiskSignal(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function acknowledgeCCDAlertCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.acknowledgeCCDAlert(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function investigateCCDAlertCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.investigateCCDAlert(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordCCDInterventionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await mentCounsCcdService.recordCCDIntervention(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function resolveCCDAlertCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.resolveCCDAlert(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function markCCDFalsePositiveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.markCCDFalsePositive(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getStudentRiskProfileCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getStudentRiskProfile(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}
export async function getCCDDashboardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getCCDDashboard(req.collegeId!)); } catch (err) { next(err); }
}
export async function recomputeStudentScoreCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.recomputeStudentScore(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}
export async function listRiskSignalsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, source } = req.query as any;
    res.json(await mentCounsCcdService.listRiskSignals(req.collegeId!, Number(page) || 1, Number(limit) || 20, { studentId, source }));
  } catch (err) { next(err); }
}
export async function getRiskSignalCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getRiskSignal(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function listCCDAlertsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, status, priority } = req.query as any;
    res.json(await mentCounsCcdService.listCCDAlerts(req.collegeId!, Number(page) || 1, Number(limit) || 20, { studentId, status, priority }));
  } catch (err) { next(err); }
}
export async function getCCDAlertCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getCCDAlert(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function listCCDInterventionsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, alertId, studentId } = req.query as any;
    res.json(await mentCounsCcdService.listCCDInterventions(req.collegeId!, Number(page) || 1, Number(limit) || 20, { alertId, studentId }));
  } catch (err) { next(err); }
}
export async function getCCDInterventionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getCCDIntervention(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function listCCDThresholdsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.listCCDThresholds(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getCCDThresholdCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.getCCDThreshold(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCCDThresholdCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await mentCounsCcdService.createCCDThreshold(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCCDThresholdCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await mentCounsCcdService.updateCCDThreshold(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
