import { Schema, model, Document } from 'mongoose';

export interface IFeeComponentRule extends Document {
  collegeId: Schema.Types.ObjectId;
  feeComponentId: Schema.Types.ObjectId;
  conditionType: string;
  conditionValue: string;
  operator: string;
  status: string;
}

const schema = new Schema<IFeeComponentRule>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  feeComponentId: { type: Schema.Types.ObjectId, ref: 'FeeComponent', required: true },
  conditionType: { type: String, enum: ['hostel', 'transport', 'lab_programme', 'quota', 'category', 'regulation', 'batch'], required: true },
  conditionValue: { type: String, required: true },
  operator: { type: String, enum: ['equals', 'in', 'not_in', 'exists', 'not_exists'], required: true },
  status: { type: String, enum: ['configured', 'draft'], required: true, default: 'draft' },
}, { timestamps: true });

schema.index({ collegeId: 1, feeComponentId: 1 });

export const FeeComponentRule = model<IFeeComponentRule>('FeeComponentRule', schema);
