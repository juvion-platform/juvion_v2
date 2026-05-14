import { Schema, model, Document } from 'mongoose';

// ─── 001-ai-lead-scoring §10.3 ────────────────────────────────────
// Daily aggregation per college. The scoring worker upserts into this
// doc on every job completion via `$inc`, so the stats endpoint (and
// dashboard card) can serve cheap aggregate reads without scanning
// audit logs. One doc per (collegeId, startOfDayUTC).

export interface ILeadScoringStats extends Document {
  collegeId: Schema.Types.ObjectId;
  date: Date; // UTC start-of-day bucket
  totalScored: number;
  llmScored: number;
  rulesOnlyScored: number;
  totalLlmCostInr: number;
  avgLatencyMs: number;
  gradeDistribution: { hot: number; warm: number; cold: number; dormant: number };
  llmCapHit: boolean;
  modelVersion?: string;
}

const schema = new Schema<ILeadScoringStats>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  date: { type: Date, required: true, index: true },
  totalScored: { type: Number, default: 0 },
  llmScored: { type: Number, default: 0 },
  rulesOnlyScored: { type: Number, default: 0 },
  totalLlmCostInr: { type: Number, default: 0 },
  avgLatencyMs: { type: Number, default: 0 },
  gradeDistribution: {
    _id: false,
    hot: { type: Number, default: 0 },
    warm: { type: Number, default: 0 },
    cold: { type: Number, default: 0 },
    dormant: { type: Number, default: 0 },
  },
  llmCapHit: { type: Boolean, default: false },
  modelVersion: String,
}, { timestamps: true });

// One row per (college, day) — upsert key for the worker's $inc writes.
schema.index({ collegeId: 1, date: -1 }, { unique: true });

export const LeadScoringStats = model<ILeadScoringStats>('LeadScoringStats', schema);
