import { Schema, model, Document } from 'mongoose';

export interface IEntranceExamScore extends Document {
  collegeId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId; examType: string; rank?: number; score: number; year: number;
}

const schema = new Schema<IEntranceExamScore>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  examType: { type: String, enum: ['EAMCET', 'JEE', 'ECET'], required: true },
  rank: Number,
  score: { type: Number, required: true },
  year: { type: Number, required: true },
}, { timestamps: true });



export const EntranceExamScore = model<IEntranceExamScore>('EntranceExamScore', schema);
