import { Schema, model, Document } from 'mongoose';

export interface IInternshipApplication extends Document {
  collegeId: Schema.Types.ObjectId;
  internshipId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; status: string; appliedAt: Date;
}

const schema = new Schema<IInternshipApplication>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  internshipId: { type: Schema.Types.ObjectId, ref: 'InternshipPosting', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['applied', 'shortlisted', 'selected', 'rejected', 'completed'], default: 'applied' },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, internshipId: 1, studentId: 1 }, { unique: true });

export const InternshipApplication = model<IInternshipApplication>('InternshipApplication', schema);
