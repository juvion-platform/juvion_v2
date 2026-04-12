import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

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
