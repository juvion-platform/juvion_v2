import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';
import * as fdpAppraisalService from './fdp-appraisal-service';
import * as exitService from './exit-service';
import * as disciplinaryService from './disciplinary-service';
import * as compliancePayrollService from './compliance-payroll-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Employee ════════════════════════════════════════════════

export async function listEmployees(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, departmentId, status } = req.query as any;
    res.json(await service.listEmployees(req.collegeId!, Number(page) || 1, Number(limit) || 20, departmentId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getEmployee(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getEmployee(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEmployee(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEmployee(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEmployee(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEmployee(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEmployee(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEmployee(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Leave Type ══════════════════════════════════════════════

export async function listLeaveTypes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as any;
    res.json(await service.listLeaveTypes(req.collegeId!, Number(page) || 1, Number(limit) || 20, req.authScope));
  } catch (err) { next(err); }
}
export async function getLeaveType(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getLeaveType(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLeaveType(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLeaveType(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLeaveType(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateLeaveType(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLeaveType(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteLeaveType(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Leave Application ═══════════════════════════════════════

export async function listLeaveApplications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId, status } = req.query as any;
    res.json(await service.listLeaveApplications(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getLeaveApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getLeaveApplication(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLeaveApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLeaveApplication(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLeaveApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateLeaveApplication(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLeaveApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteLeaveApplication(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Leave Balance ═══════════════════════════════════════════

export async function listLeaveBalances(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId, academicYearId } = req.query as any;
    res.json(await service.listLeaveBalances(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, academicYearId, req.authScope));
  } catch (err) { next(err); }
}
export async function createLeaveBalance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLeaveBalance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLeaveBalance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateLeaveBalance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLeaveBalance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteLeaveBalance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Employee Attendance ═════════════════════════════════════

export async function listEmployeeAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId } = req.query as any;
    res.json(await service.listEmployeeAttendance(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, req.authScope));
  } catch (err) { next(err); }
}
export async function createEmployeeAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEmployeeAttendance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEmployeeAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEmployeeAttendance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEmployeeAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEmployeeAttendance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Pay Structure ═══════════════════════════════════════════

export async function listPayStructures(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId } = req.query as any;
    res.json(await service.listPayStructures(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, req.authScope));
  } catch (err) { next(err); }
}
export async function getPayStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPayStructure(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPayStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPayStructure(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePayStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePayStructure(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePayStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePayStructure(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Payroll ═════════════════════════════════════════════════

export async function listPayrolls(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId, month, year } = req.query as any;
    res.json(await service.listPayrolls(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, Number(month) || undefined, Number(year) || undefined, req.authScope));
  } catch (err) { next(err); }
}
export async function getPayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPayroll(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPayroll(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePayroll(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePayroll(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Appraisal ═══════════════════════════════════════════════

export async function listAppraisals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId, academicYearId } = req.query as any;
    res.json(await service.listAppraisals(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, academicYearId, req.authScope));
  } catch (err) { next(err); }
}
export async function getAppraisal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAppraisal(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAppraisal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAppraisal(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAppraisal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAppraisal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAppraisal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAppraisal(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Promotion ═══════════════════════════════════════════════

export async function listPromotions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId } = req.query as any;
    res.json(await service.listPromotions(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, req.authScope));
  } catch (err) { next(err); }
}
export async function createPromotion(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPromotion(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePromotion(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePromotion(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePromotion(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePromotion(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Training ════════════════════════════════════════════════

export async function listTrainings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listTrainings(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getTraining(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getTraining(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createTraining(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createTraining(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateTraining(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateTraining(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteTraining(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteTraining(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Training Participant ════════════════════════════════════

export async function listTrainingParticipants(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, trainingId } = req.query as any;
    res.json(await service.listTrainingParticipants(req.collegeId!, Number(page) || 1, Number(limit) || 20, trainingId, req.authScope));
  } catch (err) { next(err); }
}
export async function createTrainingParticipant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createTrainingParticipant(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateTrainingParticipant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateTrainingParticipant(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteTrainingParticipant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteTrainingParticipant(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Qualification ═══════════════════════════════════════════

export async function listQualifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, personId } = req.query as any;
    res.json(await service.listQualifications(req.collegeId!, Number(page) || 1, Number(limit) || 20, personId, req.authScope));
  } catch (err) { next(err); }
}
export async function createQualification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createQualification(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateQualification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateQualification(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteQualification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteQualification(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Grievance ═══════════════════════════════════════════════

export async function listGrievances(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listGrievances(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getGrievance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getGrievance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createGrievance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createGrievance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateGrievance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateGrievance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteGrievance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteGrievance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ On Duty ═════════════════════════════════════════════════

export async function listOnDuty(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId } = req.query as any;
    res.json(await service.listOnDuty(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, req.authScope));
  } catch (err) { next(err); }
}
export async function createOnDuty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createOnDuty(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateOnDuty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateOnDuty(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteOnDuty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteOnDuty(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Exit Process ════════════════════════════════════════════

export async function listExitProcesses(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId } = req.query as any;
    res.json(await service.listExitProcesses(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, req.authScope));
  } catch (err) { next(err); }
}
export async function getExitProcess(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getExitProcess(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createExitProcess(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createExitProcess(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateExitProcess(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateExitProcess(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteExitProcess(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteExitProcess(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Recruitment ═════════════════════════════════════════════

export async function listRecruitments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listRecruitments(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getRecruitment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getRecruitment(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createRecruitment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createRecruitment(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRecruitment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateRecruitment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRecruitment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteRecruitment(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Job Application ═════════════════════════════════════════

export async function listJobApplications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, recruitmentId, status } = req.query as any;
    res.json(await service.listJobApplications(req.collegeId!, Number(page) || 1, Number(limit) || 20, recruitmentId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getJobApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getJobApplication(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createJobApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createJobApplication(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateJobApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateJobApplication(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteJobApplication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteJobApplication(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Publication ═════════════════════════════════════════════

export async function listPublications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, facultyId } = req.query as any;
    res.json(await service.listPublications(req.collegeId!, Number(page) || 1, Number(limit) || 20, facultyId, req.authScope));
  } catch (err) { next(err); }
}
export async function getPublication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPublication(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPublication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPublication(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePublication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePublication(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePublication(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePublication(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Research Project ════════════════════════════════════════

export async function listResearchProjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, principalInvestigatorId } = req.query as any;
    res.json(await service.listResearchProjects(req.collegeId!, Number(page) || 1, Number(limit) || 20, principalInvestigatorId, req.authScope));
  } catch (err) { next(err); }
}
export async function getResearchProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getResearchProject(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createResearchProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createResearchProject(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateResearchProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateResearchProject(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteResearchProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteResearchProject(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════
// W05 Phase 1 — Leave & Attendance Workflow Controllers
// ═══════════════════════════════════════════════════════════

// ─── Leave Workflow ─────────────────────────────────────────

export async function submitLeaveRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.submitLeaveRequest(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function autoApproveCasualLeave(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.autoApproveCasualLeave(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function checkExamClash(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { fromDate, toDate } = req.query as any;
    res.json(await service.checkExamClash(req.collegeId!, req.params.employeeId as string, fromDate, toDate));
  } catch (err) { next(err); }
}

export async function routeLeaveForApproval(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { level, approverId } = req.body;
    res.json(await service.routeLeaveForApproval(req.collegeId!, req.params.id as string, level, approverId, who(req)));
  } catch (err) { next(err); }
}

export async function approveLeaveRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { approverId, remarks } = req.body;
    res.json(await service.approveLeaveRequest(req.collegeId!, req.params.id as string, approverId, remarks || '', who(req)));
  } catch (err) { next(err); }
}

export async function rejectLeaveRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { approverId, remarks } = req.body;
    res.json(await service.rejectLeaveRequest(req.collegeId!, req.params.id as string, approverId, remarks || '', who(req)));
  } catch (err) { next(err); }
}

export async function withdrawLeaveRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.withdrawLeaveRequest(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function processCompensatoryOff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.processCompensatoryOff(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function annualLeaveReset(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId, newAcademicYearId } = req.body;
    res.json(await service.annualLeaveReset(req.collegeId!, academicYearId, newAcademicYearId, who(req)));
  } catch (err) { next(err); }
}

export async function triggerFacultySubstitution(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.triggerFacultySubstitution(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function initializeLeaveBalance(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { employeeId, academicYearId, joiningDate } = req.body;
    res.status(201).json(await service.initializeLeaveBalance(req.collegeId!, employeeId, academicYearId, new Date(joiningDate), who(req)));
  } catch (err) { next(err); }
}

// ─── Attendance Workflow ────────────────────────────────────

export async function recordBiometricAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.recordBiometricAttendance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function detectAttendanceAnomalies(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.body;
    res.json(await service.detectAttendanceAnomalies(req.collegeId!, month, year, who(req)));
  } catch (err) { next(err); }
}

export async function submitODRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.submitODRequest(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function approveODRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { approverId } = req.body;
    res.json(await service.approveODRequest(req.collegeId!, req.params.id as string, approverId, who(req)));
  } catch (err) { next(err); }
}

export async function reconcileAttendanceLeave(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.body;
    res.json(await service.reconcileAttendanceLeave(req.collegeId!, month, year, who(req)));
  } catch (err) { next(err); }
}

export async function lockMonthlyAttendance(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.body;
    res.json(await service.lockMonthlyAttendance(req.collegeId!, month, year, who(req)));
  } catch (err) { next(err); }
}

export async function submitAttendanceCorrection(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.submitAttendanceCorrection(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function approveAttendanceCorrection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { approverId } = req.body;
    res.json(await service.approveAttendanceCorrection(req.collegeId!, req.params.id as string, approverId, who(req)));
  } catch (err) { next(err); }
}

// ═══ Attendance Anomaly CRUD ════════════════════════════════

export async function listAttendanceAnomalies(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId, month, year } = req.query as any;
    res.json(await service.listAttendanceAnomalies(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, Number(month) || undefined, Number(year) || undefined, req.authScope));
  } catch (err) { next(err); }
}
export async function getAttendanceAnomaly(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAttendanceAnomaly(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAttendanceAnomaly(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAttendanceAnomaly(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAttendanceAnomaly(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAttendanceAnomaly(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAttendanceAnomaly(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAttendanceAnomaly(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Attendance Monthly Summary CRUD ════════════════════════

export async function listAttendanceMonthlySummaries(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, employeeId, month, year } = req.query as any;
    res.json(await service.listAttendanceMonthlySummaries(req.collegeId!, Number(page) || 1, Number(limit) || 20, employeeId, Number(month) || undefined, Number(year) || undefined, req.authScope));
  } catch (err) { next(err); }
}
export async function getAttendanceMonthlySummary(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAttendanceMonthlySummary(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAttendanceMonthlySummary(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAttendanceMonthlySummary(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAttendanceMonthlySummary(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAttendanceMonthlySummary(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAttendanceMonthlySummary(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAttendanceMonthlySummary(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 3 — FDP Tracking & Appraisal Controllers
// ═══════════════════════════════════════════════════════════════════

// ─── FDP Workflow ─────────────────────────────────────────────────

export async function submitFDPCertificate(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await fdpAppraisalService.submitFDPCertificate(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function ocrExtractFDP(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.ocrExtractFDP(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function verifyFDPCertificate(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.verifyFDPCertificate(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function computeFDPComplianceGap(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { facultyId, academicYearId } = req.body;
    res.json(await fdpAppraisalService.computeFDPComplianceGap(req.collegeId!, facultyId, academicYearId, who(req)));
  } catch (err) { next(err); }
}
export async function nudgeFDPShortfall(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.body;
    res.json(await fdpAppraisalService.nudgeFDPShortfall(req.collegeId!, academicYearId));
  } catch (err) { next(err); }
}
export async function reportFDPToCompliance(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.body;
    res.json(await fdpAppraisalService.reportFDPToCompliance(req.collegeId!, academicYearId));
  } catch (err) { next(err); }
}

// ─── Appraisal Cycle Workflow ─────────────────────────────────────

export async function configureAppraisalCycle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await fdpAppraisalService.configureAppraisalCycle(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function initiateAppraisalCycle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.initiateAppraisalCycle(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function finalizeAppraisalRatings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.finalizeAppraisalRatings(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Appraisal Workflow ───────────────────────────────────────────

export async function submitSelfAssessment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.submitSelfAssessment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function aggregateAppraisalData(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { appraisalType } = req.body;
    if (appraisalType === 'staff') {
      res.json(await fdpAppraisalService.aggregateStaffAppraisalData(req.collegeId!, req.params.id as string, who(req)));
    } else {
      res.json(await fdpAppraisalService.aggregateFacultyAppraisalData(req.collegeId!, req.params.id as string, who(req)));
    }
  } catch (err) { next(err); }
}
export async function submitReviewerAssessment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.submitReviewerAssessment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function moderateAppraisalRatings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.moderateAppraisalRatings(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function handleRatingDispute(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.handleRatingDispute(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function resolveRatingDispute(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.resolveRatingDispute(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function generatePromotionPIPRecommendations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { cycleId } = req.body;
    res.json(await fdpAppraisalService.generatePromotionPIPRecommendations(req.collegeId!, cycleId, who(req)));
  } catch (err) { next(err); }
}

// ─── FDP Record CRUD ──────────────────────────────────────────────

export async function listFDPRecords(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, facultyId, verificationStatus } = req.query as any;
    res.json(await fdpAppraisalService.listFDPRecords(req.collegeId!, Number(page) || 1, Number(limit) || 20, facultyId, verificationStatus));
  } catch (err) { next(err); }
}
export async function getFDPRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.getFDPRecord(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createFDPRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await fdpAppraisalService.createFDPRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFDPRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.updateFDPRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFDPRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.deleteFDPRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── FDP Compliance Summary CRUD ──────────────────────────────────

export async function listFDPComplianceSummaries(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, facultyId, academicYearId } = req.query as any;
    res.json(await fdpAppraisalService.listFDPComplianceSummaries(req.collegeId!, Number(page) || 1, Number(limit) || 20, facultyId, academicYearId));
  } catch (err) { next(err); }
}
export async function getFDPComplianceSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.getFDPComplianceSummary(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createFDPComplianceSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await fdpAppraisalService.createFDPComplianceSummary(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFDPComplianceSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.updateFDPComplianceSummary(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFDPComplianceSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.deleteFDPComplianceSummary(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Appraisal Cycle CRUD ─────────────────────────────────────────

export async function listAppraisalCycles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await fdpAppraisalService.listAppraisalCycles(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getAppraisalCycle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.getAppraisalCycle(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAppraisalCycleRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await fdpAppraisalService.createAppraisalCycle(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAppraisalCycle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.updateAppraisalCycle(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAppraisalCycle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await fdpAppraisalService.deleteAppraisalCycle(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 4 — Exit & Separation Controllers
// ═══════════════════════════════════════════════════════════════════

// ─── Separation Initiation ───────────────────────────────────────
export async function initiateResignation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.initiateResignation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function processRetirement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.processRetirement(req.collegeId!, req.params.employeeId as string, who(req))); } catch (err) { next(err); }
}
export async function processTermination(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.processTermination(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function processDeathNotification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.processDeathNotification(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// ─── Resignation Approval ────────────────────────────────────────
export async function acceptResignation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.acceptResignation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function rejectResignation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.rejectResignation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function waiveNoticePeriod(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.waiveNoticePeriod(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// ─── Clearance ───────────────────────────────────────────────────
export async function initiateClearance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.initiateClearance(req.collegeId!, req.params.separationId as string, who(req))); } catch (err) { next(err); }
}
export async function clearItemCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.clearItem(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getClearanceStatusCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getClearanceStatus(req.collegeId!, req.params.separationId as string)); } catch (err) { next(err); }
}

// ─── Handover ────────────────────────────────────────────────────
export async function createHandoverRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.createHandoverRecord(req.collegeId!, req.params.separationId as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHandoverItemCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.updateHandoverItem(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function verifyHandoverCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.verifyHandover(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Settlement ──────────────────────────────────────────────────
export async function computeFinalSettlementCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.computeFinalSettlement(req.collegeId!, req.params.separationId as string, who(req))); } catch (err) { next(err); }
}
export async function approveSettlement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.approveSettlement(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function processSettlement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.processSettlement(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Completion ──────────────────────────────────────────────────
export async function issueRelievingOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.issueRelievingOrder(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function archiveEmployeeRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.archiveEmployeeRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function triggerReplacementRequisition(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.triggerReplacementRequisition(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Special Cases ───────────────────────────────────────────────
export async function detectUpcomingRetirements(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const withinMonths = Number(req.query.withinMonths) || 3;
    res.json(await exitService.detectUpcomingRetirements(req.collegeId!, withinMonths));
  } catch (err) { next(err); }
}
export async function detectExpiringContracts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const withinMonths = Number(req.query.withinMonths) || 3;
    res.json(await exitService.detectExpiringContracts(req.collegeId!, withinMonths));
  } catch (err) { next(err); }
}
export async function processContractRenewal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.processContractRenewal(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// ─── Separation CRUD ─────────────────────────────────────────────
export async function listSeparationRequests(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await exitService.listSeparationRequests(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getSeparationRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getSeparationRequest(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSeparationRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.createSeparationRequest(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSeparationRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.updateSeparationRequest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSeparationRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.deleteSeparationRequest(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Exit Clearance CRUD ─────────────────────────────────────────
export async function listExitClearances(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as any;
    res.json(await exitService.listExitClearances(req.collegeId!, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}
export async function getExitClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getExitClearance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createExitClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.createExitClearance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateExitClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.updateExitClearance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteExitClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.deleteExitClearance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Handover Record CRUD ────────────────────────────────────────
export async function listHandoverRecords(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as any;
    res.json(await exitService.listHandoverRecords(req.collegeId!, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}
export async function getHandoverRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getHandoverRecord(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHandoverRecordCRUDCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.createHandoverRecordCRUD(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHandoverRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.updateHandoverRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHandoverRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.deleteHandoverRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Final Settlement CRUD ───────────────────────────────────────
export async function listFinalSettlements(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as any;
    res.json(await exitService.listFinalSettlements(req.collegeId!, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}
export async function getFinalSettlement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.getFinalSettlement(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createFinalSettlementCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await exitService.createFinalSettlement(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFinalSettlement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.updateFinalSettlement(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFinalSettlement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await exitService.deleteFinalSettlement(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 5 — Disciplinary Proceedings Controllers
// ═══════════════════════════════════════════════════════════════════

export async function initiateCaseInternal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await disciplinaryService.initiateCaseInternal(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function receiveDisciplinaryReferral(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await disciplinaryService.receiveDisciplinaryReferral(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateInvestigation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.updateInvestigation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function closeInsufficientEvidence(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.closeInsufficientEvidence(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function issueShowCause(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.issueShowCause(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordResponse(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.recordResponse(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordHearing(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.recordHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function decideOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.decideOutcome(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function implementOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.implementOutcome(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function closeCaseAfterImplementation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.closeCaseAfterImplementation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function submitAppeal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.submitAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function resolveAppeal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.resolveAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function detectOverdueCases(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.detectOverdueCases(req.collegeId!)); } catch (err) { next(err); }
}

// Disciplinary CRUD
export async function listDisciplinaryCases(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await disciplinaryService.listDisciplinaryCases(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getDisciplinaryCase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.getDisciplinaryCase(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createDisciplinaryCaseCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await disciplinaryService.createDisciplinaryCase(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateDisciplinaryCase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.updateDisciplinaryCase(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteDisciplinaryCase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.deleteDisciplinaryCase(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function listDisciplinaryOutcomes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as any;
    res.json(await disciplinaryService.listDisciplinaryOutcomes(req.collegeId!, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}
export async function getDisciplinaryOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.getDisciplinaryOutcome(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createDisciplinaryOutcomeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await disciplinaryService.createDisciplinaryOutcome(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateDisciplinaryOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.updateDisciplinaryOutcome(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteDisciplinaryOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await disciplinaryService.deleteDisciplinaryOutcome(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 6 — Compliance Reporting & Payroll Extract Controllers
// ═══════════════════════════════════════════════════════════════════

export async function computeStudentFacultyRatio(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await compliancePayrollService.computeStudentFacultyRatio(req.collegeId!)); } catch (err) { next(err); }
}
export async function generateFDPComplianceReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.body;
    res.json(await compliancePayrollService.generateFDPComplianceReport(req.collegeId!, academicYearId));
  } catch (err) { next(err); }
}
export async function generatePayrollExtract(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.body;
    res.status(201).json(await compliancePayrollService.generatePayrollExtract(req.collegeId!, month, year, who(req)));
  } catch (err) { next(err); }
}
export async function reviewPayrollExtract(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await compliancePayrollService.reviewPayrollExtract(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function releasePayrollExtract(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await compliancePayrollService.releasePayrollExtract(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function generateAttendanceComplianceReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.body;
    res.json(await compliancePayrollService.generateAttendanceComplianceReport(req.collegeId!, month, year));
  } catch (err) { next(err); }
}

// Payroll Data Extract CRUD
export async function listPayrollDataExtracts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await compliancePayrollService.listPayrollDataExtracts(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getPayrollDataExtract(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await compliancePayrollService.getPayrollDataExtract(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPayrollDataExtractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await compliancePayrollService.createPayrollDataExtract(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePayrollDataExtract(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await compliancePayrollService.updatePayrollDataExtract(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePayrollDataExtract(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await compliancePayrollService.deletePayrollDataExtract(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
