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
  IImportJobPinSummary,
  ImportJobStatus,
  IImportJobSchemaField,
} from '../../models/platform/ImportJob';
import {
  putObject,
  getPresignedUrl,
  isS3Configured,
} from '../../shared/s3/s3-client';
import {
  getImportSchema,
  serializeSchema,
  type ImportSchemaDefinition,
} from './bulk-import-registry';
import type {
  ImportRowAction, ImportCommitContext, ImportRowPinPreview,
} from './import-schemas/types';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import {
  resolveImportPinAcademicYear,
  IMPORT_AUTO_PIN_MAX_ROWS,
  type PinBudget,
} from '../people/student-import-pin';

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
  /**
   * Academic year to pin imported students against. Omitted means "the
   * college's current one"; supplying it is how a cohort is loaded ahead of
   * the year it belongs to.
   */
  academicYearId?: string;
}

/** What the whole file will pin against, decided once and echoed to the operator. */
export interface ImportPinContext {
  academicYearId: string | null;
  academicYearLabel?: string;
  /** Present when pinning is off for the entire job. */
  warning?: string;
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
    pinPreview?: ImportRowPinPreview;
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
  /**
   * EVERY row that commit would write, not just the ones in `previewRows`.
   *
   * `previewRows` is a display slice capped at PREVIEW_SUCCESS_LIMIT valid
   * rows; a client that derived its selection from it would silently drop
   * everything past the cap. This is the authoritative list to select from.
   * Integers only — the caller already has the display data it needs.
   */
  eligibleRowNumbers: number[];
  /** Absent for entity types that do not fee-pin. */
  pinContext?: ImportPinContext;
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

/**
 * Settle the academic year the job's fee pins resolve against.
 *
 * An explicitly chosen year is validated against the college rather than
 * trusted — it arrives from a form field, and a year belonging to another
 * tenant must not become a pin axis.
 */
async function resolvePinContext(
  collegeId: string,
  explicitAcademicYearId?: string,
): Promise<ImportPinContext> {
  if (explicitAcademicYearId) {
    if (!Types.ObjectId.isValid(explicitAcademicYearId)) {
      throw new AppError(400, 'academicYearId is not a valid id.');
    }
    const chosen = await AcademicYear.findOne({
      _id: explicitAcademicYearId,
      collegeId,
    })
      .select('_id label code')
      .lean();
    if (!chosen) throw new AppError(400, 'Academic year not found for this college.');
    return {
      academicYearId: String(chosen._id),
      academicYearLabel: chosen.label ?? chosen.code ?? '',
    };
  }

  const resolved = await resolveImportPinAcademicYear(collegeId);
  if (!resolved.ok) return { academicYearId: null, warning: resolved.message };
  return { academicYearId: resolved.academicYearId, academicYearLabel: resolved.label };
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
  if (!job.s3Key) {
    throw new AppError(
      503,
      'No source file was archived for this job because storage (AWS_S3_BUCKET) was not configured at upload time.',
    );
  }
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

  // ─ Generate the job _id up-front so we can name the S3 key if the
  //   archive is enabled.
  const jobOid = new Types.ObjectId();

  // The source archive is an audit convenience, not a correctness
  // requirement — an unconfigured bucket must not make imports impossible.
  // Where S3 IS configured a failed upload still aborts, preserving the
  // original guarantee for real deployments.
  let s3Key: string | undefined;
  if (isS3Configured()) {
    s3Key = s3KeyFor(collegeId, jobOid, fileName);
    await putObject({
      key: s3Key,
      body: fileBuffer,
      contentType: declaredMime,
      metadata: { entityType, fileName, collegeId },
    });
  }

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
      eligibleRowNumbers: [],
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
      eligibleRowNumbers: [],
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

  // Decided once for the whole file. Doing it per row would let a long import
  // straddle an academic-year rollover and split one cohort across two years.
  let pinContext: ImportPinContext | undefined;
  if (def.requiresPinAcademicYear) {
    pinContext = await resolvePinContext(collegeId, opts.academicYearId);
  }

  const ctx: ImportCommitContext = {
    collegeId,
    performedBy,
    jobId: String(jobOid),
    ...(pinContext?.academicYearId ? { academicYearId: pinContext.academicYearId } : {}),
    // Preview-only, and it must stay that way: reusing a cached match to
    // WRITE a pin would persist a structure that was superseded between
    // preview and commit. Commit builds its own context without one.
    previewCache: new Map<string, unknown>(),
  };
  /**
   * File-scoped claim ledger for `def.naturalKeys`: "<label>\0<value>" ->
   * the 1-based row that claimed it first. Lives here rather than in a
   * schema module because this loop is the only place with whole-file
   * state — module-level state in a schema would leak between two imports
   * running concurrently. Empty and never consulted for schemas that do not
   * declare `naturalKeys`.
   */
  const claimedKeys = new Map<string, number>();

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
    let pinPreview: ImportRowPinPreview | undefined;

    // Whole-file duplicate check, before the (DB-backed) validateRow hook so
    // a duplicate row costs no queries. Only rows that passed field
    // validation take part: a row that is already failing will never be
    // written, so it must neither collide nor claim an identity.
    if (valid && def.naturalKeys) {
      const keys = def.naturalKeys(typedRow);
      for (const k of keys) {
        const claimedBy = claimedKeys.get(`${k.label}\u0000${k.value}`);
        if (claimedBy !== undefined) {
          errors.push({
            field: '_row',
            error: `duplicate ${k.label} "${k.value}" — also on row ${claimedBy}`,
          });
          valid = false;
          break;
        }
      }
      // Claim only if this row survived: an identity claimed by a failed row
      // would produce a false collision for a later, legitimate row.
      if (valid) {
        for (const k of keys) claimedKeys.set(`${k.label}\u0000${k.value}`, rowIdx);
      }
    }

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
        pinPreview = rowRes.pinPreview;
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
      // `blocked` is its own outcome, not an error. It used to persist as
      // outcome:'error' with error:'' (empty, since a blocked row collects no
      // field errors), which made commit count it as a failure — a job whose
      // only anomaly was a sealed record reported "1 failed" for a row that
      // was never eligible. The reason lives in `notes`.
      outcome: blocked ? 'blocked' : valid ? 'success' : 'error',
      error: valid || blocked ? undefined : errors.map((e) => `${e.field}: ${e.error}`).join('; '),
      raw: valid ? typedRow : rawObj,
      action,
      notes,
      resolved,
      pinPreview,
    });

    // Preview slice. Always include error rows. Cap success rows.
    const successPreviewCount = previewRows.filter((p) => p.valid).length;
    const includeThisRow =
      !valid || successPreviewCount < PREVIEW_SUCCESS_LIMIT;
    if (includeThisRow) {
      previewRows.push({
        row: rowIdx, raw: rawObj, valid, errors, action, notes, resolved, pinPreview,
      });
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
    blockedCount: actionCounts.blocked,
    results,
    errorSummary:
      errorCount > 0
        ? `${errorCount} of ${parsed.rows.length} rows have validation errors.`
        : undefined,
    pinAcademicYearId: pinContext?.academicYearId
      ? new Types.ObjectId(pinContext.academicYearId)
      : undefined,
    pinContextWarning: pinContext?.warning,
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
    eligibleRowNumbers: job.results
      .filter((r) => r.outcome === 'success')
      .map((r) => r.row),
    ...(pinContext ? { pinContext } : {}),
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
  opts?: { selectedRowNumbers?: number[] },
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

  // Validate client-supplied row selection
  const allRowNums = new Set(job.results.map((r) => r.row));
  const eligibleRowNums = new Set(
    job.results.filter((r) => r.outcome === 'success').map((r) => r.row)
  );
  const selectedSet = opts?.selectedRowNumbers ? new Set(opts.selectedRowNumbers) : null;

  if (selectedSet) {
    for (const rowNum of selectedSet) {
      if (!allRowNums.has(rowNum)) {
        throw new AppError(
          400,
          `Invalid row reference: row ${rowNum} does not exist in this import job.`,
        );
      }
      if (!eligibleRowNums.has(rowNum)) {
        const rowResult = job.results.find((r) => r.row === rowNum);
        throw new AppError(
          400,
          `Invalid row selection: row ${rowNum} is not eligible for import (status: ${rowResult?.outcome}).`,
        );
      }
    }
  }

  job.status = 'committing';
  await job.save();

  let successCount = 0;
  let failureCount = 0;
  let blockedCount = 0;
  let skippedCount = 0;

  // No previewCache here on purpose — see ImportCommitContext. Commit always
  // re-resolves against live data so a structure superseded since preview is
  // never persisted as a pin.
  const pinBudget: PinBudget | undefined = def.requiresPinAcademicYear
    ? { remaining: IMPORT_AUTO_PIN_MAX_ROWS }
    : undefined;
  const ctx: ImportCommitContext = {
    collegeId,
    performedBy,
    jobId: String(job._id),
    ...(job.pinAcademicYearId ? { academicYearId: String(job.pinAcademicYearId) } : {}),
    ...(pinBudget ? { pinBudget } : {}),
  };
  const pinSummary: IImportJobPinSummary = {
    pinned: 0, alreadyPinned: 0, noMatch: 0, skipped: 0, errors: 0, totalPinnedAmount: 0,
  };

  for (let i = 0; i < job.results.length; i += 1) {
    const r = job.results[i]!;
    if (r.outcome === 'blocked') {
      // Never attempted, and never a failure: the business rules refused it
      // at preview and the operator was told so before confirming.
      blockedCount += 1;
      continue;
    }
    if (r.outcome !== 'success') {
      // Already-failed validation row — skip, keep the failure entry.
      failureCount += 1;
      continue;
    }

    // Exclude if selectedSet is provided but doesn't include this row
    if (selectedSet && !selectedSet.has(r.row)) {
      r.outcome = 'skipped';
      r.notes = ['skipped - not selected by operator'];
      skippedCount += 1;
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const { id, pinOutcome } = await def.commitOne(r.raw as Record<string, unknown>, ctx);
      r.createdId = id;
      // Keep outcome='success'; clear `raw` to save space — the
      // create succeeded, the row is now identifiable by createdId.
      r.raw = undefined;
      successCount += 1;
      // Tallied on its own axis. A pin that did not land leaves the row a
      // success: the student was imported, which is what the row claimed.
      if (pinOutcome) {
        r.pinOutcome = {
          kind: pinOutcome.kind,
          ...('message' in pinOutcome ? { message: pinOutcome.message } : {}),
          ...('reason' in pinOutcome ? { message: pinOutcome.reason } : {}),
          ...('fsiId' in pinOutcome ? { fsiId: pinOutcome.fsiId } : {}),
          ...(pinOutcome.kind === 'pinned' ? { totalAmount: pinOutcome.totalAmount } : {}),
        };
        if (pinOutcome.kind === 'pinned') {
          pinSummary.pinned += 1;
          pinSummary.totalPinnedAmount += pinOutcome.totalAmount;
        } else if (pinOutcome.kind === 'already-pinned') pinSummary.alreadyPinned += 1;
        else if (pinOutcome.kind === 'no-match') pinSummary.noMatch += 1;
        else if (pinOutcome.kind === 'skipped') pinSummary.skipped += 1;
        else pinSummary.errors += 1;
      }
    } catch (err) {
      r.outcome = 'error';
      r.error = (err as Error).message ?? 'commit failed';
      failureCount += 1;
    }
  }

  if (pinBudget && pinBudget.remaining <= 0) {
    // Never let truncation read as full coverage.
    // eslint-disable-next-line no-console
    console.warn(
      `[bulk-import] job=${String(job._id)} hit the ${IMPORT_AUTO_PIN_MAX_ROWS}-row auto-pin cap; `
      + `${pinSummary.skipped} row(s) imported unpinned and need a bulk pin.`,
    );
  }
  if (def.requiresPinAcademicYear) job.pinSummary = pinSummary;

  job.successCount = successCount;
  job.failureCount = failureCount;
  job.blockedCount = blockedCount;
  job.skippedCount = skippedCount;
  job.completedAt = new Date();
  // Blocked and skipped rows are excluded from this ladder on purpose: a job whose only
  // anomaly is a sealed record or a skipped row did not partially fail, it did exactly what
  // preview/operator choice said it would. The summary still names them so nothing is silent.
  job.status =
    failureCount === 0
      ? 'completed'
      : successCount === 0
        ? 'failed'
        : 'partial';
  if (failureCount > 0 || blockedCount > 0 || skippedCount > 0) {
    const parts = [`Committed ${successCount} of ${job.totalRows} rows`];
    if (failureCount > 0) parts.push(`${failureCount} failed`);
    if (blockedCount > 0) parts.push(`${blockedCount} blocked and not written`);
    if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
    job.errorSummary = `${parts.join('; ')}.`;
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
