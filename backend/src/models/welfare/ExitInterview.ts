import { Schema, model, Document } from 'mongoose';

export interface IExitInterview extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  exitRequestId?: Schema.Types.ObjectId;
  interviewerId: Schema.Types.ObjectId;
  interviewDate: Date;
  primaryReason: 'financial' | 'personal' | 'academic' | 'family' | 'health' | 'career_change' | 'relocation' | 'institutional' | 'other';
  secondaryReasons: string[];
  institutionalFeedback?: {
    teachingQuality: number;
    infrastructure: number;
    support: number;
    overallSatisfaction: number;
    suggestions?: string;
  };
  followUpRequired: boolean;
  followUpNotes?: string;
  status: 'scheduled' | 'completed' | 'student_declined';
}

const schema = new Schema<IExitInterview>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  exitRequestId: { type: Schema.Types.ObjectId, ref: 'ExitRequest' },
  interviewerId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  interviewDate: { type: Date, required: true },
  primaryReason: { type: String, enum: ['financial', 'personal', 'academic', 'family', 'health', 'career_change', 'relocation', 'institutional', 'other'], required: true },
  secondaryReasons: [{ type: String }],
  institutionalFeedback: {
    teachingQuality: { type: Number, min: 1, max: 5 },
    infrastructure: { type: Number, min: 1, max: 5 },
    support: { type: Number, min: 1, max: 5 },
    overallSatisfaction: { type: Number, min: 1, max: 5 },
    suggestions: String,
  },
  followUpRequired: { type: Boolean, default: false },
  followUpNotes: String,
  status: { type: String, enum: ['scheduled', 'completed', 'student_declined'], default: 'scheduled' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });
schema.index({ collegeId: 1, exitRequestId: 1 });

export const ExitInterview = model<IExitInterview>('ExitInterview', schema);
