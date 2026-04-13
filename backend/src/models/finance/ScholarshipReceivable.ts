import { Schema, model, Document } from 'mongoose';

export interface IScholarshipReceivable extends Document {
  collegeId: Schema.Types.ObjectId;
  scholarshipClaimId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  expectedAmount: number;
  expectedDisbursementDate?: Date;
  status: string;
  disbursedAmount?: number;
  disbursedAt?: Date;
}

const schema = new Schema<IScholarshipReceivable>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  scholarshipClaimId: { type: Schema.Types.ObjectId, ref: 'ScholarshipClaim', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  expectedAmount: { type: Number, required: true },
  expectedDisbursementDate: { type: Date },
  status: { type: String, enum: ['pending', 'disbursed', 'overdue', 'converted_to_liability'], default: 'pending' },
  disbursedAmount: { type: Number },
  disbursedAt: { type: Date },
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });

export const ScholarshipReceivable = model<IScholarshipReceivable>('ScholarshipReceivable', schema);
