import { Schema, model, Document } from 'mongoose';

export interface ISubmission extends Document {
  collegeId: Schema.Types.ObjectId;
  assignmentId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  submittedAt: Date;
  content?: string;
  attachments?: string[];
  marksObtained?: number;
  gradedBy?: Schema.Types.ObjectId;
  gradedAt?: Date;
  remarks?: string;
  status: string;
  isLate: boolean;
}

const schema = new Schema<ISubmission>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  submittedAt: { type: Date, required: true },
  content: String,
  attachments: [String],
  marksObtained: Number,
  gradedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  gradedAt: Date,
  remarks: String,
  status: { type: String, enum: ['submitted', 'late', 'graded', 'returned'], default: 'submitted' },
  isLate: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, assignmentId: 1, studentId: 1 }, { unique: true });
schema.index({ collegeId: 1, studentId: 1 });

export const Submission = model<ISubmission>('Submission', schema);
