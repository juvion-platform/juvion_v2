import { Schema, model, Document, Types } from 'mongoose';

export type OutboxStatus = 'pending' | 'processing' | 'done' | 'dead';
export const OUTBOX_STATUSES: readonly OutboxStatus[] = ['pending', 'processing', 'done', 'dead'];
/** `done` rows are kept 30 days for the admin console, then dropped by the TTL index. */
export const DONE_TTL_SECONDS = 30 * 86_400;

export interface IOutboxEvent extends Document {
  collegeId: Types.ObjectId;
  type: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  lockedUntil: Date | null;
  lastError?: string;
  processedAt?: Date;
  createdAt: Date;
}

const schema = new Schema<IOutboxEvent>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    dedupeKey: { type: String, required: true },
    status: { type: String, enum: OUTBOX_STATUSES, required: true, default: 'pending' },
    attempts: { type: Number, default: 0 },
    availableAt: { type: Date, required: true, default: Date.now },
    lockedUntil: { type: Date, default: null },
    lastError: String,
    processedAt: Date,
  },
  { timestamps: true },
);

schema.index({ dedupeKey: 1 }, { unique: true });
schema.index({ status: 1, availableAt: 1 });
schema.index({ status: 1, lockedUntil: 1 });
schema.index({ processedAt: 1 }, { expireAfterSeconds: DONE_TTL_SECONDS, partialFilterExpression: { status: 'done' } });

export const OutboxEvent = model<IOutboxEvent>('OutboxEvent', schema);
