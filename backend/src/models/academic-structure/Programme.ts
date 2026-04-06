import { Schema, model, Document } from 'mongoose';

export interface IProgramme extends Document {
  collegeId: Schema.Types.ObjectId;
  code: string; name: string; level: string; durationYears: number; regulationId: Schema.Types.ObjectId; isActive: boolean;
}

const schema = new Schema<IProgramme>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  level: { type: String, enum: ['UG', 'PG', 'Diploma', 'PhD'], required: true },
  durationYears: { type: Number, required: true },
  regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Programme = model<IProgramme>('Programme', schema);
