import { Schema, model, Document } from 'mongoose';
export interface IHostelPenalty extends Document { collegeId: Schema.Types.ObjectId; violationId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; penaltyType: string; fineAmount?: number; effectiveDate: Date; expiryDate?: Date; status: string; appealDeadline?: Date; modifiedPenaltyType?: string; modifiedFineAmount?: number; }
const schema = new Schema<IHostelPenalty>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  violationId: { type: Schema.Types.ObjectId, ref: 'HostelViolation', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  penaltyType: { type: String, enum: ['warning', 'fine', 'suspension', 'expulsion'], required: true },
  fineAmount: Number,
  effectiveDate: { type: Date, required: true },
  expiryDate: Date,
  status: { type: String, enum: ['active', 'served', 'cancelled', 'modified'], default: 'active' },
  appealDeadline: Date,
  modifiedPenaltyType: String,
  modifiedFineAmount: Number,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1 });
export const HostelPenalty = model<IHostelPenalty>('HostelPenalty', schema);
