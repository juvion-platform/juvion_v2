import { Schema, model, Document } from 'mongoose';

export interface ICounselingAllotment extends Document {
  collegeId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId; allotmentOrder: number; collegeCode: string; branchCode: string; round: number; status: string;
  // W01 intake enhancements
  reportingDeadline?: Date;
  reportedAt?: Date;
  reportingStatus?: string;
  slideRound?: number;
}

const schema = new Schema<ICounselingAllotment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  allotmentOrder: Number,
  collegeCode: String,
  branchCode: String,
  round: { type: Number, required: true },
  status: { type: String, enum: ['allotted', 'accepted', 'cancelled', 'upgraded'], default: 'allotted' },
  // W01 intake enhancements
  reportingDeadline: Date,
  reportedAt: Date,
  reportingStatus: { type: String, enum: ['allotted', 'notified', 'reported', 'lapsed', 'surrendered'] },
  slideRound: Number,
}, { timestamps: true });



export const CounselingAllotment = model<ICounselingAllotment>('CounselingAllotment', schema);
