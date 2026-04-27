import { Schema, model, Types } from 'mongoose';

/**
 * AgentAction — append-only audit log of every LLM-mediated action the
 * finance agent performs (see fee-analytics-ai-native plan §2.1 and
 * Task A2). One document per backend call, regardless of whether the
 * call was streaming or one-shot.
 *
 * Critical: `maskedPrompt` and `maskedResponse` ALWAYS contain the
 * PII-masked text — never raw guardian phone numbers, addresses, etc.
 * (per spec AC "Audit log stores the MASKED prompt + response").
 *
 * `reverted` is populated when an officer reverses a write action
 * (e.g. recalls a reminder). Reads of agent activity are typically by
 * `(collegeId, createdAt desc)` for admin review or by
 * `(userId, createdAt desc)` for per-user review — both compound
 * indexes are declared below.
 *
 * Pattern: plain interface + `model<T>()` (no `extends Document`) —
 * mirrors `FeeAlertsCronRun.ts`.
 */

export type AgentActionType =
  | 'chat'
  | 'forecast'
  | 'risk'
  | 'situations'
  | 'reminder-draft'
  | 'reminder-approve'
  | 'situation-dismiss';

export interface IAgentActionReversal {
  at: Date;
  by: Types.ObjectId;
  reason: string;
}

export interface IAgentAction {
  _id: Types.ObjectId;
  collegeId: Types.ObjectId;
  userId: Types.ObjectId;
  type: AgentActionType;
  maskedPrompt: string;
  maskedResponse: string;
  provider: 'claude' | 'openai';
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  reverted?: IAgentActionReversal;
  createdAt: Date;
}

const reversalSchema = new Schema<IAgentActionReversal>(
  {
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true },
  },
  { _id: false },
);

const schema = new Schema<IAgentAction>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    type: {
      type: String,
      enum: [
        'chat',
        'forecast',
        'risk',
        'situations',
        'reminder-draft',
        'reminder-approve',
        'situation-dismiss',
      ],
      required: true,
    },
    maskedPrompt: { type: String, required: true },
    maskedResponse: { type: String, required: true },
    provider: {
      type: String,
      enum: ['claude', 'openai'],
      required: true,
    },
    model: { type: String, required: true },
    durationMs: { type: Number, required: true },
    inputTokens: { type: Number, required: true },
    outputTokens: { type: Number, required: true },
    costInr: { type: Number, required: true },
    reverted: { type: reversalSchema, required: false },
  },
  // Only `createdAt` is meaningful for an append-only audit; we still
  // enable both via timestamps for ergonomic mongoose handling, but the
  // public interface only exposes `createdAt`.
  { timestamps: true },
);

// Plan §2.2 — admin review of all agent activity (per-college, newest first).
schema.index({ collegeId: 1, createdAt: -1 });
// Plan §2.2 — per-user review (per-user audit drill-down).
schema.index({ userId: 1, createdAt: -1 });

export const AgentAction = model<IAgentAction>('AgentAction', schema);
