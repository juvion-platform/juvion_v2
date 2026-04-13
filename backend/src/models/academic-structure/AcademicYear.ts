import { Schema, model, Document } from 'mongoose';

export interface IAcademicYear extends Document {
  collegeId: Schema.Types.ObjectId;
  code: string; label: string; startDate: Date; endDate: Date; isCurrent: boolean;
  status?: string;
}

const schema = new Schema<IAcademicYear>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  code: { type: String, required: true },
  label: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isCurrent: { type: Boolean, default: false },
  status: { type: String, enum: ['planning', 'active', 'completed'], default: 'planning' },
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const AcademicYear = model<IAcademicYear>('AcademicYear', schema);
