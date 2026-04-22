import { Schema, model, Types } from 'mongoose';

/**
 * FeeAlertsCronRun — per-college audit record written by the nightly
 * `fee-alerts-cron` BullMQ worker (see plan §1.5 / §2.2 of the
 * fee-collection-analytics-and-alerts spec).
 *
 * One document is created at the start of each run per active college and
 * updated with rolling counts as the cron iterates. A top-level error (DB
 * outage, cursor failure) is recorded via `topLevelError`. Per-student
 * errors accumulate in `errors[]` without aborting the run.
 *
 * Retention: the cron prunes snapshots older than 90 days (mirrors the
 * `FeePinAuditSnapshot` pattern from the fee-configuration feature).
 */

export type FeeAlertsStageKey =
  | 'stage_1'
  | 'stage_2'
  | 'stage_3'
  | 'stage_4'
  | 'welfare_referred';

export interface IFeeAlertsCronRunError {
  studentId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  message: string;
  stackSnippet?: string;
}

export interface IFeeAlertsCronRunAdvancedByStage {
  stage_1: number;
  stage_2: number;
  stage_3: number;
  stage_4: number;
  welfare_referred: number;
}

// NOTE: intentionally NOT extending mongoose's `Document` — the base class
// has a built-in `errors: ValidationError` getter that clashes with our
// per-run error log field. Using a plain data interface + `model<T>()` is
// the modern Mongoose-8 idiom and avoids the name collision.
export interface IFeeAlertsCronRun {
  _id: Types.ObjectId;
  collegeId: Types.ObjectId;
  startedAt: Date;
  finishedAt?: Date;
  advancedByStage: IFeeAlertsCronRunAdvancedByStage;
  skipped: number;
  alreadyAdvanced: number;
  unchanged: number;
  paused: number;
  errors: IFeeAlertsCronRunError[];
  topLevelError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const errorSchema = new Schema<IFeeAlertsCronRunError>(
  {
    studentId: { type: Schema.Types.ObjectId },
    invoiceId: { type: Schema.Types.ObjectId },
    message: { type: String, required: true },
    stackSnippet: { type: String },
  },
  { _id: false },
);

const advancedByStageSchema = new Schema<IFeeAlertsCronRunAdvancedByStage>(
  {
    stage_1: { type: Number, required: true, default: 0 },
    stage_2: { type: Number, required: true, default: 0 },
    stage_3: { type: Number, required: true, default: 0 },
    stage_4: { type: Number, required: true, default: 0 },
    welfare_referred: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const schema = new Schema<IFeeAlertsCronRun>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    advancedByStage: {
      type: advancedByStageSchema,
      required: true,
      default: () => ({
        stage_1: 0, stage_2: 0, stage_3: 0, stage_4: 0, welfare_referred: 0,
      }),
    },
    skipped: { type: Number, required: true, default: 0 },
    alreadyAdvanced: { type: Number, required: true, default: 0 },
    unchanged: { type: Number, required: true, default: 0 },
    paused: { type: Number, required: true, default: 0 },
    errors: { type: [errorSchema], default: [] },
    topLevelError: { type: String },
  },
  { timestamps: true },
);

// Dashboard query pattern: "latest run per college" (plan §2.4).
schema.index({ collegeId: 1, startedAt: -1 });

export const FeeAlertsCronRun = model<IFeeAlertsCronRun>(
  'FeeAlertsCronRun',
  schema,
);
