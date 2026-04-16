import api from './api';

const BASE = '/people';

export const getStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ── Persons (raw) ───────────────────────────────────
export const listPersons = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/persons`, { params: { page, limit, search } }).then(r => r.data);
export const getPerson = (id: string) => api.get(`${BASE}/persons/${id}`).then(r => r.data);
export const deletePerson = (id: string) => api.delete(`${BASE}/persons/${id}`).then(r => r.data);

// ── Students ─────────────────────────────────────────
export const listStudents = (page = 1, limit = 20, status?: string, search?: string, onboardingStatus?: string, needsAttention?: boolean) =>
  api.get(`${BASE}/students`, { params: { page, limit, status, search, onboardingStatus, needsAttention } }).then(r => r.data);
export const getStudent = (id: string) => api.get(`${BASE}/students/${id}`).then(r => r.data);
export const createStudent = (data: any) => api.post(`${BASE}/students`, data).then(r => r.data);
export const updateStudent = (id: string, data: any) => api.put(`${BASE}/students/${id}`, data).then(r => r.data);
export const deleteStudent = (id: string) => api.delete(`${BASE}/students/${id}`).then(r => r.data);
export const uploadStudentPhoto = (studentId: string, file: File) => {
  const form = new FormData();
  form.append('photo', file);
  return api.post(`${BASE}/students/${studentId}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// ── Faculty ──────────────────────────────────────────
export const listFaculty = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/faculty`, { params: { page, limit, status, search } }).then(r => r.data);
export const getFaculty = (id: string) => api.get(`${BASE}/faculty/${id}`).then(r => r.data);
export const createFaculty = (data: any) => api.post(`${BASE}/faculty`, data).then(r => r.data);
export const updateFaculty = (id: string, data: any) => api.put(`${BASE}/faculty/${id}`, data).then(r => r.data);
export const deleteFaculty = (id: string) => api.delete(`${BASE}/faculty/${id}`).then(r => r.data);

// ── Staff ────────────────────────────────────────────
export const listStaff = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/staff`, { params: { page, limit, status, search } }).then(r => r.data);
export const getStaff = (id: string) => api.get(`${BASE}/staff/${id}`).then(r => r.data);
export const createStaff = (data: any) => api.post(`${BASE}/staff`, data).then(r => r.data);
export const updateStaff = (id: string, data: any) => api.put(`${BASE}/staff/${id}`, data).then(r => r.data);
export const deleteStaff = (id: string) => api.delete(`${BASE}/staff/${id}`).then(r => r.data);

// ── Parents ──────────────────────────────────────────
export const listParents = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/parents`, { params: { page, limit, search } }).then(r => r.data);
export const getParent = (id: string) => api.get(`${BASE}/parents/${id}`).then(r => r.data);
export const createParent = (data: any) => api.post(`${BASE}/parents`, data).then(r => r.data);
export const updateParent = (id: string, data: any) => api.put(`${BASE}/parents/${id}`, data).then(r => r.data);
export const deleteParent = (id: string) => api.delete(`${BASE}/parents/${id}`).then(r => r.data);

// ── Organizations ────────────────────────────────────
export const listOrganizations = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/organizations`, { params: { page, limit, search } }).then(r => r.data);
export const getOrganization = (id: string) => api.get(`${BASE}/organizations/${id}`).then(r => r.data);
export const createOrganization = (data: any) => api.post(`${BASE}/organizations`, data).then(r => r.data);
export const updateOrganization = (id: string, data: any) => api.put(`${BASE}/organizations/${id}`, data).then(r => r.data);
export const deleteOrganization = (id: string) => api.delete(`${BASE}/organizations/${id}`).then(r => r.data);

// ── Exit Requests (W10) ─────────────────────────────────
export const listExitRequests = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/exit-requests`, { params: { page, limit, status } }).then(r => r.data);
export const getExitRequest = (id: string) => api.get(`${BASE}/exit-requests/${id}`).then(r => r.data);
export const submitExitRequest = (studentId: string, data: any) =>
  api.post(`${BASE}/students/${studentId}/exit-request`, data).then(r => r.data);
export const approveExitRequest = (id: string, data: any) => api.put(`${BASE}/exit-requests/${id}/approve`, data).then(r => r.data);
export const rejectExitRequest = (id: string, data: any) => api.put(`${BASE}/exit-requests/${id}/reject`, data).then(r => r.data);
export const cancelExitRequest = (id: string) => api.put(`${BASE}/exit-requests/${id}/cancel`).then(r => r.data);

// ── Clearance Workflows (W10) ───────────────────────────
export const listClearanceWorkflows = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/clearance-workflows`, { params: { page, limit, status } }).then(r => r.data);
export const getClearanceWorkflow = (id: string) => api.get(`${BASE}/clearance-workflows/${id}`).then(r => r.data);
export const initiateClearance = (data: any) => api.post(`${BASE}/clearance-workflows`, data).then(r => r.data);

// ── Document Templates & Exit Documents (W10) ───────────
export const listDocumentTemplates = (page = 1, limit = 20, type?: string) =>
  api.get(`${BASE}/document-templates`, { params: { page, limit, type } }).then(r => r.data);
export const getDocumentTemplate = (id: string) => api.get(`${BASE}/document-templates/${id}`).then(r => r.data);
export const createDocumentTemplate = (data: any) => api.post(`${BASE}/document-templates`, data).then(r => r.data);
export const generateDocument = (data: any) => api.post(`${BASE}/documents/generate`, data).then(r => r.data);

// ── Alumni (W10) ────────────────────────────────────────
export const listAlumni = (page = 1, limit = 20, programmeId?: string) =>
  api.get(`${BASE}/alumni`, { params: { page, limit, programmeId } }).then(r => r.data);
export const getAlumni = (id: string) => api.get(`${BASE}/alumni/${id}`).then(r => r.data);
export const createAlumniRecord = (data: any) => api.post(`${BASE}/alumni`, data).then(r => r.data);
