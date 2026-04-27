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

// ── Student photos ───────────────────────────────────
// Wire-format mirrors backend photo-controller responses. Date fields
// are serialized as ISO strings on the wire.
//
//   POST   /people/students/:id/photo       → StudentPhotoMeta
//   DELETE /people/students/:id/photo       → 200 { deleted: true }
//   GET    /people/students/:id/photo-url   → StudentPhotoUrlsResponse
//                                             (both keys optional; empty {} when no photo)
export interface StudentPhotoMeta {
  original: string;
  thumb: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  uploadedAt: string;
}

export interface PhotoUrl { url: string; expiresAt: string }
export interface StudentPhotoUrlsResponse { thumb?: PhotoUrl; original?: PhotoUrl }

export async function uploadStudentPhoto(
  studentId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<StudentPhotoMeta> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post(`${BASE}/students/${studentId}/photo`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
  return res.data;
}

export async function deleteStudentPhoto(studentId: string): Promise<void> {
  await api.delete(`${BASE}/students/${studentId}/photo`);
}

export async function getStudentPhotoUrl(
  studentId: string,
  variant: 'thumb' | 'original' | 'both' = 'thumb',
): Promise<StudentPhotoUrlsResponse> {
  const res = await api.get(`${BASE}/students/${studentId}/photo-url`, { params: { variant } });
  return res.data;
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
