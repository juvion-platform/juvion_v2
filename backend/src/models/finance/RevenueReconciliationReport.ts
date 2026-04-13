import { Schema, model, Document } from 'mongoose';

export interface IRevenueReconciliationReport extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  totalInvoiced: number;
  totalCollected: number;
  scholarshipOffsets: number;
  concessionsGranted: number;
  writeOffs: number;
  outstandingReceivables: number;
  budgetAmount?: number;
  budgetVariance?: number;
  budgetVariancePercent?: number;
  status: 'draft' | 'final';
  finalizedBy?: Schema.Types.ObjectId;
  finalizedAt?: Date;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

const schema = new Schema<IRevenueReconciliationReport>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  totalInvoiced: { type: Number, required: true, default: 0 },
  totalCollected: { type: Number, required: true, default: 0 },
  scholarshipOffsets: { type: Number, required: true, default: 0 },
  concessionsGranted: { type: Number, required: true, default: 0 },
  writeOffs: { type: Number, required: true, default: 0 },
  outstandingReceivables: { type: Number, required: true, default: 0 },
  budgetAmount: { type: Number },
  budgetVariance: { type: Number },
  budgetVariancePercent: { type: Number },
  status: { type: String, enum: ['draft', 'final'], default: 'draft' },
  finalizedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  finalizedAt: { type: Date },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1 }, { unique: true });

export const RevenueReconciliationReport = model<IRevenueReconciliationReport>('RevenueReconciliationReport', schema);
