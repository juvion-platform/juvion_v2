import { Schema, model, Document } from 'mongoose';

export interface IScholarshipEligibility extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  schemeCode: string;
  academicYearId: Schema.Types.ObjectId;
  status: string;
  verificationMethod: string;
  verifiedAt?: Date;
  documentsStatus?: string;
}

const schema = new Schema<IScholarshipEligibility>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  schemeCode: { type: String, required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  status: { type: String, enum: ['pending', 'eligible', 'ineligible', 'expired'], default: 'pending' },
  verificationMethod: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  verifiedAt: { type: Date },
  documentsStatus: { type: String, enum: ['complete', 'incomplete', 'expired'] },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, schemeCode: 1, academicYearId: 1 });

export const ScholarshipEligibility = model<IScholarshipEligibility>('ScholarshipEligibility', schema);
