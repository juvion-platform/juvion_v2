import { Schema, model, Document, Types } from 'mongoose';

/**
 * 002-ai-assisted-config §3 + §10.12.
 *
 * One document per LLM-suggested field-value pair. Suggestions are
 * grouped by `batchId` (one batch per `POST /suggest` call). When the
 * admin reviews them on the form, accept/reject flips the status; the
 * suggestion's `costInr` is the per-suggestion share of the batch cost
 * (equal division: `batchCostInr / suggestions.length`), so summing
 * costs by batchId is provable against the LLM's invoice.
 */

export type ConfigSuggestionSource = 'llm' | 'peer-default';
export type ConfigSuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface IConfigSuggestion extends Document {
  collegeId: Types.ObjectId;
  configType: string;
  field: string;
  suggestedValue: unknown;
  confidence: number; // 0..1
  rationale: string;
  source: ConfigSuggestionSource;
  status: ConfigSuggestionStatus;
  generatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  llmModel: string;
  promptVersion: string;
  costInr: number;
  batchId: string;
}

const schema = new Schema<IConfigSuggestion>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    configType: { type: String, required: true, trim: true },
    field: { type: String, required: true },
    suggestedValue: { type: Schema.Types.Mixed, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    rationale: { type: String, required: true },
    source: { type: String, enum: ['llm', 'peer-default'], required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending',
    },
    generatedAt: { type: Date, required: true, default: Date.now },
    reviewedAt: Date,
    reviewedBy: String,
    rejectionReason: String,
    llmModel: { type: String, required: true },
    promptVersion: { type: String, required: true },
    costInr: { type: Number, required: true, min: 0 },
    batchId: { type: String, required: true },
  },
  { timestamps: true },
);

// Story 2 — fetch the latest pending suggestions per config type.
schema.index({ collegeId: 1, configType: 1, generatedAt: -1 });

// Story 3 — stats by status + daily-cap counts.
schema.index({ collegeId: 1, status: 1 });

// §10.12 — batch-integrity: sum/list a single batch.
schema.index({ batchId: 1 });

export const ConfigSuggestion = model<IConfigSuggestion>('ConfigSuggestion', schema);
