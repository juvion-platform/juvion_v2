import { Schema, model, Document } from 'mongoose';
export interface ICCDIntervention extends Document { collegeId: Schema.Types.ObjectId; alertId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; type: string; description: string; executedBy: Schema.Types.ObjectId; executedAt: Date; outcome?: string; followUpDate?: Date; followUpStatus?: string; linkedEntityId?: Schema.Types.ObjectId; linkedEntityType?: string; }
const schema = new Schema<ICCDIntervention>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  alertId: { type: Schema.Types.ObjectId, ref: 'CrisisAlert', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  type: { type: String, enum: ['mentor_outreach', 'counselling_referral', 'parent_contact', 'financial_aid_referral', 'academic_support', 'hostel_check', 'other'], required: true },
  description: { type: String, required: true },
  executedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  executedAt: { type: Date, required: true, default: Date.now },
  outcome: String,
  followUpDate: Date,
  followUpStatus: { type: String, enum: ['pending', 'completed', 'overdue'] },
  linkedEntityId: Schema.Types.ObjectId,
  linkedEntityType: String,
}, { timestamps: true });
schema.index({ collegeId: 1, alertId: 1 });
schema.index({ collegeId: 1, studentId: 1 });
export const CCDIntervention = model<ICCDIntervention>('CCDIntervention', schema);
