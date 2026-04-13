import { Schema, model, Document } from 'mongoose';

export interface IPromotion extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  fromDesignation: string;
  toDesignation: string;
  fromPayScale?: number;
  toPayScale?: number;
  effectiveDate: Date;
  remarks?: string;
  approvedBy?: Schema.Types.ObjectId;
  status: string;
  // Phase 3 — Appraisal-linked promotion fields
  appraisalId?: Schema.Types.ObjectId;
  approvalChain?: { level: number; approverId: Schema.Types.ObjectId; status: string; decidedAt?: Date }[];
}

const approvalChainSchema = new Schema({
  level: { type: Number, required: true },
  approverId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  status: { type: String, required: true },
  decidedAt: Date,
}, { _id: false });

const schema = new Schema<IPromotion>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  fromDesignation: { type: String, required: true },
  toDesignation: { type: String, required: true },
  fromPayScale: Number,
  toPayScale: Number,
  effectiveDate: { type: Date, required: true },
  remarks: String,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  status: { type: String, enum: ['proposed', 'approved', 'implemented', 'rejected'], default: 'proposed' },
  // Phase 3 fields
  appraisalId: { type: Schema.Types.ObjectId, ref: 'Appraisal' },
  approvalChain: [approvalChainSchema],
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1 });

export const Promotion = model<IPromotion>('Promotion', schema);
