import { Schema, model, Document } from 'mongoose';

export interface IReconciliationEntry extends Document {
  collegeId: Schema.Types.ObjectId;
  paymentTransactionId: Schema.Types.ObjectId;
  bankStatementRef?: string;
  matchedAmount: number;
  status: string;
  discrepancyType?: string;
  discrepancyAmount?: number;
  resolvedBy?: Schema.Types.ObjectId;
  resolvedAt?: Date;
  notes?: string;
}

const schema = new Schema<IReconciliationEntry>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  paymentTransactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', required: true },
  bankStatementRef: { type: String },
  matchedAmount: { type: Number, required: true },
  status: { type: String, enum: ['matched', 'discrepancy_flagged', 'resolved'], default: 'matched' },
  discrepancyType: { type: String },
  discrepancyAmount: { type: Number },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  resolvedAt: { type: Date },
  notes: { type: String },
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });

export const ReconciliationEntry = model<IReconciliationEntry>('ReconciliationEntry', schema);
