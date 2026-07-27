import api from './api';

const BASE = '/placement';

// ─── Stats ────────────────────────────────────────────────
export const getPlacementStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Placement Seasons ────────────────────────────────────
export const listPlacementSeasons = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/seasons`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getPlacementSeason = (id: string) =>
  api.get(`${BASE}/seasons/${id}`).then(r => r.data);
export const createPlacementSeason = (data: any) =>
  api.post(`${BASE}/seasons`, data).then(r => r.data);
export const updatePlacementSeason = (id: string, data: any) =>
  api.put(`${BASE}/seasons/${id}`, data).then(r => r.data);
export const deletePlacementSeason = (id: string) =>
  api.delete(`${BASE}/seasons/${id}`).then(r => r.data);

// ─── Companies ────────────────────────────────────────────
export const listCompanies = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/companies`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getCompany = (id: string) =>
  api.get(`${BASE}/companies/${id}`).then(r => r.data);
export const createCompany = (data: any) =>
  api.post(`${BASE}/companies`, data).then(r => r.data);
export const updateCompany = (id: string, data: any) =>
  api.put(`${BASE}/companies/${id}`, data).then(r => r.data);
export const deleteCompany = (id: string) =>
  api.delete(`${BASE}/companies/${id}`).then(r => r.data);

// ─── Job Postings ─────────────────────────────────────────
export const listJobPostings = (page = 1, limit = 20, placementSeasonId?: string, search?: string) =>
  api.get(`${BASE}/job-postings`, { params: { page, limit, placementSeasonId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getJobPosting = (id: string) =>
  api.get(`${BASE}/job-postings/${id}`).then(r => r.data);
export const createJobPosting = (data: any) =>
  api.post(`${BASE}/job-postings`, data).then(r => r.data);
export const updateJobPosting = (id: string, data: any) =>
  api.put(`${BASE}/job-postings/${id}`, data).then(r => r.data);
export const deleteJobPosting = (id: string) =>
  api.delete(`${BASE}/job-postings/${id}`).then(r => r.data);

// ─── Placement Registrations ──────────────────────────────
export const listPlacementRegistrations = (page = 1, limit = 20, jobPostingId?: string, search?: string) =>
  api.get(`${BASE}/registrations`, { params: { page, limit, jobPostingId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createPlacementRegistration = (data: any) =>
  api.post(`${BASE}/registrations`, data).then(r => r.data);
export const updatePlacementRegistration = (id: string, data: any) =>
  api.put(`${BASE}/registrations/${id}`, data).then(r => r.data);
export const deletePlacementRegistration = (id: string) =>
  api.delete(`${BASE}/registrations/${id}`).then(r => r.data);

// ─── Placement Rounds ─────────────────────────────────────
export const listPlacementRounds = (page = 1, limit = 20, jobPostingId?: string, search?: string) =>
  api.get(`${BASE}/rounds`, { params: { page, limit, jobPostingId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createPlacementRound = (data: any) =>
  api.post(`${BASE}/rounds`, data).then(r => r.data);
export const updatePlacementRound = (id: string, data: any) =>
  api.put(`${BASE}/rounds/${id}`, data).then(r => r.data);
export const deletePlacementRound = (id: string) =>
  api.delete(`${BASE}/rounds/${id}`).then(r => r.data);

// ─── Round Results ────────────────────────────────────────
export const listRoundResults = (page = 1, limit = 20, roundId?: string, search?: string) =>
  api.get(`${BASE}/round-results`, { params: { page, limit, roundId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createRoundResult = (data: any) =>
  api.post(`${BASE}/round-results`, data).then(r => r.data);
export const updateRoundResult = (id: string, data: any) =>
  api.put(`${BASE}/round-results/${id}`, data).then(r => r.data);
export const deleteRoundResult = (id: string) =>
  api.delete(`${BASE}/round-results/${id}`).then(r => r.data);

// ─── Placement Offers ─────────────────────────────────────
export const listPlacementOffers = (page = 1, limit = 20, studentId?: string, search?: string) =>
  api.get(`${BASE}/offers`, { params: { page, limit, studentId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createPlacementOffer = (data: any) =>
  api.post(`${BASE}/offers`, data).then(r => r.data);
export const updatePlacementOffer = (id: string, data: any) =>
  api.put(`${BASE}/offers/${id}`, data).then(r => r.data);
export const deletePlacementOffer = (id: string) =>
  api.delete(`${BASE}/offers/${id}`).then(r => r.data);

// ─── Internship Postings ──────────────────────────────────
export const listInternshipPostings = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/internships`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createInternshipPosting = (data: any) =>
  api.post(`${BASE}/internships`, data).then(r => r.data);
export const updateInternshipPosting = (id: string, data: any) =>
  api.put(`${BASE}/internships/${id}`, data).then(r => r.data);
export const deleteInternshipPosting = (id: string) =>
  api.delete(`${BASE}/internships/${id}`).then(r => r.data);

// ─── Internship Applications ──────────────────────────────
export const listInternshipApplications = (page = 1, limit = 20, internshipId?: string, search?: string) =>
  api.get(`${BASE}/internship-applications`, { params: { page, limit, internshipId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createInternshipApplication = (data: any) =>
  api.post(`${BASE}/internship-applications`, data).then(r => r.data);
export const updateInternshipApplication = (id: string, data: any) =>
  api.put(`${BASE}/internship-applications/${id}`, data).then(r => r.data);
export const deleteInternshipApplication = (id: string) =>
  api.delete(`${BASE}/internship-applications/${id}`).then(r => r.data);

// ─── Placement Trainings ──────────────────────────────────
export const listPlacementTrainings = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/trainings`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createPlacementTraining = (data: any) =>
  api.post(`${BASE}/trainings`, data).then(r => r.data);
export const updatePlacementTraining = (id: string, data: any) =>
  api.put(`${BASE}/trainings/${id}`, data).then(r => r.data);
export const deletePlacementTraining = (id: string) =>
  api.delete(`${BASE}/trainings/${id}`).then(r => r.data);

// ─── Training Attendance ──────────────────────────────────
export const listTrainingAttendance = (page = 1, limit = 20, trainingId?: string, search?: string) =>
  api.get(`${BASE}/training-attendance`, { params: { page, limit, trainingId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createTrainingAttendance = (data: any) =>
  api.post(`${BASE}/training-attendance`, data).then(r => r.data);
export const updateTrainingAttendance = (id: string, data: any) =>
  api.put(`${BASE}/training-attendance/${id}`, data).then(r => r.data);
export const deleteTrainingAttendance = (id: string) =>
  api.delete(`${BASE}/training-attendance/${id}`).then(r => r.data);

// ─── Mock Interviews ──────────────────────────────────────
export const listMockInterviews = (page = 1, limit = 20, studentId?: string, search?: string) =>
  api.get(`${BASE}/mock-interviews`, { params: { page, limit, studentId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createMockInterview = (data: any) =>
  api.post(`${BASE}/mock-interviews`, data).then(r => r.data);
export const updateMockInterview = (id: string, data: any) =>
  api.put(`${BASE}/mock-interviews/${id}`, data).then(r => r.data);
export const deleteMockInterview = (id: string) =>
  api.delete(`${BASE}/mock-interviews/${id}`).then(r => r.data);

// ─── Higher Studies ───────────────────────────────────────
export const listHigherStudiesApplications = (page = 1, limit = 20, studentId?: string, search?: string) =>
  api.get(`${BASE}/higher-studies`, { params: { page, limit, studentId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createHigherStudiesApplication = (data: any) =>
  api.post(`${BASE}/higher-studies`, data).then(r => r.data);
export const updateHigherStudiesApplication = (id: string, data: any) =>
  api.put(`${BASE}/higher-studies/${id}`, data).then(r => r.data);
export const deleteHigherStudiesApplication = (id: string) =>
  api.delete(`${BASE}/higher-studies/${id}`).then(r => r.data);

// ─── Entrepreneur Profiles ────────────────────────────────
export const listEntrepreneurProfiles = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/entrepreneurs`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createEntrepreneurProfile = (data: any) =>
  api.post(`${BASE}/entrepreneurs`, data).then(r => r.data);
export const updateEntrepreneurProfile = (id: string, data: any) =>
  api.put(`${BASE}/entrepreneurs/${id}`, data).then(r => r.data);
export const deleteEntrepreneurProfile = (id: string) =>
  api.delete(`${BASE}/entrepreneurs/${id}`).then(r => r.data);

// ─── Alumni Profiles ──────────────────────────────────────
export const listAlumniProfiles = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/alumni-profiles`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createAlumniProfile = (data: any) =>
  api.post(`${BASE}/alumni-profiles`, data).then(r => r.data);
export const updateAlumniProfile = (id: string, data: any) =>
  api.put(`${BASE}/alumni-profiles/${id}`, data).then(r => r.data);
export const deleteAlumniProfile = (id: string) =>
  api.delete(`${BASE}/alumni-profiles/${id}`).then(r => r.data);

// ─── Alumni Events ────────────────────────────────────────
export const listAlumniEvents = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/alumni-events`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createAlumniEvent = (data: any) =>
  api.post(`${BASE}/alumni-events`, data).then(r => r.data);
export const updateAlumniEvent = (id: string, data: any) =>
  api.put(`${BASE}/alumni-events/${id}`, data).then(r => r.data);
export const deleteAlumniEvent = (id: string) =>
  api.delete(`${BASE}/alumni-events/${id}`).then(r => r.data);

// ─── Placement Reports ────────────────────────────────────
export const listPlacementReports = (page = 1, limit = 20, placementSeasonId?: string, search?: string) =>
  api.get(`${BASE}/reports`, { params: { page, limit, placementSeasonId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createPlacementReport = (data: any) =>
  api.post(`${BASE}/reports`, data).then(r => r.data);
export const deletePlacementReport = (id: string) =>
  api.delete(`${BASE}/reports/${id}`).then(r => r.data);

// ═══════════════════════════════════════════════════════════
// W04 workflow surfaces
// These endpoints existed server-side with no frontend at all.
// ═══════════════════════════════════════════════════════════

// ─── Drives ───────────────────────────────────────────────
export const listDrives = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/drives`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getDrive = (id: string) =>
  api.get(`${BASE}/drives/${id}`).then(r => r.data);
export const createDrive = (data: any) =>
  api.post(`${BASE}/drives`, data).then(r => r.data);
export const updateDriveStatus = (id: string, status: string) =>
  api.put(`${BASE}/drives/${id}/status`, { status }).then(r => r.data);
export const cancelDrive = (id: string, reason?: string) =>
  api.post(`${BASE}/drives/${id}/cancel`, { reason }).then(r => r.data);
export const closeDrive = (id: string) =>
  api.put(`${BASE}/drives/${id}/close`, {}).then(r => r.data);
export const generateDriveShortlist = (id: string) =>
  api.post(`${BASE}/drives/${id}/generate-shortlist`, {}).then(r => r.data);
export const releaseDriveShortlist = (id: string) =>
  api.put(`${BASE}/drives/${id}/release-shortlist`, {}).then(r => r.data);

// ─── Drive applications ───────────────────────────────────
export const listDriveApplications = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/drive-applications`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const withdrawDriveApplication = (id: string, withdrawalReason?: string) =>
  api.post(`${BASE}/drive-applications/${id}/withdraw`, { withdrawalReason }).then(r => r.data);

// ─── Interview schedules ──────────────────────────────────
export const listInterviewSchedules = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/interview-schedules`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const setInterviewOutcome = (id: string, outcome: string) =>
  api.put(`${BASE}/interview-schedules/${id}/outcome`, { outcome }).then(r => r.data);

// ─── Career profiles ──────────────────────────────────────
export const listCareerProfiles = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/career-profiles`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const updateCareerProfile = (id: string, data: any) =>
  api.put(`${BASE}/career-profiles/${id}`, data).then(r => r.data);
export const refreshCareerProfileAcademic = (id: string) =>
  api.post(`${BASE}/career-profiles/${id}/refresh-academic`, {}).then(r => r.data);

// ─── Readiness scores (computed; no manual create) ────────
export const listReadinessScores = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/readiness-scores`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const computeReadinessScores = () =>
  api.post(`${BASE}/readiness-scores/compute-batch`, {}).then(r => r.data);

// ─── Skill records ────────────────────────────────────────
export const listSkillRecords = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/skill-records`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createSkillRecord = (data: any) =>
  api.post(`${BASE}/skill-records`, data).then(r => r.data);
export const updateSkillRecord = (id: string, data: any) =>
  api.put(`${BASE}/skill-records/${id}`, data).then(r => r.data);
export const deleteSkillRecord = (id: string) =>
  api.delete(`${BASE}/skill-records/${id}`).then(r => r.data);

// ─── Placement bars ───────────────────────────────────────
export const listPlacementBars = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/placement-bars`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createPlacementBar = (data: any) =>
  api.post(`${BASE}/placement-bars`, data).then(r => r.data);
export const liftPlacementBar = (id: string, liftConditions?: string) =>
  api.put(`${BASE}/placement-bars/${id}/lift`, { liftConditions }).then(r => r.data);

// ─── Opt-outs ─────────────────────────────────────────────
export const listOptOuts = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/opt-outs`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createOptOut = (data: any) =>
  api.post(`${BASE}/opt-outs`, data).then(r => r.data);
export const voidOptOut = (id: string, voidReason?: string) =>
  api.put(`${BASE}/opt-outs/${id}/void`, { voidReason }).then(r => r.data);

// ─── Recruiter accounts ───────────────────────────────────
export const listRecruiterAccounts = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/recruiter-accounts`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createRecruiterAccount = (data: any) =>
  api.post(`${BASE}/recruiter-accounts`, data).then(r => r.data);
export const verifyRecruiterAccount = (id: string) =>
  api.put(`${BASE}/recruiter-accounts/${id}/verify`, {}).then(r => r.data);
export const deactivateRecruiterAccount = (id: string, deactivationReason?: string) =>
  api.put(`${BASE}/recruiter-accounts/${id}/deactivate`, { deactivationReason }).then(r => r.data);

// ─── Alumni career records ────────────────────────────────
export const listAlumniCareerRecords = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/alumni-career-records`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createAlumniCareerRecord = (data: any) =>
  api.post(`${BASE}/alumni-career-records`, data).then(r => r.data);
export const updateAlumniCareerRecord = (id: string, data: any) =>
  api.put(`${BASE}/alumni-career-records/${id}`, data).then(r => r.data);

// ─── Alumni engagements ───────────────────────────────────
export const listAlumniEngagements = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/alumni-engagements`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);

// ─── Mentor matches ───────────────────────────────────────
export const listMentorMatches = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/mentor-matches`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createAlumniEngagement = (data: any) =>
  api.post(`${BASE}/alumni-engagements`, data).then(r => r.data);
export const remindAlumniEngagement = (id: string) =>
  api.post(`${BASE}/alumni-engagements/${id}/remind`, {}).then(r => r.data);

export const createMentorMatch = (data: any) =>
  api.post(`${BASE}/mentor-matches`, data).then(r => r.data);
export const approveMentorMatch = (id: string) =>
  api.post(`${BASE}/mentor-matches/${id}/approve`, {}).then(r => r.data);
export const introduceMentorMatch = (id: string) =>
  api.post(`${BASE}/mentor-matches/${id}/introduce`, {}).then(r => r.data);
export const activateMentorMatch = (id: string) =>
  api.post(`${BASE}/mentor-matches/${id}/activate`, {}).then(r => r.data);
export const closeMentorMatch = (id: string) =>
  api.post(`${BASE}/mentor-matches/${id}/close`, {}).then(r => r.data);
