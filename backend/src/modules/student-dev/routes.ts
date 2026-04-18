import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createClubSchema, updateClubSchema,
  createClubMembershipSchema, updateClubMembershipSchema,
  createEventSchema, updateEventSchema,
  createEventRegistrationSchema, updateEventRegistrationSchema,
  createAchievementSchema, updateAchievementSchema,
  createMentoringSchema, updateMentoringSchema,
  createSportsTeamSchema, updateSportsTeamSchema,
  createSportsTeamMemberSchema, updateSportsTeamMemberSchema,
  createNSSActivitySchema, updateNSSActivitySchema,
  createNSSParticipantSchema, updateNSSParticipantSchema,
  createSkillCertificationSchema, updateSkillCertificationSchema,
  createStudentProjectSchema, updateStudentProjectSchema,
  createCommunityProjectSchema, updateCommunityProjectSchema,
  createLeadershipRoleSchema, updateLeadershipRoleSchema,
  // W09 Workflow schemas
  proposeClubSchema, approveClubWfSchema, rejectClubWfSchema,
  openRegistrationWindowSchema, applyForMembershipSchema,
  openElectionSchema, castVoteSchema, appointPositionSchema,
  transitionMembershipStatusSchema, submitAnnualReviewSchema, dissolveClubSchema,
  proposeFestSchema, approveFestSchema, rejectFestSchema,
  updateFestLogisticsSchema, closeFestSchema, cancelFestSchema, postponeFestSchema,
  proposeCompetitionSchema, approveCompetitionSchema,
  registerForCompetitionSchema, checkInSchema, declareResultsSchema,
  proposeWorkshopSchema, approveWorkshopSchema, registerForWorkshopSchema,
  createSDProgrammeSchema, enrollInProgrammeSchema, logProgrammeHoursSchema,
  autoCaptureAchievementSchema, claimExternalAchievementSchema,
  verifyAchievementSchema_wf, rejectAchievementSchema_wf, syncExternalAchievementsSchema,
  createAwardSchema, updateAwardSchema, nominateForAwardSchema, conferAwardSchema,
  generateCertificateSchema, issueCertificateSchema,
  requestBudgetSchema, approveBudgetSchema, rejectBudgetSchema,
  recordExpenseSchema, reconcileBudgetSchema, allocateActivityFeePoolSchema,
  createBudgetLineItemSchema, updateBudgetLineItemSchema,
  createSponsorContactSchema, updateSponsorContactSchema,
  createSponsorshipSchema, updateSponsorshipStatusSchema,
  assemblePortfolioSchema, updatePortfolioEntrySchema_wf, addManualEntrySchema,
  publishPortfolioSchema, unpublishPortfolioSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('student-dev', 'read'), ctrl.dashboardStats);

// Clubs — workflow routes (specific paths before parameterized :id)
router.post('/clubs/propose', authorize('student-dev', 'create'), validate(proposeClubSchema), ctrl.proposeClubCtrl);
router.post('/clubs/registration-window', authorize('student-dev', 'create'), validate(openRegistrationWindowSchema), ctrl.openRegistrationWindowCtrl);
router.get('/clubs/recommendations/:studentId', authorize('student-dev', 'read'), ctrl.getClubRecommendationsCtrl);
// Clubs — CRUD
router.get('/clubs', authorize('student-dev', 'read'), ctrl.listClubs);
router.get('/clubs/:id', authorize('student-dev', 'read'), ctrl.getClub);
router.post('/clubs', authorize('student-dev', 'create'), validate(createClubSchema), ctrl.createClub);
router.put('/clubs/:id', authorize('student-dev', 'update'), validate(updateClubSchema), ctrl.updateClub);
router.delete('/clubs/:id', authorize('student-dev', 'delete'), ctrl.deleteClub);
// Clubs — workflow routes on :id
router.post('/clubs/:id/approve', authorize('student-dev', 'update'), validate(approveClubWfSchema), ctrl.approveClubCtrl);
router.post('/clubs/:id/reject', authorize('student-dev', 'update'), validate(rejectClubWfSchema), ctrl.rejectClubCtrl);
router.post('/clubs/:id/elections', authorize('student-dev', 'create'), validate(openElectionSchema), ctrl.openElectionCtrl);
router.post('/clubs/:id/elections/:electionId/vote', authorize('student-dev', 'create'), validate(castVoteSchema), ctrl.castVoteCtrl);
router.post('/clubs/:id/appoint', authorize('student-dev', 'update'), validate(appointPositionSchema), ctrl.appointPositionCtrl);
router.get('/clubs/:id/health-report', authorize('student-dev', 'read'), ctrl.getClubHealthReportCtrl);
router.post('/clubs/:id/review', authorize('student-dev', 'update'), validate(submitAnnualReviewSchema), ctrl.submitAnnualReviewCtrl);
router.post('/clubs/:id/dissolve', authorize('student-dev', 'update'), validate(dissolveClubSchema), ctrl.dissolveClubCtrl);

// Club Memberships — workflow routes (specific paths before parameterized :id)
router.post('/club-memberships/apply', authorize('student-dev', 'create'), validate(applyForMembershipSchema), ctrl.applyForMembershipCtrl);
// Club Memberships — CRUD
router.get('/club-memberships', authorize('student-dev', 'read'), ctrl.listClubMemberships);
router.get('/club-memberships/:id', authorize('student-dev', 'read'), ctrl.getClubMembership);
router.post('/club-memberships', authorize('student-dev', 'create'), validate(createClubMembershipSchema), ctrl.createClubMembership);
router.put('/club-memberships/:id', authorize('student-dev', 'update'), validate(updateClubMembershipSchema), ctrl.updateClubMembership);
router.delete('/club-memberships/:id', authorize('student-dev', 'delete'), ctrl.deleteClubMembership);
// Club Memberships — workflow routes on :id
router.patch('/club-memberships/:id/status', authorize('student-dev', 'update'), validate(transitionMembershipStatusSchema), ctrl.transitionMembershipStatusCtrl);

// Events — workflow routes (specific paths before parameterized :id)
router.get('/events/calendar', authorize('student-dev', 'read'), ctrl.getEventCalendarCtrl);
// Events — CRUD
router.get('/events', authorize('student-dev', 'read'), ctrl.listEvents);
router.get('/events/:id', authorize('student-dev', 'read'), ctrl.getEvent);
router.post('/events', authorize('student-dev', 'create'), validate(createEventSchema), ctrl.createEvent);
router.put('/events/:id', authorize('student-dev', 'update'), validate(updateEventSchema), ctrl.updateEvent);
router.delete('/events/:id', authorize('student-dev', 'delete'), ctrl.deleteEvent);

// Event Registrations
router.get('/event-registrations', authorize('student-dev', 'read'), ctrl.listEventRegistrations);
router.get('/event-registrations/:id', authorize('student-dev', 'read'), ctrl.getEventRegistration);
router.post('/event-registrations', authorize('student-dev', 'create'), validate(createEventRegistrationSchema), ctrl.createEventRegistration);
router.put('/event-registrations/:id', authorize('student-dev', 'update'), validate(updateEventRegistrationSchema), ctrl.updateEventRegistration);
router.delete('/event-registrations/:id', authorize('student-dev', 'delete'), ctrl.deleteEventRegistration);

// Achievements — workflow routes (specific paths before parameterized :id)
router.post('/achievements/auto-capture', authorize('student-dev', 'create'), validate(autoCaptureAchievementSchema), ctrl.autoCaptureAchievementCtrl);
router.post('/achievements/claim', authorize('student-dev', 'create'), validate(claimExternalAchievementSchema), ctrl.claimExternalAchievementCtrl);
router.post('/achievements/sync-external', authorize('student-dev', 'create'), validate(syncExternalAchievementsSchema), ctrl.syncExternalAchievementsCtrl);
// Achievements — CRUD
router.get('/achievements', authorize('student-dev', 'read'), ctrl.listAchievements);
router.get('/achievements/:id', authorize('student-dev', 'read'), ctrl.getAchievement);
router.post('/achievements', authorize('student-dev', 'create'), validate(createAchievementSchema), ctrl.createAchievement);
router.put('/achievements/:id', authorize('student-dev', 'update'), validate(updateAchievementSchema), ctrl.updateAchievement);
router.delete('/achievements/:id', authorize('student-dev', 'delete'), ctrl.deleteAchievement);
// Achievements — workflow routes on :id
router.post('/achievements/:id/verify', authorize('student-dev', 'update'), validate(verifyAchievementSchema_wf), ctrl.verifyAchievementCtrl);
router.post('/achievements/:id/reject', authorize('student-dev', 'update'), validate(rejectAchievementSchema_wf), ctrl.rejectAchievementCtrl);

// Mentoring
router.get('/mentoring', authorize('student-dev', 'read'), ctrl.listMentoringSessions);
router.get('/mentoring/:id', authorize('student-dev', 'read'), ctrl.getMentoringSession);
router.post('/mentoring', authorize('student-dev', 'create'), validate(createMentoringSchema), ctrl.createMentoringSession);
router.put('/mentoring/:id', authorize('student-dev', 'update'), validate(updateMentoringSchema), ctrl.updateMentoringSession);
router.delete('/mentoring/:id', authorize('student-dev', 'delete'), ctrl.deleteMentoringSession);

// Sports Teams
router.get('/sports-teams', authorize('student-dev', 'read'), ctrl.listSportsTeams);
router.get('/sports-teams/:id', authorize('student-dev', 'read'), ctrl.getSportsTeam);
router.post('/sports-teams', authorize('student-dev', 'create'), validate(createSportsTeamSchema), ctrl.createSportsTeam);
router.put('/sports-teams/:id', authorize('student-dev', 'update'), validate(updateSportsTeamSchema), ctrl.updateSportsTeam);
router.delete('/sports-teams/:id', authorize('student-dev', 'delete'), ctrl.deleteSportsTeam);

// Sports Team Members
router.get('/sports-team-members', authorize('student-dev', 'read'), ctrl.listSportsTeamMembers);
router.get('/sports-team-members/:id', authorize('student-dev', 'read'), ctrl.getSportsTeamMember);
router.post('/sports-team-members', authorize('student-dev', 'create'), validate(createSportsTeamMemberSchema), ctrl.createSportsTeamMember);
router.put('/sports-team-members/:id', authorize('student-dev', 'update'), validate(updateSportsTeamMemberSchema), ctrl.updateSportsTeamMember);
router.delete('/sports-team-members/:id', authorize('student-dev', 'delete'), ctrl.deleteSportsTeamMember);

// NSS Activities
router.get('/nss-activities', authorize('student-dev', 'read'), ctrl.listNSSActivities);
router.get('/nss-activities/:id', authorize('student-dev', 'read'), ctrl.getNSSActivity);
router.post('/nss-activities', authorize('student-dev', 'create'), validate(createNSSActivitySchema), ctrl.createNSSActivity);
router.put('/nss-activities/:id', authorize('student-dev', 'update'), validate(updateNSSActivitySchema), ctrl.updateNSSActivity);
router.delete('/nss-activities/:id', authorize('student-dev', 'delete'), ctrl.deleteNSSActivity);

// NSS Participants
router.get('/nss-participants', authorize('student-dev', 'read'), ctrl.listNSSParticipants);
router.get('/nss-participants/:id', authorize('student-dev', 'read'), ctrl.getNSSParticipant);
router.post('/nss-participants', authorize('student-dev', 'create'), validate(createNSSParticipantSchema), ctrl.createNSSParticipant);
router.put('/nss-participants/:id', authorize('student-dev', 'update'), validate(updateNSSParticipantSchema), ctrl.updateNSSParticipant);
router.delete('/nss-participants/:id', authorize('student-dev', 'delete'), ctrl.deleteNSSParticipant);

// Skill Certifications
router.get('/skill-certifications', authorize('student-dev', 'read'), ctrl.listSkillCertifications);
router.get('/skill-certifications/:id', authorize('student-dev', 'read'), ctrl.getSkillCertification);
router.post('/skill-certifications', authorize('student-dev', 'create'), validate(createSkillCertificationSchema), ctrl.createSkillCertification);
router.put('/skill-certifications/:id', authorize('student-dev', 'update'), validate(updateSkillCertificationSchema), ctrl.updateSkillCertification);
router.delete('/skill-certifications/:id', authorize('student-dev', 'delete'), ctrl.deleteSkillCertification);

// Student Projects
router.get('/student-projects', authorize('student-dev', 'read'), ctrl.listStudentProjects);
router.get('/student-projects/:id', authorize('student-dev', 'read'), ctrl.getStudentProject);
router.post('/student-projects', authorize('student-dev', 'create'), validate(createStudentProjectSchema), ctrl.createStudentProject);
router.put('/student-projects/:id', authorize('student-dev', 'update'), validate(updateStudentProjectSchema), ctrl.updateStudentProject);
router.delete('/student-projects/:id', authorize('student-dev', 'delete'), ctrl.deleteStudentProject);

// Community Projects
router.get('/community-projects', authorize('student-dev', 'read'), ctrl.listCommunityProjects);
router.get('/community-projects/:id', authorize('student-dev', 'read'), ctrl.getCommunityProject);
router.post('/community-projects', authorize('student-dev', 'create'), validate(createCommunityProjectSchema), ctrl.createCommunityProject);
router.put('/community-projects/:id', authorize('student-dev', 'update'), validate(updateCommunityProjectSchema), ctrl.updateCommunityProject);
router.delete('/community-projects/:id', authorize('student-dev', 'delete'), ctrl.deleteCommunityProject);

// Leadership Roles
router.get('/leadership-roles', authorize('student-dev', 'read'), ctrl.listLeadershipRoles);
router.get('/leadership-roles/:id', authorize('student-dev', 'read'), ctrl.getLeadershipRole);
router.post('/leadership-roles', authorize('student-dev', 'create'), validate(createLeadershipRoleSchema), ctrl.createLeadershipRole);
router.put('/leadership-roles/:id', authorize('student-dev', 'update'), validate(updateLeadershipRoleSchema), ctrl.updateLeadershipRole);
router.delete('/leadership-roles/:id', authorize('student-dev', 'delete'), ctrl.deleteLeadershipRole);

// ═══ W09 Workflow Routes ═══════════════════════════════════

// ── EVT: Fests ─────────────────────────────────────────────
router.get('/fests', authorize('student-dev', 'read'), ctrl.listFestsCtrl);
router.post('/fests/propose', authorize('student-dev', 'create'), validate(proposeFestSchema), ctrl.proposeFestCtrl);
router.get('/fests/:id', authorize('student-dev', 'read'), ctrl.getFestCtrl);
router.post('/fests/:id/approve', authorize('student-dev', 'update'), validate(approveFestSchema), ctrl.approveFestCtrl);
router.post('/fests/:id/reject', authorize('student-dev', 'update'), validate(rejectFestSchema), ctrl.rejectFestCtrl);
router.put('/fests/:id/logistics', authorize('student-dev', 'update'), validate(updateFestLogisticsSchema), ctrl.updateFestLogisticsCtrl);
router.post('/fests/:id/close', authorize('student-dev', 'update'), validate(closeFestSchema), ctrl.closeFestCtrl);
router.post('/fests/:id/cancel', authorize('student-dev', 'update'), validate(cancelFestSchema), ctrl.cancelFestCtrl);
router.post('/fests/:id/postpone', authorize('student-dev', 'update'), validate(postponeFestSchema), ctrl.postponeFestCtrl);

// ── EVT: Competitions ──────────────────────────────────────
router.get('/competitions', authorize('student-dev', 'read'), ctrl.listCompetitionsCtrl);
router.post('/competitions/propose', authorize('student-dev', 'create'), validate(proposeCompetitionSchema), ctrl.proposeCompetitionCtrl);
router.get('/competitions/:id', authorize('student-dev', 'read'), ctrl.getCompetitionCtrl);
router.post('/competitions/:id/approve', authorize('student-dev', 'update'), validate(approveCompetitionSchema), ctrl.approveCompetitionCtrl);
router.post('/competitions/:id/register', authorize('student-dev', 'create'), validate(registerForCompetitionSchema), ctrl.registerForCompetitionCtrl);
router.post('/competitions/:id/check-in', authorize('student-dev', 'update'), validate(checkInSchema), ctrl.checkInCompetitionCtrl);
router.post('/competitions/:id/results', authorize('student-dev', 'update'), validate(declareResultsSchema), ctrl.declareCompetitionResultsCtrl);
router.post('/competitions/:id/close', authorize('student-dev', 'update'), ctrl.closeCompetitionCtrl);

// ── EVT: Workshops ─────────────────────────────────────────
router.get('/workshops', authorize('student-dev', 'read'), ctrl.listWorkshopsCtrl);
router.post('/workshops/propose', authorize('student-dev', 'create'), validate(proposeWorkshopSchema), ctrl.proposeWorkshopCtrl);
router.get('/workshops/:id', authorize('student-dev', 'read'), ctrl.getWorkshopCtrl);
router.post('/workshops/:id/approve', authorize('student-dev', 'update'), validate(approveWorkshopSchema), ctrl.approveWorkshopCtrl);
router.post('/workshops/:id/register', authorize('student-dev', 'create'), validate(registerForWorkshopSchema), ctrl.registerForWorkshopCtrl);
router.post('/workshops/:id/check-in', authorize('student-dev', 'update'), validate(checkInSchema), ctrl.checkInWorkshopCtrl);
router.post('/workshops/:id/complete', authorize('student-dev', 'update'), ctrl.completeWorkshopCtrl);

// ── EVT: Programmes (NCC/NSS) ──────────────────────────────
router.get('/programmes', authorize('student-dev', 'read'), ctrl.listSDProgrammesCtrl);
router.get('/programmes/:id', authorize('student-dev', 'read'), ctrl.getSDProgrammeCtrl);
router.post('/programmes', authorize('student-dev', 'create'), validate(createSDProgrammeSchema), ctrl.createSDProgrammeCtrl);
router.post('/programmes/:id/enroll', authorize('student-dev', 'create'), validate(enrollInProgrammeSchema), ctrl.enrollInProgrammeCtrl);
router.post('/programmes/:id/log-hours', authorize('student-dev', 'update'), validate(logProgrammeHoursSchema), ctrl.logProgrammeHoursCtrl);

// ── ACH: Awards ────────────────────────────────────────────
router.get('/awards', authorize('student-dev', 'read'), ctrl.listAwardsCtrl);
router.get('/awards/:id', authorize('student-dev', 'read'), ctrl.getAwardCtrl);
router.post('/awards', authorize('student-dev', 'create'), validate(createAwardSchema), ctrl.createAwardCtrl);
router.put('/awards/:id', authorize('student-dev', 'update'), validate(updateAwardSchema), ctrl.updateAwardCtrl);
router.delete('/awards/:id', authorize('student-dev', 'delete'), ctrl.deleteAwardCtrl);

// ── ACH: Award Instances ───────────────────────────────────
router.get('/award-instances', authorize('student-dev', 'read'), ctrl.listAwardInstancesCtrl);
router.post('/award-instances/nominate', authorize('student-dev', 'create'), validate(nominateForAwardSchema), ctrl.nominateForAwardCtrl);
router.get('/award-instances/:id', authorize('student-dev', 'read'), ctrl.getAwardInstanceCtrl);
router.post('/award-instances/:id/confer', authorize('student-dev', 'update'), validate(conferAwardSchema), ctrl.conferAwardCtrl);

// ── ACH: Certificates ─────────────────────────────────────
router.get('/certificates', authorize('student-dev', 'read'), ctrl.listCertificatesCtrl);
router.post('/certificates/generate', authorize('student-dev', 'create'), validate(generateCertificateSchema), ctrl.generateCertificateCtrl);
router.get('/certificates/:id', authorize('student-dev', 'read'), ctrl.getCertificateCtrl);
router.post('/certificates/:id/issue', authorize('student-dev', 'update'), validate(issueCertificateSchema), ctrl.issueCertificateCtrl);
router.post('/certificates/:id/revoke', authorize('student-dev', 'update'), ctrl.revokeCertificateCtrl);

// ── BUD: Activity Budgets ──────────────────────────────────
router.get('/budgets', authorize('student-dev', 'read'), ctrl.listActivityBudgetsCtrl);
router.post('/budgets/request', authorize('student-dev', 'create'), validate(requestBudgetSchema), ctrl.requestBudgetCtrl);
router.post('/budgets/allocate-pool', authorize('student-dev', 'create'), validate(allocateActivityFeePoolSchema), ctrl.allocateActivityFeePoolCtrl);
router.get('/budgets/:id', authorize('student-dev', 'read'), ctrl.getActivityBudgetCtrl);
router.post('/budgets/:id/approve', authorize('student-dev', 'update'), validate(approveBudgetSchema), ctrl.approveBudgetCtrl);
router.post('/budgets/:id/reject', authorize('student-dev', 'update'), validate(rejectBudgetSchema), ctrl.rejectBudgetCtrl);
router.get('/budgets/:id/utilisation', authorize('student-dev', 'read'), ctrl.getUtilisationCtrl);
router.post('/budgets/:id/expense', authorize('student-dev', 'create'), validate(recordExpenseSchema), ctrl.recordExpenseCtrl);
router.post('/budgets/:id/reconcile', authorize('student-dev', 'update'), validate(reconcileBudgetSchema), ctrl.reconcileBudgetCtrl);

// ── BUD: Budget Line Items ─────────────────────────────────
router.get('/budgets/:budgetId/line-items', authorize('student-dev', 'read'), ctrl.listBudgetLineItemsCtrl);
router.get('/budget-line-items/:id', authorize('student-dev', 'read'), ctrl.getBudgetLineItemCtrl);
router.post('/budget-line-items', authorize('student-dev', 'create'), validate(createBudgetLineItemSchema), ctrl.createBudgetLineItemCtrl);
router.put('/budget-line-items/:id', authorize('student-dev', 'update'), validate(updateBudgetLineItemSchema), ctrl.updateBudgetLineItemCtrl);
router.delete('/budget-line-items/:id', authorize('student-dev', 'delete'), ctrl.deleteBudgetLineItemCtrl);

// ── BUD: Sponsor Contacts ──────────────────────────────────
router.get('/sponsor-contacts', authorize('student-dev', 'read'), ctrl.listSponsorContactsCtrl);
router.get('/sponsor-contacts/:id', authorize('student-dev', 'read'), ctrl.getSponsorContactCtrl);
router.post('/sponsor-contacts', authorize('student-dev', 'create'), validate(createSponsorContactSchema), ctrl.createSponsorContactCtrl);
router.put('/sponsor-contacts/:id', authorize('student-dev', 'update'), validate(updateSponsorContactSchema), ctrl.updateSponsorContactCtrl);
router.delete('/sponsor-contacts/:id', authorize('student-dev', 'delete'), ctrl.deleteSponsorContactCtrl);

// ── BUD: Sponsorships ──────────────────────────────────────
router.get('/sponsorships', authorize('student-dev', 'read'), ctrl.listSponsorshipsCtrl);
router.get('/sponsorships/:id', authorize('student-dev', 'read'), ctrl.getSponsorshipCtrl);
router.post('/sponsorships', authorize('student-dev', 'create'), validate(createSponsorshipSchema), ctrl.createSponsorshipCtrl);
router.patch('/sponsorships/:id/status', authorize('student-dev', 'update'), validate(updateSponsorshipStatusSchema), ctrl.updateSponsorshipStatusCtrl);
router.delete('/sponsorships/:id', authorize('student-dev', 'delete'), ctrl.deleteSponsorshipCtrl);

// ── PORT: Portfolio ────────────────────────────────────────
router.get('/portfolios/my', authorize('student-dev', 'read'), ctrl.getMyPortfolioCtrl);
router.post('/portfolios/assemble', authorize('student-dev', 'create'), validate(assemblePortfolioSchema), ctrl.assemblePortfolioCtrl);
router.post('/portfolios/publish', authorize('student-dev', 'update'), validate(publishPortfolioSchema), ctrl.publishPortfolioCtrl);
router.post('/portfolios/unpublish', authorize('student-dev', 'update'), validate(unpublishPortfolioSchema), ctrl.unpublishPortfolioCtrl);
router.get('/portfolios/:studentId', authorize('student-dev', 'read'), ctrl.getStudentPortfolioCtrl);
router.get('/portfolios/:studentId/completeness', authorize('student-dev', 'read'), ctrl.getCompletenessCtrl);
router.post('/portfolios/:studentId/finalise', authorize('student-dev', 'update'), ctrl.finalisePortfolioCtrl);
router.post('/portfolio-entries/manual', authorize('student-dev', 'create'), validate(addManualEntrySchema), ctrl.addManualEntryCtrl);
router.get('/portfolio-entries', authorize('student-dev', 'read'), ctrl.listPortfolioEntriesCtrl);
router.get('/portfolio-entries/:id', authorize('student-dev', 'read'), ctrl.getPortfolioEntryCtrl);
router.put('/portfolio-entries/:id', authorize('student-dev', 'update'), validate(updatePortfolioEntrySchema_wf), ctrl.updatePortfolioEntryCtrl);

export default router;
