import { Schema, model, Document } from 'mongoose';

export interface IRoundResult extends Document {
  collegeId: Schema.Types.ObjectId;
  roundId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; result: string; score?: number; remarks?: string;
}

const schema = new Schema<IRoundResult>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  roundId: { type: Schema.Types.ObjectId, ref: 'PlacementRound', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  result: { type: String, enum: ['pass', 'fail', 'absent'], required: true },
  score: Number,
  remarks: String,
}, { timestamps: true });

schema.index({ collegeId: 1, roundId: 1, studentId: 1 }, { unique: true });

export const RoundResult = model<IRoundResult>('RoundResult', schema);
