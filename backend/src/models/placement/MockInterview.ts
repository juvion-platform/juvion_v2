import { Schema, model, Document } from 'mongoose';

export interface IMockInterview extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; interviewerId: Schema.Types.ObjectId; date: Date; type: string; rating?: number; feedback?: string;
}

const schema = new Schema<IMockInterview>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  interviewerId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  date: { type: Date, required: true },
  type: { type: String, enum: ['technical', 'hr', 'mixed'], required: true },
  rating: Number,
  feedback: String,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });

export const MockInterview = model<IMockInterview>('MockInterview', schema);
