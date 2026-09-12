import { Schema, model, Document } from 'mongoose';

/**
 * Point-in-time record of a student's CCD compound risk score.
 *
 * `computeRiskScore` recalculates from live, decaying signals — it holds no
 * history. Without this collection the question "did contacting this student
 * help?" is unanswerable, and unlike most gaps it cannot be backfilled: once a
 * signal decays the score that existed at the time is gone for good. So the
 * write lands now even though the effectiveness dashboard that consumes it
 * ships later.
 *
 * Written on every `computeAndUpdateCCDAlert` run, including runs that produce
 * NO priority — a student dropping back below the P3 line is precisely the
 * recovery we want to be able to see.
 */
export interface IRiskScoreSnapshot extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  score: number;
  priority?: string | null;
  breakdown: {
    baseTotal: number;
    crossModuleMultiplier: number;
    temporalMultiplier: number;
    finalScore: number;
  };
  capturedAt: Date;
}

const schema = new Schema<IRiskScoreSnapshot>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  score: { type: Number, required: true },
  priority: { type: String, enum: ['P1', 'P2', 'P3', null], default: null },
  breakdown: {
    baseTotal: Number,
    crossModuleMultiplier: Number,
    temporalMultiplier: Number,
    finalScore: Number,
  },
  capturedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, capturedAt: -1 });

export const RiskScoreSnapshot = model<IRiskScoreSnapshot>('RiskScoreSnapshot', schema);
