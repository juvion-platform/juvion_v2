import { Schema, model, Document } from 'mongoose';

export interface IPlacementSeason extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId; name: string; startDate: Date; endDate: Date; status: string;
  eligibleBatches: number[];
  eligibleProgrammeIds: Schema.Types.ObjectId[];
  dreamThreshold: number;
  minCgpaDefault: number;
  seasonTargets?: {
    placementRateTarget?: number;
    avgCtcTarget?: number;
    companyCountTarget?: number;
  };
}

const schema = new Schema<IPlacementSeason>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['planning', 'pre_season', 'open', 'active', 'wind_down', 'closed'], default: 'planning' },
  eligibleBatches: [Number],
  eligibleProgrammeIds: [{ type: Schema.Types.ObjectId, ref: 'Programme' }],
  dreamThreshold: { type: Number, default: 1.5 },
  minCgpaDefault: { type: Number, default: 6.0 },
  seasonTargets: {
    placementRateTarget: Number,
    avgCtcTarget: Number,
    companyCountTarget: Number,
  },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1 });

export const PlacementSeason = model<IPlacementSeason>('PlacementSeason', schema);
