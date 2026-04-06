import api from './api';

const BASE = '/placement';

// ─── Stats ────────────────────────────────────────────────
export const getPlacementStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Placement Seasons ────────────────────────────────────
export const listPlacementSeasons = (page = 1, limit = 20) =>
  api.get(`${BASE}/seasons`, { params: { page, limit } }).then(r => r.data);
export const getPlacementSeason = (id: string) =>
  api.get(`${BASE}/seasons/${id}`).then(r => r.data);
export const createPlacementSeason = (data: any) =>
  api.post(`${BASE}/seasons`, data).then(r => r.data);
export const updatePlacementSeason = (id: string, data: any) =>
  api.put(`${BASE}/seasons/${id}`, data).then(r => r.data);
export const deletePlacementSeason = (id: string) =>
  api.delete(`${BASE}/seasons/${id}`).then(r => r.data);

// ─── Companies ────────────────────────────────────────────
export const listCompanies = (page = 1, limit = 20) =>
  api.get(`${BASE}/companies`, { params: { page, limit } }).then(r => r.data);
export const getCompany = (id: string) =>
  api.get(`${BASE}/companies/${id}`).then(r => r.data);
export const createCompany = (data: any) =>
  api.post(`${BASE}/companies`, data).then(r => r.data);
export const updateCompany = (id: string, data: any) =>
  api.put(`${BASE}/companies/${id}`, data).then(r => r.data);
export const deleteCompany = (id: string) =>
  api.delete(`${BASE}/companies/${id}`).then(r => r.data);

// ─── Job Postings ─────────────────────────────────────────
export const listJobPostings = (page = 1, limit = 20, placementSeasonId?: string) =>
  api.get(`${BASE}/job-postings`, { params: { page, limit, placementSeasonId } }).then(r => r.data);
export const getJobPosting = (id: string) =>
  api.get(`${BASE}/job-postings/${id}`).then(r => r.data);
export const createJobPosting = (data: any) =>
  api.post(`${BASE}/job-postings`, data).then(r => r.data);
export const updateJobPosting = (id: string, data: any) =>
  api.put(`${BASE}/job-postings/${id}`, data).then(r => r.data);
export const deleteJobPosting = (id: string) =>
  api.delete(`${BASE}/job-postings/${id}`).then(r => r.data);

// ─── Placement Registrations ──────────────────────────────
export const listPlacementRegistrations = (page = 1, limit = 20, jobPostingId?: string) =>
  api.get(`${BASE}/registrations`, { params: { page, limit, jobPostingId } }).then(r => r.data);
export const createPlacementRegistration = (data: any) =>
  api.post(`${BASE}/registrations`, data).then(r => r.data);
export const updatePlacementRegistration = (id: string, data: any) =>
  api.put(`${BASE}/registrations/${id}`, data).then(r => r.data);
export const deletePlacementRegistration = (id: string) =>
  api.delete(`${BASE}/registrations/${id}`).then(r => r.data);

// ─── Placement Rounds ─────────────────────────────────────
export const listPlacementRounds = (page = 1, limit = 20, jobPostingId?: string) =>
  api.get(`${BASE}/rounds`, { params: { page, limit, jobPostingId } }).then(r => r.data);
export const createPlacementRound = (data: any) =>
  api.post(`${BASE}/rounds`, data).then(r => r.data);
export const updatePlacementRound = (id: string, data: any) =>
  api.put(`${BASE}/rounds/${id}`, data).then(r => r.data);
export const deletePlacementRound = (id: string) =>
  api.delete(`${BASE}/rounds/${id}`).then(r => r.data);

// ─── Round Results ────────────────────────────────────────
export const listRoundResults = (page = 1, limit = 20, roundId?: string) =>
  api.get(`${BASE}/round-results`, { params: { page, limit, roundId } }).then(r => r.data);
export const createRoundResult = (data: any) =>
  api.post(`${BASE}/round-results`, data).then(r => r.data);
export const updateRoundResult = (id: string, data: any) =>
  api.put(`${BASE}/round-results/${id}`, data).then(r => r.data);
export const deleteRoundResult = (id: string) =>
  api.delete(`${BASE}/round-results/${id}`).then(r => r.data);

// ─── Placement Offers ─────────────────────────────────────
export const listPlacementOffers = (page = 1, limit = 20, studentId?: string) =>
  api.get(`${BASE}/offers`, { params: { page, limit, studentId } }).then(r => r.data);
export const createPlacementOffer = (data: any) =>
  api.post(`${BASE}/offers`, data).then(r => r.data);
export const updatePlacementOffer = (id: string, data: any) =>
  api.put(`${BASE}/offers/${id}`, data).then(r => r.data);
export const deletePlacementOffer = (id: string) =>
  api.delete(`${BASE}/offers/${id}`).then(r => r.data);

// ─── Internship Postings ──────────────────────────────────
export const listInternshipPostings = (page = 1, limit = 20) =>
  api.get(`${BASE}/internships`, { params: { page, limit } }).then(r => r.data);
export const createInternshipPosting = (data: any) =>
  api.post(`${BASE}/internships`, data).then(r => r.data);
export const updateInternshipPosting = (id: string, data: any) =>
  api.put(`${BASE}/internships/${id}`, data).then(r => r.data);
export const deleteInternshipPosting = (id: string) =>
  api.delete(`${BASE}/internships/${id}`).then(r => r.data);

// ─── Internship Applications ──────────────────────────────
export const listInternshipApplications = (page = 1, limit = 20, internshipId?: string) =>
  api.get(`${BASE}/internship-applications`, { params: { page, limit, internshipId } }).then(r => r.data);
export const createInternshipApplication = (data: any) =>
  api.post(`${BASE}/internship-applications`, data).then(r => r.data);
export const updateInternshipApplication = (id: string, data: any) =>
  api.put(`${BASE}/internship-applications/${id}`, data).then(r => r.data);
export const deleteInternshipApplication = (id: string) =>
  api.delete(`${BASE}/internship-applications/${id}`).then(r => r.data);

// ─── Placement Trainings ──────────────────────────────────
export const listPlacementTrainings = (page = 1, limit = 20) =>
  api.get(`${BASE}/trainings`, { params: { page, limit } }).then(r => r.data);
export const createPlacementTraining = (data: any) =>
  api.post(`${BASE}/trainings`, data).then(r => r.data);
export const updatePlacementTraining = (id: string, data: any) =>
  api.put(`${BASE}/trainings/${id}`, data).then(r => r.data);
export const deletePlacementTraining = (id: string) =>
  api.delete(`${BASE}/trainings/${id}`).then(r => r.data);

// ─── Training Attendance ──────────────────────────────────
export const listTrainingAttendance = (page = 1, limit = 20, trainingId?: string) =>
  api.get(`${BASE}/training-attendance`, { params: { page, limit, trainingId } }).then(r => r.data);
export const createTrainingAttendance = (data: any) =>
  api.post(`${BASE}/training-attendance`, data).then(r => r.data);
export const updateTrainingAttendance = (id: string, data: any) =>
  api.put(`${BASE}/training-attendance/${id}`, data).then(r => r.data);
export const deleteTrainingAttendance = (id: string) =>
  api.delete(`${BASE}/training-attendance/${id}`).then(r => r.data);

// ─── Mock Interviews ──────────────────────────────────────
export const listMockInterviews = (page = 1, limit = 20, studentId?: string) =>
  api.get(`${BASE}/mock-interviews`, { params: { page, limit, studentId } }).then(r => r.data);
export const createMockInterview = (data: any) =>
  api.post(`${BASE}/mock-interviews`, data).then(r => r.data);
export const updateMockInterview = (id: string, data: any) =>
  api.put(`${BASE}/mock-interviews/${id}`, data).then(r => r.data);
export const deleteMockInterview = (id: string) =>
  api.delete(`${BASE}/mock-interviews/${id}`).then(r => r.data);

// ─── Higher Studies ───────────────────────────────────────
export const listHigherStudiesApplications = (page = 1, limit = 20, studentId?: string) =>
  api.get(`${BASE}/higher-studies`, { params: { page, limit, studentId } }).then(r => r.data);
export const createHigherStudiesApplication = (data: any) =>
  api.post(`${BASE}/higher-studies`, data).then(r => r.data);
export const updateHigherStudiesApplication = (id: string, data: any) =>
  api.put(`${BASE}/higher-studies/${id}`, data).then(r => r.data);
export const deleteHigherStudiesApplication = (id: string) =>
  api.delete(`${BASE}/higher-studies/${id}`).then(r => r.data);

// ─── Entrepreneur Profiles ────────────────────────────────
export const listEntrepreneurProfiles = (page = 1, limit = 20) =>
  api.get(`${BASE}/entrepreneurs`, { params: { page, limit } }).then(r => r.data);
export const createEntrepreneurProfile = (data: any) =>
  api.post(`${BASE}/entrepreneurs`, data).then(r => r.data);
export const updateEntrepreneurProfile = (id: string, data: any) =>
  api.put(`${BASE}/entrepreneurs/${id}`, data).then(r => r.data);
export const deleteEntrepreneurProfile = (id: string) =>
  api.delete(`${BASE}/entrepreneurs/${id}`).then(r => r.data);

// ─── Alumni Profiles ──────────────────────────────────────
export const listAlumniProfiles = (page = 1, limit = 20) =>
  api.get(`${BASE}/alumni-profiles`, { params: { page, limit } }).then(r => r.data);
export const createAlumniProfile = (data: any) =>
  api.post(`${BASE}/alumni-profiles`, data).then(r => r.data);
export const updateAlumniProfile = (id: string, data: any) =>
  api.put(`${BASE}/alumni-profiles/${id}`, data).then(r => r.data);
export const deleteAlumniProfile = (id: string) =>
  api.delete(`${BASE}/alumni-profiles/${id}`).then(r => r.data);

// ─── Alumni Events ────────────────────────────────────────
export const listAlumniEvents = (page = 1, limit = 20) =>
  api.get(`${BASE}/alumni-events`, { params: { page, limit } }).then(r => r.data);
export const createAlumniEvent = (data: any) =>
  api.post(`${BASE}/alumni-events`, data).then(r => r.data);
export const updateAlumniEvent = (id: string, data: any) =>
  api.put(`${BASE}/alumni-events/${id}`, data).then(r => r.data);
export const deleteAlumniEvent = (id: string) =>
  api.delete(`${BASE}/alumni-events/${id}`).then(r => r.data);

// ─── Placement Reports ────────────────────────────────────
export const listPlacementReports = (page = 1, limit = 20, placementSeasonId?: string) =>
  api.get(`${BASE}/reports`, { params: { page, limit, placementSeasonId } }).then(r => r.data);
export const createPlacementReport = (data: any) =>
  api.post(`${BASE}/reports`, data).then(r => r.data);
export const deletePlacementReport = (id: string) =>
  api.delete(`${BASE}/reports/${id}`).then(r => r.data);
