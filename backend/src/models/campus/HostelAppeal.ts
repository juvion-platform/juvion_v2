import { Schema, model, Document } from 'mongoose';
export interface IHostelAppeal extends Document { collegeId: Schema.Types.ObjectId; penaltyId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; grounds: string; supportingDocuments: string[]; reviewedBy?: Schema.Types.ObjectId; hearingDate?: Date; outcome?: string; outcomeRemarks?: string; status: string; }
const schema = new Schema<IHostelAppeal>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  penaltyId: { type: Schema.Types.ObjectId, ref: 'HostelPenalty', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  grounds: { type: String, required: true },
  supportingDocuments: [String],
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  hearingDate: Date,
  outcome: { type: String, enum: ['upheld', 'modified', 'overturned'] },
  outcomeRemarks: String,
  status: { type: String, enum: ['submitted', 'under_review', 'hearing_scheduled', 'resolved'], default: 'submitted' },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1 });
export const HostelAppeal = model<IHostelAppeal>('HostelAppeal', schema);
