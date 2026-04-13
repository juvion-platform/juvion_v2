import { Schema, model, Document } from 'mongoose';

export interface IInternalAssessment extends Document {
  collegeId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId; name: string; type: string; maxMarks: number; weightage: number; date?: Date; status: string;
  coMappings?: {
    coCode: string;
    weight: number;
  }[];
}

const schema = new Schema<IInternalAssessment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['mid1', 'mid2', 'assignment', 'quiz', 'seminar', 'lab_internal'], required: true },
  maxMarks: { type: Number, required: true },
  weightage: { type: Number, required: true },
  date: Date,
  status: { type: String, enum: ['scheduled', 'conducted', 'marks_entered', 'finalized'], default: 'scheduled' },
  coMappings: [{
    coCode: { type: String, required: true },
    weight: { type: Number, required: true, min: 0, max: 1 },
  }],
}, { timestamps: true });

schema.index({ collegeId: 1, courseOfferingId: 1, type: 1 });

export const InternalAssessment = model<IInternalAssessment>('InternalAssessment', schema);
