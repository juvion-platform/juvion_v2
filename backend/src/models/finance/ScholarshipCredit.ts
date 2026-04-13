import { Schema, model, Document } from 'mongoose';

export interface IScholarshipCredit extends Document {
  collegeId: Schema.Types.ObjectId;
  scholarshipReceivableId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  invoiceId: Schema.Types.ObjectId;
  invoiceLineItemId?: Schema.Types.ObjectId;
  amount: number;
  appliedAt: Date;
}

const schema = new Schema<IScholarshipCredit>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  scholarshipReceivableId: { type: Schema.Types.ObjectId, ref: 'ScholarshipReceivable', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  invoiceLineItemId: { type: Schema.Types.ObjectId, ref: 'InvoiceLineItem' },
  amount: { type: Number, required: true },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });

export const ScholarshipCredit = model<IScholarshipCredit>('ScholarshipCredit', schema);
