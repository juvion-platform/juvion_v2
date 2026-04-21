import { Schema, model, Document } from 'mongoose';

export interface IInvoiceLineItem extends Document {
  collegeId: Schema.Types.ObjectId;
  invoiceId: Schema.Types.ObjectId;
  feeComponentId?: Schema.Types.ObjectId;
  description: string;
  grossAmount: number;
  scholarshipAllocated: number;
  concessionApplied: number;
  netAmount: number;
  status: string;
  /**
   * Optional pointer to the Student.feePins[_id] that produced this
   * line item. Populated by `generateSemesterInvoice` once pin-first
   * resolution is live (plan §2.3, §1.6, Task 10). Mirrors the field
   * added on `FeeLineItem` in T1. Existing line items leave this
   * undefined — backward compatible.
   */
  sourcePinId?: Schema.Types.ObjectId;
}

const schema = new Schema<IInvoiceLineItem>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  feeComponentId: { type: Schema.Types.ObjectId, ref: 'FeeComponent' },
  description: { type: String, required: true },
  grossAmount: { type: Number, required: true },
  scholarshipAllocated: { type: Number, required: true, default: 0 },
  concessionApplied: { type: Number, required: true, default: 0 },
  netAmount: { type: Number, required: true },
  status: { type: String, enum: ['active', 'adjusted', 'waived', 'cancelled'], required: true, default: 'active' },
  sourcePinId: { type: Schema.Types.ObjectId },
}, { timestamps: true });

schema.index({ collegeId: 1, invoiceId: 1 });

export const InvoiceLineItem = model<IInvoiceLineItem>('InvoiceLineItem', schema);
