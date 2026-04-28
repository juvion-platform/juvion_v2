import { Schema, model, Types } from 'mongoose';

/**
 * LLMUsageSnapshot — weekly per-college audit row written by the
 * `llm-usage-weekly` cron worker (Mon 06:00 UTC). One document per
 * (collegeId, completed-week). See llm-spend-limits plan §1.3 / §1.9.
 *
 * Why a separate collection (vs. recomputing from AgentAction on demand):
 *   - audit-grade: captures `limitAtTime` and `alertThresholdAtTime` as
 *     they were at the moment the cron ran, so retroactive limit changes
 *     don't rewrite history;
 *   - cheap: ~52 rows/college/year (trivial growth, per plan risk #8);
 *   - readable: admin dashboards can render last-N-weeks bars without
 *     hammering AgentAction.aggregate().
 *
 * `byType` is intentionally `Schema.Types.Mixed` (free-form) so the cron
 * worker can write whatever AgentAction `type` keys are present in the
 * window — no schema migration is needed when a new agent action type
 * (e.g. `risk-narrative`) is introduced.
 *
 * Index `{ collegeId: 1, weekStart: -1 }` is intentionally NON-unique:
 * admin re-runs (manual cron trigger, retroactive recompute) are allowed
 * and expected.  Later-write-wins semantics live in the cron worker, NOT
 * the schema (per plan §1.9).
 *
 * Pattern: plain interface + `model<T>()` (no `extends Document`) —
 * mirrors AgentAction.ts and FeeAlertsCronRun.ts. Avoids the
 * mongoose `Document.errors` field clash on validation paths.
 */

export interface ILLMUsageSnapshot {
  _id: Types.ObjectId;
  collegeId: Types.ObjectId;
  weekStart: Date;
  weekEnd: Date;
  totalCostInr: number;
  totalCalls: number;
  byType: Record<string, number>;
  limitAtTime: number;
  alertThresholdAtTime: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ILLMUsageSnapshot>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    totalCostInr: { type: Number, required: true, min: 0 },
    totalCalls: { type: Number, required: true, min: 0 },
    byType: { type: Schema.Types.Mixed, default: {} },
    limitAtTime: { type: Number, required: true, min: 0 },
    alertThresholdAtTime: { type: Number, required: true },
  },
  { timestamps: true },
);

// Plan §2.3 — admin review of weekly usage (per-college, newest first).
// Non-unique: admin re-runs are allowed; later-write-wins is handled in
// the cron worker, not enforced at the schema layer.
schema.index({ collegeId: 1, weekStart: -1 });

export const LLMUsageSnapshot = model<ILLMUsageSnapshot>(
  'LLMUsageSnapshot',
  schema,
);
