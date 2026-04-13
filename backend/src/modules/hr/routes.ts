import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createEmployeeSchema, updateEmployeeSchema,
  createLeaveTypeSchema, updateLeaveTypeSchema,
  createLeaveApplicationSchema, updateLeaveApplicationSchema,
  createLeaveBalanceSchema, updateLeaveBalanceSchema,
  createEmployeeAttendanceSchema, updateEmployeeAttendanceSchema,
  createPayStructureSchema, updatePayStructureSchema,
  createPayrollSchema, updatePayrollSchema,
  createAppraisalSchema, updateAppraisalSchema,
  createPromotionSchema, updatePromotionSchema,
  createTrainingSchema, updateTrainingSchema,
  createTrainingParticipantSchema, updateTrainingParticipantSchema,
  createQualificationSchema, updateQualificationSchema,
  createGrievanceSchema, updateGrievanceSchema,
  createOnDutySchema, updateOnDutySchema,
  createExitProcessSchema, updateExitProcessSchema,
  createRecruitmentSchema, updateRecruitmentSchema,
  createJobApplicationSchema, updateJobApplicationSchema,
  createPublicationSchema, updatePublicationSchema,
  createResearchProjectSchema, updateResearchProjectSchema,
  submitLeaveSchema, compOffSchema, annualResetSchema, initBalanceSchema,
  biometricSchema, odSchema, correctionSchema,
  createAttendanceAnomalySchema, updateAttendanceAnomalySchema,
  createAttendanceMonthlySummarySchema, updateAttendanceMonthlySummarySchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('hr', 'read'), ctrl.dashboardStats);

// Employees
router.get('/employees', authorize('hr', 'read'), ctrl.listEmployees);
router.get('/employees/:id', authorize('hr', 'read'), ctrl.getEmployee);
router.post('/employees', authorize('hr', 'create'), validate(createEmployeeSchema), ctrl.createEmployee);
router.put('/employees/:id', authorize('hr', 'update'), validate(updateEmployeeSchema), ctrl.updateEmployee);
router.delete('/employees/:id', authorize('hr', 'delete'), ctrl.deleteEmployee);

// Leave Types
router.get('/leave-types', authorize('hr', 'read'), ctrl.listLeaveTypes);
router.get('/leave-types/:id', authorize('hr', 'read'), ctrl.getLeaveType);
router.post('/leave-types', authorize('hr', 'create'), validate(createLeaveTypeSchema), ctrl.createLeaveType);
router.put('/leave-types/:id', authorize('hr', 'update'), validate(updateLeaveTypeSchema), ctrl.updateLeaveType);
router.delete('/leave-types/:id', authorize('hr', 'delete'), ctrl.deleteLeaveType);

// Leave Workflow Routes (before CRUD :id routes)
router.post('/leave-applications/submit', authorize('hr', 'create'), validate(submitLeaveSchema), ctrl.submitLeaveRequest);
router.post('/leave-applications/:id/auto-approve', authorize('hr', 'update'), ctrl.autoApproveCasualLeave);
router.post('/leave-applications/:id/approve', authorize('hr', 'update'), ctrl.approveLeaveRequest);
router.post('/leave-applications/:id/reject', authorize('hr', 'update'), ctrl.rejectLeaveRequest);
router.post('/leave-applications/:id/withdraw', authorize('hr', 'update'), ctrl.withdrawLeaveRequest);
router.post('/leave-applications/:id/route', authorize('hr', 'update'), ctrl.routeLeaveForApproval);
router.get('/leave-applications/:employeeId/exam-clash', authorize('hr', 'read'), ctrl.checkExamClash);
router.post('/leave-applications/:id/trigger-substitution', authorize('hr', 'update'), ctrl.triggerFacultySubstitution);
router.post('/leave/compensatory-off', authorize('hr', 'create'), validate(compOffSchema), ctrl.processCompensatoryOff);
router.post('/leave/annual-reset', authorize('hr', 'update'), validate(annualResetSchema), ctrl.annualLeaveReset);
router.post('/leave/initialize-balance', authorize('hr', 'create'), validate(initBalanceSchema), ctrl.initializeLeaveBalance);

// Leave Applications CRUD
router.get('/leave-applications', authorize('hr', 'read'), ctrl.listLeaveApplications);
router.get('/leave-applications/:id', authorize('hr', 'read'), ctrl.getLeaveApplication);
router.post('/leave-applications', authorize('hr', 'create'), validate(createLeaveApplicationSchema), ctrl.createLeaveApplication);
router.put('/leave-applications/:id', authorize('hr', 'update'), validate(updateLeaveApplicationSchema), ctrl.updateLeaveApplication);
router.delete('/leave-applications/:id', authorize('hr', 'delete'), ctrl.deleteLeaveApplication);

// Leave Balances
router.get('/leave-balances', authorize('hr', 'read'), ctrl.listLeaveBalances);
router.post('/leave-balances', authorize('hr', 'create'), validate(createLeaveBalanceSchema), ctrl.createLeaveBalance);
router.put('/leave-balances/:id', authorize('hr', 'update'), validate(updateLeaveBalanceSchema), ctrl.updateLeaveBalance);
router.delete('/leave-balances/:id', authorize('hr', 'delete'), ctrl.deleteLeaveBalance);

// Attendance Workflow Routes (before CRUD :id routes)
router.post('/attendance/biometric', authorize('hr', 'create'), validate(biometricSchema), ctrl.recordBiometricAttendance);
router.post('/attendance/detect-anomalies', authorize('hr', 'update'), ctrl.detectAttendanceAnomalies);
router.post('/attendance/reconcile', authorize('hr', 'update'), ctrl.reconcileAttendanceLeave);
router.post('/attendance/lock-monthly', authorize('hr', 'update'), ctrl.lockMonthlyAttendance);
router.post('/attendance/:id/correction', authorize('hr', 'update'), validate(correctionSchema), ctrl.submitAttendanceCorrection);
router.post('/attendance/:id/correction/approve', authorize('hr', 'update'), ctrl.approveAttendanceCorrection);

// OD Workflow Routes
router.post('/on-duties/submit', authorize('hr', 'create'), validate(odSchema), ctrl.submitODRequest);
router.post('/on-duties/:id/approve', authorize('hr', 'update'), ctrl.approveODRequest);

// Employee Attendance CRUD
router.get('/employee-attendance', authorize('hr', 'read'), ctrl.listEmployeeAttendance);
router.post('/employee-attendance', authorize('hr', 'create'), validate(createEmployeeAttendanceSchema), ctrl.createEmployeeAttendance);
router.put('/employee-attendance/:id', authorize('hr', 'update'), validate(updateEmployeeAttendanceSchema), ctrl.updateEmployeeAttendance);
router.delete('/employee-attendance/:id', authorize('hr', 'delete'), ctrl.deleteEmployeeAttendance);

// Pay Structures
router.get('/pay-structures', authorize('hr', 'read'), ctrl.listPayStructures);
router.get('/pay-structures/:id', authorize('hr', 'read'), ctrl.getPayStructure);
router.post('/pay-structures', authorize('hr', 'create'), validate(createPayStructureSchema), ctrl.createPayStructure);
router.put('/pay-structures/:id', authorize('hr', 'update'), validate(updatePayStructureSchema), ctrl.updatePayStructure);
router.delete('/pay-structures/:id', authorize('hr', 'delete'), ctrl.deletePayStructure);

// Payroll
router.get('/payroll', authorize('hr', 'read'), ctrl.listPayrolls);
router.get('/payroll/:id', authorize('hr', 'read'), ctrl.getPayroll);
router.post('/payroll', authorize('hr', 'create'), validate(createPayrollSchema), ctrl.createPayroll);
router.put('/payroll/:id', authorize('hr', 'update'), validate(updatePayrollSchema), ctrl.updatePayroll);
router.delete('/payroll/:id', authorize('hr', 'delete'), ctrl.deletePayroll);

// Appraisals
router.get('/appraisals', authorize('hr', 'read'), ctrl.listAppraisals);
router.get('/appraisals/:id', authorize('hr', 'read'), ctrl.getAppraisal);
router.post('/appraisals', authorize('hr', 'create'), validate(createAppraisalSchema), ctrl.createAppraisal);
router.put('/appraisals/:id', authorize('hr', 'update'), validate(updateAppraisalSchema), ctrl.updateAppraisal);
router.delete('/appraisals/:id', authorize('hr', 'delete'), ctrl.deleteAppraisal);

// Promotions
router.get('/promotions', authorize('hr', 'read'), ctrl.listPromotions);
router.post('/promotions', authorize('hr', 'create'), validate(createPromotionSchema), ctrl.createPromotion);
router.put('/promotions/:id', authorize('hr', 'update'), validate(updatePromotionSchema), ctrl.updatePromotion);
router.delete('/promotions/:id', authorize('hr', 'delete'), ctrl.deletePromotion);

// Trainings
router.get('/trainings', authorize('hr', 'read'), ctrl.listTrainings);
router.get('/trainings/:id', authorize('hr', 'read'), ctrl.getTraining);
router.post('/trainings', authorize('hr', 'create'), validate(createTrainingSchema), ctrl.createTraining);
router.put('/trainings/:id', authorize('hr', 'update'), validate(updateTrainingSchema), ctrl.updateTraining);
router.delete('/trainings/:id', authorize('hr', 'delete'), ctrl.deleteTraining);

// Training Participants
router.get('/training-participants', authorize('hr', 'read'), ctrl.listTrainingParticipants);
router.post('/training-participants', authorize('hr', 'create'), validate(createTrainingParticipantSchema), ctrl.createTrainingParticipant);
router.put('/training-participants/:id', authorize('hr', 'update'), validate(updateTrainingParticipantSchema), ctrl.updateTrainingParticipant);
router.delete('/training-participants/:id', authorize('hr', 'delete'), ctrl.deleteTrainingParticipant);

// Qualifications
router.get('/qualifications', authorize('hr', 'read'), ctrl.listQualifications);
router.post('/qualifications', authorize('hr', 'create'), validate(createQualificationSchema), ctrl.createQualification);
router.put('/qualifications/:id', authorize('hr', 'update'), validate(updateQualificationSchema), ctrl.updateQualification);
router.delete('/qualifications/:id', authorize('hr', 'delete'), ctrl.deleteQualification);

// Grievances
router.get('/grievances', authorize('hr', 'read'), ctrl.listGrievances);
router.get('/grievances/:id', authorize('hr', 'read'), ctrl.getGrievance);
router.post('/grievances', authorize('hr', 'create'), validate(createGrievanceSchema), ctrl.createGrievance);
router.put('/grievances/:id', authorize('hr', 'update'), validate(updateGrievanceSchema), ctrl.updateGrievance);
router.delete('/grievances/:id', authorize('hr', 'delete'), ctrl.deleteGrievance);

// On Duty
router.get('/on-duty', authorize('hr', 'read'), ctrl.listOnDuty);
router.post('/on-duty', authorize('hr', 'create'), validate(createOnDutySchema), ctrl.createOnDuty);
router.put('/on-duty/:id', authorize('hr', 'update'), validate(updateOnDutySchema), ctrl.updateOnDuty);
router.delete('/on-duty/:id', authorize('hr', 'delete'), ctrl.deleteOnDuty);

// Exit Processes
router.get('/exit-processes', authorize('hr', 'read'), ctrl.listExitProcesses);
router.get('/exit-processes/:id', authorize('hr', 'read'), ctrl.getExitProcess);
router.post('/exit-processes', authorize('hr', 'create'), validate(createExitProcessSchema), ctrl.createExitProcess);
router.put('/exit-processes/:id', authorize('hr', 'update'), validate(updateExitProcessSchema), ctrl.updateExitProcess);
router.delete('/exit-processes/:id', authorize('hr', 'delete'), ctrl.deleteExitProcess);

// Recruitments
router.get('/recruitments', authorize('hr', 'read'), ctrl.listRecruitments);
router.get('/recruitments/:id', authorize('hr', 'read'), ctrl.getRecruitment);
router.post('/recruitments', authorize('hr', 'create'), validate(createRecruitmentSchema), ctrl.createRecruitment);
router.put('/recruitments/:id', authorize('hr', 'update'), validate(updateRecruitmentSchema), ctrl.updateRecruitment);
router.delete('/recruitments/:id', authorize('hr', 'delete'), ctrl.deleteRecruitment);

// Job Applications
router.get('/job-applications', authorize('hr', 'read'), ctrl.listJobApplications);
router.get('/job-applications/:id', authorize('hr', 'read'), ctrl.getJobApplication);
router.post('/job-applications', authorize('hr', 'create'), validate(createJobApplicationSchema), ctrl.createJobApplication);
router.put('/job-applications/:id', authorize('hr', 'update'), validate(updateJobApplicationSchema), ctrl.updateJobApplication);
router.delete('/job-applications/:id', authorize('hr', 'delete'), ctrl.deleteJobApplication);

// Publications
router.get('/publications', authorize('hr', 'read'), ctrl.listPublications);
router.get('/publications/:id', authorize('hr', 'read'), ctrl.getPublication);
router.post('/publications', authorize('hr', 'create'), validate(createPublicationSchema), ctrl.createPublication);
router.put('/publications/:id', authorize('hr', 'update'), validate(updatePublicationSchema), ctrl.updatePublication);
router.delete('/publications/:id', authorize('hr', 'delete'), ctrl.deletePublication);

// Research Projects
router.get('/research-projects', authorize('hr', 'read'), ctrl.listResearchProjects);
router.get('/research-projects/:id', authorize('hr', 'read'), ctrl.getResearchProject);
router.post('/research-projects', authorize('hr', 'create'), validate(createResearchProjectSchema), ctrl.createResearchProject);
router.put('/research-projects/:id', authorize('hr', 'update'), validate(updateResearchProjectSchema), ctrl.updateResearchProject);
router.delete('/research-projects/:id', authorize('hr', 'delete'), ctrl.deleteResearchProject);

// Attendance Anomalies
router.get('/attendance-anomalies', authorize('hr', 'read'), ctrl.listAttendanceAnomalies);
router.get('/attendance-anomalies/:id', authorize('hr', 'read'), ctrl.getAttendanceAnomaly);
router.post('/attendance-anomalies', authorize('hr', 'create'), validate(createAttendanceAnomalySchema), ctrl.createAttendanceAnomaly);
router.put('/attendance-anomalies/:id', authorize('hr', 'update'), validate(updateAttendanceAnomalySchema), ctrl.updateAttendanceAnomaly);
router.delete('/attendance-anomalies/:id', authorize('hr', 'delete'), ctrl.deleteAttendanceAnomaly);

// Attendance Monthly Summaries
router.get('/attendance-monthly-summaries', authorize('hr', 'read'), ctrl.listAttendanceMonthlySummaries);
router.get('/attendance-monthly-summaries/:id', authorize('hr', 'read'), ctrl.getAttendanceMonthlySummary);
router.post('/attendance-monthly-summaries', authorize('hr', 'create'), validate(createAttendanceMonthlySummarySchema), ctrl.createAttendanceMonthlySummary);
router.put('/attendance-monthly-summaries/:id', authorize('hr', 'update'), validate(updateAttendanceMonthlySummarySchema), ctrl.updateAttendanceMonthlySummary);
router.delete('/attendance-monthly-summaries/:id', authorize('hr', 'delete'), ctrl.deleteAttendanceMonthlySummary);

export default router;
