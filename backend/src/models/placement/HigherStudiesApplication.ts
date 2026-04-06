import { Schema, model, Document } from 'mongoose';

export interface IHigherStudiesApplication extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; examType: string; examScore?: number; targetUniversity?: string; country?: string; programmeApplied?: string; status: string;
}

const schema = new Schema<IHigherStudiesApplication>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  examType: { type: String, enum: ['gate', 'gre', 'cat', 'gmat', 'ielts', 'toefl', 'other'], required: true },
  examScore: Number,
  targetUniversity: String,
  country: String,
  programmeApplied: String,
  status: { type: String, enum: ['preparing', 'applied', 'admitted', 'rejected'], default: 'preparing' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });

export const HigherStudiesApplication = model<IHigherStudiesApplication>('HigherStudiesApplication', schema);
