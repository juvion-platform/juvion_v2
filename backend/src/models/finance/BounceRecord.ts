import { Schema, model, Document } from 'mongoose';

export interface IBounceRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  paymentTransactionId: Schema.Types.ObjectId;
  invoiceId: Schema.Types.ObjectId;
  reason: string;
  penaltyAmount: number;
  penaltyLineItemId?: Schema.Types.ObjectId;
  bouncedAt: Date;
}

const schema = new Schema<IBounceRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  paymentTransactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', required: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  reason: { type: String, required: true },
  penaltyAmount: { type: Number, default: 0 },
  penaltyLineItemId: { type: Schema.Types.ObjectId, ref: 'InvoiceLineItem' },
  bouncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, invoiceId: 1 });

export const BounceRecord = model<IBounceRecord>('BounceRecord', schema);
