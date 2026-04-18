import { Schema, model, Document } from 'mongoose';

export interface ICourseMaterial extends Document {
  collegeId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId;
  title: string;
  type: string;
  fileUrl: string;
  uploadedBy: Schema.Types.ObjectId;
  uploadedAt: Date;
  weekNumber?: number;
  description?: string;
  isPublished: boolean;
}

const schema = new Schema<ICourseMaterial>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['lecture_notes', 'presentation', 'reference', 'assignment_brief', 'lab_manual', 'video', 'other'], required: true },
  fileUrl: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  uploadedAt: { type: Date, default: Date.now },
  weekNumber: Number,
  description: String,
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, courseOfferingId: 1 });

export const CourseMaterial = model<ICourseMaterial>('CourseMaterial', schema);
