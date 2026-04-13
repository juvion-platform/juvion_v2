import { Schema, model, Document } from 'mongoose';

export interface IScholarshipClaim extends Document {
  collegeId: Schema.Types.ObjectId;
  scholarshipEligibilityId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  schemeCode: string;
  academicYearId: Schema.Types.ObjectId;
  claimAmount: number;
  portalReference?: string;
  status: string;
  submittedAt: Date;
  rejectionReason?: string;
}

const schema = new Schema<IScholarshipClaim>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  scholarshipEligibilityId: { type: Schema.Types.ObjectId, ref: 'ScholarshipEligibility', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  schemeCode: { type: String, required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  claimAmount: { type: Number, required: true },
  portalReference: { type: String },
  status: { type: String, enum: ['submitted', 'under_review', 'approved', 'rejected'], default: 'submitted' },
  submittedAt: { type: Date, default: Date.now },
  rejectionReason: { type: String },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 });

export const ScholarshipClaim = model<IScholarshipClaim>('ScholarshipClaim', schema);
