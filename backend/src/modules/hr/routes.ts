import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
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
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', ctrl.dashboardStats);

// Employees
router.get('/employees', ctrl.listEmployees);
router.get('/employees/:id', ctrl.getEmployee);
router.post('/employees', validate(createEmployeeSchema), ctrl.createEmployee);
router.put('/employees/:id', validate(updateEmployeeSchema), ctrl.updateEmployee);
router.delete('/employees/:id', ctrl.deleteEmployee);

// Leave Types
router.get('/leave-types', ctrl.listLeaveTypes);
router.get('/leave-types/:id', ctrl.getLeaveType);
router.post('/leave-types', validate(createLeaveTypeSchema), ctrl.createLeaveType);
router.put('/leave-types/:id', validate(updateLeaveTypeSchema), ctrl.updateLeaveType);
router.delete('/leave-types/:id', ctrl.deleteLeaveType);

// Leave Applications
router.get('/leave-applications', ctrl.listLeaveApplications);
router.get('/leave-applications/:id', ctrl.getLeaveApplication);
router.post('/leave-applications', validate(createLeaveApplicationSchema), ctrl.createLeaveApplication);
router.put('/leave-applications/:id', validate(updateLeaveApplicationSchema), ctrl.updateLeaveApplication);
router.delete('/leave-applications/:id', ctrl.deleteLeaveApplication);

// Leave Balances
router.get('/leave-balances', ctrl.listLeaveBalances);
router.post('/leave-balances', validate(createLeaveBalanceSchema), ctrl.createLeaveBalance);
router.put('/leave-balances/:id', validate(updateLeaveBalanceSchema), ctrl.updateLeaveBalance);
router.delete('/leave-balances/:id', ctrl.deleteLeaveBalance);

// Employee Attendance
router.get('/employee-attendance', ctrl.listEmployeeAttendance);
router.post('/employee-attendance', validate(createEmployeeAttendanceSchema), ctrl.createEmployeeAttendance);
router.put('/employee-attendance/:id', validate(updateEmployeeAttendanceSchema), ctrl.updateEmployeeAttendance);
router.delete('/employee-attendance/:id', ctrl.deleteEmployeeAttendance);

// Pay Structures
router.get('/pay-structures', ctrl.listPayStructures);
router.get('/pay-structures/:id', ctrl.getPayStructure);
router.post('/pay-structures', validate(createPayStructureSchema), ctrl.createPayStructure);
router.put('/pay-structures/:id', validate(updatePayStructureSchema), ctrl.updatePayStructure);
router.delete('/pay-structures/:id', ctrl.deletePayStructure);

// Payroll
router.get('/payroll', ctrl.listPayrolls);
router.get('/payroll/:id', ctrl.getPayroll);
router.post('/payroll', validate(createPayrollSchema), ctrl.createPayroll);
router.put('/payroll/:id', validate(updatePayrollSchema), ctrl.updatePayroll);
router.delete('/payroll/:id', ctrl.deletePayroll);

// Appraisals
router.get('/appraisals', ctrl.listAppraisals);
router.get('/appraisals/:id', ctrl.getAppraisal);
router.post('/appraisals', validate(createAppraisalSchema), ctrl.createAppraisal);
router.put('/appraisals/:id', validate(updateAppraisalSchema), ctrl.updateAppraisal);
router.delete('/appraisals/:id', ctrl.deleteAppraisal);

// Promotions
router.get('/promotions', ctrl.listPromotions);
router.post('/promotions', validate(createPromotionSchema), ctrl.createPromotion);
router.put('/promotions/:id', validate(updatePromotionSchema), ctrl.updatePromotion);
router.delete('/promotions/:id', ctrl.deletePromotion);

// Trainings
router.get('/trainings', ctrl.listTrainings);
router.get('/trainings/:id', ctrl.getTraining);
router.post('/trainings', validate(createTrainingSchema), ctrl.createTraining);
router.put('/trainings/:id', validate(updateTrainingSchema), ctrl.updateTraining);
router.delete('/trainings/:id', ctrl.deleteTraining);

// Training Participants
router.get('/training-participants', ctrl.listTrainingParticipants);
router.post('/training-participants', validate(createTrainingParticipantSchema), ctrl.createTrainingParticipant);
router.put('/training-participants/:id', validate(updateTrainingParticipantSchema), ctrl.updateTrainingParticipant);
router.delete('/training-participants/:id', ctrl.deleteTrainingParticipant);

// Qualifications
router.get('/qualifications', ctrl.listQualifications);
router.post('/qualifications', validate(createQualificationSchema), ctrl.createQualification);
router.put('/qualifications/:id', validate(updateQualificationSchema), ctrl.updateQualification);
router.delete('/qualifications/:id', ctrl.deleteQualification);

// Grievances
router.get('/grievances', ctrl.listGrievances);
router.get('/grievances/:id', ctrl.getGrievance);
router.post('/grievances', validate(createGrievanceSchema), ctrl.createGrievance);
router.put('/grievances/:id', validate(updateGrievanceSchema), ctrl.updateGrievance);
router.delete('/grievances/:id', ctrl.deleteGrievance);

// On Duty
router.get('/on-duty', ctrl.listOnDuty);
router.post('/on-duty', validate(createOnDutySchema), ctrl.createOnDuty);
router.put('/on-duty/:id', validate(updateOnDutySchema), ctrl.updateOnDuty);
router.delete('/on-duty/:id', ctrl.deleteOnDuty);

// Exit Processes
router.get('/exit-processes', ctrl.listExitProcesses);
router.get('/exit-processes/:id', ctrl.getExitProcess);
router.post('/exit-processes', validate(createExitProcessSchema), ctrl.createExitProcess);
router.put('/exit-processes/:id', validate(updateExitProcessSchema), ctrl.updateExitProcess);
router.delete('/exit-processes/:id', ctrl.deleteExitProcess);

// Recruitments
router.get('/recruitments', ctrl.listRecruitments);
router.get('/recruitments/:id', ctrl.getRecruitment);
router.post('/recruitments', validate(createRecruitmentSchema), ctrl.createRecruitment);
router.put('/recruitments/:id', validate(updateRecruitmentSchema), ctrl.updateRecruitment);
router.delete('/recruitments/:id', ctrl.deleteRecruitment);

// Job Applications
router.get('/job-applications', ctrl.listJobApplications);
router.get('/job-applications/:id', ctrl.getJobApplication);
router.post('/job-applications', validate(createJobApplicationSchema), ctrl.createJobApplication);
router.put('/job-applications/:id', validate(updateJobApplicationSchema), ctrl.updateJobApplication);
router.delete('/job-applications/:id', ctrl.deleteJobApplication);

// Publications
router.get('/publications', ctrl.listPublications);
router.get('/publications/:id', ctrl.getPublication);
router.post('/publications', validate(createPublicationSchema), ctrl.createPublication);
router.put('/publications/:id', validate(updatePublicationSchema), ctrl.updatePublication);
router.delete('/publications/:id', ctrl.deletePublication);

// Research Projects
router.get('/research-projects', ctrl.listResearchProjects);
router.get('/research-projects/:id', ctrl.getResearchProject);
router.post('/research-projects', validate(createResearchProjectSchema), ctrl.createResearchProject);
router.put('/research-projects/:id', validate(updateResearchProjectSchema), ctrl.updateResearchProject);
router.delete('/research-projects/:id', ctrl.deleteResearchProject);

export default router;
