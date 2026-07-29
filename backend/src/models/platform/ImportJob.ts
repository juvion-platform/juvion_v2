import { Schema, model, Document, Types } from 'mongoose';

/**
 * ImportJob — one bulk-import operation. Strategic Gap 2 Phase A.
 *
 * Lifecycle:
 *   pending          (job created, file uploaded, awaiting parse)
 *   parsing          (CSV being parsed + validated)
 *   preview_ready    (validation done, operator can commit or abandon)
 *   committing       (rows being written to the target collection)
 *   completed        (all rows committed successfully)
 *   partial          (some rows committed, some failed; results[] has details)
 *   failed           (parse or commit error before any rows committed)
 *
 * The `entityType` discriminator picks which schema definition applied
 * + which target collection received the rows. `schemaSnapshot` is a
 * frozen copy of the schema at job-creation time — if the schema
 * registry changes later we can still replay / audit historical jobs
 * with the exact field set the operator saw.
 *
 * Per-row outcomes live in `results[]` (success or error + row index +
 * raw input + reason). Cap is enforced at the service layer (currently
 * 10k rows × small JSON ≈ a few MB — fits Mongo's 16 MB doc limit
 * comfortably).
 *
 * Multi-tenancy: every row carries `collegeId`. The uploaded source
 * file lives at `colleges/<cid>/bulk-imports/<jobId>/<filename>` so
 * S3 access naturally scopes by tenant.
 */

export const IMPORT_JOB_STATUSES = [
  'pending',
  'parsing',
  'preview_ready',
  'committing',
  'completed',
  'partial',
  'failed',
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

export interface IImportJobRowResult {
  /** 1-based row number in the input CSV (1 = first data row, not header). */
  row: number;
  /**
   * `blocked` is a valid row the business rules refuse to write (a sealed /
   * exited / alumni record, or a change import is not allowed to make). It
   * is deliberately NOT an error: it never reaches commit and never counts
   * toward failureCount. Only schemas with a validateRow hook can produce it.
   */
  outcome: 'success' | 'error' | 'blocked';
  /** Mongo _id of the row created on success — empty on error. */
  createdId?: string;
  /** Human-readable failure reason. */
  error?: string;
  /** Raw input row (object keyed by header). Useful for retry / audit. */
  raw?: Record<string, unknown>;
  /** What committing this row would do — set by the schema's optional validateRow hook. */
  action?: 'create' | 'update' | 'blocked';
  /** Advisory strings from validateRow (e.g. side effects the commit would cause). */
  notes?: string[];
  /** Label -> display value for codes this row resolved (programme, branch). */
  resolved?: Record<string, string>;
  /**
   * Fee-pin result for this row, when the schema attempted one. Recorded
   * separately from `outcome` because a pin never changes whether the row
   * itself succeeded — a student with no matching fee structure is imported,
   * not failed.
   */
  pinOutcome?: {
    kind: string;
    message?: string;
    fsiId?: string;
    totalAmount?: number;
  };
}

/** Roll-up of the per-row `pinOutcome`s, computed once at commit. */
export interface IImportJobPinSummary {
  pinned: number;
  alreadyPinned: number;
  noMatch: number;
  skipped: number;
  errors: number;
  totalPinnedAmount: number;
}

export interface IImportJobSchemaField {
  fieldKey: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'objectIdRef';
  required: boolean;
  /** For enum: allowed values. For objectIdRef: ref collection name. */
  meta?: Record<string, unknown>;
}

export interface IImportJob extends Document {
  collegeId: Types.ObjectId;
  /** Who created the job. */
  performedBy: string;

  /** Which entity type this job imports. Drives the schema + commit handler. */
  entityType: string;
  /** Frozen schema snapshot at creation time. */
  schemaSnapshot: IImportJobSchemaField[];

  /** Original filename uploaded by the operator. */
  fileName: string;
  /**
   * S3 location of the uploaded source file. Undefined when the archive
   * was never attempted because `AWS_S3_BUCKET` was not configured at
   * upload time — the archive is an audit convenience, not a correctness
   * requirement, so an unconfigured bucket must not block the import.
   */
  s3Key?: string;
  mimeType: string;
  sizeBytes: number;

  status: ImportJobStatus;

  /** Total data rows detected (after header). */
  totalRows: number;
  /** Set during commit. */
  successCount: number;
  failureCount: number;
  /**
   * Rows the business rules refused to write. Tallied at preview and carried
   * through commit. Kept separate from failureCount so a job whose only
   * anomaly is a sealed record does not report a failure that never happened.
   */
  blockedCount: number;

  /** Per-row outcomes — populated during validation + commit. */
  results: IImportJobRowResult[];

  /** Short summary surfaced on list views. */
  errorSummary?: string;

  /**
   * Academic year the fee-pin resolution runs against, frozen at preview.
   * Commit reads it back rather than re-deriving, so a college that flips
   * `isCurrent` between the two calls cannot split one cohort across two
   * years. Undefined when the job could not resolve one — see
   * `pinContextWarning`.
   */
  pinAcademicYearId?: Types.ObjectId;
  /** Why pinning is off for this whole job, if it is. Shown before the operator commits. */
  pinContextWarning?: string;
  /** Populated at commit for schemas that pin. */
  pinSummary?: IImportJobPinSummary;

  startedAt: Date;
  completedAt?: Date;
  archivedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const rowResultSchema = new Schema<IImportJobRowResult>(
  {
    row: { type: Number, required: true },
    outcome: { type: String, enum: ['success', 'error', 'blocked'], required: true },
    createdId: { type: String },
    error: { type: String },
    raw: { type: Schema.Types.Mixed },
    action: { type: String, enum: ['create', 'update', 'blocked'], required: false },
    notes: { type: [String], required: false },
    resolved: { type: Schema.Types.Mixed, required: false },
    pinOutcome: { type: Schema.Types.Mixed, required: false },
  },
  { _id: false },
);

const schemaFieldSchema = new Schema<IImportJobSchemaField>(
  {
    fieldKey: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'date', 'enum', 'objectIdRef'],
      required: true,
    },
    required: { type: Boolean, required: true, default: false },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const schema = new Schema<IImportJob>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    performedBy: { type: String, required: true },

    entityType: { type: String, required: true, index: true },
    schemaSnapshot: { type: [schemaFieldSchema], required: true },

    fileName: { type: String, required: true },
    s3Key: { type: String, required: false },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },

    status: {
      type: String,
      enum: IMPORT_JOB_STATUSES,
      required: true,
      default: 'pending',
    },

    totalRows: { type: Number, required: true, default: 0 },
    successCount: { type: Number, required: true, default: 0 },
    failureCount: { type: Number, required: true, default: 0 },
    blockedCount: { type: Number, required: true, default: 0 },

    results: { type: [rowResultSchema], default: [] },

    pinAcademicYearId: { type: Schema.Types.ObjectId, required: false },
    pinContextWarning: { type: String, required: false },
    pinSummary: { type: Schema.Types.Mixed, required: false },

    errorSummary: { type: String },

    startedAt: { type: Date, default: Date.now, required: true },
    completedAt: { type: Date },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Primary list pattern — recent jobs per college, newest first.
schema.index({ collegeId: 1, archivedAt: 1, createdAt: -1 });
schema.index({ collegeId: 1, entityType: 1, createdAt: -1 });

export const ImportJob = model<IImportJob>('ImportJob', schema);
