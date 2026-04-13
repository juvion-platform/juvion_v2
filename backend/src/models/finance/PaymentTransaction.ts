import { Schema, model, Document } from 'mongoose';

export interface IPaymentTransaction extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  invoiceId: Schema.Types.ObjectId;
  amount: number;
  channel: string;
  paymentMode: string;
  transactionRef?: string;
  reconciliationStatus: string;
  gatewayOrderId?: string;
  ddNumber?: string;
  ddBank?: string;
  ddDate?: Date;
  paymentDate: Date;
  receiptId?: Schema.Types.ObjectId;
}

const schema = new Schema<IPaymentTransaction>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  amount: { type: Number, required: true },
  channel: { type: String, enum: ['gateway', 'cash', 'dd', 'neft', 'rtgs', 'upi', 'card'], required: true },
  paymentMode: { type: String, required: true },
  transactionRef: { type: String },
  reconciliationStatus: { type: String, enum: ['initiated', 'received', 'matched', 'discrepancy', 'resolved', 'reversed', 'refunded'], default: 'received' },
  gatewayOrderId: { type: String },
  ddNumber: { type: String },
  ddBank: { type: String },
  ddDate: { type: Date },
  paymentDate: { type: Date, required: true, default: Date.now },
  receiptId: { type: Schema.Types.ObjectId, ref: 'Receipt' },
}, { timestamps: true });

schema.index({ collegeId: 1, invoiceId: 1 });
schema.index({ collegeId: 1, reconciliationStatus: 1 });

export const PaymentTransaction = model<IPaymentTransaction>('PaymentTransaction', schema);
