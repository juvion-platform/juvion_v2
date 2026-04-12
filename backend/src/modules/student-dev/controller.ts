import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

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
