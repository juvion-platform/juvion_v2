import { Schema, model, Document } from 'mongoose';

export interface IScholarship extends Document {
  collegeId: Schema.Types.ObjectId;
  name: string; provider: string; type: string; amount: number; criteria: string; academicYearId: Schema.Types.ObjectId; maxRecipients?: number; isActive: boolean;
}

const schema = new Schema<IScholarship>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  provider: { type: String, enum: ['government', 'institutional', 'private', 'corporate'], required: true },
  type: { type: String, enum: ['merit', 'need_based', 'sports', 'sc_st', 'bc', 'minority', 'ebc'], required: true },
  amount: { type: Number, required: true },
  criteria: String,
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  maxRecipients: Number,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1 });

export const Scholarship = model<IScholarship>('Scholarship', schema);
