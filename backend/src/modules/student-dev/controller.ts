import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';
import * as orgService from './org-service';
import * as evtService from './evt-service';
import * as achService from './ach-service';
import * as budService from './bud-service';
import * as portService from './port-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Club ══════════════════════════════════════════════════

export async function listClubs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, type } = req.query as any;
    res.json(await service.listClubs(req.collegeId!, Number(page) || 1, Number(limit) || 20, type, req.authScope));
  } catch (err) { next(err); }
}
export async function getClub(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getClub(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createClub(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createClub(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateClub(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateClub(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteClub(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteClub(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Club Membership ═══════════════════════════════════════

export async function listClubMemberships(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, clubId, status } = req.query as any;
    res.json(await service.listClubMemberships(req.collegeId!, Number(page) || 1, Number(limit) || 20, clubId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getClubMembership(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getClubMembership(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createClubMembership(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createClubMembership(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateClubMembership(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateClubMembership(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteClubMembership(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteClubMembership(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Event ═════════════════════════════════════════════════

export async function listEvents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, type, status } = req.query as any;
    res.json(await service.listEvents(req.collegeId!, Number(page) || 1, Number(limit) || 20, type, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getEvent(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEvent(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEvent(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEvent(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Event Registration ════════════════════════════════════

export async function listEventRegistrations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, eventId, status } = req.query as any;
    res.json(await service.listEventRegistrations(req.collegeId!, Number(page) || 1, Number(limit) || 20, eventId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getEventRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getEventRegistration(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEventRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEventRegistration(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEventRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEventRegistration(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEventRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEventRegistration(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Achievement ═══════════════════════════════════════════

export async function listAchievements(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, category, level } = req.query as any;
    res.json(await service.listAchievements(req.collegeId!, Number(page) || 1, Number(limit) || 20, category, level, req.authScope));
  } catch (err) { next(err); }
}
export async function getAchievement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAchievement(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAchievement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAchievement(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAchievement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAchievement(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAchievement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAchievement(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Mentoring ═════════════════════════════════════════════

export async function listMentoringSessions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listMentoringSessions(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getMentoringSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getMentoringSession(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMentoringSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMentoringSession(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMentoringSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateMentoringSession(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMentoringSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteMentoringSession(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Sports Team ═══════════════════════════════════════════

export async function listSportsTeams(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, category } = req.query as any;
    res.json(await service.listSportsTeams(req.collegeId!, Number(page) || 1, Number(limit) || 20, category, req.authScope));
  } catch (err) { next(err); }
}
export async function getSportsTeam(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getSportsTeam(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSportsTeam(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createSportsTeam(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSportsTeam(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateSportsTeam(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSportsTeam(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteSportsTeam(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Sports Team Member ════════════════════════════════════

export async function listSportsTeamMembers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, teamId } = req.query as any;
    res.json(await service.listSportsTeamMembers(req.collegeId!, Number(page) || 1, Number(limit) || 20, teamId, req.authScope));
  } catch (err) { next(err); }
}
export async function getSportsTeamMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getSportsTeamMember(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSportsTeamMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createSportsTeamMember(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSportsTeamMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateSportsTeamMember(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSportsTeamMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteSportsTeamMember(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ NSS Activity ══════════════════════════════════════════

export async function listNSSActivities(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, type, status } = req.query as any;
    res.json(await service.listNSSActivities(req.collegeId!, Number(page) || 1, Number(limit) || 20, type, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getNSSActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getNSSActivity(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createNSSActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createNSSActivity(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateNSSActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateNSSActivity(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteNSSActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteNSSActivity(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ NSS Participant ═══════════════════════════════════════

export async function listNSSParticipants(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, activityId } = req.query as any;
    res.json(await service.listNSSParticipants(req.collegeId!, Number(page) || 1, Number(limit) || 20, activityId, req.authScope));
  } catch (err) { next(err); }
}
export async function getNSSParticipant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getNSSParticipant(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createNSSParticipant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createNSSParticipant(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateNSSParticipant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateNSSParticipant(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteNSSParticipant(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteNSSParticipant(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Skill Certification ══════════════════════════════════

export async function listSkillCertifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, provider } = req.query as any;
    res.json(await service.listSkillCertifications(req.collegeId!, Number(page) || 1, Number(limit) || 20, provider, req.authScope));
  } catch (err) { next(err); }
}
export async function getSkillCertification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getSkillCertification(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSkillCertification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createSkillCertification(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSkillCertification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateSkillCertification(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSkillCertification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteSkillCertification(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Student Project ═══════════════════════════════════════

export async function listStudentProjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, type, status } = req.query as any;
    res.json(await service.listStudentProjects(req.collegeId!, Number(page) || 1, Number(limit) || 20, type, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getStudentProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStudentProject(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createStudentProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createStudentProject(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateStudentProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateStudentProject(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteStudentProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteStudentProject(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Community Project ════════════════════════════════════

export async function listCommunityProjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listCommunityProjects(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getCommunityProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getCommunityProject(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCommunityProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCommunityProject(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCommunityProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateCommunityProject(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteCommunityProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteCommunityProject(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Leadership Role ══════════════════════════════════════

export async function listLeadershipRoles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, body } = req.query as any;
    res.json(await service.listLeadershipRoles(req.collegeId!, Number(page) || 1, Number(limit) || 20, body, req.authScope));
  } catch (err) { next(err); }
}
export async function getLeadershipRole(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getLeadershipRole(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLeadershipRole(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLeadershipRole(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLeadershipRole(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateLeadershipRole(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLeadershipRole(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteLeadershipRole(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════════
// W09 Workflow Controllers
// ═══════════════════════════════════════════════════════════════

// ─── ORG: Club Lifecycle ────────────────────────────────────

export async function proposeClubCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await orgService.proposeClub(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveClubCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await orgService.approveClub(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function rejectClubCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await orgService.rejectClub(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function openRegistrationWindowCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await orgService.openRegistrationWindow(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function getClubRecommendationsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await orgService.getClubRecommendations(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}
export async function applyForMembershipCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await orgService.applyForMembership(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function openElectionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await orgService.openElection(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function castVoteCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await orgService.castVote(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function appointPositionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await orgService.appointPosition(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function transitionMembershipStatusCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await orgService.transitionMembershipStatus(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getClubHealthReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await orgService.getClubHealthReport(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function submitAnnualReviewCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await orgService.submitAnnualReview(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function dissolveClubCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await orgService.dissolveClub(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// ─── EVT: Fests ─────────────────────────────────────────────

export async function listFestsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await evtService.listFests(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getFestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.getFest(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function proposeFestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evtService.proposeFest(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveFestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.approveFest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function rejectFestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.rejectFest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFestLogisticsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.updateFestLogistics(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function closeFestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.closeFest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function cancelFestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.cancelFest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function postponeFestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.postponeFest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// ─── EVT: Competitions ──────────────────────────────────────

export async function listCompetitionsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status, parentType } = req.query as any;
    res.json(await evtService.listCompetitions(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, parentType));
  } catch (err) { next(err); }
}
export async function getCompetitionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.getCompetition(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function proposeCompetitionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evtService.proposeCompetition(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveCompetitionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.approveCompetition(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function registerForCompetitionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evtService.registerForCompetition(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function checkInCompetitionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.checkInCompetition(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function declareCompetitionResultsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.declareCompetitionResults(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function closeCompetitionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.closeCompetition(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── EVT: Workshops ─────────────────────────────────────────

export async function listWorkshopsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await evtService.listWorkshops(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getWorkshopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.getWorkshop(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function proposeWorkshopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evtService.proposeWorkshop(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveWorkshopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.approveWorkshop(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function registerForWorkshopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evtService.registerForWorkshop(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function checkInWorkshopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.checkInWorkshop(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function completeWorkshopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.completeWorkshop(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── EVT: Programmes / Calendar ─────────────────────────────

export async function listSDProgrammesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, type } = req.query as any;
    res.json(await evtService.listSDProgrammes(req.collegeId!, Number(page) || 1, Number(limit) || 20, type));
  } catch (err) { next(err); }
}
export async function getSDProgrammeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.getSDProgramme(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSDProgrammeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evtService.createSDProgramme(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function enrollInProgrammeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evtService.enrollInProgramme(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function logProgrammeHoursCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evtService.logProgrammeHours(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getEventCalendarCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = req.query as any;
    res.json(await evtService.getEventCalendar(req.collegeId!, { startDate, endDate }));
  } catch (err) { next(err); }
}

// ─── ACH: Achievement Verification ─────────────────────────

export async function autoCaptureAchievementCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await achService.autoCaptureAchievement(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function claimExternalAchievementCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await achService.claimExternalAchievement(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function verifyAchievementCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.verifyAchievement(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function rejectAchievementCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.rejectAchievement(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function syncExternalAchievementsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.syncExternalAchievements(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// ─── ACH: Awards ────────────────────────────────────────────

export async function listAwardsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, category } = req.query as any;
    res.json(await achService.listAwards(req.collegeId!, Number(page) || 1, Number(limit) || 20, category));
  } catch (err) { next(err); }
}
export async function getAwardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.getAward(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAwardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await achService.createAward(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAwardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.updateAward(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAwardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.deleteAward(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── ACH: Award Instances ───────────────────────────────────

export async function listAwardInstancesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, awardId, status } = req.query as any;
    res.json(await achService.listAwardInstances(req.collegeId!, Number(page) || 1, Number(limit) || 20, awardId, status));
  } catch (err) { next(err); }
}
export async function getAwardInstanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.getAwardInstance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function nominateForAwardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await achService.nominateForAward(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function conferAwardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.conferAward(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// ─── ACH: Certificates ─────────────────────────────────────

export async function listCertificatesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, type } = req.query as any;
    res.json(await achService.listCertificates(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, type));
  } catch (err) { next(err); }
}
export async function getCertificateCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.getCertificate(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function generateCertificateCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await achService.generateCertificate(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function issueCertificateCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.issueCertificate(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function revokeCertificateCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await achService.revokeCertificate(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── BUD: Activity Budgets ──────────────────────────────────

export async function listActivityBudgetsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status, entityType } = req.query as any;
    res.json(await budService.listActivityBudgets(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, entityType));
  } catch (err) { next(err); }
}
export async function getActivityBudgetCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.getActivityBudget(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function requestBudgetCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await budService.requestBudget(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveBudgetCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.approveBudget(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function rejectBudgetCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.rejectBudget(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getUtilisationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.getUtilisation(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function recordExpenseCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.recordExpense(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function reconcileBudgetCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.reconcileBudget(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function allocateActivityFeePoolCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await budService.allocateActivityFeePool(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// ─── BUD: Budget Line Items ────────────────────────────────

export async function listBudgetLineItemsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as any;
    res.json(await budService.listBudgetLineItems(req.collegeId!, req.params.budgetId as string, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}
export async function getBudgetLineItemCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.getBudgetLineItem(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createBudgetLineItemCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await budService.createBudgetLineItem(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateBudgetLineItemCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.updateBudgetLineItem(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteBudgetLineItemCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.deleteBudgetLineItem(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── BUD: Sponsor Contacts ─────────────────────────────────

export async function listSponsorContactsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, company } = req.query as any;
    res.json(await budService.listSponsorContacts(req.collegeId!, Number(page) || 1, Number(limit) || 20, company));
  } catch (err) { next(err); }
}
export async function getSponsorContactCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.getSponsorContact(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSponsorContactCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await budService.createSponsorContact(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSponsorContactCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.updateSponsorContact(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSponsorContactCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.deleteSponsorContact(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── BUD: Sponsorships ──────────────────────────────────────

export async function listSponsorshipsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, eventType, status } = req.query as any;
    res.json(await budService.listSponsorships(req.collegeId!, Number(page) || 1, Number(limit) || 20, eventType, status));
  } catch (err) { next(err); }
}
export async function getSponsorshipCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.getSponsorship(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSponsorshipCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await budService.createSponsorship(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSponsorshipStatusCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.updateSponsorshipStatus(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSponsorshipCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await budService.deleteSponsorship(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── PORT: Portfolio ────────────────────────────────────────

export async function getMyPortfolioCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const studentId = (req.user as any)?.studentId || (req.query as any).studentId;
    res.json(await portService.getMyPortfolio(req.collegeId!, studentId));
  } catch (err) { next(err); }
}
export async function getStudentPortfolioCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await portService.getStudentPortfolio(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}
export async function assemblePortfolioCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await portService.assemblePortfolio(req.collegeId!, req.body.studentId, who(req))); } catch (err) { next(err); }
}
export async function listPortfolioEntriesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, portfolioId } = req.query as any;
    const pId = req.params.portfolioId || portfolioId;
    res.json(await portService.listPortfolioEntries(req.collegeId!, pId, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}
export async function getPortfolioEntryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await portService.getPortfolioEntry(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function updatePortfolioEntryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await portService.updatePortfolioEntry(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function addManualEntryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await portService.addManualEntry(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function publishPortfolioCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await portService.publishPortfolio(req.collegeId!, req.body.studentId, who(req))); } catch (err) { next(err); }
}
export async function unpublishPortfolioCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await portService.unpublishPortfolio(req.collegeId!, req.body.studentId, who(req))); } catch (err) { next(err); }
}
export async function getCompletenessCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await portService.getCompletenessAndGaps(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}
export async function finalisePortfolioCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await portService.finalisePortfolio(req.collegeId!, req.params.studentId as string, who(req))); } catch (err) { next(err); }
}
