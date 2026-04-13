import { Schema, model, Document } from 'mongoose';

export interface ISemesterResult extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; semesterId: Schema.Types.ObjectId; sgpa: number; cgpa: number; totalCreditsEarned: number; totalCreditsRegistered: number; backlogs: number; result: string;
  promotionStatus?: string;
  boardDecision?: string;
  publishedAt?: Date;
  status?: string;
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
  promotionStatus: { type: String, enum: ['promoted', 'detained', 'year_back', 'graduated', 'pending'], default: 'pending' },
  boardDecision: { type: String },
  publishedAt: { type: Date },
  status: { type: String, enum: ['draft', 'computed', 'board_review', 'approved', 'published'], default: 'draft' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 }, { unique: true });

export const SemesterResult = model<ISemesterResult>('SemesterResult', schema);
