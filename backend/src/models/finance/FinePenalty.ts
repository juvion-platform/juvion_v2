import { Schema, model, Document } from 'mongoose';

export interface IFinePenalty extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; type: string; reason: string; amount: number; dueDate: Date; paidAmount: number; status: string; imposedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<IFinePenalty>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  type: { type: String, enum: ['late_fee', 'library', 'disciplinary', 'damage', 'other'], required: true },
  reason: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'partial', 'paid', 'waived'], default: 'pending' },
  imposedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, status: 1 });

export const FinePenalty = model<IFinePenalty>('FinePenalty', schema);
