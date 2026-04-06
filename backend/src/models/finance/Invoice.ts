import { Schema, model, Document } from 'mongoose';

export interface IInvoice extends Document {
  collegeId: Schema.Types.ObjectId;
  invoiceNumber: string; studentId?: Schema.Types.ObjectId; type: string; items: { description: string; amount: number }[]; totalAmount: number; dueDate: Date; status: string; issuedDate: Date;
}

const schema = new Schema<IInvoice>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  invoiceNumber: { type: String, required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  type: { type: String, enum: ['fee', 'hostel', 'transport', 'other'], required: true },
  items: [{ description: String, amount: Number }],
  totalAmount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'issued', 'paid', 'overdue', 'cancelled'], default: 'draft' },
  issuedDate: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, invoiceNumber: 1 }, { unique: true });

export const Invoice = model<IInvoice>('Invoice', schema);
