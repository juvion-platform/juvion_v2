import api from './api';

const BASE = '/academics/exam-config';

// Wire types kept loose intentionally — these are admin-facing config
// rows that vary per institution. Strict typing happens at the form
// level where we know the entity.

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

// ─── ExamRoom ─────────────────────────────────────────────────────
export const listExamRooms = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/rooms`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then((r) => r.data as PaginatedResponse<any>);
export const getExamRoom = (id: string) => api.get(`${BASE}/rooms/${id}`).then((r) => r.data);
export const createExamRoom = (data: any) => api.post(`${BASE}/rooms`, data).then((r) => r.data);
export const updateExamRoom = (id: string, data: any) => api.put(`${BASE}/rooms/${id}`, data).then((r) => r.data);
export const deleteExamRoom = (id: string) => api.delete(`${BASE}/rooms/${id}`).then((r) => r.data);

// ─── Evaluator ────────────────────────────────────────────────────
export const listEvaluators = (page = 1, limit = 20, status?: string, kind?: string, search?: string) =>
  api.get(`${BASE}/evaluators`, { params: { page, limit, status, kind, ...(search ? { search } : {}) } }).then((r) => r.data as PaginatedResponse<any>);
export const getEvaluator = (id: string) => api.get(`${BASE}/evaluators/${id}`).then((r) => r.data);
export const createEvaluator = (data: any) => api.post(`${BASE}/evaluators`, data).then((r) => r.data);
export const updateEvaluator = (id: string, data: any) => api.put(`${BASE}/evaluators/${id}`, data).then((r) => r.data);
export const deleteEvaluator = (id: string) => api.delete(`${BASE}/evaluators/${id}`).then((r) => r.data);

// ─── GradeTemplate ────────────────────────────────────────────────
export const listGradeTemplates = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/grade-templates`, { params: { page, limit, ...(search ? { search } : {}) } }).then((r) => r.data as PaginatedResponse<any>);
export const getGradeTemplate = (id: string) => api.get(`${BASE}/grade-templates/${id}`).then((r) => r.data);
export const createGradeTemplate = (data: any) => api.post(`${BASE}/grade-templates`, data).then((r) => r.data);
export const updateGradeTemplate = (id: string, data: any) => api.put(`${BASE}/grade-templates/${id}`, data).then((r) => r.data);
export const deleteGradeTemplate = (id: string) => api.delete(`${BASE}/grade-templates/${id}`).then((r) => r.data);

// ─── ExamCentreTemplate ───────────────────────────────────────────
export const listExamCentreTemplates = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/centre-templates`, { params: { page, limit, ...(search ? { search } : {}) } }).then((r) => r.data as PaginatedResponse<any>);
export const getExamCentreTemplate = (id: string) => api.get(`${BASE}/centre-templates/${id}`).then((r) => r.data);
export const createExamCentreTemplate = (data: any) => api.post(`${BASE}/centre-templates`, data).then((r) => r.data);
export const updateExamCentreTemplate = (id: string, data: any) => api.put(`${BASE}/centre-templates/${id}`, data).then((r) => r.data);
export const deleteExamCentreTemplate = (id: string) => api.delete(`${BASE}/centre-templates/${id}`).then((r) => r.data);

// ─── QuestionPaperSchema ──────────────────────────────────────────
export const listQuestionPapers = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/question-papers`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then((r) => r.data as PaginatedResponse<any>);
export const getQuestionPaper = (id: string) => api.get(`${BASE}/question-papers/${id}`).then((r) => r.data);
export const createQuestionPaper = (data: any) => api.post(`${BASE}/question-papers`, data).then((r) => r.data);
export const updateQuestionPaper = (id: string, data: any) => api.put(`${BASE}/question-papers/${id}`, data).then((r) => r.data);
export const deleteQuestionPaper = (id: string) => api.delete(`${BASE}/question-papers/${id}`).then((r) => r.data);

// ─── SignatureType ────────────────────────────────────────────────
export const listSignatureTypes = () => api.get(`${BASE}/signatures`).then((r) => r.data as { items: any[] });
export const getSignatureType = (id: string) => api.get(`${BASE}/signatures/${id}`).then((r) => r.data);
export const createSignatureType = (data: any) => api.post(`${BASE}/signatures`, data).then((r) => r.data);
export const updateSignatureType = (id: string, data: any) => api.put(`${BASE}/signatures/${id}`, data).then((r) => r.data);
export const deleteSignatureType = (id: string) => api.delete(`${BASE}/signatures/${id}`).then((r) => r.data);

// ─── MoocSubject ──────────────────────────────────────────────────
export const listMoocSubjects = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/mooc-subjects`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then((r) => r.data as PaginatedResponse<any>);
export const getMoocSubject = (id: string) => api.get(`${BASE}/mooc-subjects/${id}`).then((r) => r.data);
export const createMoocSubject = (data: any) => api.post(`${BASE}/mooc-subjects`, data).then((r) => r.data);
export const updateMoocSubject = (id: string, data: any) => api.put(`${BASE}/mooc-subjects/${id}`, data).then((r) => r.data);
export const deleteMoocSubject = (id: string) => api.delete(`${BASE}/mooc-subjects/${id}`).then((r) => r.data);
