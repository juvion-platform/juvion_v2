/**
 * bulk-imports — admin-portal client for the schema-driven bulk-import
 * surface (Strategic Gap 2 Phase A). Mounted under
 * /api/platform/bulk-imports.
 */

import api from './api';

const BASE = '/platform/bulk-imports';

export type ImportJobStatus =
  | 'pending'
  | 'parsing'
  | 'preview_ready'
  | 'committing'
  | 'completed'
  | 'partial'
  | 'failed';

export interface ImportEntityFieldDef {
  fieldKey: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'objectIdRef';
  required: boolean;
  meta?: Record<string, unknown>;
}

export interface ImportEntityTypeDef {
  entityType: string;
  label: string;
  description: string;
  fields: ImportEntityFieldDef[];
  sampleRow: Record<string, string>;
}

export interface ImportJobRowResult {
  row: number;
  /**
   * `blocked` is a valid row the business rules refused to write (sealed /
   * exited / alumni, or a change import may not make). It is not an error:
   * it never reaches commit and never counts toward `failureCount`. The
   * reason lives in `notes`.
   */
  outcome: 'success' | 'error' | 'blocked' | 'skipped';
  createdId?: string;
  error?: string;
  raw?: Record<string, unknown>;
  notes?: string[];
}

export interface ImportJobDoc {
  _id: string;
  collegeId: string;
  performedBy: string;
  entityType: string;
  schemaSnapshot: ImportEntityFieldDef[];
  fileName: string;
  /** Undefined when the source archive wasn't attempted (S3 not configured server-side). */
  s3Key?: string;
  mimeType: string;
  sizeBytes: number;
  status: ImportJobStatus;
  totalRows: number;
  successCount: number;
  failureCount: number;
  /** Rows the business rules refused to write. Never part of failureCount. */
  blockedCount?: number;
  skippedCount?: number;
  results: ImportJobRowResult[];
  errorSummary?: string;
  startedAt: string;
  completedAt?: string;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportPreviewRow {
  row: number;
  raw: Record<string, string>;
  valid: boolean;
  errors: Array<{ field: string; error: string }>;
}

export interface ImportPreviewResponse {
  job: ImportJobDoc;
  headers: string[];
  previewRows: ImportPreviewRow[];
  validCount: number;
  errorCount: number;
}

export const listImportEntityTypes = (): Promise<{ items: ImportEntityTypeDef[] }> =>
  api.get(`${BASE}/entity-types`).then((r) => r.data);

export const listImportJobs = (
  entityType?: string,
): Promise<{ items: ImportJobDoc[] }> =>
  api
    .get(BASE, { params: entityType ? { entityType } : undefined })
    .then((r) => r.data);

export const getImportJob = (jobId: string): Promise<ImportJobDoc> =>
  api.get(`${BASE}/${jobId}`).then((r) => r.data);

export const uploadImportFile = (
  entityType: string,
  file: File,
): Promise<ImportPreviewResponse> => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('entityType', entityType);
  return api
    .post(BASE, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

export const commitImportJob = (jobId: string, selectedRowNumbers?: number[]): Promise<ImportJobDoc> =>
  api.post(`${BASE}/${jobId}/commit`, { selectedRowNumbers }).then((r) => r.data);

export const archiveImportJob = (
  jobId: string,
): Promise<{ archived: true; archivedAt: string }> =>
  api.delete(`${BASE}/${jobId}`).then((r) => r.data);
