import { Schema, model, Document } from 'mongoose';

export interface IPlacementReport extends Document {
  collegeId: Schema.Types.ObjectId;
  placementSeasonId: Schema.Types.ObjectId; reportType: string; data: Record<string, any>; generatedAt: Date;
}

const schema = new Schema<IPlacementReport>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  placementSeasonId: { type: Schema.Types.ObjectId, ref: 'PlacementSeason', required: true },
  reportType: { type: String, enum: ['company_wise', 'branch_wise', 'package_analysis', 'trend'], required: true },
  data: Schema.Types.Mixed,
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, placementSeasonId: 1 });

export const PlacementReport = model<IPlacementReport>('PlacementReport', schema);
