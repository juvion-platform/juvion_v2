import { Schema, model, Document } from 'mongoose';
export interface IRiskSignal extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; source: string; signalType: string; baseWeight: number; firstGenModifier: number; computedWeight: number; triggerData: unknown; receivedAt: Date; expiresAt: Date; decayed: boolean; consumedByAlertId?: Schema.Types.ObjectId; status: string; }
const schema = new Schema<IRiskSignal>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  source: { type: String, enum: ['M03', 'M04', 'M08', 'Juvi', 'M06'], required: true },
  signalType: { type: String, enum: ['attendance_drop', 'failing_grades', 'backlog_accumulation', 'fee_default', 'scholarship_loss', 'warden_concern', 'mess_attendance_drop', 'messaging_withdrawal', 'sentiment_anomaly', 'isolation_indicators', 'grievance_filed', 'counselling_active'], required: true },
  baseWeight: { type: Number, required: true },
  firstGenModifier: { type: Number, default: 0 },
  computedWeight: { type: Number, required: true },
  triggerData: Schema.Types.Mixed,
  receivedAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
  decayed: { type: Boolean, default: false },
  consumedByAlertId: Schema.Types.ObjectId,
  status: { type: String, enum: ['active', 'decayed', 'consumed', 'suppressed'], default: 'active' },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, status: 1, receivedAt: -1 });
export const RiskSignal = model<IRiskSignal>('RiskSignal', schema);
