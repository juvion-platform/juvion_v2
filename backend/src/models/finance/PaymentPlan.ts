import { Schema, model, Document } from 'mongoose';

export interface IPaymentPlanInstallment {
  dueDate: Date;
  amount: number;
  status: string;
  paidDate?: Date;
}

export interface IPaymentPlan extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  invoiceId: Schema.Types.ObjectId;
  feeAgreementId?: Schema.Types.ObjectId;
  templateId?: string;
  totalAmount: number;
  installments: IPaymentPlanInstallment[];
  status: string;
}

const installmentSchema = new Schema({
  dueDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'overdue'], required: true, default: 'pending' },
  paidDate: Date,
}, { _id: false });

const schema = new Schema<IPaymentPlan>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  feeAgreementId: { type: Schema.Types.ObjectId, ref: 'FeeAgreement' },
  templateId: String,
  totalAmount: { type: Number, required: true },
  installments: [installmentSchema],
  status: { type: String, enum: ['active', 'completed', 'defaulted', 'cancelled'], required: true, default: 'active' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, status: 1 });

export const PaymentPlan = model<IPaymentPlan>('PaymentPlan', schema);
