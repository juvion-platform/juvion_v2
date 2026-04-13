import { Schema, model, Document } from 'mongoose';

export interface IStudyRecommendation extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  courseId?: Schema.Types.ObjectId;
  recommendationType: string;
  title: string;
  description: string;
  priority: string;
  basedOn: string;
  isRead: boolean;
  expiresAt?: Date;
}

const schema = new Schema<IStudyRecommendation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  recommendationType: { type: String, enum: ['focus_area', 'study_material', 'time_management', 'revision', 'general'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['high', 'medium', 'low'], required: true },
  basedOn: { type: String, required: true },
  isRead: { type: Boolean, required: true, default: false },
  expiresAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 });

export const StudyRecommendation = model<IStudyRecommendation>('StudyRecommendation', schema);
