import api from './api';

const BASE = '/student-dev';

// ─── Stats ────────────────────────────────────────────────
export const getStudentDevStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Clubs ────────────────────────────────────────────────
export const listClubs = (page = 1, limit = 20, type?: string, search?: string) =>
  api.get(`${BASE}/clubs`, { params: { page, limit, type, ...(search ? { search } : {}) } }).then(r => r.data);
export const getClub = (id: string) =>
  api.get(`${BASE}/clubs/${id}`).then(r => r.data);
export const createClub = (data: any) =>
  api.post(`${BASE}/clubs`, data).then(r => r.data);
export const updateClub = (id: string, data: any) =>
  api.put(`${BASE}/clubs/${id}`, data).then(r => r.data);
export const deleteClub = (id: string) =>
  api.delete(`${BASE}/clubs/${id}`).then(r => r.data);

// ─── Club Memberships ─────────────────────────────────────
export const listClubMemberships = (page = 1, limit = 20, clubId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/club-memberships`, { params: { page, limit, clubId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getClubMembership = (id: string) =>
  api.get(`${BASE}/club-memberships/${id}`).then(r => r.data);
export const createClubMembership = (data: any) =>
  api.post(`${BASE}/club-memberships`, data).then(r => r.data);
export const updateClubMembership = (id: string, data: any) =>
  api.put(`${BASE}/club-memberships/${id}`, data).then(r => r.data);
export const deleteClubMembership = (id: string) =>
  api.delete(`${BASE}/club-memberships/${id}`).then(r => r.data);

// ─── Events ───────────────────────────────────────────────
export const listEvents = (page = 1, limit = 20, type?: string, status?: string, search?: string) =>
  api.get(`${BASE}/events`, { params: { page, limit, type, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getEvent = (id: string) =>
  api.get(`${BASE}/events/${id}`).then(r => r.data);
export const createEvent = (data: any) =>
  api.post(`${BASE}/events`, data).then(r => r.data);
export const updateEvent = (id: string, data: any) =>
  api.put(`${BASE}/events/${id}`, data).then(r => r.data);
export const deleteEvent = (id: string) =>
  api.delete(`${BASE}/events/${id}`).then(r => r.data);

// ─── Event Registrations ──────────────────────────────────
export const listEventRegistrations = (page = 1, limit = 20, eventId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/event-registrations`, { params: { page, limit, eventId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getEventRegistration = (id: string) =>
  api.get(`${BASE}/event-registrations/${id}`).then(r => r.data);
export const createEventRegistration = (data: any) =>
  api.post(`${BASE}/event-registrations`, data).then(r => r.data);
export const updateEventRegistration = (id: string, data: any) =>
  api.put(`${BASE}/event-registrations/${id}`, data).then(r => r.data);
export const deleteEventRegistration = (id: string) =>
  api.delete(`${BASE}/event-registrations/${id}`).then(r => r.data);

// ─── Achievements ─────────────────────────────────────────
export const listAchievements = (page = 1, limit = 20, category?: string, level?: string, search?: string) =>
  api.get(`${BASE}/achievements`, { params: { page, limit, category, level, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAchievement = (id: string) =>
  api.get(`${BASE}/achievements/${id}`).then(r => r.data);
export const createAchievement = (data: any) =>
  api.post(`${BASE}/achievements`, data).then(r => r.data);
export const updateAchievement = (id: string, data: any) =>
  api.put(`${BASE}/achievements/${id}`, data).then(r => r.data);
export const deleteAchievement = (id: string) =>
  api.delete(`${BASE}/achievements/${id}`).then(r => r.data);

// ─── Mentoring ────────────────────────────────────────────
export const listMentoringSessions = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/mentoring`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getMentoringSession = (id: string) =>
  api.get(`${BASE}/mentoring/${id}`).then(r => r.data);
export const createMentoringSession = (data: any) =>
  api.post(`${BASE}/mentoring`, data).then(r => r.data);
export const updateMentoringSession = (id: string, data: any) =>
  api.put(`${BASE}/mentoring/${id}`, data).then(r => r.data);
export const deleteMentoringSession = (id: string) =>
  api.delete(`${BASE}/mentoring/${id}`).then(r => r.data);

// ─── Sports Teams ─────────────────────────────────────────
export const listSportsTeams = (page = 1, limit = 20, category?: string, search?: string) =>
  api.get(`${BASE}/sports-teams`, { params: { page, limit, category, ...(search ? { search } : {}) } }).then(r => r.data);
export const getSportsTeam = (id: string) =>
  api.get(`${BASE}/sports-teams/${id}`).then(r => r.data);
export const createSportsTeam = (data: any) =>
  api.post(`${BASE}/sports-teams`, data).then(r => r.data);
export const updateSportsTeam = (id: string, data: any) =>
  api.put(`${BASE}/sports-teams/${id}`, data).then(r => r.data);
export const deleteSportsTeam = (id: string) =>
  api.delete(`${BASE}/sports-teams/${id}`).then(r => r.data);

// ─── Sports Team Members ──────────────────────────────────
export const listSportsTeamMembers = (page = 1, limit = 20, teamId?: string, search?: string) =>
  api.get(`${BASE}/sports-team-members`, { params: { page, limit, teamId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getSportsTeamMember = (id: string) =>
  api.get(`${BASE}/sports-team-members/${id}`).then(r => r.data);
export const createSportsTeamMember = (data: any) =>
  api.post(`${BASE}/sports-team-members`, data).then(r => r.data);
export const updateSportsTeamMember = (id: string, data: any) =>
  api.put(`${BASE}/sports-team-members/${id}`, data).then(r => r.data);
export const deleteSportsTeamMember = (id: string) =>
  api.delete(`${BASE}/sports-team-members/${id}`).then(r => r.data);

// ─── NSS Activities ───────────────────────────────────────
export const listNSSActivities = (page = 1, limit = 20, type?: string, status?: string, search?: string) =>
  api.get(`${BASE}/nss-activities`, { params: { page, limit, type, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getNSSActivity = (id: string) =>
  api.get(`${BASE}/nss-activities/${id}`).then(r => r.data);
export const createNSSActivity = (data: any) =>
  api.post(`${BASE}/nss-activities`, data).then(r => r.data);
export const updateNSSActivity = (id: string, data: any) =>
  api.put(`${BASE}/nss-activities/${id}`, data).then(r => r.data);
export const deleteNSSActivity = (id: string) =>
  api.delete(`${BASE}/nss-activities/${id}`).then(r => r.data);

// ─── NSS Participants ─────────────────────────────────────
export const listNSSParticipants = (page = 1, limit = 20, activityId?: string, search?: string) =>
  api.get(`${BASE}/nss-participants`, { params: { page, limit, activityId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getNSSParticipant = (id: string) =>
  api.get(`${BASE}/nss-participants/${id}`).then(r => r.data);
export const createNSSParticipant = (data: any) =>
  api.post(`${BASE}/nss-participants`, data).then(r => r.data);
export const updateNSSParticipant = (id: string, data: any) =>
  api.put(`${BASE}/nss-participants/${id}`, data).then(r => r.data);
export const deleteNSSParticipant = (id: string) =>
  api.delete(`${BASE}/nss-participants/${id}`).then(r => r.data);

// ─── Skill Certifications ─────────────────────────────────
export const listSkillCertifications = (page = 1, limit = 20, provider?: string, search?: string) =>
  api.get(`${BASE}/skill-certifications`, { params: { page, limit, provider, ...(search ? { search } : {}) } }).then(r => r.data);
export const getSkillCertification = (id: string) =>
  api.get(`${BASE}/skill-certifications/${id}`).then(r => r.data);
export const createSkillCertification = (data: any) =>
  api.post(`${BASE}/skill-certifications`, data).then(r => r.data);
export const updateSkillCertification = (id: string, data: any) =>
  api.put(`${BASE}/skill-certifications/${id}`, data).then(r => r.data);
export const deleteSkillCertification = (id: string) =>
  api.delete(`${BASE}/skill-certifications/${id}`).then(r => r.data);

// ─── Student Projects ─────────────────────────────────────
export const listStudentProjects = (page = 1, limit = 20, type?: string, status?: string, search?: string) =>
  api.get(`${BASE}/student-projects`, { params: { page, limit, type, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getStudentProject = (id: string) =>
  api.get(`${BASE}/student-projects/${id}`).then(r => r.data);
export const createStudentProject = (data: any) =>
  api.post(`${BASE}/student-projects`, data).then(r => r.data);
export const updateStudentProject = (id: string, data: any) =>
  api.put(`${BASE}/student-projects/${id}`, data).then(r => r.data);
export const deleteStudentProject = (id: string) =>
  api.delete(`${BASE}/student-projects/${id}`).then(r => r.data);

// ─── Community Projects ───────────────────────────────────
export const listCommunityProjects = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/community-projects`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getCommunityProject = (id: string) =>
  api.get(`${BASE}/community-projects/${id}`).then(r => r.data);
export const createCommunityProject = (data: any) =>
  api.post(`${BASE}/community-projects`, data).then(r => r.data);
export const updateCommunityProject = (id: string, data: any) =>
  api.put(`${BASE}/community-projects/${id}`, data).then(r => r.data);
export const deleteCommunityProject = (id: string) =>
  api.delete(`${BASE}/community-projects/${id}`).then(r => r.data);

// ─── Leadership Roles ─────────────────────────────────────
export const listLeadershipRoles = (page = 1, limit = 20, body?: string, search?: string) =>
  api.get(`${BASE}/leadership-roles`, { params: { page, limit, body, ...(search ? { search } : {}) } }).then(r => r.data);
export const getLeadershipRole = (id: string) =>
  api.get(`${BASE}/leadership-roles/${id}`).then(r => r.data);
export const createLeadershipRole = (data: any) =>
  api.post(`${BASE}/leadership-roles`, data).then(r => r.data);
export const updateLeadershipRole = (id: string, data: any) =>
  api.put(`${BASE}/leadership-roles/${id}`, data).then(r => r.data);
export const deleteLeadershipRole = (id: string) =>
  api.delete(`${BASE}/leadership-roles/${id}`).then(r => r.data);
