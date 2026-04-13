import { Schema, model, Document } from 'mongoose';

export interface IPaymentRequest extends Document {
  collegeId: Schema.Types.ObjectId;
  vendorId: Schema.Types.ObjectId;
  invoiceReference: string;
  amount: number;
  costCenter?: string;
  servicePeriod?: string;
  m08ApprovalDate?: Date;
  m08Approver?: Schema.Types.ObjectId;
  status: string;
}

const schema = new Schema<IPaymentRequest>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  vendorId: { type: Schema.Types.ObjectId, required: true },
  invoiceReference: { type: String, required: true },
  amount: { type: Number, required: true },
  costCenter: String,
  servicePeriod: String,
  m08ApprovalDate: Date,
  m08Approver: { type: Schema.Types.ObjectId, ref: 'Person' },
  status: { type: String, enum: ['received', 'scheduled', 'pending_approval', 'approved', 'executed', 'confirmed', 'failed'], required: true, default: 'received' },
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });

export const PaymentRequest = model<IPaymentRequest>('PaymentRequest', schema);
