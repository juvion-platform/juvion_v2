import { Schema, model, Document } from 'mongoose';

export interface IPlacementTraining extends Document {
  collegeId: Schema.Types.ObjectId;
  title: string; type: string; trainer?: string; startDate: Date; endDate: Date; status: string;
}

const schema = new Schema<IPlacementTraining>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['aptitude', 'soft_skills', 'technical', 'mock_interview', 'resume'], required: true },
  trainer: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['planned', 'ongoing', 'completed'], default: 'planned' },
}, { timestamps: true });

schema.index({ collegeId: 1, startDate: -1 });

export const PlacementTraining = model<IPlacementTraining>('PlacementTraining', schema);
