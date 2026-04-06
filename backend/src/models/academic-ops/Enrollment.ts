import { Schema, model, Document } from 'mongoose';

export interface IEnrollment extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; courseOfferingId: Schema.Types.ObjectId; semesterId: Schema.Types.ObjectId; status: string; enrolledAt: Date;
}

const schema = new Schema<IEnrollment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  status: { type: String, enum: ['enrolled', 'dropped', 'withdrawn', 'completed'], default: 'enrolled' },
  enrolledAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 });
schema.index({ collegeId: 1, courseOfferingId: 1, studentId: 1 }, { unique: true });

export const Enrollment = model<IEnrollment>('Enrollment', schema);
