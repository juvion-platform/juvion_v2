import { Schema, model, Document } from 'mongoose';

export interface IQualification extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId; degree: string; specialization?: string; university: string; yearOfPassing: number; percentage?: number; cgpa?: number; isHighest: boolean;
}

const schema = new Schema<IQualification>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  degree: { type: String, required: true },
  specialization: String,
  university: { type: String, required: true },
  yearOfPassing: { type: Number, required: true },
  percentage: Number,
  cgpa: Number,
  isHighest: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, personId: 1 });

export const Qualification = model<IQualification>('Qualification', schema);
