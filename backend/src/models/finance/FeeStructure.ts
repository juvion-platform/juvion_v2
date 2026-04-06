import { Schema, model, Document } from 'mongoose';

export interface IFeeStructure extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId; programmeId: Schema.Types.ObjectId; branchId?: Schema.Types.ObjectId; category?: string; quota?: string; year: number; components: { name: string; amount: number; isRefundable: boolean }[]; totalAmount: number;
}

const schema = new Schema<IFeeStructure>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  category: String,
  quota: { type: String, enum: ['convener', 'management', 'nri'] },
  year: { type: Number, required: true },
  components: [{ name: String, amount: Number, isRefundable: { type: Boolean, default: false } }],
  totalAmount: { type: Number, required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1, programmeId: 1 });

export const FeeStructure = model<IFeeStructure>('FeeStructure', schema);
