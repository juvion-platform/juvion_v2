import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

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
