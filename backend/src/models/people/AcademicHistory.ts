import { Schema, model, Document } from 'mongoose';

export interface IAcademicHistory extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  sgpa: number;
  cgpa: number;
  creditsEarned: number;
  creditsRegistered: number;
  backlogs: number;
  result: string;
  promotionStatus?: string;
  recordedAt: Date;
}

const schema = new Schema<IAcademicHistory>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  sgpa: { type: Number, required: true },
  cgpa: { type: Number, required: true },
  creditsEarned: { type: Number, required: true },
  creditsRegistered: { type: Number, required: true },
  backlogs: { type: Number, required: true },
  result: { type: String, enum: ['pass', 'fail', 'detained'], required: true },
  promotionStatus: { type: String, enum: ['promoted', 'detained', 'year_back', 'graduated'] },
  recordedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 }, { unique: true });

export const AcademicHistory = model<IAcademicHistory>('AcademicHistory', schema);
