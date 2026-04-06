import { Club } from '../../models/student-dev/Club';
import { ClubMembership } from '../../models/student-dev/ClubMembership';
import { Event } from '../../models/student-dev/Event';
import { EventRegistration } from '../../models/student-dev/EventRegistration';
import { Achievement } from '../../models/student-dev/Achievement';
import { Mentoring } from '../../models/student-dev/Mentoring';
import { SportsTeam } from '../../models/student-dev/SportsTeam';
import { SportsTeamMember } from '../../models/student-dev/SportsTeamMember';
import { NSSActivity } from '../../models/student-dev/NSSActivity';
import { NSSParticipant } from '../../models/student-dev/NSSParticipant';
import { SkillCertification } from '../../models/student-dev/SkillCertification';
import { StudentProject } from '../../models/student-dev/StudentProject';
import { CommunityProject } from '../../models/student-dev/CommunityProject';
import { LeadershipRole } from '../../models/student-dev/LeadershipRole';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    clubs, activeClubs, clubMemberships, activeClubMemberships,
    events, completedEvents, eventRegistrations,
    achievements, mentoringSessions, activeMentoring,
    sportsTeams, sportsTeamMembers,
    nssActivities, completedNssActivities, nssParticipants,
    skillCertifications, studentProjects, completedProjects,
    communityProjects, leadershipRoles,
  ] = await Promise.all([
    Club.countDocuments({ collegeId }),
    Club.countDocuments({ collegeId, isActive: true }),
    ClubMembership.countDocuments({ collegeId }),
    ClubMembership.countDocuments({ collegeId, status: 'active' }),
    Event.countDocuments({ collegeId }),
    Event.countDocuments({ collegeId, status: 'completed' }),
    EventRegistration.countDocuments({ collegeId }),
    Achievement.countDocuments({ collegeId }),
    Mentoring.countDocuments({ collegeId }),
    Mentoring.countDocuments({ collegeId, status: 'active' }),
    SportsTeam.countDocuments({ collegeId }),
    SportsTeamMember.countDocuments({ collegeId }),
    NSSActivity.countDocuments({ collegeId }),
    NSSActivity.countDocuments({ collegeId, status: 'completed' }),
    NSSParticipant.countDocuments({ collegeId }),
    SkillCertification.countDocuments({ collegeId }),
    StudentProject.countDocuments({ collegeId }),
    StudentProject.countDocuments({ collegeId, status: 'completed' }),
    CommunityProject.countDocuments({ collegeId }),
    LeadershipRole.countDocuments({ collegeId }),
  ]);
  return {
    clubs, activeClubs, clubMemberships, activeClubMemberships,
    events, completedEvents, eventRegistrations,
    achievements, mentoringSessions, activeMentoring,
    sportsTeams, sportsTeamMembers,
    nssActivities, completedNssActivities, nssParticipants,
    skillCertifications, studentProjects, completedProjects,
    communityProjects, leadershipRoles,
  };
}

// ═══ Club ══════════════════════════════════════════════════

export async function listClubs(collegeId: string, page = 1, limit = 20, type?: string) {
  const filter: any = { collegeId };
  if (type) filter.type = type;
  return paginate(Club, filter, page, limit, { createdAt: -1 }, [
    { path: 'coordinatorId', populate: { path: 'personId' } },
    { path: 'facultyAdvisorId', populate: { path: 'personId' } },
  ]);
}

export async function getClub(collegeId: string, id: string) {
  const doc = await Club.findOne({ _id: id, collegeId })
    .populate({ path: 'coordinatorId', populate: { path: 'personId' } })
    .populate({ path: 'facultyAdvisorId', populate: { path: 'personId' } });
  if (!doc) throw new AppError(404, 'Club not found');
  return doc;
}

export async function createClub(collegeId: string, data: any, who: string) {
  const doc = await Club.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Club', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateClub(collegeId: string, id: string, data: any, who: string) {
  const doc = await Club.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Club not found');
  await createAuditLog({ collegeId, entityType: 'Club', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteClub(collegeId: string, id: string, who: string) {
  const doc = await Club.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Club not found');
  await createAuditLog({ collegeId, entityType: 'Club', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Club Membership ═══════════════════════════════════════

export async function listClubMemberships(collegeId: string, page = 1, limit = 20, clubId?: string, status?: string) {
  const filter: any = { collegeId };
  if (clubId) filter.clubId = clubId;
  if (status) filter.status = status;
  return paginate(ClubMembership, filter, page, limit, { createdAt: -1 }, [
    { path: 'clubId' },
    { path: 'studentId', populate: { path: 'personId' } },
  ]);
}

export async function getClubMembership(collegeId: string, id: string) {
  const doc = await ClubMembership.findOne({ _id: id, collegeId })
    .populate('clubId')
    .populate({ path: 'studentId', populate: { path: 'personId' } });
  if (!doc) throw new AppError(404, 'Club membership not found');
  return doc;
}

export async function createClubMembership(collegeId: string, data: any, who: string) {
  const doc = await ClubMembership.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ClubMembership', entityId: String(doc._id), entityName: data.role || 'member', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateClubMembership(collegeId: string, id: string, data: any, who: string) {
  const doc = await ClubMembership.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Club membership not found');
  await createAuditLog({ collegeId, entityType: 'ClubMembership', entityId: id, entityName: doc.role, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteClubMembership(collegeId: string, id: string, who: string) {
  const doc = await ClubMembership.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Club membership not found');
  await createAuditLog({ collegeId, entityType: 'ClubMembership', entityId: id, entityName: doc.role, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Event ═════════════════════════════════════════════════

export async function listEvents(collegeId: string, page = 1, limit = 20, type?: string, status?: string) {
  const filter: any = { collegeId };
  if (type) filter.type = type;
  if (status) filter.status = status;
  return paginate(Event, filter, page, limit, { startDate: -1 }, ['clubId', 'departmentId', 'coordinatorId']);
}

export async function getEvent(collegeId: string, id: string) {
  const doc = await Event.findOne({ _id: id, collegeId }).populate('clubId departmentId coordinatorId');
  if (!doc) throw new AppError(404, 'Event not found');
  return doc;
}

export async function createEvent(collegeId: string, data: any, who: string) {
  const doc = await Event.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Event', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateEvent(collegeId: string, id: string, data: any, who: string) {
  const doc = await Event.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Event not found');
  await createAuditLog({ collegeId, entityType: 'Event', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteEvent(collegeId: string, id: string, who: string) {
  const doc = await Event.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Event not found');
  await createAuditLog({ collegeId, entityType: 'Event', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Event Registration ════════════════════════════════════

export async function listEventRegistrations(collegeId: string, page = 1, limit = 20, eventId?: string, status?: string) {
  const filter: any = { collegeId };
  if (eventId) filter.eventId = eventId;
  if (status) filter.status = status;
  return paginate(EventRegistration, filter, page, limit, { registeredAt: -1 }, ['eventId', 'participantId']);
}

export async function getEventRegistration(collegeId: string, id: string) {
  const doc = await EventRegistration.findOne({ _id: id, collegeId }).populate('eventId participantId');
  if (!doc) throw new AppError(404, 'Event registration not found');
  return doc;
}

export async function createEventRegistration(collegeId: string, data: any, who: string) {
  const doc = await EventRegistration.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EventRegistration', entityId: String(doc._id), entityName: data.teamName || 'registration', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateEventRegistration(collegeId: string, id: string, data: any, who: string) {
  const doc = await EventRegistration.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Event registration not found');
  await createAuditLog({ collegeId, entityType: 'EventRegistration', entityId: id, entityName: doc.teamName || 'registration', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteEventRegistration(collegeId: string, id: string, who: string) {
  const doc = await EventRegistration.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Event registration not found');
  await createAuditLog({ collegeId, entityType: 'EventRegistration', entityId: id, entityName: doc.teamName || 'registration', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Achievement ═══════════════════════════════════════════

export async function listAchievements(collegeId: string, page = 1, limit = 20, category?: string, level?: string) {
  const filter: any = { collegeId };
  if (category) filter.category = category;
  if (level) filter.level = level;
  return paginate(Achievement, filter, page, limit, { date: -1 }, [
    { path: 'studentId', populate: { path: 'personId' } },
    { path: 'verifiedBy' },
  ]);
}

export async function getAchievement(collegeId: string, id: string) {
  const doc = await Achievement.findOne({ _id: id, collegeId })
    .populate({ path: 'studentId', populate: { path: 'personId' } })
    .populate('verifiedBy');
  if (!doc) throw new AppError(404, 'Achievement not found');
  return doc;
}

export async function createAchievement(collegeId: string, data: any, who: string) {
  const doc = await Achievement.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Achievement', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAchievement(collegeId: string, id: string, data: any, who: string) {
  const doc = await Achievement.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Achievement not found');
  await createAuditLog({ collegeId, entityType: 'Achievement', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAchievement(collegeId: string, id: string, who: string) {
  const doc = await Achievement.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Achievement not found');
  await createAuditLog({ collegeId, entityType: 'Achievement', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Mentoring ═════════════════════════════════════════════

export async function listMentoringSessions(collegeId: string, page = 1, limit = 20, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  return paginate(Mentoring, filter, page, limit, { createdAt: -1 }, [
    { path: 'mentorId', populate: { path: 'personId' } },
    { path: 'menteeId', populate: { path: 'personId' } },
    { path: 'academicYearId' },
  ]);
}

export async function getMentoringSession(collegeId: string, id: string) {
  const doc = await Mentoring.findOne({ _id: id, collegeId })
    .populate({ path: 'mentorId', populate: { path: 'personId' } })
    .populate({ path: 'menteeId', populate: { path: 'personId' } })
    .populate('academicYearId');
  if (!doc) throw new AppError(404, 'Mentoring session not found');
  return doc;
}

export async function createMentoringSession(collegeId: string, data: any, who: string) {
  const doc = await Mentoring.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Mentoring', entityId: String(doc._id), entityName: 'mentoring session', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateMentoringSession(collegeId: string, id: string, data: any, who: string) {
  const doc = await Mentoring.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Mentoring session not found');
  await createAuditLog({ collegeId, entityType: 'Mentoring', entityId: id, entityName: 'mentoring session', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteMentoringSession(collegeId: string, id: string, who: string) {
  const doc = await Mentoring.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Mentoring session not found');
  await createAuditLog({ collegeId, entityType: 'Mentoring', entityId: id, entityName: 'mentoring session', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Sports Team ═══════════════════════════════════════════

export async function listSportsTeams(collegeId: string, page = 1, limit = 20, category?: string) {
  const filter: any = { collegeId };
  if (category) filter.category = category;
  return paginate(SportsTeam, filter, page, limit, { createdAt: -1 }, [
    { path: 'coachId' },
    { path: 'captain', populate: { path: 'personId' } },
    { path: 'academicYearId' },
  ]);
}

export async function getSportsTeam(collegeId: string, id: string) {
  const doc = await SportsTeam.findOne({ _id: id, collegeId })
    .populate('coachId')
    .populate({ path: 'captain', populate: { path: 'personId' } })
    .populate('academicYearId');
  if (!doc) throw new AppError(404, 'Sports team not found');
  return doc;
}

export async function createSportsTeam(collegeId: string, data: any, who: string) {
  const doc = await SportsTeam.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'SportsTeam', entityId: String(doc._id), entityName: data.sport, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateSportsTeam(collegeId: string, id: string, data: any, who: string) {
  const doc = await SportsTeam.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Sports team not found');
  await createAuditLog({ collegeId, entityType: 'SportsTeam', entityId: id, entityName: doc.sport, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteSportsTeam(collegeId: string, id: string, who: string) {
  const doc = await SportsTeam.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Sports team not found');
  await createAuditLog({ collegeId, entityType: 'SportsTeam', entityId: id, entityName: doc.sport, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Sports Team Member ════════════════════════════════════

export async function listSportsTeamMembers(collegeId: string, page = 1, limit = 20, teamId?: string) {
  const filter: any = { collegeId };
  if (teamId) filter.teamId = teamId;
  return paginate(SportsTeamMember, filter, page, limit, { createdAt: -1 }, [
    { path: 'teamId' },
    { path: 'studentId', populate: { path: 'personId' } },
  ]);
}

export async function getSportsTeamMember(collegeId: string, id: string) {
  const doc = await SportsTeamMember.findOne({ _id: id, collegeId })
    .populate('teamId')
    .populate({ path: 'studentId', populate: { path: 'personId' } });
  if (!doc) throw new AppError(404, 'Sports team member not found');
  return doc;
}

export async function createSportsTeamMember(collegeId: string, data: any, who: string) {
  const doc = await SportsTeamMember.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'SportsTeamMember', entityId: String(doc._id), entityName: data.position || 'member', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateSportsTeamMember(collegeId: string, id: string, data: any, who: string) {
  const doc = await SportsTeamMember.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Sports team member not found');
  await createAuditLog({ collegeId, entityType: 'SportsTeamMember', entityId: id, entityName: doc.position || 'member', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteSportsTeamMember(collegeId: string, id: string, who: string) {
  const doc = await SportsTeamMember.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Sports team member not found');
  await createAuditLog({ collegeId, entityType: 'SportsTeamMember', entityId: id, entityName: doc.position || 'member', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ NSS Activity ══════════════════════════════════════════

export async function listNSSActivities(collegeId: string, page = 1, limit = 20, type?: string, status?: string) {
  const filter: any = { collegeId };
  if (type) filter.type = type;
  if (status) filter.status = status;
  return paginate(NSSActivity, filter, page, limit, { date: -1 }, ['coordinatorId']);
}

export async function getNSSActivity(collegeId: string, id: string) {
  const doc = await NSSActivity.findOne({ _id: id, collegeId }).populate('coordinatorId');
  if (!doc) throw new AppError(404, 'NSS activity not found');
  return doc;
}

export async function createNSSActivity(collegeId: string, data: any, who: string) {
  const doc = await NSSActivity.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'NSSActivity', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateNSSActivity(collegeId: string, id: string, data: any, who: string) {
  const doc = await NSSActivity.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'NSS activity not found');
  await createAuditLog({ collegeId, entityType: 'NSSActivity', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteNSSActivity(collegeId: string, id: string, who: string) {
  const doc = await NSSActivity.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'NSS activity not found');
  await createAuditLog({ collegeId, entityType: 'NSSActivity', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ NSS Participant ═══════════════════════════════════════

export async function listNSSParticipants(collegeId: string, page = 1, limit = 20, activityId?: string) {
  const filter: any = { collegeId };
  if (activityId) filter.activityId = activityId;
  return paginate(NSSParticipant, filter, page, limit, { createdAt: -1 }, [
    { path: 'activityId' },
    { path: 'studentId', populate: { path: 'personId' } },
  ]);
}

export async function getNSSParticipant(collegeId: string, id: string) {
  const doc = await NSSParticipant.findOne({ _id: id, collegeId })
    .populate('activityId')
    .populate({ path: 'studentId', populate: { path: 'personId' } });
  if (!doc) throw new AppError(404, 'NSS participant not found');
  return doc;
}

export async function createNSSParticipant(collegeId: string, data: any, who: string) {
  const doc = await NSSParticipant.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'NSSParticipant', entityId: String(doc._id), entityName: 'NSS participant', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateNSSParticipant(collegeId: string, id: string, data: any, who: string) {
  const doc = await NSSParticipant.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'NSS participant not found');
  await createAuditLog({ collegeId, entityType: 'NSSParticipant', entityId: id, entityName: 'NSS participant', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteNSSParticipant(collegeId: string, id: string, who: string) {
  const doc = await NSSParticipant.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'NSS participant not found');
  await createAuditLog({ collegeId, entityType: 'NSSParticipant', entityId: id, entityName: 'NSS participant', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Skill Certification ══════════════════════════════════

export async function listSkillCertifications(collegeId: string, page = 1, limit = 20, provider?: string) {
  const filter: any = { collegeId };
  if (provider) filter.provider = provider;
  return paginate(SkillCertification, filter, page, limit, { completedDate: -1 }, [
    { path: 'studentId', populate: { path: 'personId' } },
  ]);
}

export async function getSkillCertification(collegeId: string, id: string) {
  const doc = await SkillCertification.findOne({ _id: id, collegeId })
    .populate({ path: 'studentId', populate: { path: 'personId' } });
  if (!doc) throw new AppError(404, 'Skill certification not found');
  return doc;
}

export async function createSkillCertification(collegeId: string, data: any, who: string) {
  const doc = await SkillCertification.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'SkillCertification', entityId: String(doc._id), entityName: data.certificationName, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateSkillCertification(collegeId: string, id: string, data: any, who: string) {
  const doc = await SkillCertification.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Skill certification not found');
  await createAuditLog({ collegeId, entityType: 'SkillCertification', entityId: id, entityName: doc.certificationName, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteSkillCertification(collegeId: string, id: string, who: string) {
  const doc = await SkillCertification.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Skill certification not found');
  await createAuditLog({ collegeId, entityType: 'SkillCertification', entityId: id, entityName: doc.certificationName, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Student Project ═══════════════════════════════════════

export async function listStudentProjects(collegeId: string, page = 1, limit = 20, type?: string, status?: string) {
  const filter: any = { collegeId };
  if (type) filter.type = type;
  if (status) filter.status = status;
  return paginate(StudentProject, filter, page, limit, { createdAt: -1 }, [
    { path: 'teamMembers', populate: { path: 'personId' } },
    { path: 'guideId', populate: { path: 'personId' } },
  ]);
}

export async function getStudentProject(collegeId: string, id: string) {
  const doc = await StudentProject.findOne({ _id: id, collegeId })
    .populate({ path: 'teamMembers', populate: { path: 'personId' } })
    .populate({ path: 'guideId', populate: { path: 'personId' } });
  if (!doc) throw new AppError(404, 'Student project not found');
  return doc;
}

export async function createStudentProject(collegeId: string, data: any, who: string) {
  const doc = await StudentProject.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'StudentProject', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateStudentProject(collegeId: string, id: string, data: any, who: string) {
  const doc = await StudentProject.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Student project not found');
  await createAuditLog({ collegeId, entityType: 'StudentProject', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteStudentProject(collegeId: string, id: string, who: string) {
  const doc = await StudentProject.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Student project not found');
  await createAuditLog({ collegeId, entityType: 'StudentProject', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Community Project ════════════════════════════════════

export async function listCommunityProjects(collegeId: string, page = 1, limit = 20, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  return paginate(CommunityProject, filter, page, limit, { startDate: -1 }, [
    { path: 'leadStudentId', populate: { path: 'personId' } },
    { path: 'facultyMentorId', populate: { path: 'personId' } },
  ]);
}

export async function getCommunityProject(collegeId: string, id: string) {
  const doc = await CommunityProject.findOne({ _id: id, collegeId })
    .populate({ path: 'leadStudentId', populate: { path: 'personId' } })
    .populate({ path: 'facultyMentorId', populate: { path: 'personId' } });
  if (!doc) throw new AppError(404, 'Community project not found');
  return doc;
}

export async function createCommunityProject(collegeId: string, data: any, who: string) {
  const doc = await CommunityProject.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'CommunityProject', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateCommunityProject(collegeId: string, id: string, data: any, who: string) {
  const doc = await CommunityProject.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Community project not found');
  await createAuditLog({ collegeId, entityType: 'CommunityProject', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteCommunityProject(collegeId: string, id: string, who: string) {
  const doc = await CommunityProject.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Community project not found');
  await createAuditLog({ collegeId, entityType: 'CommunityProject', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Leadership Role ══════════════════════════════════════

export async function listLeadershipRoles(collegeId: string, page = 1, limit = 20, body?: string) {
  const filter: any = { collegeId };
  if (body) filter.body = body;
  return paginate(LeadershipRole, filter, page, limit, { startDate: -1 }, [
    { path: 'studentId', populate: { path: 'personId' } },
    { path: 'academicYearId' },
  ]);
}

export async function getLeadershipRole(collegeId: string, id: string) {
  const doc = await LeadershipRole.findOne({ _id: id, collegeId })
    .populate({ path: 'studentId', populate: { path: 'personId' } })
    .populate('academicYearId');
  if (!doc) throw new AppError(404, 'Leadership role not found');
  return doc;
}

export async function createLeadershipRole(collegeId: string, data: any, who: string) {
  const doc = await LeadershipRole.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'LeadershipRole', entityId: String(doc._id), entityName: data.role, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateLeadershipRole(collegeId: string, id: string, data: any, who: string) {
  const doc = await LeadershipRole.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Leadership role not found');
  await createAuditLog({ collegeId, entityType: 'LeadershipRole', entityId: id, entityName: doc.role, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteLeadershipRole(collegeId: string, id: string, who: string) {
  const doc = await LeadershipRole.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Leadership role not found');
  await createAuditLog({ collegeId, entityType: 'LeadershipRole', entityId: id, entityName: doc.role, action: 'delete', changes: [], performedBy: who });
  return doc;
}
