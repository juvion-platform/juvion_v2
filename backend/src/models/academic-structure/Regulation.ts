import { Schema, model, Document } from 'mongoose';

export interface IRegulation extends Document {
  collegeId: Schema.Types.ObjectId;
  code: string; name: string; effectiveFromYear: number; effectiveToYear?: number; totalCredits: number; maxYears: number; isActive: boolean;
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
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Regulation = model<IRegulation>('Regulation', schema);
