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
  // DO NOT remove this header override — it is load-bearing, not a stray
  // default. The shared `api` instance sets Content-Type: application/json
  // for every request. Without the override below, axios's default
  // transformRequest sees that JSON header on a FormData body and
  // JSON.stringify()s it right there — before the adapter ever gets a
  // chance to let the browser set its own multipart boundary. The result
  // is a request with an empty/garbage body and Content-Type: application/
  // json; the backend sees no req.file and previewHandler 400s with "No
  // file uploaded." Setting the header to 'multipart/form-data' here just
  // dodges that early JSON branch — axios strips this value again right
  // before the request goes out so the browser can add the real
  // `boundary=...` parameter. Same pattern as
  // services/bulk-imports.ts:uploadImportFile. Covered by the
  // "sends a multipart Content-Type override" test in
  // __tests__/student-import.test.ts — if that test goes red, so does
  // every student CSV upload.
  return api
    .post(`${BASE}/preview`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

/**
 * What the commit endpoint actually returns — a trimmed summary, not the
 * whole ImportJob.
 *
 * The failed and blocked rows travel WITH the response on purpose. Per-row
 * commit errors are recorded on the job, but the facade exposes only
 * template / preview / commit and a Registrar cannot open
 * /platform/bulk-imports to read a job (they hold people:*, not
 * platform:read). If the counts and rows did not come back here, a 300-row
 * import that half-failed would be indistinguishable from a clean one for
 * the only persona this door exists for.
 *
 * Per-row detail is capped server-side at 100 entries; the counts are exact.
 */
export interface ImportCommitSummary {
  jobId: string;
  status: string;
  totalRows: number;
  successCount: number;
  /** Rows that were attempted and threw. Blocked rows are NOT counted here. */
  failureCount: number;
  /** Rows the business rules refused to write. Never attempted. */
  blockedCount: number;
  errorSummary?: string;
  failedRows: Array<{ row: number; error: string }>;
  blockedRows: Array<{ row: number; reason: string }>;
  fileName?: string;
  createdAt?: string;
  completedAt?: string;
  /** True when `failedRows` / `blockedRows` were capped. Counts stay exact. */
  truncated?: boolean;
}

export const commitStudentImport = (jobId: string): Promise<ImportCommitSummary> =>
  api.post(`${BASE}/commit`, { jobId }).then((r) => r.data);

/** One row of the drawer's "recent imports" list — no per-row detail. */
export interface ImportJobListEntry {
  jobId: string;
  fileName: string;
  status: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  blockedCount: number;
  errorSummary?: string;
  createdAt?: string;
  completedAt?: string;
}

/**
 * Recent student imports for this college.
 *
 * Summary fields only — the server deliberately withholds per-row detail here,
 * because a job's `results[]` can hold up to 10,000 entries and this list is
 * ten jobs deep. Fetch one job's detail when the operator opens it.
 */
export const listStudentImportJobs = (limit?: number): Promise<{ items: ImportJobListEntry[] }> =>
  api.get(`${BASE}/jobs`, { params: limit ? { limit } : undefined }).then((r) => r.data);

/**
 * One past job, in the same shape as the commit response — which is what lets
 * the drawer render a fresh commit and a re-opened job through one component.
 */
export const getStudentImportJob = (jobId: string): Promise<ImportCommitSummary> =>
  api.get(`${BASE}/jobs/${jobId}`).then((r) => r.data);

function csvCell(value: string): string {
  return /[,"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Build the downloadable template.
 *
 * Mandatory columns get a trailing `*` so the operator can see what is
 * required without opening the schema panel. The server strips that marker
 * on upload (normalizeImportHeader), which is what makes the round-trip work.
 *
 * Header cells come from `fieldKey`, never from `label` — the backend
 * matches uploaded columns back to a schema field by exact `fieldKey`
 * string, so a header derived from the (operator-friendly, free-text)
 * label would fail to map on upload.
 *
 * Caveat: normalizeImportHeader strips at most ONE trailing `*`, so a
 * fieldKey that itself ends in `*` would not round-trip. No current field
 * does; a registry-driven backend test
 * (backend/src/modules/platform/__tests__/student-import-header-roundtrip.test.ts)
 * checks every field automatically and will catch it the day one is added.
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
