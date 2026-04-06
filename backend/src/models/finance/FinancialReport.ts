import { Schema, model, Document } from 'mongoose';

export interface IFinancialReport extends Document {
  collegeId: Schema.Types.ObjectId;
  reportType: string; periodFrom: Date; periodTo: Date; generatedBy: Schema.Types.ObjectId; data: Record<string, any>; generatedAt: Date;
}

const schema = new Schema<IFinancialReport>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  reportType: { type: String, enum: ['collection_summary', 'defaulter_list', 'scholarship_report', 'budget_utilization', 'income_expense'], required: true },
  periodFrom: { type: Date, required: true },
  periodTo: { type: Date, required: true },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  data: Schema.Types.Mixed,
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, reportType: 1, generatedAt: -1 });

export const FinancialReport = model<IFinancialReport>('FinancialReport', schema);
