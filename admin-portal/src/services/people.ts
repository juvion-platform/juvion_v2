import api from './api';

const BASE = '/people';

export const getStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ── Strategic Gap 7 — Persona catalog ────────────────────────────
export interface PersonaDescriptor {
  code: string;
  family: string;
  label: string;
  description: string;
  primaryModule: string;
  defaultRole: string;
  tier: 1 | 2 | 3;
  parentCode?: string;
  permissionsHint?: string;
}

export interface PersonaCatalog {
  all: PersonaDescriptor[];
  l1_l2: PersonaDescriptor[];
  l3: PersonaDescriptor[];
}

export const listPersonas = (): Promise<PersonaCatalog> =>
  api.get(`${BASE}/personas`).then((r) => r.data);

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

// ── Person-entity photos (Student / Faculty / Staff / Parent) ──────
// Wire-format mirrors backend photo-controller responses. Date fields
// are serialized as ISO strings on the wire. The same controller-factory
// serves all four entity types; the only thing that changes between
// them is the URL slug (`students` / `faculty` / `staff` / `parents`).
//
//   POST   /people/{entityType}/:id/photo       → StudentPhotoMeta
//   DELETE /people/{entityType}/:id/photo       → 200 { deleted: true }
//   GET    /people/{entityType}/:id/photo-url   → StudentPhotoUrlsResponse
//                                                 (both keys optional; empty {} when no photo)
export type PersonEntityType = 'students' | 'faculty' | 'staff' | 'parents';

export interface StudentPhotoMeta {
  original: string;
  thumb: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  uploadedAt: string;
}

export interface PhotoUrl { url: string; expiresAt: string }
export interface StudentPhotoUrlsResponse { thumb?: PhotoUrl; original?: PhotoUrl }

export async function uploadEntityPhoto(
  entityType: PersonEntityType,
  entityId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<StudentPhotoMeta> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post(`${BASE}/${entityType}/${entityId}/photo`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
  return res.data;
}

export async function deleteEntityPhoto(
  entityType: PersonEntityType,
  entityId: string,
): Promise<void> {
  await api.delete(`${BASE}/${entityType}/${entityId}/photo`);
}

export async function getEntityPhotoUrl(
  entityType: PersonEntityType,
  entityId: string,
  variant: 'thumb' | 'original' | 'both' = 'thumb',
): Promise<StudentPhotoUrlsResponse> {
  const res = await api.get(`${BASE}/${entityType}/${entityId}/photo-url`, { params: { variant } });
  return res.data;
}

// ── Compat shims (student-only, deprecated) ────────────────────────
// Thin wrappers around the entity-aware helpers above so any
// straggling callers still using the student-only API keep working.
// Remove once every consumer has migrated to `*EntityPhoto*`.

/** @deprecated Use `uploadEntityPhoto('students', studentId, ...)` instead. */
export function uploadStudentPhoto(
  studentId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<StudentPhotoMeta> {
  return uploadEntityPhoto('students', studentId, file, onProgress);
}

/** @deprecated Use `deleteEntityPhoto('students', studentId)` instead. */
export function deleteStudentPhoto(studentId: string): Promise<void> {
  return deleteEntityPhoto('students', studentId);
}

/** @deprecated Use `getEntityPhotoUrl('students', studentId, variant)` instead. */
export function getStudentPhotoUrl(
  studentId: string,
  variant: 'thumb' | 'original' | 'both' = 'thumb',
): Promise<StudentPhotoUrlsResponse> {
  return getEntityPhotoUrl('students', studentId, variant);
}

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

// ═══════════════════════════════════════════════════════════
// Exit / clearance / alumni workflow
// Complete backends (people/routes.ts) that had no frontend at all.
// ═══════════════════════════════════════════════════════════

// ─── Exit requests ────────────────────────────────────────
export const listExitRequests = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/exit-requests`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getExitRequest = (id: string) =>
  api.get(`${BASE}/exit-requests/${id}`).then(r => r.data);
export const submitExitRequest = (studentId: string, data: any) =>
  api.post(`${BASE}/students/${studentId}/exit-request`, data).then(r => r.data);
export const approveExitRequest = (id: string, data: Record<string, unknown> = {}) =>
  api.put(`${BASE}/exit-requests/${id}/approve`, data).then(r => r.data);
export const rejectExitRequest = (id: string, reason?: string) =>
  api.put(`${BASE}/exit-requests/${id}/reject`, { reason }).then(r => r.data);
export const cancelExitRequest = (id: string) =>
  api.put(`${BASE}/exit-requests/${id}/cancel`, {}).then(r => r.data);
export const getStudentExitSummary = (studentId: string) =>
  api.get(`${BASE}/students/${studentId}/exit-summary`).then(r => r.data);

// ─── Clearance ────────────────────────────────────────────
export const getClearanceDashboard = () =>
  api.get(`${BASE}/clearance-dashboard`).then(r => r.data);
export const listClearanceWorkflows = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/clearance-workflows`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getClearanceWorkflow = (id: string) =>
  api.get(`${BASE}/clearance-workflows/${id}`).then(r => r.data);
export const initiateClearance = (data: any) =>
  api.post(`${BASE}/clearance-workflows`, data).then(r => r.data);
export const listPendingClearanceItems = () =>
  api.get(`${BASE}/clearance-items/pending`).then(r => r.data);
export const completeClearanceItem = (id: string, data: Record<string, unknown> = {}) =>
  api.put(`${BASE}/clearance-items/${id}/complete`, data).then(r => r.data);
export const waiveClearanceItem = (id: string, reason?: string) =>
  api.put(`${BASE}/clearance-items/${id}/waive`, { reason }).then(r => r.data);

// ─── Exit documents ───────────────────────────────────────
export const listDocumentTemplates = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/document-templates`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createDocumentTemplate = (data: any) =>
  api.post(`${BASE}/document-templates`, data).then(r => r.data);
export const generateExitDocument = (data: any) =>
  api.post(`${BASE}/documents/generate`, data).then(r => r.data);
export const signExitDocument = (id: string, data: Record<string, unknown> = {}) =>
  api.put(`${BASE}/documents/${id}/sign`, data).then(r => r.data);
export const issueExitDocument = (id: string, data: Record<string, unknown> = {}) =>
  api.post(`${BASE}/documents/${id}/issue`, data).then(r => r.data);
export const revokeExitDocument = (id: string, reason?: string) =>
  api.put(`${BASE}/documents/${id}/revoke`, { reason }).then(r => r.data);

// ─── Alumni ───────────────────────────────────────────────
export const listAlumni = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/alumni`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAlumni = (id: string) =>
  api.get(`${BASE}/alumni/${id}`).then(r => r.data);
export const createAlumniRecord = (data: any) =>
  api.post(`${BASE}/alumni`, data).then(r => r.data);
