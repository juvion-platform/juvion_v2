import { Schema, model, Document } from 'mongoose';

export interface IGradeCard extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; semesterId: Schema.Types.ObjectId; courseId: Schema.Types.ObjectId; internalMarks: number; externalMarks: number; totalMarks: number; grade: string; gradePoints: number; credits: number; result: string;
}

const schema = new Schema<IGradeCard>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  internalMarks: { type: Number, required: true },
  externalMarks: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  grade: { type: String, required: true },
  gradePoints: { type: Number, required: true },
  credits: { type: Number, required: true },
  result: { type: String, enum: ['pass', 'fail', 'absent'], required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 });

export const GradeCard = model<IGradeCard>('GradeCard', schema);
