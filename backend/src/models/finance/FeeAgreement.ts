import { Schema, model, Document } from 'mongoose';

export interface IFeeAgreement extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  feeStructureInstanceId: Schema.Types.ObjectId;
  negotiatedTotal: number;
  baseTotal: number;
  waiverAmount: number;
  approvalAuthority: string;
  concessionDetails?: string;
  validityPeriodYears: number;
  status: string;
}

const schema = new Schema<IFeeAgreement>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  feeStructureInstanceId: { type: Schema.Types.ObjectId, ref: 'FeeStructureInstance', required: true },
  negotiatedTotal: { type: Number, required: true },
  baseTotal: { type: Number, required: true },
  waiverAmount: { type: Number, required: true, default: 0 },
  approvalAuthority: { type: String, required: true },
  concessionDetails: String,
  validityPeriodYears: { type: Number, required: true, default: 4 },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], required: true, default: 'active' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, status: 1 });

export const FeeAgreement = model<IFeeAgreement>('FeeAgreement', schema);
