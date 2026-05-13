/**
 * faculty-teaching — admin-portal client for the three Phase D
 * sub-collections under Faculty (Subjects taught, Research scholars,
 * Books authored). Each entity shares an identical CRUD shape; the
 * service exposes one function per (entity, verb) pair.
 */

import api from './api';

const BASE = '/people';

// ─── Types ─────────────────────────────────────────────────────────

export type FacultySubjectRole =
  | 'instructor'
  | 'co_instructor'
  | 'lab_incharge'
  | 'tutorial';
export type FacultySubjectStatus = 'planned' | 'active' | 'completed';

export interface FacultySubjectAssignmentDoc {
  _id: string;
  collegeId: string;
  facultyId: string;
  subjectCode: string;
  subjectName: string;
  subjectId?: string;
  academicYear: string;
  semester?: number;
  role: FacultySubjectRole;
  weeklyHours?: number;
  studentCount?: number;
  status: FacultySubjectStatus;
  notes?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type FacultyResearchScholarType =
  | 'phd'
  | 'mtech'
  | 'mphil'
  | 'undergrad_project';
export type FacultyResearchScholarStatus =
  | 'ongoing'
  | 'completed'
  | 'discontinued'
  | 'awarded';

export interface FacultyResearchScholarDoc {
  _id: string;
  collegeId: string;
  facultyId: string;
  scholarName: string;
  scholarType: FacultyResearchScholarType;
  topic: string;
  registrationYear: number;
  completionYear?: number;
  status: FacultyResearchScholarStatus;
  coGuide?: string;
  university?: string;
  thesisLink?: string;
  notes?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type FacultyBookRole =
  | 'author'
  | 'co_author'
  | 'editor'
  | 'co_editor'
  | 'translator';
export type FacultyBookType =
  | 'textbook'
  | 'monograph'
  | 'edited_volume'
  | 'chapter';
export type FacultyBookLevel = 'international' | 'national' | 'regional';

export interface FacultyBookDoc {
  _id: string;
  collegeId: string;
  facultyId: string;
  title: string;
  role: FacultyBookRole;
  bookType: FacultyBookType;
  publisher: string;
  isbn?: string;
  year: number;
  edition?: string;
  pages?: number;
  level: FacultyBookLevel;
  coAuthors?: string;
  doi?: string;
  notes?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Subjects taught ──────────────────────────────────────────────

const subjectsBase = (fid: string) => `${BASE}/faculty/${fid}/subjects`;

export const listFacultySubjects = (
  facultyId: string,
): Promise<{ items: FacultySubjectAssignmentDoc[] }> =>
  api.get(subjectsBase(facultyId)).then((r) => r.data);

export const createFacultySubject = (
  facultyId: string,
  data: Partial<FacultySubjectAssignmentDoc>,
): Promise<FacultySubjectAssignmentDoc> =>
  api.post(subjectsBase(facultyId), data).then((r) => r.data);

export const updateFacultySubject = (
  facultyId: string,
  id: string,
  patch: Partial<FacultySubjectAssignmentDoc>,
): Promise<FacultySubjectAssignmentDoc> =>
  api.patch(`${subjectsBase(facultyId)}/${id}`, patch).then((r) => r.data);

export const archiveFacultySubject = (
  facultyId: string,
  id: string,
): Promise<{ archived: true; archivedAt: string }> =>
  api.delete(`${subjectsBase(facultyId)}/${id}`).then((r) => r.data);

// ─── Research scholars ────────────────────────────────────────────

const scholarsBase = (fid: string) => `${BASE}/faculty/${fid}/scholars`;

export const listFacultyScholars = (
  facultyId: string,
): Promise<{ items: FacultyResearchScholarDoc[] }> =>
  api.get(scholarsBase(facultyId)).then((r) => r.data);

export const createFacultyScholar = (
  facultyId: string,
  data: Partial<FacultyResearchScholarDoc>,
): Promise<FacultyResearchScholarDoc> =>
  api.post(scholarsBase(facultyId), data).then((r) => r.data);

export const updateFacultyScholar = (
  facultyId: string,
  id: string,
  patch: Partial<FacultyResearchScholarDoc>,
): Promise<FacultyResearchScholarDoc> =>
  api.patch(`${scholarsBase(facultyId)}/${id}`, patch).then((r) => r.data);

export const archiveFacultyScholar = (
  facultyId: string,
  id: string,
): Promise<{ archived: true; archivedAt: string }> =>
  api.delete(`${scholarsBase(facultyId)}/${id}`).then((r) => r.data);

// ─── Books ────────────────────────────────────────────────────────

const booksBase = (fid: string) => `${BASE}/faculty/${fid}/books`;

export const listFacultyBooks = (
  facultyId: string,
): Promise<{ items: FacultyBookDoc[] }> =>
  api.get(booksBase(facultyId)).then((r) => r.data);

export const createFacultyBook = (
  facultyId: string,
  data: Partial<FacultyBookDoc>,
): Promise<FacultyBookDoc> =>
  api.post(booksBase(facultyId), data).then((r) => r.data);

export const updateFacultyBook = (
  facultyId: string,
  id: string,
  patch: Partial<FacultyBookDoc>,
): Promise<FacultyBookDoc> =>
  api.patch(`${booksBase(facultyId)}/${id}`, patch).then((r) => r.data);

export const archiveFacultyBook = (
  facultyId: string,
  id: string,
): Promise<{ archived: true; archivedAt: string }> =>
  api.delete(`${booksBase(facultyId)}/${id}`).then((r) => r.data);
