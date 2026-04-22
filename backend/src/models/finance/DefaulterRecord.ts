import { Schema, model, Document } from 'mongoose';

export interface IDistressSignal {
  type: string;
  value: number;
  weight: number;
}

export interface IDefaulterRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  invoiceId: Schema.Types.ObjectId;
  overdueAmount: number;
  daysOverdue: number;
  escalationStage: 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'welfare_referred' | 'resolved' | 'exited_hardship' | 'exited_write_off';
  welfareReferralStatus: 'none' | 'pending' | 'referred' | 'returned';
  distressSignals: IDistressSignal[];
  distressScore?: number;
  resolutionDate?: Date;
  resolutionType?: string;
  /**
   * Set by `POST /api/finance/students/:id/pause-escalation` (plan §1.8).
   * The nightly `fee-alerts-cron` skips a student if this value is a
   * future date. `null` or `undefined` means auto-escalation is live.
   */
  autoEscalationPaused?: Date | null;
  /**
   * Set by `fee-alerts-cron` every time a DefaulterRecord is advanced.
   * The cron uses this for same-day idempotency: if
   * `lastEscalationAt >= startOfToday` the student is skipped on re-runs.
   */
  lastEscalationAt?: Date;
  metadata?: Record<string, unknown>;
}

const distressSignalSchema = new Schema<IDistressSignal>({
  type: { type: String },
  value: { type: Number },
  weight: { type: Number },
}, { _id: false });

const schema = new Schema<IDefaulterRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  overdueAmount: { type: Number, required: true },
  daysOverdue: { type: Number, required: true, default: 0 },
  escalationStage: {
    type: String,
    enum: ['stage_1', 'stage_2', 'stage_3', 'stage_4', 'welfare_referred', 'resolved', 'exited_hardship', 'exited_write_off'],
    default: 'stage_1',
  },
  welfareReferralStatus: {
    // 'pending' added by the fee-alerts-cron feature (T5): the cron
    // sets this when a DefaulterRecord crosses the welfare_referred
    // threshold (≥ 61 days overdue). The Welfare module picks it up
    // and transitions it to 'referred' / 'returned' downstream.
    type: String,
    enum: ['none', 'pending', 'referred', 'returned'],
    default: 'none',
  },
  distressSignals: { type: [distressSignalSchema], default: [] },
  distressScore: { type: Number },
  resolutionDate: { type: Date },
  resolutionType: { type: String, enum: ['payment', 'write_off', 'concession', 'other'] },
  autoEscalationPaused: { type: Date, default: null },
  lastEscalationAt: { type: Date },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ collegeId: 1, escalationStage: 1 });
schema.index({ collegeId: 1, studentId: 1 });

export const DefaulterRecord = model<IDefaulterRecord>('DefaulterRecord', schema);
