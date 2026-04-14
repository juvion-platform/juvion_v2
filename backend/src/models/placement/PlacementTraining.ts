import { Schema, model, Document } from 'mongoose';

export interface IPlacementTraining extends Document {
  collegeId: Schema.Types.ObjectId;
  title: string; type: string; trainer?: string; startDate: Date; endDate: Date; status: string;
  targetBatch: number[];
  targetProgrammeIds: Schema.Types.ObjectId[];
  mode: string;
  placementSeasonId?: Schema.Types.ObjectId;
  sessions: Array<{
    sessionNumber: number;
    date: Date;
    startTime: string;
    endTime: string;
    venue: string;
    status: string;
  }>;
}

const schema = new Schema<IPlacementTraining>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['aptitude', 'soft_skills', 'technical', 'mock_interview', 'resume'], required: true },
  trainer: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['planned', 'ongoing', 'completed'], default: 'planned' },
  targetBatch: [Number],
  targetProgrammeIds: [{ type: Schema.Types.ObjectId, ref: 'Programme' }],
  mode: { type: String, enum: ['in_house', 'vendor', 'hybrid'], default: 'in_house' },
  placementSeasonId: { type: Schema.Types.ObjectId, ref: 'PlacementSeason' },
  sessions: [{
    sessionNumber: Number,
    date: Date,
    startTime: String,
    endTime: String,
    venue: String,
    status: { type: String, enum: ['scheduled', 'conducted', 'cancelled'], default: 'scheduled' },
  }],
}, { timestamps: true });

schema.index({ collegeId: 1, startDate: -1 });

export const PlacementTraining = model<IPlacementTraining>('PlacementTraining', schema);
