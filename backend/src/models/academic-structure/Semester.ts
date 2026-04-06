import { Schema, model, Document } from 'mongoose';

export interface ISemester extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId; number: number; year: number; startDate: Date; endDate: Date; status: string;
}

const schema = new Schema<ISemester>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  number: { type: Number, required: true },
  year: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['upcoming', 'active', 'completed'], default: 'upcoming' },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1, number: 1 }, { unique: true });

export const Semester = model<ISemester>('Semester', schema);
