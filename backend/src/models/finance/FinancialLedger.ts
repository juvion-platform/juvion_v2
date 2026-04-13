import { Schema, model, Document } from 'mongoose';

export interface IFinancialLedger extends Document {
  collegeId: Schema.Types.ObjectId;
  entryDate: Date;
  entryType: string;
  category: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  referenceId?: string;
  referenceType?: string;
  // Double-entry bookkeeping fields
  journalEntryId?: string;
  accountCode?: string;
  accountName?: string;
  periodId?: string;
  isLocked: boolean;
  studentId?: Schema.Types.ObjectId;
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
  // Double-entry bookkeeping fields
  journalEntryId: { type: String, index: true },
  accountCode: {
    type: String,
    enum: [
      'ACCT_REC', 'FEE_INCOME', 'CASH', 'BANK',
      'SCHOLARSHIP_REC', 'SCHOLARSHIP_INCOME',
      'REFUND_PAYABLE', 'BAD_DEBT', 'VENDOR_PAYABLE',
      'CONCESSION_EXPENSE', 'PENALTY_INCOME', 'SUSPENSE',
    ],
  },
  accountName: { type: String },
  periodId: { type: String },
  isLocked: { type: Boolean, default: false },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
}, { timestamps: true });

schema.index({ collegeId: 1, entryDate: -1 });
schema.index({ collegeId: 1, journalEntryId: 1 });
schema.index({ collegeId: 1, accountCode: 1, entryDate: -1 });
schema.index({ collegeId: 1, periodId: 1, isLocked: 1 });

export const FinancialLedger = model<IFinancialLedger>('FinancialLedger', schema);
