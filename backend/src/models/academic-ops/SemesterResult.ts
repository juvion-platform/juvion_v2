import { Schema, model, Document } from 'mongoose';

export interface ISemesterResult extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; semesterId: Schema.Types.ObjectId; sgpa: number; cgpa: number; totalCreditsEarned: number; totalCreditsRegistered: number; backlogs: number; result: string;
}

const schema = new Schema<ISemesterResult>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  sgpa: { type: Number, required: true },
  cgpa: { type: Number, required: true },
  totalCreditsEarned: { type: Number, required: true },
  totalCreditsRegistered: { type: Number, required: true },
  backlogs: { type: Number, default: 0 },
  result: { type: String, enum: ['pass', 'fail', 'detained'], required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 }, { unique: true });

export const SemesterResult = model<ISemesterResult>('SemesterResult', schema);
