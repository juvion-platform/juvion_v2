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

// ─── Publications (Phase B original spec — NAAC research outputs) ───

export type FacultyPublicationIndexing =
  | 'scopus' | 'wos' | 'ugc_care' | 'other_indexed' | 'none';
export type FacultyPublicationQuartile = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type FacultyPublicationLevel = 'international' | 'national' | 'regional';
export type FacultyPublicationType =
  | 'journal' | 'conference' | 'book_chapter' | 'symposium';

export interface FacultyPublicationDoc {
  _id: string;
  collegeId: string;
  facultyId: string;
  title: string;
  authors: string;
  authorPosition: string;
  type: FacultyPublicationType;
  journal: string;
  publisher?: string;
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  publicationDate?: string;
  indexingService: FacultyPublicationIndexing;
  quartile?: FacultyPublicationQuartile;
  impactPercentile?: number;
  level: FacultyPublicationLevel;
  sdgMapping?: string[];
  citationCount?: number;
  notes?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const pubBase = (fid: string) => `${BASE}/faculty/${fid}/publications`;

export const listFacultyPublications = (
  facultyId: string,
): Promise<{ items: FacultyPublicationDoc[] }> =>
  api.get(pubBase(facultyId)).then((r) => r.data);

export const createFacultyPublication = (
  facultyId: string,
  data: Partial<FacultyPublicationDoc>,
): Promise<FacultyPublicationDoc> =>
  api.post(pubBase(facultyId), data).then((r) => r.data);

export const updateFacultyPublication = (
  facultyId: string,
  id: string,
  patch: Partial<FacultyPublicationDoc>,
): Promise<FacultyPublicationDoc> =>
  api.patch(`${pubBase(facultyId)}/${id}`, patch).then((r) => r.data);

export const archiveFacultyPublication = (
  facultyId: string,
  id: string,
): Promise<{ archived: true; archivedAt: string }> =>
  api.delete(`${pubBase(facultyId)}/${id}`).then((r) => r.data);

// ─── Patents ──────────────────────────────────────────────────────

export type FacultyPatentStatus =
  | 'filed' | 'published' | 'granted' | 'abandoned' | 'expired';
export type FacultyPatentInventorRole =
  | 'sole_inventor' | 'first_inventor' | 'co_inventor';

export interface FacultyPatentDoc {
  _id: string;
  collegeId: string;
  facultyId: string;
  title: string;
  inventors: string;
  inventorRole: FacultyPatentInventorRole;
  jurisdiction: string;
  applicationNumber: string;
  patentNumber?: string;
  ipcClassification?: string;
  filingDate: string;
  publicationDate?: string;
  grantDate?: string;
  status: FacultyPatentStatus;
  assignee?: string;
  abstract?: string;
  notes?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const patBase = (fid: string) => `${BASE}/faculty/${fid}/patents`;

export const listFacultyPatents = (
  facultyId: string,
): Promise<{ items: FacultyPatentDoc[] }> =>
  api.get(patBase(facultyId)).then((r) => r.data);

export const createFacultyPatent = (
  facultyId: string,
  data: Partial<FacultyPatentDoc>,
): Promise<FacultyPatentDoc> =>
  api.post(patBase(facultyId), data).then((r) => r.data);

export const updateFacultyPatent = (
  facultyId: string,
  id: string,
  patch: Partial<FacultyPatentDoc>,
): Promise<FacultyPatentDoc> =>
  api.patch(`${patBase(facultyId)}/${id}`, patch).then((r) => r.data);

export const archiveFacultyPatent = (
  facultyId: string,
  id: string,
): Promise<{ archived: true; archivedAt: string }> =>
  api.delete(`${patBase(facultyId)}/${id}`).then((r) => r.data);

// ─── Projects ─────────────────────────────────────────────────────

export type FacultyProjectStatus =
  | 'proposed' | 'ongoing' | 'completed' | 'terminated';
export type FacultyProjectAgencyType =
  | 'government_national' | 'government_state' | 'industry'
  | 'international' | 'non_government' | 'internal';
export type FacultyProjectInvestigatorRole = 'pi' | 'co_pi' | 'investigator';

export interface FacultyProjectDoc {
  _id: string;
  collegeId: string;
  facultyId: string;
  title: string;
  fundingAgency: string;
  agencyType: FacultyProjectAgencyType;
  investigatorRole: FacultyProjectInvestigatorRole;
  coInvestigators?: string;
  sanctionAmount: number;
  sanctionOrderNumber?: string;
  sanctionOrderUrl?: string;
  sanctionDate?: string;
  startDate: string;
  endDate?: string;
  durationMonths?: number;
  status: FacultyProjectStatus;
  abstract?: string;
  outcomes?: string;
  notes?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const projBase = (fid: string) => `${BASE}/faculty/${fid}/projects`;

export const listFacultyProjects = (
  facultyId: string,
): Promise<{ items: FacultyProjectDoc[] }> =>
  api.get(projBase(facultyId)).then((r) => r.data);

export const createFacultyProject = (
  facultyId: string,
  data: Partial<FacultyProjectDoc>,
): Promise<FacultyProjectDoc> =>
  api.post(projBase(facultyId), data).then((r) => r.data);

export const updateFacultyProject = (
  facultyId: string,
  id: string,
  patch: Partial<FacultyProjectDoc>,
): Promise<FacultyProjectDoc> =>
  api.patch(`${projBase(facultyId)}/${id}`, patch).then((r) => r.data);

export const archiveFacultyProject = (
  facultyId: string,
  id: string,
): Promise<{ archived: true; archivedAt: string }> =>
  api.delete(`${projBase(facultyId)}/${id}`).then((r) => r.data);
