import { Schema, model, Document } from 'mongoose';

export interface IOverpaymentRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  paymentTransactionId: Schema.Types.ObjectId;
  invoiceId: Schema.Types.ObjectId;
  overpaymentAmount: number;
  resolution: string;
  refundId?: Schema.Types.ObjectId;
  resolvedAt?: Date;
}

const schema = new Schema<IOverpaymentRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  paymentTransactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', required: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  overpaymentAmount: { type: Number, required: true },
  resolution: { type: String, enum: ['refund', 'credit_forward', 'pending'], default: 'pending' },
  refundId: { type: Schema.Types.ObjectId, ref: 'Refund' },
  resolvedAt: { type: Date },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, resolution: 1 });

export const OverpaymentRecord = model<IOverpaymentRecord>('OverpaymentRecord', schema);
