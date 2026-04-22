import { Schema, model, Document } from 'mongoose';

export interface IInvoice extends Document {
  collegeId: Schema.Types.ObjectId;
  invoiceNumber: string; studentId?: Schema.Types.ObjectId; type: string; items: { description: string; amount: number }[]; totalAmount: number; dueDate: Date; status: string; issuedDate: Date;
  examType?: string;
  semesterId?: Schema.Types.ObjectId;
  feeAgreementId?: Schema.Types.ObjectId;
  netPayable?: number;
  scholarshipAllocated?: number;
  concessionApplied?: number;
  paymentPlanId?: Schema.Types.ObjectId;
  batchId?: string;
  metadata?: Record<string, unknown>;
}

const schema = new Schema<IInvoice>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  invoiceNumber: { type: String, required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  type: { type: String, enum: ['fee', 'hostel', 'transport', 'other'], required: true },
  items: [{ description: String, amount: Number }],
  totalAmount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'generated', 'sent', 'partially_paid', 'paid', 'overdue', 'disputed', 'confirmed', 'written_off', 'cancelled'], default: 'draft' },
  issuedDate: { type: Date, default: Date.now },
  examType: { type: String },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester' },
  feeAgreementId: { type: Schema.Types.ObjectId, ref: 'FeeAgreement' },
  netPayable: { type: Number },
  scholarshipAllocated: { type: Number, default: 0 },
  concessionApplied: { type: Number, default: 0 },
  paymentPlanId: { type: Schema.Types.ObjectId, ref: 'PaymentPlan' },
  batchId: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ collegeId: 1, invoiceNumber: 1 }, { unique: true });
// Cron primary scan query — plan §2.4
schema.index({ collegeId: 1, status: 1, dueDate: 1 });

export const Invoice = model<IInvoice>('Invoice', schema);
