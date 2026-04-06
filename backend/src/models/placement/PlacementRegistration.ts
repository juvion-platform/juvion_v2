import { Schema, model, Document } from 'mongoose';

export interface IPlacementRegistration extends Document {
  collegeId: Schema.Types.ObjectId;
  jobPostingId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; resumeUrl?: string; status: string; appliedAt: Date;
}

const schema = new Schema<IPlacementRegistration>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  jobPostingId: { type: Schema.Types.ObjectId, ref: 'JobPosting', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  resumeUrl: String,
  status: { type: String, enum: ['registered', 'shortlisted', 'placed', 'not_placed'], default: 'registered' },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, jobPostingId: 1, studentId: 1 }, { unique: true });

export const PlacementRegistration = model<IPlacementRegistration>('PlacementRegistration', schema);
