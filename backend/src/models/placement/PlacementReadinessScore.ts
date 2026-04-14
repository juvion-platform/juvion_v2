import { Schema, model, Document } from 'mongoose';

export interface IPlacementReadinessScore extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; placementSeasonId: Schema.Types.ObjectId; overall: number; components: { aptitude: number; technical: number; softSkills: number; profileCompleteness: number; mockInterview?: number }; weights: { aptitude: number; technical: number; softSkills: number; profileCompleteness: number }; category: string; lastComputedAt: Date;
}

const schema = new Schema<IPlacementReadinessScore>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  placementSeasonId: { type: Schema.Types.ObjectId, ref: 'PlacementSeason', required: true },
  overall: { type: Number, min: 0, max: 100, default: 0 },
  components: {
    aptitude: { type: Number, default: 0 },
    technical: { type: Number, default: 0 },
    softSkills: { type: Number, default: 0 },
    profileCompleteness: { type: Number, default: 0 },
    mockInterview: Number,
  },
  weights: {
    aptitude: { type: Number, default: 0.30 },
    technical: { type: Number, default: 0.30 },
    softSkills: { type: Number, default: 0.20 },
    profileCompleteness: { type: Number, default: 0.20 },
  },
  category: { type: String, enum: ['ready', 'needs_improvement', 'at_risk'], default: 'at_risk' },
  lastComputedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, placementSeasonId: 1, studentId: 1 }, { unique: true });
schema.index({ collegeId: 1, category: 1 });

export const PlacementReadinessScore = model<IPlacementReadinessScore>('PlacementReadinessScore', schema);
