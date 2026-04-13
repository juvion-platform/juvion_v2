import { Schema, model, Document } from 'mongoose';

export interface IRefund extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; paymentId?: Schema.Types.ObjectId; amount: number; reason: string; refundMode: string; status: string; approvedBy?: Schema.Types.ObjectId; processedDate?: Date;
  invoiceId?: Schema.Types.ObjectId;
  sourceType?: string;
  sourceId?: Schema.Types.ObjectId;
  refundTransactionRef?: string;
  approvalThreshold?: number;
}

const schema = new Schema<IRefund>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  refundMode: { type: String, enum: ['cash', 'cheque', 'online', 'neft'], required: true },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'processing', 'processed', 'confirmed', 'failed'], default: 'requested' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  processedDate: Date,
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  sourceType: { type: String, enum: ['overpayment', 'cancellation', 'adjustment'] },
  sourceId: { type: Schema.Types.ObjectId },
  refundTransactionRef: { type: String },
  approvalThreshold: { type: Number },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });

export const Refund = model<IRefund>('Refund', schema);
