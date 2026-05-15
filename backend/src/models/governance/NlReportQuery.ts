import { Schema, model, Document, Types } from 'mongoose';

/**
 * 003-nl-report-queries §3 + §10.4 + §10.7.
 *
 * One doc per natural-language report query. Always stores the
 * PII-MASKED form of the question (raw never reaches the database —
 * the masker runs before the LLM call, masked-text is what's logged).
 *
 * `llmModel` (not `model`) avoids collision with Mongoose's
 * Document.model() method.
 * `reason` (not `refusalReason`) matches the HTTP refused-response
 * body key so wire + storage stay consistent.
 */

export type NlReportStatus = 'matched' | 'refused';

export interface INlReportQuery extends Document {
  collegeId: Types.ObjectId;
  /** PII-masked, capped 500 chars. */
  question: string;
  status: NlReportStatus;
  selectedReport?: string;
  params?: Record<string, unknown>;
  /** Populated only when status === 'refused'. Mirrors the HTTP body key. */
  reason?: string;
  /** Set when matched: the ReportRun the NL flow produced. */
  runId?: Types.ObjectId;
  performedBy: string;
  generatedAt: Date;
  llmModel: string;
  promptVersion: string;
  costInr: number;
  /** True when the cap-guard denied the LLM claim. */
  capReached?: boolean;
}

const schema = new Schema<INlReportQuery>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    question: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: ['matched', 'refused'], required: true },
    selectedReport: String,
    params: { type: Schema.Types.Mixed },
    reason: String,
    runId: { type: Schema.Types.ObjectId, ref: 'ReportRun' },
    performedBy: { type: String, required: true },
    generatedAt: { type: Date, required: true, default: Date.now },
    llmModel: { type: String, required: true },
    promptVersion: { type: String, required: true },
    costInr: { type: Number, required: true, min: 0 },
    capReached: { type: Boolean },
  },
  { timestamps: true },
);

// Story 1 — recent NL queries per college (history surface).
schema.index({ collegeId: 1, generatedAt: -1 });

// Story 3 — stats $facet pipeline filters by collegeId + status.
schema.index({ collegeId: 1, status: 1, generatedAt: -1 });

export const NlReportQuery = model<INlReportQuery>('NlReportQuery', schema);
