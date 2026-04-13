import { Schema, model, Document } from 'mongoose';

export interface IVendorPayment extends Document {
  collegeId: Schema.Types.ObjectId;
  paymentRequestId: Schema.Types.ObjectId;
  vendorId: Schema.Types.ObjectId;
  amount: number;
  paymentTerms?: string;
  executionDate?: Date;
  batchId?: string;
  bankReference?: string;
  status: string;
}

const schema = new Schema<IVendorPayment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  paymentRequestId: { type: Schema.Types.ObjectId, ref: 'PaymentRequest', required: true },
  vendorId: { type: Schema.Types.ObjectId, required: true },
  amount: { type: Number, required: true },
  paymentTerms: String,
  executionDate: Date,
  batchId: String,
  bankReference: String,
  status: { type: String, enum: ['scheduled', 'pending_approval', 'approved', 'executed', 'bank_confirmed', 'failed'], required: true, default: 'scheduled' },
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, batchId: 1 });

export const VendorPayment = model<IVendorPayment>('VendorPayment', schema);
