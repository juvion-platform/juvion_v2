import { Schema, model, Document } from 'mongoose';

export interface ISpotRound extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  eligibilityCriteria?: string;
  maxSeats: number;
  filledSeats: number;
  status: string;
  approvedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<ISpotRound>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  eligibilityCriteria: String,
  maxSeats: { type: Number, default: 0 },
  filledSeats: { type: Number, default: 0 },
  status: { type: String, enum: ['planned', 'open', 'closed'], default: 'planned' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1, status: 1 });

export const SpotRound = model<ISpotRound>('SpotRound', schema);
