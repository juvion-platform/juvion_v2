import { Schema, model, Document } from 'mongoose';

export interface IQuiz extends Document {
  collegeId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId;
  assessmentId?: Schema.Types.ObjectId;
  title: string;
  description?: string;
  maxMarks: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  status: string;
  questions: {
    questionText: string;
    type: string;
    options?: string[];
    correctAnswer: string;
    marks: number;
    coCode?: string;
  }[];
  shuffleQuestions: boolean;
  showResults: boolean;
  createdBy: Schema.Types.ObjectId;
}

const schema = new Schema<IQuiz>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'InternalAssessment' },
  title: { type: String, required: true },
  description: String,
  maxMarks: { type: Number, required: true },
  duration: { type: Number, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'published', 'active', 'closed', 'graded'], default: 'draft' },
  questions: [{
    questionText: { type: String, required: true },
    type: { type: String, enum: ['mcq', 'true_false', 'short_answer'], required: true },
    options: [String],
    correctAnswer: { type: String, required: true },
    marks: { type: Number, required: true },
    coCode: String,
  }],
  shuffleQuestions: { type: Boolean, default: false },
  showResults: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, courseOfferingId: 1 });

export const Quiz = model<IQuiz>('Quiz', schema);
