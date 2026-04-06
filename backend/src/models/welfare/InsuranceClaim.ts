import { Schema, model, Document } from 'mongoose';
export interface IInsuranceClaim extends Document { collegeId: Schema.Types.ObjectId; personId: Schema.Types.ObjectId; insuranceProvider: string; policyNumber: string; claimAmount: number; reason: string; claimDate: Date; status: string; settledAmount?: number; }
const schema = new Schema<IInsuranceClaim>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  insuranceProvider: { type: String, required: true },
  policyNumber: { type: String, required: true },
  claimAmount: { type: Number, required: true },
  reason: { type: String, required: true },
  claimDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['filed', 'processing', 'approved', 'rejected', 'settled'], default: 'filed' },
  settledAmount: Number,
}, { timestamps: true });
schema.index({ collegeId: 1, personId: 1 });
export const InsuranceClaim = model<IInsuranceClaim>('InsuranceClaim', schema);
