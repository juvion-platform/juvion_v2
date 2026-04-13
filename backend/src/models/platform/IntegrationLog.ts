import { Schema, model, Document } from 'mongoose';

export interface IIntegrationLog extends Document {
  collegeId: Schema.Types.ObjectId;
  provider: string;
  endpoint: string;
  method: string;
  requestPayload?: Record<string, any>;
  responsePayload?: Record<string, any>;
  statusCode?: number;
  status: string;
  retryCount: number;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

const schema = new Schema<IIntegrationLog>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  provider: { type: String, required: true },
  endpoint: { type: String, required: true },
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE'], required: true },
  requestPayload: Schema.Types.Mixed,
  responsePayload: Schema.Types.Mixed,
  statusCode: Number,
  status: { type: String, enum: ['pending', 'success', 'failed', 'retrying'], required: true, default: 'pending' },
  retryCount: { type: Number, required: true, default: 0 },
  error: String,
  startedAt: { type: Date, required: true, default: Date.now },
  completedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, provider: 1, status: 1 });

export const IntegrationLog = model<IIntegrationLog>('IntegrationLog', schema);
