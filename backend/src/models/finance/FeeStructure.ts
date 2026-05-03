import { Schema, model, Document } from 'mongoose';

export interface IFeeStructure extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  branchId?: Schema.Types.ObjectId;
  category?: string;
  quota?: string;
  year: number;
  components: { name: string; amount: number; isRefundable: boolean }[];
  totalAmount: number;
  status: string;
  effectiveDate?: Date;
  priorVersionId?: Schema.Types.ObjectId;
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
}

const schema = new Schema<IFeeStructure>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  category: String,
  // No enum: quota codes come from the admin-managed FeeQuota CRUD
  // (/api/finance/fee-quotas). Matched by string equality in
  // fee-pin-service — same contract as `category`.
  quota: { type: String },
  year: { type: Number, required: true },
  components: [{ name: String, amount: Number, isRefundable: { type: Boolean, default: false } }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'active', 'superseded', 'archived'], required: true, default: 'draft' },
  effectiveDate: Date,
  priorVersionId: { type: Schema.Types.ObjectId, ref: 'FeeStructure' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  approvedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1, programmeId: 1 });

// One fee structure per (collegeId, academicYearId, programmeId, branchId,
// category, quota, year). Mongo treats missing-field === null on a unique
// index, so two rows with branchId=null OR category=null collide as
// expected (no manual normalisation needed).
//
// The `priorVersionId` + status='superseded' fields exist on the schema for
// a future supersede workflow; today no code path creates supersede pairs,
// so the all-statuses unique index is safe. When supersede lands, switch
// this to a partial filter expression that excludes superseded/archived.
schema.index(
  {
    collegeId: 1,
    academicYearId: 1,
    programmeId: 1,
    branchId: 1,
    category: 1,
    quota: 1,
    year: 1,
  },
  { unique: true, name: 'feestructure_combination_unique' },
);

export const FeeStructure = model<IFeeStructure>('FeeStructure', schema);
