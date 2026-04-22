import { Schema, model, Document } from 'mongoose';

export interface IScholarshipAllocation extends Document {
  collegeId: Schema.Types.ObjectId;
  scholarshipId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; amount: number; status: string; disbursedDate?: Date;
  metadata?: Record<string, unknown>;
}

const schema = new Schema<IScholarshipAllocation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  scholarshipId: { type: Schema.Types.ObjectId, ref: 'Scholarship', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['applied', 'approved', 'disbursed', 'rejected'], default: 'applied' },
  disbursedDate: Date,
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ collegeId: 1, scholarshipId: 1, studentId: 1 });

export const ScholarshipAllocation = model<IScholarshipAllocation>('ScholarshipAllocation', schema);
