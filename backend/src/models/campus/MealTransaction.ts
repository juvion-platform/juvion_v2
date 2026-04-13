import { Schema, model, Document } from 'mongoose';
export interface IMealTransaction extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; messFacilityId: Schema.Types.ObjectId; date: Date; mealType: string; transactionType: string; amount: number; balance: number; remarks?: string; }
const schema = new Schema<IMealTransaction>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  messFacilityId: { type: Schema.Types.ObjectId, ref: 'MessFacility', required: true },
  date: { type: Date, required: true },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'snacks', 'dinner'], required: true },
  transactionType: { type: String, enum: ['coupon_deduct', 'coupon_credit', 'credit_meal'], required: true },
  amount: { type: Number, required: true },
  balance: { type: Number, required: true },
  remarks: String,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, date: -1 });
export const MealTransaction = model<IMealTransaction>('MealTransaction', schema);
