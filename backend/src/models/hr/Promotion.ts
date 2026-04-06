import { Schema, model, Document } from 'mongoose';

export interface IPromotion extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; fromDesignation: string; toDesignation: string; fromPayScale?: number; toPayScale?: number; effectiveDate: Date; remarks?: string; approvedBy?: Schema.Types.ObjectId; status: string;
}

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
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1 });

export const Promotion = model<IPromotion>('Promotion', schema);
