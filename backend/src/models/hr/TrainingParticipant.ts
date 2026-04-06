import { Schema, model, Document } from 'mongoose';

export interface ITrainingParticipant extends Document {
  collegeId: Schema.Types.ObjectId;
  trainingId: Schema.Types.ObjectId; employeeId: Schema.Types.ObjectId; status: string; feedbackRating?: number; certificateIssued: boolean;
}

const schema = new Schema<ITrainingParticipant>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  trainingId: { type: Schema.Types.ObjectId, ref: 'Training', required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  status: { type: String, enum: ['nominated', 'confirmed', 'attended', 'absent'], default: 'nominated' },
  feedbackRating: Number,
  certificateIssued: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, trainingId: 1, employeeId: 1 }, { unique: true });

export const TrainingParticipant = model<ITrainingParticipant>('TrainingParticipant', schema);
