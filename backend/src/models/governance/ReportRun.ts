import { Schema, model, Document, Types } from 'mongoose';

/**
 * ReportRun — one execution of a declarative report definition.
 * Strategic Gap 4 Phase A.
 *
 * The declarative engine itself is a registry of `ReportDefinition`s
 * (see `modules/governance/report-registry.ts`). Each run captures
 * the parameters the operator chose, the resulting rows, and an
 * audit trail. Phase A ships 12 v1 reports; the engine is the
 * foundation for the doc's "natural-language report queries"
 * differentiation in Phase B.
 *
 * Status:
 *   queued      — created, not yet executed
 *   running     — executor working on it
 *   success     — finished, `result` populated
 *   failed      — executor threw; `error` captures the reason
 *   unimplemented — definition exists but runner is Phase B
 */

export const REPORT_RUN_STATUSES = [
  'queued', 'running', 'success', 'failed', 'unimplemented',
] as const;
export type ReportRunStatus = (typeof REPORT_RUN_STATUSES)[number];

export interface IReportRun extends Document {
  collegeId: Types.ObjectId;
  /** Definition code from the registry (e.g. 'admissions-funnel'). */
  definitionCode: string;
  /** Parameter values the operator supplied (e.g. { from: '2026-01-01' }). */
  parameters: Record<string, unknown>;
  status: ReportRunStatus;
  /** Aggregated rows. Cap at the service layer to avoid 16MB doc blowups. */
  result?: unknown[];
  /** Number of rows in result; cheaper to read than length(result). */
  resultCount: number;
  /** Optional pre-aggregated summary (totals, breakdowns) the frontend
   *  renders alongside the row table. */
  summary?: Record<string, unknown>;
  /** When the runner returns "Phase B" instead of real data. */
  unimplementedReason?: string;
  error?: string;
  executedAt?: Date;
  /** Wall-clock duration of the runner in ms. */
  durationMs?: number;
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IReportRun>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    definitionCode: { type: String, required: true, trim: true },
    parameters: { type: Schema.Types.Mixed, required: true, default: {} },
    status: { type: String, enum: REPORT_RUN_STATUSES, required: true, default: 'queued' },
    result: { type: Schema.Types.Mixed },
    resultCount: { type: Number, default: 0 },
    summary: { type: Schema.Types.Mixed },
    unimplementedReason: { type: String, trim: true },
    error: { type: String, trim: true },
    executedAt: { type: Date },
    durationMs: { type: Number, min: 0 },
    requestedBy: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, definitionCode: 1, createdAt: -1 });
schema.index({ collegeId: 1, status: 1, createdAt: -1 });

export const ReportRun = model<IReportRun>('ReportRun', schema);
