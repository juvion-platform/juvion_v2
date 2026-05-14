import { Schema, model, Document, Types } from 'mongoose';

/**
 * QuestionPaperSchema — paper-blueprint master. Strategic Gap 6 Phase A.
 *
 * Defines the structure (sections × questions × marks) of a question
 * paper for a course + exam-type combination. Used by the paper-
 * setting workflow and the answer-script evaluation interface (where
 * graders enter marks per section/question).
 *
 * Example for "Mid-1, R20 regulation, B.Tech subject":
 *   sections: [
 *     { name: 'A', questionCount: 5, marksPerQuestion: 2, internalChoice: false },
 *     { name: 'B', questionCount: 5, marksPerQuestion: 10, internalChoice: true },
 *   ]
 *   totalMarks: 60
 *   durationMinutes: 90
 */
export interface IPaperSection {
  name: string;
  questionCount: number;
  marksPerQuestion: number;
  /** Internal-choice questions count as one slot but offer student
   *  multiple alternatives. */
  internalChoice: boolean;
  /** Bloom's-taxonomy level or other rubric tag. */
  rubricTag?: string;
}

export interface IQuestionPaperSchema extends Document {
  collegeId: Types.ObjectId;
  name: string;
  examType: string;
  programmeId?: Types.ObjectId;
  regulationId?: Types.ObjectId;
  courseId?: Types.ObjectId;
  sections: IPaperSection[];
  totalMarks: number;
  durationMinutes: number;
  /** Free-text instructions printed at the top of the paper. */
  generalInstructions?: string;
  status: 'draft' | 'approved' | 'archived';
}

const sectionSchema = new Schema<IPaperSection>(
  {
    name: { type: String, required: true, trim: true },
    questionCount: { type: Number, required: true, min: 1 },
    marksPerQuestion: { type: Number, required: true, min: 0 },
    internalChoice: { type: Boolean, default: false },
    rubricTag: { type: String, trim: true },
  },
  { _id: false },
);

const schema = new Schema<IQuestionPaperSchema>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    examType: { type: String, required: true, trim: true },
    programmeId: { type: Schema.Types.ObjectId, ref: 'Programme' },
    regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation' },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    sections: { type: [sectionSchema], default: [] },
    totalMarks: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 0 },
    generalInstructions: { type: String, trim: true },
    status: { type: String, enum: ['draft', 'approved', 'archived'], default: 'draft' },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, examType: 1, courseId: 1 });

export const QuestionPaperSchema = model<IQuestionPaperSchema>('QuestionPaperSchema', schema);
