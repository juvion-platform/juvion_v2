import { Schema, model, Document } from 'mongoose';

export interface IInternshipPosting extends Document {
  collegeId: Schema.Types.ObjectId;
  companyId: Schema.Types.ObjectId; title: string; description?: string; stipend?: number; durationWeeks: number; startDate?: Date; lastDateToApply: Date; status: string;
}

const schema = new Schema<IInternshipPosting>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  title: { type: String, required: true },
  description: String,
  stipend: Number,
  durationWeeks: { type: Number, required: true },
  startDate: Date,
  lastDateToApply: { type: Date, required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true });

schema.index({ collegeId: 1, companyId: 1 });

export const InternshipPosting = model<IInternshipPosting>('InternshipPosting', schema);
