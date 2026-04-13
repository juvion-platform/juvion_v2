import { Schema, model, Document } from 'mongoose';

export interface IAttainmentRun extends Document {
  collegeId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  runType: string;
  status: string;
  triggeredBy: Schema.Types.ObjectId;
  startedAt: Date;
  completedAt?: Date;
  summary?: Record<string, any>;
  error?: string;
}

const schema = new Schema<IAttainmentRun>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  runType: { type: String, enum: ['co', 'po', 'programme_health'], required: true },
  status: { type: String, enum: ['running', 'completed', 'failed'], required: true, default: 'running' },
  triggeredBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  startedAt: { type: Date, required: true, default: Date.now },
  completedAt: Date,
  summary: Schema.Types.Mixed,
  error: String,
}, { timestamps: true });

schema.index({ collegeId: 1, semesterId: 1, runType: 1 });

export const AttainmentRun = model<IAttainmentRun>('AttainmentRun', schema);
