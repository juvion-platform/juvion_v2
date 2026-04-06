import { Schema, model, Document } from 'mongoose';

export interface IJobPosting extends Document {
  collegeId: Schema.Types.ObjectId;
  placementSeasonId: Schema.Types.ObjectId; companyId: Schema.Types.ObjectId; role: string; description: string; packageLpa: number; eligibilityCriteria: Record<string, any>; registrationDeadline: Date; maxPositions: number; status: string;
}

const schema = new Schema<IJobPosting>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  placementSeasonId: { type: Schema.Types.ObjectId, ref: 'PlacementSeason', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  role: { type: String, required: true },
  description: String,
  packageLpa: { type: Number, required: true },
  eligibilityCriteria: Schema.Types.Mixed,
  registrationDeadline: Date,
  maxPositions: { type: Number, default: 1 },
  status: { type: String, enum: ['draft', 'open', 'closed', 'filled'], default: 'draft' },
}, { timestamps: true });

schema.index({ collegeId: 1, placementSeasonId: 1, companyId: 1 });

export const JobPosting = model<IJobPosting>('JobPosting', schema);
