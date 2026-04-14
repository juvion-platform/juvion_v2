import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createPlacementSeasonSchema, updatePlacementSeasonSchema,
  createCompanySchema, updateCompanySchema,
  createJobPostingSchema, updateJobPostingSchema,
  createPlacementRegistrationSchema, updatePlacementRegistrationSchema,
  createPlacementRoundSchema, updatePlacementRoundSchema,
  createRoundResultSchema, updateRoundResultSchema,
  createPlacementOfferSchema, updatePlacementOfferSchema,
  createInternshipPostingSchema, updateInternshipPostingSchema,
  createInternshipApplicationSchema, updateInternshipApplicationSchema,
  createPlacementTrainingSchema, updatePlacementTrainingSchema,
  createTrainingAttendanceSchema, updateTrainingAttendanceSchema,
  createMockInterviewSchema, updateMockInterviewSchema,
  createHigherStudiesApplicationSchema, updateHigherStudiesApplicationSchema,
  createEntrepreneurProfileSchema, updateEntrepreneurProfileSchema,
  createAlumniProfileSchema, updateAlumniProfileSchema,
  createAlumniEventSchema, updateAlumniEventSchema,
  createPlacementReportSchema,
  // W04 workflow schemas
  createEngagementLogSchema, scorePipelineSchema, blacklistCompanySchema,
  registerRecruiterAccountSchema, verifyRecruiterAccountSchema, deactivateRecruiterAccountSchema,
  transitionSeasonSchema,
  createDriveSchema_wf, transitionDriveSchema, cancelDriveSchema,
  applyToDriveSchema, withdrawApplicationSchema,
  scheduleInterviewsSchema, updateInterviewOutcomeSchema, checkEligibilitySchema,
  createOfferSchema_wf, releaseOfferSchema,
  applyPlacementBarSchema, liftPlacementBarSchema,
  recordOptOutSchema, voidOptOutSchema,
  initCareerProfilesSchema, updateCareerProfileSchema_wf,
  validateProfileItemSchema, refreshAcademicDataSchema, computeBatchReadinessSchema,
  createSkillRecordSchema, updateSkillRecordSchema, ingestExternalAssessmentSchema,
  updateTrainingSessionSchema_wf, recordTrainingAssessmentSchema,
  initAlumniCareerRecordSchema, updateAlumniCareerRecordSchema, batchInitAlumniSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('placement', 'read'), ctrl.dashboardStats);

// Placement Seasons
router.get('/seasons', authorize('placement', 'read'), ctrl.listPlacementSeasons);
router.get('/seasons/:id', authorize('placement', 'read'), ctrl.getPlacementSeason);
router.post('/seasons', authorize('placement', 'create'), validate(createPlacementSeasonSchema), ctrl.createPlacementSeason);
router.put('/seasons/:id', authorize('placement', 'update'), validate(updatePlacementSeasonSchema), ctrl.updatePlacementSeason);
router.delete('/seasons/:id', authorize('placement', 'delete'), ctrl.deletePlacementSeason);

// Companies
router.get('/companies', authorize('placement', 'read'), ctrl.listCompanies);
router.get('/companies/:id', authorize('placement', 'read'), ctrl.getCompany);
router.post('/companies', authorize('placement', 'create'), validate(createCompanySchema), ctrl.createCompany);
router.put('/companies/:id', authorize('placement', 'update'), validate(updateCompanySchema), ctrl.updateCompany);
router.delete('/companies/:id', authorize('placement', 'delete'), ctrl.deleteCompany);

// Job Postings
router.get('/job-postings', authorize('placement', 'read'), ctrl.listJobPostings);
router.get('/job-postings/:id', authorize('placement', 'read'), ctrl.getJobPosting);
router.post('/job-postings', authorize('placement', 'create'), validate(createJobPostingSchema), ctrl.createJobPosting);
router.put('/job-postings/:id', authorize('placement', 'update'), validate(updateJobPostingSchema), ctrl.updateJobPosting);
router.delete('/job-postings/:id', authorize('placement', 'delete'), ctrl.deleteJobPosting);

// Registrations
router.get('/registrations', authorize('placement', 'read'), ctrl.listPlacementRegistrations);
router.post('/registrations', authorize('placement', 'create'), validate(createPlacementRegistrationSchema), ctrl.createPlacementRegistration);
router.put('/registrations/:id', authorize('placement', 'update'), validate(updatePlacementRegistrationSchema), ctrl.updatePlacementRegistration);
router.delete('/registrations/:id', authorize('placement', 'delete'), ctrl.deletePlacementRegistration);

// Rounds
router.get('/rounds', authorize('placement', 'read'), ctrl.listPlacementRounds);
router.post('/rounds', authorize('placement', 'create'), validate(createPlacementRoundSchema), ctrl.createPlacementRound);
router.put('/rounds/:id', authorize('placement', 'update'), validate(updatePlacementRoundSchema), ctrl.updatePlacementRound);
router.delete('/rounds/:id', authorize('placement', 'delete'), ctrl.deletePlacementRound);

// Round Results
router.get('/round-results', authorize('placement', 'read'), ctrl.listRoundResults);
router.post('/round-results', authorize('placement', 'create'), validate(createRoundResultSchema), ctrl.createRoundResult);
router.put('/round-results/:id', authorize('placement', 'update'), validate(updateRoundResultSchema), ctrl.updateRoundResult);
router.delete('/round-results/:id', authorize('placement', 'delete'), ctrl.deleteRoundResult);

// ── Offers Workflow (specific paths before :id) ────────────
router.post('/offers/check-dream-policy', authorize('placement', 'read'), validate(checkEligibilitySchema), ctrl.checkDreamPolicyCtrl);
router.post('/offers/create-from-drive', authorize('placement', 'create'), validate(createOfferSchema_wf), ctrl.createOfferFromDriveCtrl);
router.get('/offers/by-drive/:id', authorize('placement', 'read'), ctrl.listOffersByDriveCtrl);

// Offers
router.get('/offers', authorize('placement', 'read'), ctrl.listPlacementOffers);
router.post('/offers', authorize('placement', 'create'), validate(createPlacementOfferSchema), ctrl.createPlacementOffer);
router.put('/offers/:id', authorize('placement', 'update'), validate(updatePlacementOfferSchema), ctrl.updatePlacementOffer);
router.delete('/offers/:id', authorize('placement', 'delete'), ctrl.deletePlacementOffer);
router.post('/offers/:id/accept', authorize('placement', 'update'), ctrl.acceptOfferCtrl);
router.post('/offers/:id/reject', authorize('placement', 'update'), ctrl.rejectOfferCtrl);
router.post('/offers/:id/renege', authorize('placement', 'update'), ctrl.handleRenegeCtrl);
router.post('/offers/:id/lapse', authorize('placement', 'update'), ctrl.handleLapseCtrl);
router.post('/offers/:id/release', authorize('placement', 'update'), validate(releaseOfferSchema), ctrl.releaseOfferCtrl);

// Internship Postings
router.get('/internships', authorize('placement', 'read'), ctrl.listInternshipPostings);
router.post('/internships', authorize('placement', 'create'), validate(createInternshipPostingSchema), ctrl.createInternshipPosting);
router.put('/internships/:id', authorize('placement', 'update'), validate(updateInternshipPostingSchema), ctrl.updateInternshipPosting);
router.delete('/internships/:id', authorize('placement', 'delete'), ctrl.deleteInternshipPosting);

// Internship Applications
router.get('/internship-applications', authorize('placement', 'read'), ctrl.listInternshipApplications);
router.post('/internship-applications', authorize('placement', 'create'), validate(createInternshipApplicationSchema), ctrl.createInternshipApplication);
router.put('/internship-applications/:id', authorize('placement', 'update'), validate(updateInternshipApplicationSchema), ctrl.updateInternshipApplication);
router.delete('/internship-applications/:id', authorize('placement', 'delete'), ctrl.deleteInternshipApplication);

// Training
router.get('/trainings', authorize('placement', 'read'), ctrl.listPlacementTrainings);
router.post('/trainings', authorize('placement', 'create'), validate(createPlacementTrainingSchema), ctrl.createPlacementTraining);
router.put('/trainings/:id', authorize('placement', 'update'), validate(updatePlacementTrainingSchema), ctrl.updatePlacementTraining);
router.delete('/trainings/:id', authorize('placement', 'delete'), ctrl.deletePlacementTraining);

// Training Attendance
router.get('/training-attendance', authorize('placement', 'read'), ctrl.listTrainingAttendance);
router.post('/training-attendance', authorize('placement', 'create'), validate(createTrainingAttendanceSchema), ctrl.createTrainingAttendance);
router.put('/training-attendance/:id', authorize('placement', 'update'), validate(updateTrainingAttendanceSchema), ctrl.updateTrainingAttendance);
router.delete('/training-attendance/:id', authorize('placement', 'delete'), ctrl.deleteTrainingAttendance);

// Mock Interviews
router.get('/mock-interviews', authorize('placement', 'read'), ctrl.listMockInterviews);
router.post('/mock-interviews', authorize('placement', 'create'), validate(createMockInterviewSchema), ctrl.createMockInterview);
router.put('/mock-interviews/:id', authorize('placement', 'update'), validate(updateMockInterviewSchema), ctrl.updateMockInterview);
router.delete('/mock-interviews/:id', authorize('placement', 'delete'), ctrl.deleteMockInterview);

// Higher Studies
router.get('/higher-studies', authorize('placement', 'read'), ctrl.listHigherStudiesApplications);
router.post('/higher-studies', authorize('placement', 'create'), validate(createHigherStudiesApplicationSchema), ctrl.createHigherStudiesApplication);
router.put('/higher-studies/:id', authorize('placement', 'update'), validate(updateHigherStudiesApplicationSchema), ctrl.updateHigherStudiesApplication);
router.delete('/higher-studies/:id', authorize('placement', 'delete'), ctrl.deleteHigherStudiesApplication);

// Entrepreneur Profiles
router.get('/entrepreneurs', authorize('placement', 'read'), ctrl.listEntrepreneurProfiles);
router.post('/entrepreneurs', authorize('placement', 'create'), validate(createEntrepreneurProfileSchema), ctrl.createEntrepreneurProfile);
router.put('/entrepreneurs/:id', authorize('placement', 'update'), validate(updateEntrepreneurProfileSchema), ctrl.updateEntrepreneurProfile);
router.delete('/entrepreneurs/:id', authorize('placement', 'delete'), ctrl.deleteEntrepreneurProfile);

// Alumni Profiles
router.get('/alumni-profiles', authorize('placement', 'read'), ctrl.listAlumniProfiles);
router.post('/alumni-profiles', authorize('placement', 'create'), validate(createAlumniProfileSchema), ctrl.createAlumniProfile);
router.put('/alumni-profiles/:id', authorize('placement', 'update'), validate(updateAlumniProfileSchema), ctrl.updateAlumniProfile);
router.delete('/alumni-profiles/:id', authorize('placement', 'delete'), ctrl.deleteAlumniProfile);

// Alumni Events
router.get('/alumni-events', authorize('placement', 'read'), ctrl.listAlumniEvents);
router.post('/alumni-events', authorize('placement', 'create'), validate(createAlumniEventSchema), ctrl.createAlumniEvent);
router.put('/alumni-events/:id', authorize('placement', 'update'), validate(updateAlumniEventSchema), ctrl.updateAlumniEvent);
router.delete('/alumni-events/:id', authorize('placement', 'delete'), ctrl.deleteAlumniEvent);

// Placement Reports
router.get('/reports', authorize('placement', 'read'), ctrl.listPlacementReports);
router.post('/reports', authorize('placement', 'create'), validate(createPlacementReportSchema), ctrl.createPlacementReport);
router.delete('/reports/:id', authorize('placement', 'delete'), ctrl.deletePlacementReport);

// ═══ W04 Workflow Routes ═══════════════════════════════════

// ── CRM: Company Engagement ────────────────────────────────
router.get('/companies/:id/engagement-logs', authorize('placement', 'read'), ctrl.listEngagementLogsCtrl);
router.post('/companies/:id/engagement-logs', authorize('placement', 'create'), validate(createEngagementLogSchema), ctrl.createEngagementLogCtrl);
router.post('/companies/:id/score-pipeline', authorize('placement', 'update'), validate(scorePipelineSchema), ctrl.scorePipelineCtrl);
router.get('/companies/:id/pipeline-dashboard', authorize('placement', 'read'), ctrl.getPipelineDashboardCtrl);
router.put('/companies/:id/blacklist', authorize('placement', 'update'), validate(blacklistCompanySchema), ctrl.blacklistCompanyCtrl);
router.put('/companies/:id/reinstate', authorize('placement', 'update'), ctrl.reinstateCompanyCtrl);
router.get('/companies/:id/programme-affinity', authorize('placement', 'read'), ctrl.listProgrammeAffinityCtrl);
router.post('/seasons/:id/company-analytics', authorize('placement', 'update'), ctrl.generateSeasonAnalyticsCtrl);

// ── Recruiter Portal ───────────────────────────────────────
router.get('/recruiter-accounts', authorize('placement', 'read'), ctrl.listRecruiterAccountsCtrl);
router.get('/recruiter-accounts/:id', authorize('placement', 'read'), ctrl.getRecruiterAccountCtrl);
router.post('/recruiter-accounts', authorize('placement', 'create'), validate(registerRecruiterAccountSchema), ctrl.registerRecruiterAccountCtrl);
router.put('/recruiter-accounts/:id/verify', authorize('placement', 'update'), validate(verifyRecruiterAccountSchema), ctrl.verifyRecruiterAccountCtrl);
router.put('/recruiter-accounts/:id/deactivate', authorize('placement', 'update'), validate(deactivateRecruiterAccountSchema), ctrl.deactivateRecruiterAccountCtrl);
router.get('/recruiter-accounts/:id/activity-log', authorize('placement', 'read'), ctrl.getRecruiterActivityLogCtrl);

// ── Season Lifecycle ───────────────────────────────────────
router.put('/seasons/:id/status', authorize('placement', 'update'), validate(transitionSeasonSchema), ctrl.transitionSeasonCtrl);
router.get('/seasons/:id/statistics', authorize('placement', 'read'), ctrl.getSeasonStatisticsCtrl);

// ── Drives ─────────────────────────────────────────────────
router.get('/drives', authorize('placement', 'read'), ctrl.listDrivesCtrl);
router.get('/drives/:id', authorize('placement', 'read'), ctrl.getDriveCtrl);
router.post('/drives', authorize('placement', 'create'), validate(createDriveSchema_wf), ctrl.createDriveCtrl);
router.put('/drives/:id/status', authorize('placement', 'update'), validate(transitionDriveSchema), ctrl.transitionDriveCtrl);
router.post('/drives/:id/cancel', authorize('placement', 'update'), validate(cancelDriveSchema), ctrl.cancelDriveCtrl);
router.get('/drives/:id/applications', authorize('placement', 'read'), ctrl.listDriveApplicationsCtrl);
router.post('/drives/:id/applications', authorize('placement', 'create'), validate(applyToDriveSchema), ctrl.applyToDriveCtrl);
router.post('/drives/:id/generate-shortlist', authorize('placement', 'update'), ctrl.generateShortlistCtrl);
router.put('/drives/:id/release-shortlist', authorize('placement', 'update'), ctrl.releaseShortlistCtrl);
router.get('/drives/:id/interview-schedules', authorize('placement', 'read'), ctrl.listInterviewSchedulesCtrl);
router.post('/drives/:id/schedule-interviews', authorize('placement', 'create'), validate(scheduleInterviewsSchema), ctrl.scheduleInterviewsCtrl);
router.put('/drives/:id/close', authorize('placement', 'update'), ctrl.closeDriveCtrl);

// ── Drive Applications (by id) ─────────────────────────────
router.get('/drive-applications/:id', authorize('placement', 'read'), ctrl.getDriveApplicationCtrl);
router.post('/drive-applications/:id/withdraw', authorize('placement', 'update'), validate(withdrawApplicationSchema), ctrl.withdrawApplicationCtrl);

// ── Interview Schedules (by id) ─────────────────────────────
router.get('/interview-schedules/:id', authorize('placement', 'read'), ctrl.getInterviewScheduleCtrl);
router.put('/interview-schedules/:id/outcome', authorize('placement', 'update'), validate(updateInterviewOutcomeSchema), ctrl.updateInterviewOutcomeCtrl);

// ── Eligibility + Dream Policy ─────────────────────────────
router.post('/drives/:id/check-eligibility', authorize('placement', 'read'), validate(checkEligibilitySchema), ctrl.checkEligibilityCtrl);

// ── Placement Bars ─────────────────────────────────────────
router.get('/placement-bars', authorize('placement', 'read'), ctrl.listPlacementBarsCtrl);
router.post('/placement-bars', authorize('placement', 'create'), validate(applyPlacementBarSchema), ctrl.applyPlacementBarCtrl);
router.put('/placement-bars/:id/lift', authorize('placement', 'update'), validate(liftPlacementBarSchema), ctrl.liftPlacementBarCtrl);

// ── Opt-Outs ───────────────────────────────────────────────
router.get('/opt-outs', authorize('placement', 'read'), ctrl.listOptOutsCtrl);
router.post('/opt-outs', authorize('placement', 'create'), validate(recordOptOutSchema), ctrl.recordOptOutCtrl);
router.put('/opt-outs/:id/void', authorize('placement', 'update'), validate(voidOptOutSchema), ctrl.voidOptOutCtrl);

// ── Career Profiles ────────────────────────────────────────
router.get('/career-profiles', authorize('placement', 'read'), ctrl.listCareerProfilesCtrl);
router.get('/career-profiles/:id', authorize('placement', 'read'), ctrl.getCareerProfileCtrl);
router.post('/seasons/:id/init-career-profiles', authorize('placement', 'create'), validate(initCareerProfilesSchema), ctrl.initCareerProfilesCtrl);
router.put('/career-profiles/:id', authorize('placement', 'update'), validate(updateCareerProfileSchema_wf), ctrl.updateCareerProfileCtrl);
router.post('/career-profiles/:id/validate-item', authorize('placement', 'update'), validate(validateProfileItemSchema), ctrl.validateProfileItemCtrl);
router.post('/career-profiles/:id/refresh-academic', authorize('placement', 'update'), validate(refreshAcademicDataSchema), ctrl.refreshAcademicDataCtrl);

// ── Readiness Scores ───────────────────────────────────────
router.get('/readiness-scores', authorize('placement', 'read'), ctrl.listReadinessScoresCtrl);
router.post('/readiness-scores/compute-batch', authorize('placement', 'create'), validate(computeBatchReadinessSchema), ctrl.computeBatchReadinessCtrl);
router.get('/readiness-scores/:studentId', authorize('placement', 'read'), ctrl.getReadinessScoreCtrl);

// ── Skill Records ──────────────────────────────────────────
router.get('/skill-records', authorize('placement', 'read'), ctrl.listSkillRecordsCtrl);
router.post('/skill-records', authorize('placement', 'create'), validate(createSkillRecordSchema), ctrl.createSkillRecordCtrl);
router.post('/skill-records/ingest-external', authorize('placement', 'create'), validate(ingestExternalAssessmentSchema), ctrl.ingestExternalAssessmentCtrl);
router.get('/skill-records/:id', authorize('placement', 'read'), ctrl.getSkillRecordCtrl);
router.put('/skill-records/:id', authorize('placement', 'update'), validate(updateSkillRecordSchema), ctrl.updateSkillRecordCtrl);
router.delete('/skill-records/:id', authorize('placement', 'delete'), ctrl.deleteSkillRecordCtrl);

// ── Training Workflow ──────────────────────────────────────
router.put('/trainings/:id/session', authorize('placement', 'update'), validate(updateTrainingSessionSchema_wf), ctrl.updateTrainingSessionCtrl);
router.post('/trainings/assessment', authorize('placement', 'create'), validate(recordTrainingAssessmentSchema), ctrl.recordTrainingAssessmentCtrl);
router.get('/trainings/:id/completion-stats', authorize('placement', 'read'), ctrl.getTrainingCompletionStatsCtrl);

// ── Alumni Career Records ──────────────────────────────────
router.get('/alumni-career-records', authorize('placement', 'read'), ctrl.listAlumniCareerRecordsCtrl);
router.post('/alumni-career-records', authorize('placement', 'create'), validate(initAlumniCareerRecordSchema), ctrl.initAlumniCareerRecordCtrl);
router.post('/alumni-career-records/batch-init', authorize('placement', 'create'), validate(batchInitAlumniSchema), ctrl.batchInitAlumniCtrl);
router.get('/alumni-career-records/:id', authorize('placement', 'read'), ctrl.getAlumniCareerRecordCtrl);
router.put('/alumni-career-records/:id', authorize('placement', 'update'), validate(updateAlumniCareerRecordSchema), ctrl.updateAlumniCareerRecordCtrl);
router.get('/alumni-analytics', authorize('placement', 'read'), ctrl.getAlumniAnalyticsCtrl);

export default router;
