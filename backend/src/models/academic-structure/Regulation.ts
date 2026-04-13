import { Schema, model, Document } from 'mongoose';

export interface IRegulation extends Document {
  collegeId: Schema.Types.ObjectId;
  code: string; name: string; effectiveFromYear: number; effectiveToYear?: number; totalCredits: number; maxYears: number; isActive: boolean;
  gradingScale?: {
    grade: string;
    minMarks: number;
    maxMarks: number;
    gradePoints: number;
  }[];
  cieFormula?: {
    components: {
      type: string;
      maxMarks: number;
      weight: number;
      aggregation: string;
      groupWith?: string;
    }[];
    totalCIEMarks: number;
  };
  passingCriteria?: {
    internalMin: number;
    externalMin: number;
    totalMin: number;
  };
}

const schema = new Schema<IRegulation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  effectiveFromYear: { type: Number, required: true },
  effectiveToYear: Number,
  totalCredits: { type: Number, required: true },
  maxYears: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  gradingScale: [{
    grade: { type: String, required: true },
    minMarks: { type: Number, required: true },
    maxMarks: { type: Number, required: true },
    gradePoints: { type: Number, required: true },
  }],
  cieFormula: {
    components: [{
      type: { type: String, required: true },
      maxMarks: { type: Number, required: true },
      weight: { type: Number, required: true },
      aggregation: { type: String, required: true },
      groupWith: String,
    }],
    totalCIEMarks: Number,
  },
  passingCriteria: {
    internalMin: Number,
    externalMin: Number,
    totalMin: Number,
  },
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Regulation = model<IRegulation>('Regulation', schema);
