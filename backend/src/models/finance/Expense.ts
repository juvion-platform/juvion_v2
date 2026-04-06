import { Schema, model, Document } from 'mongoose';

export interface IExpense extends Document {
  collegeId: Schema.Types.ObjectId;
  budgetId?: Schema.Types.ObjectId; category: string; description: string; amount: number; vendorName?: string; invoiceNumber?: string; invoiceDate?: Date; paidDate?: Date; status: string; approvedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<IExpense>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  budgetId: { type: Schema.Types.ObjectId, ref: 'Budget' },
  category: { type: String, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  vendorName: String,
  invoiceNumber: String,
  invoiceDate: Date,
  paidDate: Date,
  status: { type: String, enum: ['submitted', 'approved', 'paid', 'rejected'], default: 'submitted' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });

export const Expense = model<IExpense>('Expense', schema);
