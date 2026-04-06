import { Schema, model, Document } from 'mongoose';
export interface IMessFeedback extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; date: Date; mealType: string; rating: number; comments?: string; }
const schema = new Schema<IMessFeedback>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  date: { type: Date, required: true },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'snacks', 'dinner'], required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comments: String,
}, { timestamps: true });
schema.index({ collegeId: 1, date: -1 });
export const MessFeedback = model<IMessFeedback>('MessFeedback', schema);
