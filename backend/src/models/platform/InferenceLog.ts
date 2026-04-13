import { Schema, model, Document } from 'mongoose';

export interface IInferenceLog extends Document {
  collegeId: Schema.Types.ObjectId;
  agentId: string;
  agentName: string;
  inputData: Record<string, any>;
  outputData?: Record<string, any>;
  confidence?: number;
  latencyMs?: number;
  status: string;
  error?: string;
  triggeredBy?: Schema.Types.ObjectId;
  startedAt: Date;
  completedAt?: Date;
}

const schema = new Schema<IInferenceLog>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  agentId: { type: String, required: true },
  agentName: { type: String, required: true },
  inputData: { type: Schema.Types.Mixed, required: true },
  outputData: Schema.Types.Mixed,
  confidence: Number,
  latencyMs: Number,
  status: { type: String, enum: ['pending', 'success', 'failed'], required: true, default: 'pending' },
  error: String,
  triggeredBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  startedAt: { type: Date, required: true, default: Date.now },
  completedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, agentId: 1 });

export const InferenceLog = model<IInferenceLog>('InferenceLog', schema);
