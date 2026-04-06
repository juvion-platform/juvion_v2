import { Schema, model, Document } from 'mongoose';

export interface IPlacementRound extends Document {
  collegeId: Schema.Types.ObjectId;
  jobPostingId: Schema.Types.ObjectId; roundNumber: number; name: string; type: string; date?: Date; venue?: string; status: string;
}

const schema = new Schema<IPlacementRound>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  jobPostingId: { type: Schema.Types.ObjectId, ref: 'JobPosting', required: true },
  roundNumber: { type: Number, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['aptitude', 'technical', 'coding', 'gd', 'hr', 'final'], required: true },
  date: Date,
  venue: String,
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed'], default: 'scheduled' },
}, { timestamps: true });

schema.index({ collegeId: 1, jobPostingId: 1, roundNumber: 1 });

export const PlacementRound = model<IPlacementRound>('PlacementRound', schema);
