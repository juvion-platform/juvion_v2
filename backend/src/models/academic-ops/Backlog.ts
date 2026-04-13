import { Schema, model, Document } from 'mongoose';

export interface IBacklog extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  courseId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  originalExamType: string;
  attempts: number;
  currentStatus: string;
  clearedInSemesterId?: Schema.Types.ObjectId;
  clearedGrade?: string;
  clearedAt?: Date;
}

const schema = new Schema<IBacklog>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  originalExamType: { type: String, enum: ['regular', 'supplementary'], required: true },
  attempts: { type: Number, required: true, default: 0 },
  currentStatus: { type: String, enum: ['created', 'registered_for_supplementary', 'appeared', 'cleared', 'persists'], default: 'created' },
  clearedInSemesterId: { type: Schema.Types.ObjectId, ref: 'Semester' },
  clearedGrade: String,
  clearedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, courseId: 1 }, { unique: true });
schema.index({ collegeId: 1, studentId: 1 });

export const Backlog = model<IBacklog>('Backlog', schema);
