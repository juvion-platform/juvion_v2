import { Schema, model, Document } from 'mongoose';

export interface IFinancialLedger extends Document {
  collegeId: Schema.Types.ObjectId;
  entryDate: Date; entryType: string; category: string; description: string; debit: number; credit: number; balance: number; referenceId?: string; referenceType?: string;
}

const schema = new Schema<IFinancialLedger>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  entryDate: { type: Date, required: true },
  entryType: { type: String, enum: ['income', 'expense', 'transfer', 'adjustment'], required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  referenceId: String,
  referenceType: String,
}, { timestamps: true });

schema.index({ collegeId: 1, entryDate: -1 });

export const FinancialLedger = model<IFinancialLedger>('FinancialLedger', schema);
