import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
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
router.get('/stats', ctrl.dashboardStats);

// Clubs
router.get('/clubs', ctrl.listClubs);
router.get('/clubs/:id', ctrl.getClub);
router.post('/clubs', validate(createClubSchema), ctrl.createClub);
router.put('/clubs/:id', validate(updateClubSchema), ctrl.updateClub);
router.delete('/clubs/:id', ctrl.deleteClub);

// Club Memberships
router.get('/club-memberships', ctrl.listClubMemberships);
router.get('/club-memberships/:id', ctrl.getClubMembership);
router.post('/club-memberships', validate(createClubMembershipSchema), ctrl.createClubMembership);
router.put('/club-memberships/:id', validate(updateClubMembershipSchema), ctrl.updateClubMembership);
router.delete('/club-memberships/:id', ctrl.deleteClubMembership);

// Events
router.get('/events', ctrl.listEvents);
router.get('/events/:id', ctrl.getEvent);
router.post('/events', validate(createEventSchema), ctrl.createEvent);
router.put('/events/:id', validate(updateEventSchema), ctrl.updateEvent);
router.delete('/events/:id', ctrl.deleteEvent);

// Event Registrations
router.get('/event-registrations', ctrl.listEventRegistrations);
router.get('/event-registrations/:id', ctrl.getEventRegistration);
router.post('/event-registrations', validate(createEventRegistrationSchema), ctrl.createEventRegistration);
router.put('/event-registrations/:id', validate(updateEventRegistrationSchema), ctrl.updateEventRegistration);
router.delete('/event-registrations/:id', ctrl.deleteEventRegistration);

// Achievements
router.get('/achievements', ctrl.listAchievements);
router.get('/achievements/:id', ctrl.getAchievement);
router.post('/achievements', validate(createAchievementSchema), ctrl.createAchievement);
router.put('/achievements/:id', validate(updateAchievementSchema), ctrl.updateAchievement);
router.delete('/achievements/:id', ctrl.deleteAchievement);

// Mentoring
router.get('/mentoring', ctrl.listMentoringSessions);
router.get('/mentoring/:id', ctrl.getMentoringSession);
router.post('/mentoring', validate(createMentoringSchema), ctrl.createMentoringSession);
router.put('/mentoring/:id', validate(updateMentoringSchema), ctrl.updateMentoringSession);
router.delete('/mentoring/:id', ctrl.deleteMentoringSession);

// Sports Teams
router.get('/sports-teams', ctrl.listSportsTeams);
router.get('/sports-teams/:id', ctrl.getSportsTeam);
router.post('/sports-teams', validate(createSportsTeamSchema), ctrl.createSportsTeam);
router.put('/sports-teams/:id', validate(updateSportsTeamSchema), ctrl.updateSportsTeam);
router.delete('/sports-teams/:id', ctrl.deleteSportsTeam);

// Sports Team Members
router.get('/sports-team-members', ctrl.listSportsTeamMembers);
router.get('/sports-team-members/:id', ctrl.getSportsTeamMember);
router.post('/sports-team-members', validate(createSportsTeamMemberSchema), ctrl.createSportsTeamMember);
router.put('/sports-team-members/:id', validate(updateSportsTeamMemberSchema), ctrl.updateSportsTeamMember);
router.delete('/sports-team-members/:id', ctrl.deleteSportsTeamMember);

// NSS Activities
router.get('/nss-activities', ctrl.listNSSActivities);
router.get('/nss-activities/:id', ctrl.getNSSActivity);
router.post('/nss-activities', validate(createNSSActivitySchema), ctrl.createNSSActivity);
router.put('/nss-activities/:id', validate(updateNSSActivitySchema), ctrl.updateNSSActivity);
router.delete('/nss-activities/:id', ctrl.deleteNSSActivity);

// NSS Participants
router.get('/nss-participants', ctrl.listNSSParticipants);
router.get('/nss-participants/:id', ctrl.getNSSParticipant);
router.post('/nss-participants', validate(createNSSParticipantSchema), ctrl.createNSSParticipant);
router.put('/nss-participants/:id', validate(updateNSSParticipantSchema), ctrl.updateNSSParticipant);
router.delete('/nss-participants/:id', ctrl.deleteNSSParticipant);

// Skill Certifications
router.get('/skill-certifications', ctrl.listSkillCertifications);
router.get('/skill-certifications/:id', ctrl.getSkillCertification);
router.post('/skill-certifications', validate(createSkillCertificationSchema), ctrl.createSkillCertification);
router.put('/skill-certifications/:id', validate(updateSkillCertificationSchema), ctrl.updateSkillCertification);
router.delete('/skill-certifications/:id', ctrl.deleteSkillCertification);

// Student Projects
router.get('/student-projects', ctrl.listStudentProjects);
router.get('/student-projects/:id', ctrl.getStudentProject);
router.post('/student-projects', validate(createStudentProjectSchema), ctrl.createStudentProject);
router.put('/student-projects/:id', validate(updateStudentProjectSchema), ctrl.updateStudentProject);
router.delete('/student-projects/:id', ctrl.deleteStudentProject);

// Community Projects
router.get('/community-projects', ctrl.listCommunityProjects);
router.get('/community-projects/:id', ctrl.getCommunityProject);
router.post('/community-projects', validate(createCommunityProjectSchema), ctrl.createCommunityProject);
router.put('/community-projects/:id', validate(updateCommunityProjectSchema), ctrl.updateCommunityProject);
router.delete('/community-projects/:id', ctrl.deleteCommunityProject);

// Leadership Roles
router.get('/leadership-roles', ctrl.listLeadershipRoles);
router.get('/leadership-roles/:id', ctrl.getLeadershipRole);
router.post('/leadership-roles', validate(createLeadershipRoleSchema), ctrl.createLeadershipRole);
router.put('/leadership-roles/:id', validate(updateLeadershipRoleSchema), ctrl.updateLeadershipRole);
router.delete('/leadership-roles/:id', ctrl.deleteLeadershipRole);

export default router;
