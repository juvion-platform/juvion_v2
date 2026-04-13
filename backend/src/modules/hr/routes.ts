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
  submitFDPCertificateSchema, verifyFDPSchema, computeComplianceSchema,
  selfAssessmentSchema, reviewerAssessmentSchema, moderateSchema,
  disputeSchema, resolveDisputeSchema,
  createAppraisalCycleSchema, updateAppraisalCycleSchema,
  createFDPRecordSchema, updateFDPRecordSchema,
  createFDPComplianceSummarySchema, updateFDPComplianceSummarySchema,
  initiateResignationSchema, processTerminationSchema, processDeathNotificationSchema,
  rejectResignationSchema, waiveNoticeSchema, clearItemSchema,
  createHandoverSchema, updateHandoverItemSchema, contractRenewalSchema,
  createSeparationRequestSchema, updateSeparationRequestSchema,
  createExitClearanceSchema, updateExitClearanceSchema,
  createHandoverRecordSchema, updateHandoverRecordSchema,
  createFinalSettlementSchema, updateFinalSettlementSchema,
  initiateCaseInternalSchema, receiveReferralSchema, updateInvestigationSchema,
  issueShowCauseSchema, recordResponseSchema, recordHearingSchema,
  decideOutcomeSchema, implementOutcomeSchema, submitAppealSchema,
  resolveAppealSchema, closeInsufficientEvidenceSchema,
  createDisciplinaryCaseSchema, updateDisciplinaryCaseSchema,
  createDisciplinaryOutcomeSchema, updateDisciplinaryOutcomeSchema,
  generatePayrollExtractSchema, attendanceComplianceSchema,
  createPayrollDataExtractSchema, updatePayrollDataExtractSchema,
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

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 3 — FDP Tracking & Appraisal Routes
// ═══════════════════════════════════════════════════════════════════

// FDP Workflow Routes
router.post('/fdp-records/submit', authorize('hr', 'create'), validate(submitFDPCertificateSchema), ctrl.submitFDPCertificate);
router.post('/fdp-records/:id/ocr-extract', authorize('hr', 'update'), ctrl.ocrExtractFDP);
router.post('/fdp-records/:id/verify', authorize('hr', 'update'), validate(verifyFDPSchema), ctrl.verifyFDPCertificate);

// FDP Compliance Routes
router.post('/fdp-compliance/compute', authorize('hr', 'update'), validate(computeComplianceSchema), ctrl.computeFDPComplianceGap);
router.post('/fdp-compliance/nudge', authorize('hr', 'update'), ctrl.nudgeFDPShortfall);
router.post('/fdp-compliance/report', authorize('hr', 'read'), ctrl.reportFDPToCompliance);

// FDP Records CRUD
router.get('/fdp-records', authorize('hr', 'read'), ctrl.listFDPRecords);
router.get('/fdp-records/:id', authorize('hr', 'read'), ctrl.getFDPRecord);
router.post('/fdp-records', authorize('hr', 'create'), validate(createFDPRecordSchema), ctrl.createFDPRecord);
router.put('/fdp-records/:id', authorize('hr', 'update'), validate(updateFDPRecordSchema), ctrl.updateFDPRecord);
router.delete('/fdp-records/:id', authorize('hr', 'delete'), ctrl.deleteFDPRecord);

// FDP Compliance Summaries CRUD
router.get('/fdp-compliance', authorize('hr', 'read'), ctrl.listFDPComplianceSummaries);
router.get('/fdp-compliance/:id', authorize('hr', 'read'), ctrl.getFDPComplianceSummary);
router.post('/fdp-compliance-summaries', authorize('hr', 'create'), validate(createFDPComplianceSummarySchema), ctrl.createFDPComplianceSummary);
router.put('/fdp-compliance/:id', authorize('hr', 'update'), validate(updateFDPComplianceSummarySchema), ctrl.updateFDPComplianceSummary);
router.delete('/fdp-compliance/:id', authorize('hr', 'delete'), ctrl.deleteFDPComplianceSummary);

// Appraisal Cycle Workflow Routes
router.post('/appraisal-cycles/:id/initiate', authorize('hr', 'update'), ctrl.initiateAppraisalCycle);
router.post('/appraisal-cycles/:id/close', authorize('hr', 'update'), ctrl.finalizeAppraisalRatings);

// Appraisal Cycles CRUD
router.get('/appraisal-cycles', authorize('hr', 'read'), ctrl.listAppraisalCycles);
router.get('/appraisal-cycles/:id', authorize('hr', 'read'), ctrl.getAppraisalCycle);
router.post('/appraisal-cycles', authorize('hr', 'create'), validate(createAppraisalCycleSchema), ctrl.configureAppraisalCycle);
router.put('/appraisal-cycles/:id', authorize('hr', 'update'), validate(updateAppraisalCycleSchema), ctrl.updateAppraisalCycle);
router.delete('/appraisal-cycles/:id', authorize('hr', 'delete'), ctrl.deleteAppraisalCycle);

// Appraisal Workflow Routes
router.post('/appraisals/:id/self-assessment', authorize('hr', 'update'), validate(selfAssessmentSchema), ctrl.submitSelfAssessment);
router.post('/appraisals/:id/aggregate', authorize('hr', 'update'), ctrl.aggregateAppraisalData);
router.post('/appraisals/:id/reviewer-assessment', authorize('hr', 'update'), validate(reviewerAssessmentSchema), ctrl.submitReviewerAssessment);
router.post('/appraisals/:id/moderate', authorize('hr', 'update'), validate(moderateSchema), ctrl.moderateAppraisalRatings);
router.post('/appraisals/:id/dispute', authorize('hr', 'update'), validate(disputeSchema), ctrl.handleRatingDispute);
router.post('/appraisals/:id/resolve-dispute', authorize('hr', 'update'), validate(resolveDisputeSchema), ctrl.resolveRatingDispute);
router.post('/appraisals/generate-recommendations', authorize('hr', 'update'), ctrl.generatePromotionPIPRecommendations);

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 4 — Exit & Separation Routes
// ═══════════════════════════════════════════════════════════════════

// Separation Workflow Routes
router.post('/separations', authorize('hr', 'create'), validate(initiateResignationSchema), ctrl.initiateResignation);
router.post('/separations/retirement/:employeeId', authorize('hr', 'create'), ctrl.processRetirement);
router.post('/separations/termination', authorize('hr', 'create'), validate(processTerminationSchema), ctrl.processTermination);
router.post('/separations/death', authorize('hr', 'create'), validate(processDeathNotificationSchema), ctrl.processDeathNotification);
router.post('/separations/:id/accept', authorize('hr', 'update'), ctrl.acceptResignation);
router.post('/separations/:id/reject', authorize('hr', 'update'), validate(rejectResignationSchema), ctrl.rejectResignation);
router.post('/separations/:id/waive-notice', authorize('hr', 'update'), validate(waiveNoticeSchema), ctrl.waiveNoticePeriod);
router.post('/separations/:id/relieve', authorize('hr', 'update'), ctrl.issueRelievingOrder);
router.post('/separations/:id/archive', authorize('hr', 'update'), ctrl.archiveEmployeeRecord);
router.post('/separations/:id/replacement-requisition', authorize('hr', 'create'), ctrl.triggerReplacementRequisition);

// Clearance Routes
router.post('/exit-clearance/:separationId/initiate', authorize('hr', 'create'), ctrl.initiateClearance);
router.get('/exit-clearance/:separationId', authorize('hr', 'read'), ctrl.getClearanceStatusCtrl);
router.post('/exit-clearance/:id/clear-item', authorize('hr', 'update'), validate(clearItemSchema), ctrl.clearItemCtrl);

// Handover Routes
router.post('/handover/:separationId', authorize('hr', 'create'), validate(createHandoverSchema), ctrl.createHandoverRecordCtrl);
router.put('/handover/:id/item', authorize('hr', 'update'), validate(updateHandoverItemSchema), ctrl.updateHandoverItemCtrl);
router.post('/handover/:id/verify', authorize('hr', 'update'), ctrl.verifyHandoverCtrl);

// Settlement Routes
router.post('/settlements/:separationId/compute', authorize('hr', 'create'), ctrl.computeFinalSettlementCtrl);
router.post('/settlements/:id/approve', authorize('hr', 'update'), ctrl.approveSettlement);
router.post('/settlements/:id/process', authorize('hr', 'update'), ctrl.processSettlement);

// Special Case Routes
router.get('/retirement-alerts', authorize('hr', 'read'), ctrl.detectUpcomingRetirements);
router.get('/contract-expiry-alerts', authorize('hr', 'read'), ctrl.detectExpiringContracts);
router.post('/contract-renewal', authorize('hr', 'update'), validate(contractRenewalSchema), ctrl.processContractRenewal);

// Separation Requests CRUD
router.get('/separation-requests', authorize('hr', 'read'), ctrl.listSeparationRequests);
router.get('/separation-requests/:id', authorize('hr', 'read'), ctrl.getSeparationRequest);
router.post('/separation-requests', authorize('hr', 'create'), validate(createSeparationRequestSchema), ctrl.createSeparationRequestCtrl);
router.put('/separation-requests/:id', authorize('hr', 'update'), validate(updateSeparationRequestSchema), ctrl.updateSeparationRequest);
router.delete('/separation-requests/:id', authorize('hr', 'delete'), ctrl.deleteSeparationRequest);

// Exit Clearances CRUD
router.get('/exit-clearances', authorize('hr', 'read'), ctrl.listExitClearances);
router.get('/exit-clearances/:id', authorize('hr', 'read'), ctrl.getExitClearanceCtrl);
router.post('/exit-clearances', authorize('hr', 'create'), validate(createExitClearanceSchema), ctrl.createExitClearanceCtrl);
router.put('/exit-clearances/:id', authorize('hr', 'update'), validate(updateExitClearanceSchema), ctrl.updateExitClearanceCtrl);
router.delete('/exit-clearances/:id', authorize('hr', 'delete'), ctrl.deleteExitClearanceCtrl);

// Handover Records CRUD
router.get('/handover-records', authorize('hr', 'read'), ctrl.listHandoverRecords);
router.get('/handover-records/:id', authorize('hr', 'read'), ctrl.getHandoverRecordCtrl);
router.post('/handover-records', authorize('hr', 'create'), validate(createHandoverRecordSchema), ctrl.createHandoverRecordCRUDCtrl);
router.put('/handover-records/:id', authorize('hr', 'update'), validate(updateHandoverRecordSchema), ctrl.updateHandoverRecordCtrl);
router.delete('/handover-records/:id', authorize('hr', 'delete'), ctrl.deleteHandoverRecordCtrl);

// Final Settlements CRUD
router.get('/final-settlements', authorize('hr', 'read'), ctrl.listFinalSettlements);
router.get('/final-settlements/:id', authorize('hr', 'read'), ctrl.getFinalSettlement);
router.post('/final-settlements', authorize('hr', 'create'), validate(createFinalSettlementSchema), ctrl.createFinalSettlementCtrl);
router.put('/final-settlements/:id', authorize('hr', 'update'), validate(updateFinalSettlementSchema), ctrl.updateFinalSettlement);
router.delete('/final-settlements/:id', authorize('hr', 'delete'), ctrl.deleteFinalSettlement);

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 5 — Disciplinary Proceedings Routes
// ═══════════════════════════════════════════════════════════════════

// Disciplinary Workflow
router.post('/disciplinary-cases', authorize('hr', 'create'), validate(initiateCaseInternalSchema), ctrl.initiateCaseInternal);
router.post('/disciplinary-cases/from-referral', authorize('hr', 'create'), validate(receiveReferralSchema), ctrl.receiveDisciplinaryReferral);
router.get('/disciplinary-cases/overdue', authorize('hr', 'read'), ctrl.detectOverdueCases);
router.put('/disciplinary-cases/:id/investigation', authorize('hr', 'update'), validate(updateInvestigationSchema), ctrl.updateInvestigation);
router.post('/disciplinary-cases/:id/close-insufficient', authorize('hr', 'update'), validate(closeInsufficientEvidenceSchema), ctrl.closeInsufficientEvidence);
router.post('/disciplinary-cases/:id/show-cause', authorize('hr', 'update'), validate(issueShowCauseSchema), ctrl.issueShowCause);
router.post('/disciplinary-cases/:id/record-response', authorize('hr', 'update'), validate(recordResponseSchema), ctrl.recordResponse);
router.post('/disciplinary-cases/:id/hearing', authorize('hr', 'update'), validate(recordHearingSchema), ctrl.recordHearing);
router.post('/disciplinary-cases/:id/decide', authorize('hr', 'update'), validate(decideOutcomeSchema), ctrl.decideOutcome);
router.post('/disciplinary-cases/:id/implement', authorize('hr', 'update'), validate(implementOutcomeSchema), ctrl.implementOutcome);
router.post('/disciplinary-cases/:id/close', authorize('hr', 'update'), ctrl.closeCaseAfterImplementation);
router.post('/disciplinary-cases/:id/appeal', authorize('hr', 'update'), validate(submitAppealSchema), ctrl.submitAppeal);
router.post('/disciplinary-cases/:id/resolve-appeal', authorize('hr', 'update'), validate(resolveAppealSchema), ctrl.resolveAppeal);

// Disciplinary Cases CRUD
router.get('/disciplinary-cases-list', authorize('hr', 'read'), ctrl.listDisciplinaryCases);
router.get('/disciplinary-cases/:id', authorize('hr', 'read'), ctrl.getDisciplinaryCase);
router.post('/disciplinary-cases-crud', authorize('hr', 'create'), validate(createDisciplinaryCaseSchema), ctrl.createDisciplinaryCaseCtrl);
router.put('/disciplinary-cases/:id/crud', authorize('hr', 'update'), validate(updateDisciplinaryCaseSchema), ctrl.updateDisciplinaryCase);
router.delete('/disciplinary-cases/:id', authorize('hr', 'delete'), ctrl.deleteDisciplinaryCase);

// Disciplinary Outcomes CRUD
router.get('/disciplinary-outcomes', authorize('hr', 'read'), ctrl.listDisciplinaryOutcomes);
router.get('/disciplinary-outcomes/:id', authorize('hr', 'read'), ctrl.getDisciplinaryOutcome);
router.post('/disciplinary-outcomes', authorize('hr', 'create'), validate(createDisciplinaryOutcomeSchema), ctrl.createDisciplinaryOutcomeCtrl);
router.put('/disciplinary-outcomes/:id', authorize('hr', 'update'), validate(updateDisciplinaryOutcomeSchema), ctrl.updateDisciplinaryOutcome);
router.delete('/disciplinary-outcomes/:id', authorize('hr', 'delete'), ctrl.deleteDisciplinaryOutcome);

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 6 — Compliance Reporting & Payroll Extract Routes
// ═══════════════════════════════════════════════════════════════════

// Compliance
router.post('/compliance/student-faculty-ratio', authorize('hr', 'read'), ctrl.computeStudentFacultyRatio);
router.post('/compliance/fdp-report', authorize('hr', 'read'), ctrl.generateFDPComplianceReport);
router.post('/compliance/attendance-report', authorize('hr', 'read'), validate(attendanceComplianceSchema), ctrl.generateAttendanceComplianceReport);

// Payroll Extract
router.post('/payroll-extracts/generate', authorize('hr', 'create'), validate(generatePayrollExtractSchema), ctrl.generatePayrollExtract);
router.post('/payroll-extracts/:id/review', authorize('hr', 'update'), ctrl.reviewPayrollExtract);
router.post('/payroll-extracts/:id/release', authorize('hr', 'update'), ctrl.releasePayrollExtract);

// Payroll Data Extract CRUD
router.get('/payroll-extracts', authorize('hr', 'read'), ctrl.listPayrollDataExtracts);
router.get('/payroll-extracts/:id', authorize('hr', 'read'), ctrl.getPayrollDataExtract);
router.post('/payroll-extracts', authorize('hr', 'create'), validate(createPayrollDataExtractSchema), ctrl.createPayrollDataExtractCtrl);
router.put('/payroll-extracts/:id', authorize('hr', 'update'), validate(updatePayrollDataExtractSchema), ctrl.updatePayrollDataExtract);
router.delete('/payroll-extracts/:id', authorize('hr', 'delete'), ctrl.deletePayrollDataExtract);

export default router;
