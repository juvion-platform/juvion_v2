import { Schema, model, Document } from 'mongoose';

export interface IFeeStructureInstance extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  branchId?: Schema.Types.ObjectId;
  category?: string;
  quota?: string;
  status: string;
  effectiveDate?: Date;
  totalAmount: number;
  priorVersionId?: Schema.Types.ObjectId;
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
  rejectionComments?: string;
  revenueProjection?: number;
  comparisonData?: Record<string, unknown>;
}

const schema = new Schema<IFeeStructureInstance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  category: { type: String },
  // No enum: quota codes come from the admin-managed FeeQuota CRUD
  // (/api/finance/fee-quotas). Matched by string-equality against
  // `Student.quota` in fee-pin-service — same contract as `category`.
  quota: { type: String },
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'active', 'superseded', 'archived', 'revision_required'], required: true, default: 'draft' },
  effectiveDate: Date,
  totalAmount: { type: Number, required: true, default: 0 },
  priorVersionId: { type: Schema.Types.ObjectId, ref: 'FeeStructureInstance' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  approvedAt: Date,
  rejectionComments: String,
  revenueProjection: Number,
  comparisonData: Schema.Types.Mixed,
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1, programmeId: 1, status: 1 });

export const FeeStructureInstance = model<IFeeStructureInstance>('FeeStructureInstance', schema);
