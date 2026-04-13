import { Schema, model, Document } from 'mongoose';

export interface IRevaluationRequest extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  courseId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  examType: string;
  originalMarks: number;
  revaluedMarks?: number;
  reason: string;
  status: string;
  outcome?: string;
  feePaid: boolean;
  submittedAt: Date;
  completedAt?: Date;
}

const schema = new Schema<IRevaluationRequest>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  examType: { type: String, enum: ['regular', 'supplementary'], required: true },
  originalMarks: { type: Number, required: true },
  revaluedMarks: Number,
  reason: { type: String, required: true },
  status: { type: String, enum: ['submitted', 'forwarded_to_university', 'under_review', 'completed', 'rejected'], default: 'submitted' },
  outcome: { type: String, enum: ['marks_increased', 'marks_decreased', 'no_change'] },
  feePaid: { type: Boolean, required: true, default: false },
  submittedAt: { type: Date, required: true },
  completedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, courseId: 1, semesterId: 1 }, { unique: true });
schema.index({ collegeId: 1, semesterId: 1 });

export const RevaluationRequest = model<IRevaluationRequest>('RevaluationRequest', schema);
