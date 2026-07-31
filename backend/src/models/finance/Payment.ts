import { Schema, model, Document } from 'mongoose';

export interface IPayment extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; receiptNumber: string; amount: number; paymentMode: string; transactionRef?: string; paymentDate: Date; allocations: { lineItemId: Schema.Types.ObjectId; amount: number }[]; status: string; collectedBy?: Schema.Types.ObjectId; remarks?: string;
  /**
   * The invoice this payment settles (007). Optional + backward compatible —
   * existing payments have none. When present, `createPayment` applies the
   * amount against the invoice and decrements StudentFeeAccount.balance.
   */
  invoiceId?: Schema.Types.ObjectId;
  metadata?: Record<string, unknown>;
}

const schema = new Schema<IPayment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  receiptNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMode: { type: String, enum: ['cash', 'cheque', 'dd', 'online', 'upi', 'neft', 'rtgs', 'card'], required: true },
  transactionRef: String,
  paymentDate: { type: Date, default: Date.now },
  allocations: [{ lineItemId: { type: Schema.Types.ObjectId, ref: 'FeeLineItem' }, amount: Number }],
  status: { type: String, enum: ['success', 'pending', 'failed', 'reversed'], default: 'success' },
  collectedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  remarks: String,
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ collegeId: 1, receiptNumber: 1 }, { unique: true });
schema.index({ collegeId: 1, studentId: 1 });
// Dashboard collection time-series aggregation — plan §2.4
schema.index({ collegeId: 1, status: 1, createdAt: 1 });
// 007 — sum successful payments per invoice (paid-so-far) and reverse on delete.
schema.index({ collegeId: 1, invoiceId: 1 });

export const Payment = model<IPayment>('Payment', schema);
