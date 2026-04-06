import api from './api';

const BASE = '/admissions';

// ─── Stats ─────────────────────────────────────────────
export const getStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Inquiries ─────────────────────────────────────────
export const listInquiries = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/inquiries`, { params: { page, limit, status } }).then(r => r.data);

export const getInquiry = (id: string) =>
  api.get(`${BASE}/inquiries/${id}`).then(r => r.data);

export const createInquiry = (data: any) =>
  api.post(`${BASE}/inquiries`, data).then(r => r.data);

export const updateInquiry = (id: string, data: any) =>
  api.put(`${BASE}/inquiries/${id}`, data).then(r => r.data);

export const deleteInquiry = (id: string) =>
  api.delete(`${BASE}/inquiries/${id}`).then(r => r.data);

export const convertInquiry = (id: string, data: any) =>
  api.post(`${BASE}/inquiries/${id}/convert`, data).then(r => r.data);

// ─── Applicants ────────────────────────────────────────
export const listApplicants = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/applicants`, { params: { page, limit, status } }).then(r => r.data);

export const getApplicant = (id: string) =>
  api.get(`${BASE}/applicants/${id}`).then(r => r.data);

export const createApplicant = (data: any) =>
  api.post(`${BASE}/applicants`, data).then(r => r.data);

export const updateApplicant = (id: string, data: any) =>
  api.put(`${BASE}/applicants/${id}`, data).then(r => r.data);

// ─── Exam Scores ───────────────────────────────────────
export const listExamScores = (page = 1, limit = 20, applicantId?: string) =>
  api.get(`${BASE}/exam-scores`, { params: { page, limit, applicantId } }).then(r => r.data);

export const createExamScore = (data: any) =>
  api.post(`${BASE}/exam-scores`, data).then(r => r.data);

// ─── Counseling ────────────────────────────────────────
export const listCounseling = (page = 1, limit = 20, applicantId?: string) =>
  api.get(`${BASE}/counseling`, { params: { page, limit, applicantId } }).then(r => r.data);

export const createCounseling = (data: any) =>
  api.post(`${BASE}/counseling`, data).then(r => r.data);

// ─── Offers ────────────────────────────────────────────
export const listOffers = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/offers`, { params: { page, limit, status } }).then(r => r.data);

export const createOffer = (data: any) =>
  api.post(`${BASE}/offers`, data).then(r => r.data);

export const updateOffer = (id: string, data: any) =>
  api.put(`${BASE}/offers/${id}`, data).then(r => r.data);

// ─── Documents ─────────────────────────────────────────
export const listDocumentChecklists = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/documents`, { params: { page, limit, status } }).then(r => r.data);

export const getDocumentChecklist = (applicantId: string) =>
  api.get(`${BASE}/documents/${applicantId}`).then(r => r.data);

export const upsertDocumentChecklist = (applicantId: string, data: any) =>
  api.put(`${BASE}/documents/${applicantId}`, data).then(r => r.data);

// ─── Enrollments ───────────────────────────────────────
export const listEnrollments = (page = 1, limit = 20) =>
  api.get(`${BASE}/enrollments`, { params: { page, limit } }).then(r => r.data);

export const createEnrollment = (data: any) =>
  api.post(`${BASE}/enrollments`, data).then(r => r.data);
