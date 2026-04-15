import { Schema, model, Document } from 'mongoose';

export interface IDesignation extends Document {
  collegeId: Schema.Types.ObjectId;
  code: string;
  name: string;
  level?: number;
  category: string;
  isActive: boolean;
}

const schema = new Schema<IDesignation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  level: Number,
  category: { type: String, enum: ['teaching', 'non_teaching', 'administrative'], required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Designation = model<IDesignation>('Designation', schema);
