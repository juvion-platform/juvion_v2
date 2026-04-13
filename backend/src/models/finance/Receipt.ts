import { Schema, model, Document } from 'mongoose';

export interface IReceipt extends Document {
  collegeId: Schema.Types.ObjectId;
  receiptNumber: string;
  paymentTransactionId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  amount: number;
  issuedDate: Date;
  channel: string;
  status: string;
  vaultDocId?: string;
}

const schema = new Schema<IReceipt>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  receiptNumber: { type: String, required: true },
  paymentTransactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  amount: { type: Number, required: true },
  issuedDate: { type: Date, default: Date.now },
  channel: { type: String, enum: ['email', 'print', 'whatsapp'], default: 'email' },
  status: { type: String, enum: ['issued', 'cancelled', 'reissued'], default: 'issued' },
  vaultDocId: { type: String },
}, { timestamps: true });

schema.index({ collegeId: 1, receiptNumber: 1 }, { unique: true });

export const Receipt = model<IReceipt>('Receipt', schema);
