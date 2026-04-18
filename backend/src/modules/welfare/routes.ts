import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createHostelBlockSchema, updateHostelBlockSchema,
  createHostelRoomSchema, updateHostelRoomSchema,
  createHostelAllocationSchema, updateHostelAllocationSchema,
  createHostelVisitorLogSchema, updateHostelVisitorLogSchema,
  createMessMenuSchema, updateMessMenuSchema,
  createMessFeedbackSchema, updateMessFeedbackSchema,
  createTransportRouteSchema, updateTransportRouteSchema,
  createTransportAllocationSchema, updateTransportAllocationSchema,
  createHealthRecordSchema, updateHealthRecordSchema,
  createMedicalVisitSchema, updateMedicalVisitSchema,
  createCounselingSessionSchema, updateCounselingSessionSchema,
  createCrisisAlertSchema, updateCrisisAlertSchema,
  createAntiRaggingComplaintSchema, updateAntiRaggingComplaintSchema,
  createStudentGrievanceSchema, updateStudentGrievanceSchema,
  createInsuranceClaimSchema, updateInsuranceClaimSchema,
  createParentMeetingSchema, updateParentMeetingSchema,
  // W06 workflow schemas
  fileGrievanceSchema, triageGrievanceSchema, resolveGrievanceSchema,
  escalateGrievanceSchema, grievanceFeedbackSchema, reopenGrievanceSchema,
  addInternalNoteSchema, assignGrievanceSchema, reviewSystemicPatternSchema,
  fileARCComplaintSchema, assessARCSchema, arcInvestigationSchema,
  arcWitnessSchema, arcCompleteInvestigationSchema, arcHearingScheduleSchema,
  arcHearingRecordSchema, arcDecisionSchema, arcAppealSchema, arcAppealDecisionSchema,
  arcFirSchema, arcUGCReportSchema,
  fileMisconductSchema, disciplinaryInquiryStartSchema, disciplinaryInquiryCompleteSchema,
  disciplinaryHearingScheduleSchema, disciplinaryHearingRecordSchema,
  disciplinaryDecisionSchema, disciplinaryAppealSchema, disciplinaryAppealDecisionSchema,
  fileICCComplaintSchema, assessICCSchema, iccInquiryCompleteSchema,
  iccHearingScheduleSchema, iccHearingRecordSchema, iccRecommendationSchema,
  iccAppealSchema, iccAppealDecisionSchema, iccAnnualReportSchema,
  fileSCSTComplaintSchema, scstInvestigateSchema, scstDecisionSchema,
  scstPoliceReferralSchema, scstQuarterlyReportSchema,
  fileGRCComplaintSchema, grcInvestigateSchema, grcHearingScheduleSchema,
  grcHearingRecordSchema, grcDecisionSchema, grcOmbudsmanAppealSchema,
  assignMentorSchema, bulkAssignMentorsSchema, recordMentorSessionSchema,
  flagMentorConcernSchema, referToCounsellingSchema,
  updateMentorAssignmentSchema_wf, updateMentorConcernSchema_wf,
  updateCounsellingReferralSchema, closeCounsellingReferralSchema,
  ingestRiskSignalSchema, acknowledgeCCDAlertSchema, investigateCCDAlertSchema,
  ccdInterventionSchema, ccdFalsePositiveSchema,
  createCCDThresholdSchema, updateCCDThresholdSchema,
  // W10 dropout & exit interview schemas
  createDropoutRiskAlertSchema, assignDropoutAlertSchema,
  logOutreachAttemptSchema, resolveDropoutAlertSchema,
  recordExitInterviewSchema, scheduleExitInterviewSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('welfare', 'read'), ctrl.dashboardStats);

// Hostel Blocks
router.get('/hostel-blocks', authorize('welfare', 'read'), ctrl.listHostelBlocks);
router.get('/hostel-blocks/:id', authorize('welfare', 'read'), ctrl.getHostelBlock);
router.post('/hostel-blocks', authorize('welfare', 'create'), validate(createHostelBlockSchema), ctrl.createHostelBlock);
router.put('/hostel-blocks/:id', authorize('welfare', 'update'), validate(updateHostelBlockSchema), ctrl.updateHostelBlock);
router.delete('/hostel-blocks/:id', authorize('welfare', 'delete'), ctrl.deleteHostelBlock);

// Hostel Rooms
router.get('/hostel-rooms', authorize('welfare', 'read'), ctrl.listHostelRooms);
router.get('/hostel-rooms/:id', authorize('welfare', 'read'), ctrl.getHostelRoom);
router.post('/hostel-rooms', authorize('welfare', 'create'), validate(createHostelRoomSchema), ctrl.createHostelRoom);
router.put('/hostel-rooms/:id', authorize('welfare', 'update'), validate(updateHostelRoomSchema), ctrl.updateHostelRoom);
router.delete('/hostel-rooms/:id', authorize('welfare', 'delete'), ctrl.deleteHostelRoom);

// Hostel Allocations
router.get('/hostel-allocations', authorize('welfare', 'read'), ctrl.listHostelAllocations);
router.get('/hostel-allocations/:id', authorize('welfare', 'read'), ctrl.getHostelAllocation);
router.post('/hostel-allocations', authorize('welfare', 'create'), validate(createHostelAllocationSchema), ctrl.createHostelAllocation);
router.put('/hostel-allocations/:id', authorize('welfare', 'update'), validate(updateHostelAllocationSchema), ctrl.updateHostelAllocation);
router.delete('/hostel-allocations/:id', authorize('welfare', 'delete'), ctrl.deleteHostelAllocation);

// Hostel Visitor Logs
router.get('/hostel-visitor-logs', authorize('welfare', 'read'), ctrl.listHostelVisitorLogs);
router.get('/hostel-visitor-logs/:id', authorize('welfare', 'read'), ctrl.getHostelVisitorLog);
router.post('/hostel-visitor-logs', authorize('welfare', 'create'), validate(createHostelVisitorLogSchema), ctrl.createHostelVisitorLog);
router.put('/hostel-visitor-logs/:id', authorize('welfare', 'update'), validate(updateHostelVisitorLogSchema), ctrl.updateHostelVisitorLog);
router.delete('/hostel-visitor-logs/:id', authorize('welfare', 'delete'), ctrl.deleteHostelVisitorLog);

// Mess Menus
router.get('/mess-menus', authorize('welfare', 'read'), ctrl.listMessMenus);
router.get('/mess-menus/:id', authorize('welfare', 'read'), ctrl.getMessMenu);
router.post('/mess-menus', authorize('welfare', 'create'), validate(createMessMenuSchema), ctrl.createMessMenu);
router.put('/mess-menus/:id', authorize('welfare', 'update'), validate(updateMessMenuSchema), ctrl.updateMessMenu);
router.delete('/mess-menus/:id', authorize('welfare', 'delete'), ctrl.deleteMessMenu);

// Mess Feedbacks
router.get('/mess-feedbacks', authorize('welfare', 'read'), ctrl.listMessFeedbacks);
router.get('/mess-feedbacks/:id', authorize('welfare', 'read'), ctrl.getMessFeedback);
router.post('/mess-feedbacks', authorize('welfare', 'create'), validate(createMessFeedbackSchema), ctrl.createMessFeedback);
router.put('/mess-feedbacks/:id', authorize('welfare', 'update'), validate(updateMessFeedbackSchema), ctrl.updateMessFeedback);
router.delete('/mess-feedbacks/:id', authorize('welfare', 'delete'), ctrl.deleteMessFeedback);

// Transport Routes
router.get('/transport-routes', authorize('welfare', 'read'), ctrl.listTransportRoutes);
router.get('/transport-routes/:id', authorize('welfare', 'read'), ctrl.getTransportRoute);
router.post('/transport-routes', authorize('welfare', 'create'), validate(createTransportRouteSchema), ctrl.createTransportRoute);
router.put('/transport-routes/:id', authorize('welfare', 'update'), validate(updateTransportRouteSchema), ctrl.updateTransportRoute);
router.delete('/transport-routes/:id', authorize('welfare', 'delete'), ctrl.deleteTransportRoute);

// Transport Allocations
router.get('/transport-allocations', authorize('welfare', 'read'), ctrl.listTransportAllocations);
router.get('/transport-allocations/:id', authorize('welfare', 'read'), ctrl.getTransportAllocation);
router.post('/transport-allocations', authorize('welfare', 'create'), validate(createTransportAllocationSchema), ctrl.createTransportAllocation);
router.put('/transport-allocations/:id', authorize('welfare', 'update'), validate(updateTransportAllocationSchema), ctrl.updateTransportAllocation);
router.delete('/transport-allocations/:id', authorize('welfare', 'delete'), ctrl.deleteTransportAllocation);

// Health Records
router.get('/health-records', authorize('welfare', 'read'), ctrl.listHealthRecords);
router.get('/health-records/:id', authorize('welfare', 'read'), ctrl.getHealthRecord);
router.post('/health-records', authorize('welfare', 'create'), validate(createHealthRecordSchema), ctrl.createHealthRecord);
router.put('/health-records/:id', authorize('welfare', 'update'), validate(updateHealthRecordSchema), ctrl.updateHealthRecord);
router.delete('/health-records/:id', authorize('welfare', 'delete'), ctrl.deleteHealthRecord);

// Medical Visits
router.get('/medical-visits', authorize('welfare', 'read'), ctrl.listMedicalVisits);
router.get('/medical-visits/:id', authorize('welfare', 'read'), ctrl.getMedicalVisit);
router.post('/medical-visits', authorize('welfare', 'create'), validate(createMedicalVisitSchema), ctrl.createMedicalVisit);
router.put('/medical-visits/:id', authorize('welfare', 'update'), validate(updateMedicalVisitSchema), ctrl.updateMedicalVisit);
router.delete('/medical-visits/:id', authorize('welfare', 'delete'), ctrl.deleteMedicalVisit);

// Counseling Sessions
router.get('/counseling-sessions', authorize('welfare', 'read'), ctrl.listCounselingSessions);
router.get('/counseling-sessions/:id', authorize('welfare', 'read'), ctrl.getCounselingSession);
router.post('/counseling-sessions', authorize('welfare', 'create'), validate(createCounselingSessionSchema), ctrl.createCounselingSession);
router.put('/counseling-sessions/:id', authorize('welfare', 'update'), validate(updateCounselingSessionSchema), ctrl.updateCounselingSession);
router.delete('/counseling-sessions/:id', authorize('welfare', 'delete'), ctrl.deleteCounselingSession);

// Crisis Alerts
router.get('/crisis-alerts', authorize('welfare', 'read'), ctrl.listCrisisAlerts);
router.get('/crisis-alerts/:id', authorize('welfare', 'read'), ctrl.getCrisisAlert);
router.post('/crisis-alerts', authorize('welfare', 'create'), validate(createCrisisAlertSchema), ctrl.createCrisisAlert);
router.put('/crisis-alerts/:id', authorize('welfare', 'update'), validate(updateCrisisAlertSchema), ctrl.updateCrisisAlert);
router.delete('/crisis-alerts/:id', authorize('welfare', 'delete'), ctrl.deleteCrisisAlert);

// Anti-Ragging Complaints
router.get('/anti-ragging-complaints', authorize('welfare', 'read'), ctrl.listAntiRaggingComplaints);
router.get('/anti-ragging-complaints/:id', authorize('welfare', 'read'), ctrl.getAntiRaggingComplaint);
router.post('/anti-ragging-complaints', authorize('welfare', 'create'), validate(createAntiRaggingComplaintSchema), ctrl.createAntiRaggingComplaint);
router.put('/anti-ragging-complaints/:id', authorize('welfare', 'update'), validate(updateAntiRaggingComplaintSchema), ctrl.updateAntiRaggingComplaint);
router.delete('/anti-ragging-complaints/:id', authorize('welfare', 'delete'), ctrl.deleteAntiRaggingComplaint);

// Student Grievances
router.get('/student-grievances', authorize('welfare', 'read'), ctrl.listStudentGrievances);
router.get('/student-grievances/:id', authorize('welfare', 'read'), ctrl.getStudentGrievance);
router.post('/student-grievances', authorize('welfare', 'create'), validate(createStudentGrievanceSchema), ctrl.createStudentGrievance);
router.put('/student-grievances/:id', authorize('welfare', 'update'), validate(updateStudentGrievanceSchema), ctrl.updateStudentGrievance);
router.delete('/student-grievances/:id', authorize('welfare', 'delete'), ctrl.deleteStudentGrievance);

// Insurance Claims
router.get('/insurance-claims', authorize('welfare', 'read'), ctrl.listInsuranceClaims);
router.get('/insurance-claims/:id', authorize('welfare', 'read'), ctrl.getInsuranceClaim);
router.post('/insurance-claims', authorize('welfare', 'create'), validate(createInsuranceClaimSchema), ctrl.createInsuranceClaim);
router.put('/insurance-claims/:id', authorize('welfare', 'update'), validate(updateInsuranceClaimSchema), ctrl.updateInsuranceClaim);
router.delete('/insurance-claims/:id', authorize('welfare', 'delete'), ctrl.deleteInsuranceClaim);

// Parent Meetings
router.get('/parent-meetings', authorize('welfare', 'read'), ctrl.listParentMeetings);
router.get('/parent-meetings/:id', authorize('welfare', 'read'), ctrl.getParentMeeting);
router.post('/parent-meetings', authorize('welfare', 'create'), validate(createParentMeetingSchema), ctrl.createParentMeeting);
router.put('/parent-meetings/:id', authorize('welfare', 'update'), validate(updateParentMeetingSchema), ctrl.updateParentMeeting);
router.delete('/parent-meetings/:id', authorize('welfare', 'delete'), ctrl.deleteParentMeeting);

// ═══════════════════════════════════════════════════════════════
// W06 WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════════

// ═══ GGM WORKFLOW ROUTES ════════════════════════════════════
router.post('/grievances/file', authorize('welfare', 'create'), validate(fileGrievanceSchema), ctrl.fileGrievanceCtrl);
router.post('/grievances/:id/triage', authorize('welfare', 'update'), validate(triageGrievanceSchema), ctrl.triageGrievanceCtrl);
router.post('/grievances/:id/resolve', authorize('welfare', 'update'), validate(resolveGrievanceSchema), ctrl.resolveGrievanceCtrl);
router.post('/grievances/:id/escalate', authorize('welfare', 'update'), validate(escalateGrievanceSchema), ctrl.escalateGrievanceCtrl);
router.post('/grievances/:id/feedback', authorize('welfare', 'update'), validate(grievanceFeedbackSchema), ctrl.feedbackGrievanceCtrl);
router.post('/grievances/:id/close', authorize('welfare', 'update'), ctrl.closeGrievanceCtrl);
router.post('/grievances/:id/reopen', authorize('welfare', 'update'), validate(reopenGrievanceSchema), ctrl.reopenGrievanceCtrl);
router.post('/grievances/:id/notes', authorize('welfare', 'update'), validate(addInternalNoteSchema), ctrl.addInternalNoteCtrl);
router.post('/grievances/:id/assign', authorize('welfare', 'update'), validate(assignGrievanceSchema), ctrl.assignGrievanceCtrl);
router.post('/grievances/detect-patterns', authorize('welfare', 'create'), ctrl.detectSystemicPatternsCtrl);
router.get('/grievances/analytics', authorize('welfare', 'read'), ctrl.getGrievanceAnalyticsCtrl);
router.get('/grievances/sla-dashboard', authorize('welfare', 'read'), ctrl.getGrievanceSLADashboardCtrl);
router.get('/grievance-assignments', authorize('welfare', 'read'), ctrl.listGrievanceAssignmentsCtrl);
router.get('/grievance-assignments/:id', authorize('welfare', 'read'), ctrl.getGrievanceAssignmentCtrl);
router.get('/systemic-patterns', authorize('welfare', 'read'), ctrl.listSystemicPatternsCtrl);
router.get('/systemic-patterns/:id', authorize('welfare', 'read'), ctrl.getSystemicPatternCtrl);
router.post('/systemic-patterns/:id/review', authorize('welfare', 'update'), validate(reviewSystemicPatternSchema), ctrl.reviewSystemicPatternCtrl);

// ═══ ARC WORKFLOW ROUTES ════════════════════════════════════
router.get('/arc-complaints', authorize('welfare', 'read'), ctrl.listARCComplaintsCtrl);
router.get('/arc-complaints/:id', authorize('welfare', 'read'), ctrl.getARCComplaintCtrl);
router.post('/arc-complaints/file', authorize('welfare', 'create'), validate(fileARCComplaintSchema), ctrl.fileARCComplaintCtrl);
router.post('/arc-complaints/:id/assess', authorize('welfare', 'update'), validate(assessARCSchema), ctrl.assessARCComplaintCtrl);
router.post('/arc-complaints/:id/investigate', authorize('welfare', 'update'), validate(arcInvestigationSchema), ctrl.startARCInvestigationCtrl);
router.post('/arc-complaints/:id/witness', authorize('welfare', 'update'), validate(arcWitnessSchema), ctrl.recordARCWitnessCtrl);
router.post('/arc-complaints/:id/complete-investigation', authorize('welfare', 'update'), validate(arcCompleteInvestigationSchema), ctrl.completeARCInvestigationCtrl);
router.post('/arc-complaints/:id/schedule-hearing', authorize('welfare', 'update'), validate(arcHearingScheduleSchema), ctrl.scheduleARCHearingCtrl);
router.post('/arc-complaints/:id/record-hearing', authorize('welfare', 'update'), validate(arcHearingRecordSchema), ctrl.recordARCHearingCtrl);
router.post('/arc-complaints/:id/decision', authorize('welfare', 'update'), validate(arcDecisionSchema), ctrl.issueARCDecisionCtrl);
router.post('/arc-complaints/:id/execute-penalty', authorize('welfare', 'update'), ctrl.executeARCPenaltyCtrl);
router.post('/arc-complaints/:id/appeal', authorize('welfare', 'create'), validate(arcAppealSchema), ctrl.fileARCAppealCtrl);
router.post('/arc-complaints/:id/decide-appeal', authorize('welfare', 'update'), validate(arcAppealDecisionSchema), ctrl.decideARCAppealCtrl);
router.post('/arc-complaints/:id/fir', authorize('welfare', 'update'), validate(arcFirSchema), ctrl.fileARCFirCtrl);
router.get('/arc-complaints/:id/history', authorize('welfare', 'read'), ctrl.getARCComplaintHistoryCtrl);
router.post('/arc-ugc-reports', authorize('welfare', 'create'), validate(arcUGCReportSchema), ctrl.generateARCUGCReportCtrl);

// ═══ DISC WORKFLOW ROUTES ═══════════════════════════════════
router.get('/misconduct-reports', authorize('welfare', 'read'), ctrl.listMisconductReportsCtrl);
router.get('/misconduct-reports/:id', authorize('welfare', 'read'), ctrl.getMisconductReportCtrl);
router.post('/misconduct-reports/file', authorize('welfare', 'create'), validate(fileMisconductSchema), ctrl.fileMisconductReportCtrl);
router.post('/misconduct-reports/:id/start-inquiry', authorize('welfare', 'update'), validate(disciplinaryInquiryStartSchema), ctrl.startDisciplinaryInquiryCtrl);
router.post('/misconduct-reports/:id/complete-inquiry', authorize('welfare', 'update'), validate(disciplinaryInquiryCompleteSchema), ctrl.completeDisciplinaryInquiryCtrl);
router.post('/misconduct-reports/:id/schedule-hearing', authorize('welfare', 'update'), validate(disciplinaryHearingScheduleSchema), ctrl.scheduleDisciplinaryHearingCtrl);
router.post('/misconduct-reports/:id/record-hearing', authorize('welfare', 'update'), validate(disciplinaryHearingRecordSchema), ctrl.recordDisciplinaryHearingCtrl);
router.post('/misconduct-reports/:id/decision', authorize('welfare', 'update'), validate(disciplinaryDecisionSchema), ctrl.issueDisciplinaryDecisionCtrl);
router.post('/misconduct-reports/:id/execute-penalty', authorize('welfare', 'update'), ctrl.executeDisciplinaryPenaltyCtrl);
router.post('/misconduct-reports/:id/appeal', authorize('welfare', 'create'), validate(disciplinaryAppealSchema), ctrl.fileDisciplinaryAppealCtrl);
router.post('/misconduct-reports/:id/decide-appeal', authorize('welfare', 'update'), validate(disciplinaryAppealDecisionSchema), ctrl.decideDisciplinaryAppealCtrl);
router.get('/misconduct-reports/:id/history', authorize('welfare', 'read'), ctrl.getDisciplinaryHistoryCtrl);
router.get('/disciplinary-record/:studentId', authorize('welfare', 'read'), ctrl.getStudentDisciplinaryRecordCtrl);

// ═══ ICC WORKFLOW ROUTES ════════════════════════════════════
router.get('/icc-complaints', authorize('welfare', 'read'), ctrl.listICCComplaintsCtrl);
router.get('/icc-complaints/:id', authorize('welfare', 'read'), ctrl.getICCComplaintCtrl);
router.post('/icc-complaints/file', authorize('welfare', 'create'), validate(fileICCComplaintSchema), ctrl.fileICCComplaintCtrl);
router.post('/icc-complaints/:id/assess', authorize('welfare', 'update'), validate(assessICCSchema), ctrl.assessICCComplaintCtrl);
router.post('/icc-complaints/:id/start-inquiry', authorize('welfare', 'update'), ctrl.startICCInquiryCtrl);
router.post('/icc-complaints/:id/complete-inquiry', authorize('welfare', 'update'), validate(iccInquiryCompleteSchema), ctrl.completeICCInquiryCtrl);
router.post('/icc-complaints/:id/schedule-hearing', authorize('welfare', 'update'), validate(iccHearingScheduleSchema), ctrl.scheduleICCHearingCtrl);
router.post('/icc-complaints/:id/record-hearing', authorize('welfare', 'update'), validate(iccHearingRecordSchema), ctrl.recordICCHearingCtrl);
router.post('/icc-complaints/:id/recommendation', authorize('welfare', 'update'), validate(iccRecommendationSchema), ctrl.issueICCRecommendationCtrl);
router.post('/icc-complaints/:id/appeal', authorize('welfare', 'create'), validate(iccAppealSchema), ctrl.fileICCAppealCtrl);
router.post('/icc-complaints/:id/decide-appeal', authorize('welfare', 'update'), validate(iccAppealDecisionSchema), ctrl.decideICCAppealCtrl);
router.get('/icc-complaints/:id/timeline', authorize('welfare', 'read'), ctrl.getICCTimelineCtrl);
router.get('/icc-deadline-dashboard', authorize('welfare', 'read'), ctrl.getICCDeadlineDashboardCtrl);
router.post('/icc-annual-reports', authorize('welfare', 'create'), validate(iccAnnualReportSchema), ctrl.generateICCAnnualReportCtrl);
router.get('/icc-annual-reports', authorize('welfare', 'read'), ctrl.listICCAnnualReportsCtrl);
router.get('/icc-annual-reports/:id', authorize('welfare', 'read'), ctrl.getICCAnnualReportCtrl);

// ═══ SCST WORKFLOW ROUTES ═══════════════════════════════════
router.get('/scst-complaints', authorize('welfare', 'read'), ctrl.listSCSTComplaintsCtrl);
router.get('/scst-complaints/:id', authorize('welfare', 'read'), ctrl.getSCSTComplaintCtrl);
router.post('/scst-complaints/file', authorize('welfare', 'create'), validate(fileSCSTComplaintSchema), ctrl.fileSCSTComplaintCtrl);
router.post('/scst-complaints/:id/investigate', authorize('welfare', 'update'), validate(scstInvestigateSchema), ctrl.investigateSCSTComplaintCtrl);
router.post('/scst-complaints/:id/decision', authorize('welfare', 'update'), validate(scstDecisionSchema), ctrl.decideSCSTComplaintCtrl);
router.post('/scst-complaints/:id/refer-police', authorize('welfare', 'update'), validate(scstPoliceReferralSchema), ctrl.referSCSTToPoliceCtrl);
router.get('/scst-complaints/:id/timeline', authorize('welfare', 'read'), ctrl.getSCSTTimelineCtrl);
router.post('/scst-quarterly-reports', authorize('welfare', 'create'), validate(scstQuarterlyReportSchema), ctrl.generateSCSTQuarterlyReportCtrl);

// ═══ GRC WORKFLOW ROUTES ════════════════════════════════════
router.get('/grc-complaints', authorize('welfare', 'read'), ctrl.listGRCComplaintsCtrl);
router.get('/grc-complaints/:id', authorize('welfare', 'read'), ctrl.getGRCComplaintCtrl);
router.post('/grc-complaints/file', authorize('welfare', 'create'), validate(fileGRCComplaintSchema), ctrl.fileGRCComplaintCtrl);
router.post('/grc-complaints/:id/investigate', authorize('welfare', 'update'), validate(grcInvestigateSchema), ctrl.investigateGRCComplaintCtrl);
router.post('/grc-complaints/:id/schedule-hearing', authorize('welfare', 'update'), validate(grcHearingScheduleSchema), ctrl.scheduleGRCHearingCtrl);
router.post('/grc-complaints/:id/record-hearing', authorize('welfare', 'update'), validate(grcHearingRecordSchema), ctrl.recordGRCHearingCtrl);
router.post('/grc-complaints/:id/decision', authorize('welfare', 'update'), validate(grcDecisionSchema), ctrl.issueGRCDecisionCtrl);
router.post('/grc-complaints/:id/appeal-ombudsman', authorize('welfare', 'create'), validate(grcOmbudsmanAppealSchema), ctrl.appealGRCToOmbudsmanCtrl);
router.get('/grc-deadline-dashboard', authorize('welfare', 'read'), ctrl.getGRCDeadlineDashboardCtrl);

// ═══ MENTORING WORKFLOW ROUTES ══════════════════════════════
router.post('/mentor-assignments/assign', authorize('welfare', 'create'), validate(assignMentorSchema), ctrl.assignMentorCtrl);
router.post('/mentor-assignments/bulk-assign', authorize('welfare', 'create'), validate(bulkAssignMentorsSchema), ctrl.bulkAssignMentorsCtrl);
router.post('/mentor-sessions', authorize('welfare', 'create'), validate(recordMentorSessionSchema), ctrl.recordMentorSessionCtrl);
router.post('/mentor-concerns/flag', authorize('welfare', 'create'), validate(flagMentorConcernSchema), ctrl.flagMentorConcernCtrl);
router.post('/mentor-concerns/:id/escalate-ccd', authorize('welfare', 'update'), ctrl.escalateConcernToCCDCtrl);
router.post('/counselling-referrals/refer', authorize('welfare', 'create'), validate(referToCounsellingSchema), ctrl.referToCounsellingCtrl);
router.get('/mentor-engagement-analytics', authorize('welfare', 'read'), ctrl.getMentorEngagementAnalyticsCtrl);
router.get('/mentors/:mentorId/mentees', authorize('welfare', 'read'), ctrl.getMyMenteesCtrl);
router.get('/mentor-at-risk-mentees', authorize('welfare', 'read'), ctrl.getAtRiskMenteesCtrl);
router.get('/mentor-assignments', authorize('welfare', 'read'), ctrl.listMentorAssignmentsCtrl);
router.get('/mentor-assignments/:id', authorize('welfare', 'read'), ctrl.getMentorAssignmentCtrl);
router.put('/mentor-assignments/:id', authorize('welfare', 'update'), validate(updateMentorAssignmentSchema_wf), ctrl.updateMentorAssignmentCtrl);
router.get('/mentor-sessions', authorize('welfare', 'read'), ctrl.listMentorSessionsCtrl);
router.get('/mentor-sessions/:id', authorize('welfare', 'read'), ctrl.getMentorSessionCtrl);
router.get('/mentor-concerns', authorize('welfare', 'read'), ctrl.listMentorConcernsCtrl);
router.get('/mentor-concerns/:id', authorize('welfare', 'read'), ctrl.getMentorConcernCtrl);
router.put('/mentor-concerns/:id', authorize('welfare', 'update'), validate(updateMentorConcernSchema_wf), ctrl.updateMentorConcernCtrl);

// ═══ COUNSELLING WORKFLOW ROUTES ════════════════════════════
router.get('/counselling-referrals', authorize('welfare', 'read'), ctrl.listCounsellingReferralsCtrl);
router.get('/counselling-referrals/:id', authorize('welfare', 'read'), ctrl.getCounsellingReferralCtrl);
router.put('/counselling-referrals/:id', authorize('welfare', 'update'), validate(updateCounsellingReferralSchema), ctrl.updateCounsellingReferralCtrl);
router.post('/counselling-referrals/:id/close', authorize('welfare', 'update'), validate(closeCounsellingReferralSchema), ctrl.closeCounsellingReferralCtrl);
router.get('/counselling-aggregate-report', authorize('welfare', 'read'), ctrl.getCounsellingAggregateReportCtrl);
router.get('/counselling-follow-up-dashboard', authorize('welfare', 'read'), ctrl.getFollowUpDashboardCtrl);

// ═══ CCD WORKFLOW ROUTES ════════════════════════════════════
router.post('/ccd/risk-signals', authorize('welfare', 'create'), validate(ingestRiskSignalSchema), ctrl.ingestRiskSignalCtrl);
router.get('/ccd/risk-signals', authorize('welfare', 'read'), ctrl.listRiskSignalsCtrl);
router.get('/ccd/risk-signals/:id', authorize('welfare', 'read'), ctrl.getRiskSignalCtrl);
router.post('/ccd/alerts/:id/acknowledge', authorize('welfare', 'update'), validate(acknowledgeCCDAlertSchema), ctrl.acknowledgeCCDAlertCtrl);
router.post('/ccd/alerts/:id/investigate', authorize('welfare', 'update'), validate(investigateCCDAlertSchema), ctrl.investigateCCDAlertCtrl);
router.post('/ccd/alerts/:id/intervene', authorize('welfare', 'create'), validate(ccdInterventionSchema), ctrl.recordCCDInterventionCtrl);
router.post('/ccd/alerts/:id/resolve', authorize('welfare', 'update'), ctrl.resolveCCDAlertCtrl);
router.post('/ccd/alerts/:id/false-positive', authorize('welfare', 'update'), validate(ccdFalsePositiveSchema), ctrl.markCCDFalsePositiveCtrl);
router.get('/ccd/alerts', authorize('welfare', 'read'), ctrl.listCCDAlertsCtrl);
router.get('/ccd/alerts/:id', authorize('welfare', 'read'), ctrl.getCCDAlertCtrl);
router.get('/ccd/students/:studentId/risk-profile', authorize('welfare', 'read'), ctrl.getStudentRiskProfileCtrl);
router.post('/ccd/students/:studentId/recompute', authorize('welfare', 'update'), ctrl.recomputeStudentScoreCtrl);
router.get('/ccd/dashboard', authorize('welfare', 'read'), ctrl.getCCDDashboardCtrl);
router.get('/ccd/interventions', authorize('welfare', 'read'), ctrl.listCCDInterventionsCtrl);
router.get('/ccd/interventions/:id', authorize('welfare', 'read'), ctrl.getCCDInterventionCtrl);
router.get('/ccd/thresholds', authorize('welfare', 'read'), ctrl.listCCDThresholdsCtrl);
router.get('/ccd/thresholds/:id', authorize('welfare', 'read'), ctrl.getCCDThresholdCtrl);
router.post('/ccd/thresholds', authorize('welfare', 'create'), validate(createCCDThresholdSchema), ctrl.createCCDThresholdCtrl);
router.put('/ccd/thresholds/:id', authorize('welfare', 'update'), validate(updateCCDThresholdSchema), ctrl.updateCCDThresholdCtrl);

// ── W10 Dropout Risk Alerts ────────────────────────────────
router.get('/dropout-risk-alerts', authorize('welfare', 'read'), ctrl.listDropoutRiskAlertsCtrl);
router.get('/dropout-risk-alerts/:id', authorize('welfare', 'read'), ctrl.getDropoutRiskAlertCtrl);
router.post('/dropout-risk-alerts', authorize('welfare', 'create'), validate(createDropoutRiskAlertSchema), ctrl.createDropoutRiskAlertCtrl);
router.put('/dropout-risk-alerts/:id/assign', authorize('welfare', 'update'), validate(assignDropoutAlertSchema), ctrl.assignDropoutAlertCtrl);
router.post('/dropout-risk-alerts/:id/outreach', authorize('welfare', 'update'), validate(logOutreachAttemptSchema), ctrl.logOutreachAttemptCtrl);
router.put('/dropout-risk-alerts/:id/resolve', authorize('welfare', 'update'), validate(resolveDropoutAlertSchema), ctrl.resolveDropoutAlertCtrl);

// ── W10 Exit Interviews ────────────────────────────────────
router.get('/exit-interviews', authorize('welfare', 'read'), ctrl.listExitInterviewsCtrl);
router.post('/exit-interviews', authorize('welfare', 'create'), validate(recordExitInterviewSchema), ctrl.recordExitInterviewCtrl);
router.post('/exit-interviews/schedule', authorize('welfare', 'create'), validate(scheduleExitInterviewSchema), ctrl.scheduleExitInterviewCtrl);
router.get('/exit-interviews/:id', authorize('welfare', 'read'), ctrl.getExitInterviewCtrl);
router.post('/exit-interviews/:id/decline', authorize('welfare', 'update'), ctrl.declineExitInterviewCtrl);

export default router;
