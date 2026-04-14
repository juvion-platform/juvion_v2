import { Schema, model, Document } from 'mongoose';
export interface ICounsellingReferral extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; referredBy: Schema.Types.ObjectId; referralSource: string; triggeringCaseId?: Schema.Types.ObjectId; triggeringCaseType?: string; status: string; appointmentDates: Date[]; followUpStatus: string; closedAt?: Date; closedReason?: string; }
const schema = new Schema<ICounsellingReferral>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  referredBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  referralSource: { type: String, enum: ['mentor', 'st5', 'self', 'parent', 'faculty', 'ccd_alert'], required: true },
  triggeringCaseId: Schema.Types.ObjectId,
  triggeringCaseType: { type: String, enum: ['grievance', 'crisis', 'misconduct', 'academic'] },
  status: { type: String, enum: ['referred', 'accepted', 'in_progress', 'completed', 'declined'], default: 'referred' },
  appointmentDates: [Date],
  followUpStatus: { type: String, enum: ['pending', 'on_track', 'missed', 'completed'], default: 'pending' },
  closedAt: Date,
  closedReason: String,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, status: 1 });
export const CounsellingReferral = model<ICounsellingReferral>('CounsellingReferral', schema);
