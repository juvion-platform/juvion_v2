import { Schema, model, Document } from 'mongoose';

export interface IPaymentGatewayLog extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; orderId: string; gateway: string; amount: number; currency: string; status: string; gatewayResponse?: Record<string, any>; initiatedAt: Date; completedAt?: Date;
  invoiceId?: Schema.Types.ObjectId;
  signatureVerified?: boolean;
  webhookReceivedAt?: Date;
  idempotencyKey?: string;
}

const schema = new Schema<IPaymentGatewayLog>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  orderId: { type: String, required: true },
  gateway: { type: String, enum: ['razorpay', 'paytm', 'ccavenue', 'hdfc'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['initiated', 'success', 'failed', 'refunded'], default: 'initiated' },
  gatewayResponse: Schema.Types.Mixed,
  initiatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  signatureVerified: { type: Boolean },
  webhookReceivedAt: { type: Date },
  idempotencyKey: { type: String },
}, { timestamps: true });

schema.index({ collegeId: 1, orderId: 1 }, { unique: true });

export const PaymentGatewayLog = model<IPaymentGatewayLog>('PaymentGatewayLog', schema);
