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
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('student-dev', 'read'), ctrl.dashboardStats);

// Clubs
router.get('/clubs', authorize('student-dev', 'read'), ctrl.listClubs);
router.get('/clubs/:id', authorize('student-dev', 'read'), ctrl.getClub);
router.post('/clubs', authorize('student-dev', 'create'), validate(createClubSchema), ctrl.createClub);
router.put('/clubs/:id', authorize('student-dev', 'update'), validate(updateClubSchema), ctrl.updateClub);
router.delete('/clubs/:id', authorize('student-dev', 'delete'), ctrl.deleteClub);

// Club Memberships
router.get('/club-memberships', authorize('student-dev', 'read'), ctrl.listClubMemberships);
router.get('/club-memberships/:id', authorize('student-dev', 'read'), ctrl.getClubMembership);
router.post('/club-memberships', authorize('student-dev', 'create'), validate(createClubMembershipSchema), ctrl.createClubMembership);
router.put('/club-memberships/:id', authorize('student-dev', 'update'), validate(updateClubMembershipSchema), ctrl.updateClubMembership);
router.delete('/club-memberships/:id', authorize('student-dev', 'delete'), ctrl.deleteClubMembership);

// Events
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

// Achievements
router.get('/achievements', authorize('student-dev', 'read'), ctrl.listAchievements);
router.get('/achievements/:id', authorize('student-dev', 'read'), ctrl.getAchievement);
router.post('/achievements', authorize('student-dev', 'create'), validate(createAchievementSchema), ctrl.createAchievement);
router.put('/achievements/:id', authorize('student-dev', 'update'), validate(updateAchievementSchema), ctrl.updateAchievement);
router.delete('/achievements/:id', authorize('student-dev', 'delete'), ctrl.deleteAchievement);

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

export default router;
