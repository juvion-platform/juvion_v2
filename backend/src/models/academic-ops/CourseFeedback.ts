import { Schema, model, Document } from 'mongoose';

export interface ICourseFeedback extends Document {
  collegeId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; ratings: { parameter: string; score: number }[]; overallRating: number; comments?: string; submittedAt: Date;
}

const schema = new Schema<ICourseFeedback>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  ratings: [{ parameter: String, score: Number }],
  overallRating: { type: Number, required: true },
  comments: String,
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, courseOfferingId: 1, studentId: 1 }, { unique: true });

export const CourseFeedback = model<ICourseFeedback>('CourseFeedback', schema);
