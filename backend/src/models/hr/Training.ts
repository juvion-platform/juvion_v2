import { Schema, model, Document } from 'mongoose';

export interface ITraining extends Document {
  collegeId: Schema.Types.ObjectId;
  title: string; type: string; conductedBy?: string; startDate: Date; endDate: Date; venue?: string; maxParticipants?: number; status: string;
}

const schema = new Schema<ITraining>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['fdp', 'workshop', 'seminar', 'conference', 'orientation', 'skill_development'], required: true },
  conductedBy: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  venue: String,
  maxParticipants: Number,
  status: { type: String, enum: ['planned', 'ongoing', 'completed', 'cancelled'], default: 'planned' },
}, { timestamps: true });

schema.index({ collegeId: 1, startDate: -1 });

export const Training = model<ITraining>('Training', schema);
