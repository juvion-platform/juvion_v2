import { Schema, model, Document } from 'mongoose';
export interface IHostelViolation extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; reportedBy: Schema.Types.ObjectId; violationType: string; description: string; evidence: string[]; severity: string; hearingDate?: Date; outcome?: string; status: string; welfareSignalSent: boolean; }
const schema = new Schema<IHostelViolation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  violationType: { type: String, required: true },
  description: { type: String, required: true },
  evidence: [String],
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  hearingDate: Date,
  outcome: String,
  status: { type: String, enum: ['reported', 'under_investigation', 'hearing_scheduled', 'penalty_assigned', 'dismissed', 'closed'], default: 'reported' },
  welfareSignalSent: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1 });
export const HostelViolation = model<IHostelViolation>('HostelViolation', schema);
