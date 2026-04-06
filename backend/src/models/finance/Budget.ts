import { Schema, model, Document } from 'mongoose';

export interface IBudget extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId; departmentId?: Schema.Types.ObjectId; category: string; allocatedAmount: number; spentAmount: number; status: string;
}

const schema = new Schema<IBudget>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  category: { type: String, required: true },
  allocatedAmount: { type: Number, required: true },
  spentAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'approved', 'active', 'closed'], default: 'draft' },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1, departmentId: 1 });

export const Budget = model<IBudget>('Budget', schema);
