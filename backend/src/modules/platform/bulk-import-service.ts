/**
 * bulk-import-service — orchestrator for the schema-driven bulk-import
 * feature (Strategic Gap 2 Phase A).
 *
 * v1 flow (synchronous; no worker queue):
 *   1. uploadAndValidate(): operator uploads a CSV. The service parses
 *      it, runs every row through the per-field validators in the
 *      registry, persists the ImportJob with status='preview_ready',
 *      and returns the job + a preview slice (first 50 rows + every
 *      error row).
 *   2. commitJob(): operator confirms. The service iterates the
 *      previously-validated rows, calls the registry's commitOne for
 *      each, and stamps per-row outcomes. Status transitions to
 *      'completed' (all ok), 'partial' (some failed), or 'failed'
 *      (none committed).
 *
 * Failures are collected per-row, NEVER aborting the batch. This is
 * the "spreadsheet semantics" Indian operators expect — they want a
 * report of the 12 bad rows so they can fix and re-upload.
 *
 * v1 caps:
 *   - CSV only (RFC-4180-ish, inline parser, no new dep).
 *   - 10 MB file size cap.
 *   - 10k rows per job (refuses larger to keep the per-job Mongo doc
 *     under the 16 MB limit + so the synchronous commit completes in
 *     a single request).
 *
 * Multi-tenancy: every operation is collegeId-scoped. The S3 key
 * embeds collegeId so cross-tenant reads are physically impossible
 * via the shared bucket.
 */

import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import {
  ImportJob,
  IImportJob,
  IImportJobRowResult,
  ImportJobStatus,
  IImportJobSchemaField,
} from '../../models/platform/ImportJob';
import {
  putObject,
  getPresignedUrl,
} from '../../shared/s3/s3-client';
import {
  getImportSchema,
  serializeSchema,
  type ImportSchemaDefinition,
} from './bulk-import-registry';
import type { ImportRowAction } from './import-schemas/types';

// ─── Public constants ─────────────────────────────────────────────────

export const ALLOWED_IMPORT_MIMES = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel', // Excel-saved CSV sometimes carries this MIME
  'text/plain',               // some browsers send this for .csv
] as const;
export const IMPORT_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const IMPORT_MAX_ROWS = 10_000;
/** Preview slice — always includes every error row + up to this many success rows on top. */
export const PREVIEW_SUCCESS_LIMIT = 50;

// ─── Public types ─────────────────────────────────────────────────────

export interface UploadAndValidateOpts {
  collegeId: string;
  performedBy: string;
  entityType: string;
  fileBuffer: Buffer;
  fileName: string;
  declaredMime: string;
}

export interface ImportJobPreview {
  job: IImportJob;
  /** Headers from the CSV (column order preserved). */
  headers: string[];
  /** Subset of rows for UI display. Each row has the parsed values + per-field validation errors. */
  previewRows: Array<{
    row: number;
    raw: Record<string, string>;
    valid: boolean;
    errors: Array<{ field: string; error: string }>;
    action?: ImportRowAction;
    notes?: string[];
    /** Label -> display value for codes this row resolved (programme, branch). */
    resolved?: Record<string, string>;
  }>;
  validCount: number;
  errorCount: number;
  /** How many rows would create, update, or are blocked. */
  actionCounts: { create: number; update: number; blocked: number };
  /**
   * Schema-defined counters summed over every row — not just the previewed
   * ones. Empty for schemas without a validateRow hook.
   */
  sideEffectTotals: Record<string, number>;
}

// ─── CSV parser (RFC-4180-ish, no new dep) ────────────────────────────

/**
 * Normalize a CSV header cell to a schema `fieldKey`.
 *
 * Downloadable templates mark mandatory columns with a trailing `*`
 * (`name*`). The row mapper matches headers to `fieldKey` by exact string,
 * so without this a file downloaded from our own template would report every
 * required field as empty and fail every row.
 *
 * Strips surrounding whitespace and at most ONE trailing asterisk, so a
 * bare `fieldKey` — every CSV exported before templates gained the marker —
 * passes through unchanged.
 */
export function normalizeImportHeader(header: string): string {
  return header.trim().replace(/\s*\*$/, '').trim();
}

/**
 * Parse a CSV string into header[] + rows[][]. Handles quoted fields
 * with embedded commas, doubled-quote escapes, and CRLF line endings.
 * Not strict — institutions paste from Excel and we accept the
 * messiness. Empty trailing rows (just whitespace) are skipped.
 *
 * NOT supported in v1: multi-line strings inside quoted fields (rare
 * in institutional data; would require a state machine across lines).
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Normalize line endings.
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n').filter((l) => l.length > 0 || l === '');
  // Drop trailing all-empty lines.
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') {
    lines.pop();
  }
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  function parseLine(line: string): string[] {
    const out: string[] = [];
    let i = 0;
    let cur = '';
    let inQuotes = false;
    while (i < line.length) {
      const ch = line[i]!;
      if (inQuotes) {
        if (ch === '"') {
          // Doubled-quote escape inside a quoted field.
          if (line[i + 1] === '"') {
            cur += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        cur += ch;
        i += 1;
        continue;
      }
      if (ch === ',') {
        out.push(cur);
        cur = '';
        i += 1;
        continue;
      }
      if (ch === '"' && cur === '') {
        inQuotes = true;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
    }
    out.push(cur);
    return out;
  }

  const headers = parseLine(lines[0]!).map((h) => h.trim());
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    rows.push(parseLine(line));
  }
  return { headers, rows };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function isAllowedMime(mime: string): boolean {
  return (ALLOWED_IMPORT_MIMES as ReadonlyArray<string>).includes(mime);
}

function s3KeyFor(collegeId: string, jobOid: Types.ObjectId, fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  return `colleges/${collegeId}/bulk-imports/${String(jobOid)}/${safe}`;
}

function snapshotSchema(def: ImportSchemaDefinition): IImportJobSchemaField[] {
  return def.fields.map(({ fieldKey, label, type, required, meta }) => ({
    fieldKey,
    label,
    type,
    required,
    meta,
  }));
}

// ─── Reads ────────────────────────────────────────────────────────────

export async function listImportJobs(
  collegeId: string,
  opts: { limit?: number; entityType?: string } = {},
): Promise<IImportJob[]> {
  const limit = Math.min(opts.limit ?? 25, 100);
  const filter: Record<string, unknown> = {
    collegeId: new Types.ObjectId(collegeId),
    archivedAt: null,
  };
  if (opts.entityType) filter.entityType = opts.entityType;
  return ImportJob.find(filter).sort({ createdAt: -1 }).limit(limit);
}

export async function getImportJob(
  collegeId: string,
  jobId: string,
): Promise<IImportJob> {
  if (!Types.ObjectId.isValid(jobId)) throw new AppError(404, 'Import job not found');
  const doc = await ImportJob.findOne({
    _id: new Types.ObjectId(jobId),
    collegeId: new Types.ObjectId(collegeId),
    archivedAt: null,
  });
  if (!doc) throw new AppError(404, 'Import job not found');
  return doc;
}

export async function getImportJobSourceUrl(
  collegeId: string,
  jobId: string,
): Promise<{ url: string; expiresAt: Date }> {
  const job = await getImportJob(collegeId, jobId);
  return getPresignedUrl(job.s3Key, { expiresIn: 300 });
}

// ─── Writes ───────────────────────────────────────────────────────────

/**
 * Upload + parse + validate in a single call. Returns the persisted
 * ImportJob (status='preview_ready' or 'failed') plus a preview slice
 * for the UI to render before the operator confirms.
 */
export async function uploadAndValidate(
  opts: UploadAndValidateOpts,
): Promise<ImportJobPreview> {
  const { collegeId, performedBy, entityType, fileBuffer, fileName, declaredMime } = opts;

  // ─ Pre-checks
  const def = getImportSchema(entityType);
  if (!def) {
    throw new AppError(400, `Unknown entity type "${entityType}".`);
  }
  if (!isAllowedMime(declaredMime)) {
    throw new AppError(400, `Unsupported file type "${declaredMime}". Upload a .csv file.`);
  }
  if (fileBuffer.length > IMPORT_FILE_MAX_BYTES) {
    throw new AppError(400, 'File too large (max 10 MB).');
  }
  if (fileBuffer.length === 0) {
    throw new AppError(400, 'Empty file.');
  }

  // ─ Generate the job _id up-front so we can name the S3 key with it.
  const jobOid = new Types.ObjectId();
  const s3Key = s3KeyFor(collegeId, jobOid, fileName);

  // ─ Upload source to S3 first; the DB row only exists if the file
  //   landed. Same atomic-ish pattern as faculty-document-service.
  await putObject({
    key: s3Key,
    body: fileBuffer,
    contentType: declaredMime,
    metadata: { entityType, fileName, collegeId },
  });

  // ─ Parse.
  const text = fileBuffer.toString('utf-8');
  let parsed: { headers: string[]; rows: string[][] };
  try {
    parsed = parseCsv(text);
  } catch (err) {
    // Recoverable failure — still create the job so the operator sees
    // history, but mark it failed and surface the parse error.
    const failedJob = await ImportJob.create({
      _id: jobOid,
      collegeId: new Types.ObjectId(collegeId),
      performedBy,
      entityType,
      schemaSnapshot: snapshotSchema(def),
      fileName,
      s3Key,
      mimeType: declaredMime,
      sizeBytes: fileBuffer.length,
      status: 'failed' as ImportJobStatus,
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      errorSummary: `CSV parse failed: ${(err as Error).message}`,
      completedAt: new Date(),
    });
    return {
      job: failedJob,
      headers: [],
      previewRows: [],
      validCount: 0,
      errorCount: 0,
      actionCounts: { create: 0, update: 0, blocked: 0 },
      sideEffectTotals: {},
    };
  }

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    const failedJob = await ImportJob.create({
      _id: jobOid,
      collegeId: new Types.ObjectId(collegeId),
      performedBy,
      entityType,
      schemaSnapshot: snapshotSchema(def),
      fileName,
      s3Key,
      mimeType: declaredMime,
      sizeBytes: fileBuffer.length,
      status: 'failed' as ImportJobStatus,
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      errorSummary: 'CSV is empty or has no data rows below the header.',
      completedAt: new Date(),
    });
    return {
      job: failedJob,
      headers: parsed.headers,
      previewRows: [],
      validCount: 0,
      errorCount: 0,
      actionCounts: { create: 0, update: 0, blocked: 0 },
      sideEffectTotals: {},
    };
  }

  if (parsed.rows.length > IMPORT_MAX_ROWS) {
    throw new AppError(
      400,
      `Too many rows (${parsed.rows.length}). Maximum per job is ${IMPORT_MAX_ROWS}. Split the file and try again.`,
    );
  }

  // ─ Validate each row. We materialise per-row validation outcomes
  //   into ImportJobRowResult so commit can replay quickly without
  //   re-running validators.
  const previewRows: ImportJobPreview['previewRows'] = [];
  const results: IImportJobRowResult[] = [];
  let errorCount = 0;
  const actionCounts = { create: 0, update: 0, blocked: 0 };
  const sideEffectTotals: Record<string, number> = {};
  const ctx = { collegeId, performedBy };

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const rowIdx = i + 1; // 1-based, matches the spreadsheet's data-row count
    const cells = parsed.rows[i]!;
    const rawObj: Record<string, string> = {};
    parsed.headers.forEach((h, j) => {
      // Template headers carry a `*` on mandatory columns; map back to fieldKey.
      rawObj[normalizeImportHeader(h)] = cells[j] ?? '';
    });

    // Run each schema field's validator. Coerced values get attached
    // to the result so commit can read them back.
    const errors: Array<{ field: string; error: string }> = [];
    const typedRow: Record<string, unknown> = {};
    for (const field of def.fields) {
      const raw = rawObj[field.fieldKey] ?? '';
      const result = field.validate(raw, rawObj, ctx);
      if (!result.ok) {
        errors.push({ field: field.fieldKey, error: result.error });
      } else if (result.value !== '' && !(typeof result.value === 'number' && Number.isNaN(result.value))) {
        typedRow[field.fieldKey] = result.value;
      }
    }

    let valid = errors.length === 0;
    let blocked = false;
    let action: ImportRowAction | undefined;
    let notes: string[] | undefined;
    let resolved: Record<string, string> | undefined;

    // Async row check — DB-backed validation the sync field validators
    // cannot do. Skipped for rows that already failed, so a broken row does
    // not cost a query.
    if (valid && def.validateRow) {
      // eslint-disable-next-line no-await-in-loop
      const rowRes = await def.validateRow(typedRow, rawObj, ctx);
      if (!rowRes.ok) {
        valid = false;
        errors.push({ field: '_row', error: rowRes.error });
      } else {
        action = rowRes.action;
        notes = rowRes.notes;
        resolved = rowRes.resolved;
        actionCounts[rowRes.action] += 1;
        for (const [key, n] of Object.entries(rowRes.sideEffects ?? {})) {
          sideEffectTotals[key] = (sideEffectTotals[key] ?? 0) + n;
        }
        // A blocked row is not an error — it's a valid row the business
        // rules refuse (sealed/exited/alumni). It must never reach commit
        // (outcome below still becomes 'error' so commitImportJob skips
        // it), but it must NOT inflate errorCount, which is reserved for
        // genuine validation/reference failures. actionCounts.blocked is
        // the figure the operator sees for this bucket instead.
        if (rowRes.action === 'blocked') {
          valid = false;
          blocked = true;
        }
      }
    }

    if (!valid && !blocked) errorCount += 1;

    // The row entry — `raw` keeps the raw input for commit replay
    // AND error messages reference the raw value the user typed.
    results.push({
      row: rowIdx,
      outcome: valid ? 'success' : 'error',
      error: valid ? undefined : errors.map((e) => `${e.field}: ${e.error}`).join('; '),
      raw: valid ? typedRow : rawObj,
      action,
      notes,
      resolved,
    });

    // Preview slice. Always include error rows. Cap success rows.
    const successPreviewCount = previewRows.filter((p) => p.valid).length;
    const includeThisRow =
      !valid || successPreviewCount < PREVIEW_SUCCESS_LIMIT;
    if (includeThisRow) {
      previewRows.push({ row: rowIdx, raw: rawObj, valid, errors, action, notes, resolved });
    }
  }

  // ─ Persist the job.
  const status: ImportJobStatus =
    errorCount === parsed.rows.length ? 'failed' : 'preview_ready';
  const job = await ImportJob.create({
    _id: jobOid,
    collegeId: new Types.ObjectId(collegeId),
    performedBy,
    entityType,
    schemaSnapshot: snapshotSchema(def),
    fileName,
    s3Key,
    mimeType: declaredMime,
    sizeBytes: fileBuffer.length,
    status,
    totalRows: parsed.rows.length,
    successCount: 0,
    failureCount: errorCount,
    results,
    errorSummary:
      errorCount > 0
        ? `${errorCount} of ${parsed.rows.length} rows have validation errors.`
        : undefined,
  });

  return {
    job,
    headers: parsed.headers,
    previewRows,
    // Blocked rows are neither errors nor committable — exclude them from
    // both buckets. actionCounts.blocked is the figure for that bucket.
    validCount: parsed.rows.length - errorCount - actionCounts.blocked,
    errorCount,
    actionCounts,
    sideEffectTotals,
  };
}

/**
 * Commit the previously-validated rows of an already-created job.
 *
 * Iterates `job.results` and calls the registry's `commitOne` for
 * every row whose outcome is currently 'success' (= passed
 * validation). Per-row failures during commit get recorded in
 * `results[i]` with `outcome='error'` + the error message.
 *
 * Idempotency: refuses to commit a job that's not in
 * `preview_ready` state. Operators who want to retry must re-upload.
 */
export async function commitImportJob(
  collegeId: string,
  jobId: string,
  performedBy: string,
): Promise<IImportJob> {
  const job = await getImportJob(collegeId, jobId);
  if (job.status !== 'preview_ready') {
    throw new AppError(
      409,
      `Cannot commit job in status "${job.status}". Re-upload the file to retry.`,
    );
  }
  const def = getImportSchema(job.entityType);
  if (!def) {
    throw new AppError(500, `Schema for "${job.entityType}" not registered.`);
  }

  job.status = 'committing';
  await job.save();

  let successCount = 0;
  let failureCount = 0;
  const ctx = { collegeId, performedBy };

  for (let i = 0; i < job.results.length; i += 1) {
    const r = job.results[i]!;
    if (r.outcome !== 'success') {
      // Already-failed validation row — skip, keep the failure entry.
      failureCount += 1;
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const { id } = await def.commitOne(r.raw as Record<string, unknown>, ctx);
      r.createdId = id;
      // Keep outcome='success'; clear `raw` to save space — the
      // create succeeded, the row is now identifiable by createdId.
      r.raw = undefined;
      successCount += 1;
    } catch (err) {
      r.outcome = 'error';
      r.error = (err as Error).message ?? 'commit failed';
      failureCount += 1;
    }
  }

  job.successCount = successCount;
  job.failureCount = failureCount;
  job.completedAt = new Date();
  job.status =
    failureCount === 0
      ? 'completed'
      : successCount === 0
        ? 'failed'
        : 'partial';
  if (failureCount > 0) {
    job.errorSummary = `Committed ${successCount} of ${job.totalRows} rows; ${failureCount} failed.`;
  } else {
    job.errorSummary = undefined;
  }
  // Mark the results array as modified so Mongoose persists the per-row
  // outcome updates (mutating nested array entries doesn't trigger the
  // change-tracker on its own).
  job.markModified('results');
  await job.save();
  return job;
}

export async function archiveImportJob(
  collegeId: string,
  jobId: string,
): Promise<{ archived: true; archivedAt: Date }> {
  const job = await getImportJob(collegeId, jobId);
  const archivedAt = new Date();
  job.archivedAt = archivedAt;
  await job.save();
  return { archived: true, archivedAt };
}

// ─── Entity-type discovery ───────────────────────────────────────────

export function listEntityTypeDefinitions() {
  // Delegated to the registry; serialisation strips runtime functions
  // so the response is plain JSON-safe.
  // Inline-imported registry to avoid a `require()` call in a TS file.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { listImportEntityTypes } = require('./bulk-import-registry') as typeof import('./bulk-import-registry');
  return listImportEntityTypes().map(serializeSchema);
}
