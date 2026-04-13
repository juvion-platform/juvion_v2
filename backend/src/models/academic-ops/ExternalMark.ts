import { Schema, model, Document } from 'mongoose';

export interface IExternalMark extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; courseId: Schema.Types.ObjectId; semesterId: Schema.Types.ObjectId; examType: string; maxMarks: number; marksObtained: number; result: string;
  enteredBy?: Schema.Types.ObjectId;
  validatedBy?: Schema.Types.ObjectId;
  validatedAt?: Date;
  anomalyFlags?: string[];
}

const schema = new Schema<IExternalMark>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  examType: { type: String, enum: ['regular', 'supplementary', 'improvement'], required: true },
  maxMarks: { type: Number, required: true },
  marksObtained: { type: Number, required: true },
  result: { type: String, enum: ['pass', 'fail', 'absent', 'withheld'], required: true },
  enteredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  validatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  validatedAt: { type: Date },
  anomalyFlags: [{ type: String }],
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, courseId: 1, semesterId: 1, examType: 1 });

export const ExternalMark = model<IExternalMark>('ExternalMark', schema);
