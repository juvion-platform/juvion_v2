import { Schema, model, Document } from 'mongoose';

export interface IStudent extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId;
  admissionYear: number;
  category?: string;
  quota?: string;
  regulationId?: Schema.Types.ObjectId;
  programmeId?: Schema.Types.ObjectId;
  branchId?: Schema.Types.ObjectId;
  batchId?: Schema.Types.ObjectId;
  primaryParentId?: Schema.Types.ObjectId;
  feeResponsibleParentId?: Schema.Types.ObjectId;
  rollNumber?: string;
  status: string;
  onboardingStatus: string;
  onboardingCompletedAt?: Date;
  onboardingChecklist?: {
    profileVerified?: boolean;
    documentsVerified?: boolean;
    feePlanConfirmed?: boolean;
    portalAccessShared?: boolean;
    idCardIssued?: boolean;
  };
  feeStatus?: 'paid' | 'partial' | 'overdue' | 'clear';
  hasFinancialHold?: boolean;
  scholarshipStatus?: 'active' | 'none' | 'pending';
}

const schema = new Schema<IStudent>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  admissionYear: { type: Number, required: true },
  category: String,
  quota: { type: String, enum: ['convener', 'management', 'nri'] },
  regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation' },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme' },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
  primaryParentId: { type: Schema.Types.ObjectId, ref: 'Parent' },
  feeResponsibleParentId: { type: Schema.Types.ObjectId, ref: 'Parent' },
  rollNumber: String,
  status: { type: String, enum: ['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni'], default: 'prospective' },
  onboardingStatus: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
  onboardingCompletedAt: Date,
  onboardingChecklist: {
    profileVerified: { type: Boolean, default: false },
    documentsVerified: { type: Boolean, default: false },
    feePlanConfirmed: { type: Boolean, default: false },
    portalAccessShared: { type: Boolean, default: false },
    idCardIssued: { type: Boolean, default: false },
  },
  feeStatus: { type: String, enum: ['paid', 'partial', 'overdue', 'clear'] },
  hasFinancialHold: { type: Boolean, default: false },
  scholarshipStatus: { type: String, enum: ['active', 'none', 'pending'] },
}, { timestamps: true });

schema.index({ collegeId: 1, rollNumber: 1 }, { unique: true, sparse: true });

export const Student = model<IStudent>('Student', schema);
