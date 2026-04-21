import { Schema, model, Document } from 'mongoose';

export interface IFeeLineItem extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; feeStructureId?: Schema.Types.ObjectId; component: string; academicYearId: Schema.Types.ObjectId; semester?: number; amount: number; paidAmount: number; waivedAmount: number; dueDate?: Date; status: string;
  /**
   * Optional pointer to the Student.feePins[_id] that produced this
   * line item. Populated by `generateSemesterInvoice` once pin-first
   * resolution is live (plan §2.3, §1.6). Existing line items leave
   * this undefined — backward compatible.
   */
  sourcePinId?: Schema.Types.ObjectId;
}

const schema = new Schema<IFeeLineItem>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  feeStructureId: { type: Schema.Types.ObjectId, ref: 'FeeStructure' },
  component: { type: String, required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  semester: Number,
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  waivedAmount: { type: Number, default: 0 },
  dueDate: Date,
  status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue', 'waived'], default: 'pending' },
  sourcePinId: { type: Schema.Types.ObjectId },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, status: 1 });

export const FeeLineItem = model<IFeeLineItem>('FeeLineItem', schema);
