import { Schema, model, Document } from 'mongoose';

export interface ICourseOffering extends Document {
  collegeId: Schema.Types.ObjectId;
  courseId: Schema.Types.ObjectId; semesterId: Schema.Types.ObjectId; sectionId: Schema.Types.ObjectId; facultyId: Schema.Types.ObjectId; maxEnrollment: number; enrolledCount: number;
}

const schema = new Schema<ICourseOffering>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  maxEnrollment: { type: Number, default: 60 },
  enrolledCount: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ collegeId: 1, semesterId: 1, sectionId: 1 });

export const CourseOffering = model<ICourseOffering>('CourseOffering', schema);
