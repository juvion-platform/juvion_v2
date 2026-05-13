/**
 * faculty-documents — admin-portal client for the FacultyDocument
 * credential-evidence store (Strategic Gap 1 Phase B).
 *
 * The backend lives at /api/people/faculty/:facultyId/documents and
 * uses multipart/form-data for the upload route — same shape as the
 * student photo upload. List / view / patch / archive are plain JSON.
 */

import api from './api';

const BASE = '/people';

export const FACULTY_DOCUMENT_CATEGORIES = [
  'identity',
  'education',
  'certification',
  'experience',
  'current_employment',
  'research',
  'training',
  'award',
  'membership',
  'administrative',
  'hr_payroll',
  'self_declaration',
] as const;
export type FacultyDocumentCategory = (typeof FACULTY_DOCUMENT_CATEGORIES)[number];

export type FacultyDocumentVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface FacultyDocumentDoc {
  _id: string;
  collegeId: string;
  facultyId: string;
  category: FacultyDocumentCategory;
  documentType: string;
  title: string;
  description?: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  pageCount?: number;
  issuingAuthority?: string;
  issuedAt?: string;
  validUntil?: string;
  referenceNumber?: string;
  verificationStatus: FacultyDocumentVerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadFacultyDocumentInput {
  file: File;
  category: FacultyDocumentCategory;
  documentType: string;
  title: string;
  description?: string;
  issuingAuthority?: string;
  issuedAt?: string;
  validUntil?: string;
  referenceNumber?: string;
}

export interface FacultyDocumentViewUrl {
  url: string;
  expiresAt: string;
  mimeType: string;
  sizeBytes: number;
  title: string;
}

export const listFacultyDocuments = (
  facultyId: string,
): Promise<{ items: FacultyDocumentDoc[] }> =>
  api.get(`${BASE}/faculty/${facultyId}/documents`).then((r) => r.data);

export const uploadFacultyDocument = (
  facultyId: string,
  input: UploadFacultyDocumentInput,
): Promise<FacultyDocumentDoc> => {
  // Multipart form-data so the file flows alongside the metadata in
  // one request. Same content-type pattern as the photo upload.
  const fd = new FormData();
  fd.append('file', input.file);
  fd.append('category', input.category);
  fd.append('documentType', input.documentType);
  fd.append('title', input.title);
  if (input.description) fd.append('description', input.description);
  if (input.issuingAuthority) fd.append('issuingAuthority', input.issuingAuthority);
  if (input.issuedAt) fd.append('issuedAt', input.issuedAt);
  if (input.validUntil) fd.append('validUntil', input.validUntil);
  if (input.referenceNumber) fd.append('referenceNumber', input.referenceNumber);
  return api
    .post(`${BASE}/faculty/${facultyId}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const getFacultyDocumentViewUrl = (
  facultyId: string,
  docId: string,
): Promise<FacultyDocumentViewUrl> =>
  api
    .get(`${BASE}/faculty/${facultyId}/documents/${docId}/view`)
    .then((r) => r.data);

export const updateFacultyDocument = (
  facultyId: string,
  docId: string,
  patch: Partial<Pick<FacultyDocumentDoc,
    'title' | 'description' | 'issuingAuthority' | 'issuedAt'
    | 'validUntil' | 'referenceNumber' | 'category' | 'documentType'
  >>,
): Promise<FacultyDocumentDoc> =>
  api
    .patch(`${BASE}/faculty/${facultyId}/documents/${docId}`, patch)
    .then((r) => r.data);

export const archiveFacultyDocument = (
  facultyId: string,
  docId: string,
): Promise<{ archived: true; archivedAt: string }> =>
  api
    .delete(`${BASE}/faculty/${facultyId}/documents/${docId}`)
    .then((r) => r.data);

// ─── Phase B3 — verification workflow ────────────────────────────────

export const approveFacultyDocument = (
  facultyId: string,
  docId: string,
  notes?: string,
): Promise<FacultyDocumentDoc> =>
  api
    .post(`${BASE}/faculty/${facultyId}/documents/${docId}/approve`, { notes })
    .then((r) => r.data);

export const rejectFacultyDocument = (
  facultyId: string,
  docId: string,
  reason: string,
): Promise<FacultyDocumentDoc> =>
  api
    .post(`${BASE}/faculty/${facultyId}/documents/${docId}/reject`, { reason })
    .then((r) => r.data);

/**
 * The queue endpoint populates `facultyId` with the faculty
 * sub-document (with personId → name) so the UI can render
 * faculty name + employee code per row without a per-row
 * round-trip.
 */
export interface PendingFacultyDoc extends Omit<FacultyDocumentDoc, 'facultyId'> {
  facultyId:
    | string
    | {
        _id: string;
        employeeCode?: string;
        designation?: string;
        personId?: { _id?: string; name?: string };
      };
}

export const listPendingFacultyDocuments = (): Promise<{ items: PendingFacultyDoc[] }> =>
  api.get(`${BASE}/faculty-document-queue`).then((r) => r.data);
