import { Schema, model, Document } from 'mongoose';

export interface ICondonationRequest extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  reason: string;
  description: string;
  supportingDocuments?: string[];
  classesRequested: number;
  status: string;
  reviewedBy?: Schema.Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  linkedToEligibility: boolean;
}

const schema = new Schema<ICondonationRequest>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  reason: { type: String, enum: ['medical', 'od', 'family_emergency', 'other'], required: true },
  description: { type: String, required: true },
  supportingDocuments: [String],
  classesRequested: { type: Number, required: true },
  status: { type: String, enum: ['submitted', 'under_review', 'approved', 'rejected'], default: 'submitted' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewRemarks: String,
  linkedToEligibility: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 });
schema.index({ collegeId: 1, semesterId: 1, status: 1 });

export const CondonationRequest = model<ICondonationRequest>('CondonationRequest', schema);
