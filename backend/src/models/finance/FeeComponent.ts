import { Schema, model, Document } from 'mongoose';

export interface IFeeComponent extends Document {
  collegeId: Schema.Types.ObjectId;
  feeStructureInstanceId: Schema.Types.ObjectId;
  name: string;
  amount: number;
  isRefundable: boolean;
  componentType: string;
  isConditional: boolean;
  displayOrder?: number;
}

const schema = new Schema<IFeeComponent>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  feeStructureInstanceId: { type: Schema.Types.ObjectId, ref: 'FeeStructureInstance', required: true },
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  isRefundable: { type: Boolean, required: true, default: false },
  componentType: { type: String, enum: ['tuition', 'hostel', 'transport', 'lab', 'exam', 'library', 'development', 'caution_deposit', 'other'], required: true },
  isConditional: { type: Boolean, required: true, default: false },
  displayOrder: Number,
}, { timestamps: true });

schema.index({ collegeId: 1, feeStructureInstanceId: 1 });

export const FeeComponent = model<IFeeComponent>('FeeComponent', schema);
