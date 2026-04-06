import { Schema, model, Document } from 'mongoose';

export interface IAppraisal extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; reviewerId: Schema.Types.ObjectId; selfRating?: number; reviewerRating?: number; finalRating?: number; goals: { description: string; weightage: number; rating?: number }[]; status: string;
}

const schema = new Schema<IAppraisal>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  selfRating: Number,
  reviewerRating: Number,
  finalRating: Number,
  goals: [{ description: String, weightage: Number, rating: Number }],
  status: { type: String, enum: ['initiated', 'self_review', 'reviewer_review', 'completed'], default: 'initiated' },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, academicYearId: 1 });

export const Appraisal = model<IAppraisal>('Appraisal', schema);
