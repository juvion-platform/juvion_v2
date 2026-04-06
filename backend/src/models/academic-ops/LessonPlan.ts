import { Schema, model, Document } from 'mongoose';

export interface ILessonPlan extends Document {
  collegeId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId; weekNumber: number; topic: string; cosCovered: string[]; teachingMethod: string; plannedDate?: Date; completedDate?: Date; status: string;
}

const schema = new Schema<ILessonPlan>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  weekNumber: { type: Number, required: true },
  topic: { type: String, required: true },
  cosCovered: [String],
  teachingMethod: { type: String, default: 'lecture' },
  plannedDate: Date,
  completedDate: Date,
  status: { type: String, enum: ['planned', 'completed', 'skipped'], default: 'planned' },
}, { timestamps: true });

schema.index({ collegeId: 1, courseOfferingId: 1, weekNumber: 1 });

export const LessonPlan = model<ILessonPlan>('LessonPlan', schema);
