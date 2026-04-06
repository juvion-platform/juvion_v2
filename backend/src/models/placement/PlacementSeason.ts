import { Schema, model, Document } from 'mongoose';

export interface IPlacementSeason extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId; name: string; startDate: Date; endDate: Date; status: string;
}

const schema = new Schema<IPlacementSeason>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['planning', 'active', 'completed'], default: 'planning' },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1 });

export const PlacementSeason = model<IPlacementSeason>('PlacementSeason', schema);
