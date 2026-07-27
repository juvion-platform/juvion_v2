/**
 * student-import — admin-portal client for the student bulk-import surface
 * (Strategic Gap 2 Phase A, people-gated facade). Mounted under
 * /api/people/students/import/{template,preview,commit}; see
 * backend/src/modules/people/student-import-controller.ts.
 */
import api from './api';

const BASE = '/people/students/import';

export interface ImportField {
  fieldKey: string;
  label: string;
  type: string;
  required: boolean;
  meta?: Record<string, unknown>;
}

export interface ImportTemplate {
  entityType: string;
  label: string;
  description: string;
  fields: ImportField[];
  sampleRow: Record<string, string>;
}

/** What committing a row would do, as computed during preview. */
export type ImportRowAction = 'create' | 'update' | 'blocked';

export interface ImportPreviewRow {
  row: number;
  raw: Record<string, string>;
  valid: boolean;
  errors: Array<{ field: string; error: string }>;
  action?: ImportRowAction;
  /** Advisory side effects the commit would cause, e.g. guardians created. */
  notes?: string[];
  /** Label -> display value for the codes this row resolved. */
  resolved?: Record<string, string>;
}

export interface ImportPreview {
  job: { _id: string };
  headers: string[];
  previewRows: ImportPreviewRow[];
  validCount: number;
  errorCount: number;
  actionCounts: { create: number; update: number; blocked: number };
  /**
   * Counters summed server-side over every row. `previewRows` is capped at 50,
   * so these cannot be recomputed in the browser.
   */
  sideEffectTotals: Record<string, number>;
}

export const getStudentImportTemplate = (): Promise<ImportTemplate> =>
  api.get(`${BASE}/template`).then((r) => r.data);

export const previewStudentImport = (file: File): Promise<ImportPreview> => {
  const form = new FormData();
  form.append('file', file);
  // The shared `api` instance defaults Content-Type to application/json.
  // Left as-is, axios's default transformRequest sees that header, treats
  // this FormData as JSON-serializable, and stringifies it — the file
  // never goes out as multipart and the backend sees no req.file. The
  // override below is stripped again by axios itself before the request
  // goes out (browsers must set their own multipart boundary), but it is
  // required here so the JSON short-circuit above never triggers. Same
  // pattern as services/bulk-imports.ts:uploadImportFile.
  return api
    .post(`${BASE}/preview`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

export const commitStudentImport = (
  jobId: string,
): Promise<{ successCount: number; failureCount: number }> =>
  api.post(`${BASE}/commit`, { jobId }).then((r) => r.data);

function csvCell(value: string): string {
  return /[,"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Build the downloadable template.
 *
 * Mandatory columns get a trailing `*` so the operator can see what is
 * required without opening the schema panel. The server strips that marker
 * on upload (normalizeImportHeader), which is what makes the round-trip work.
 */
export function buildTemplateCsv(tpl: ImportTemplate): string {
  const header = tpl.fields
    .map((f) => (f.required ? `${f.fieldKey}*` : f.fieldKey))
    .join(',');
  const sample = tpl.fields
    .map((f) => csvCell(tpl.sampleRow[f.fieldKey] ?? ''))
    .join(',');
  return `${header}\n${sample}`;
}
