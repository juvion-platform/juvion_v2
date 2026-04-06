import { Schema, model, Document } from 'mongoose';

export interface IConcession extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; type: string; percentage?: number; flatAmount?: number; reason: string; approvedBy?: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; status: string;
}

const schema = new Schema<IConcession>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  type: { type: String, enum: ['sibling', 'staff_ward', 'merit', 'financial_hardship', 'sports', 'other'], required: true },
  percentage: Number,
  flatAmount: Number,
  reason: { type: String, required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  status: { type: String, enum: ['requested', 'approved', 'rejected'], default: 'requested' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 });

export const Concession = model<IConcession>('Concession', schema);
