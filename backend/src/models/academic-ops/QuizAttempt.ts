import { Schema, model, Document } from 'mongoose';

export interface IQuizAttempt extends Document {
  collegeId: Schema.Types.ObjectId;
  quizId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  startedAt: Date;
  submittedAt?: Date;
  answers: {
    questionIndex: number;
    answer: string;
    isCorrect?: boolean;
    marksAwarded?: number;
  }[];
  totalMarks: number;
  autoGraded: boolean;
  status: string;
}

const schema = new Schema<IQuizAttempt>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  startedAt: { type: Date, required: true },
  submittedAt: Date,
  answers: [{
    questionIndex: { type: Number, required: true },
    answer: { type: String, required: true },
    isCorrect: Boolean,
    marksAwarded: Number,
  }],
  totalMarks: { type: Number, default: 0 },
  autoGraded: { type: Boolean, default: false },
  status: { type: String, enum: ['in_progress', 'submitted', 'graded'], default: 'in_progress' },
}, { timestamps: true });

schema.index({ collegeId: 1, quizId: 1, studentId: 1 }, { unique: true });
schema.index({ collegeId: 1, studentId: 1 });

export const QuizAttempt = model<IQuizAttempt>('QuizAttempt', schema);
