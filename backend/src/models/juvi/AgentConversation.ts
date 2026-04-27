import { Schema, model, Types } from 'mongoose';

/**
 * AgentConversation — persistent chat history for the AI-native finance
 * agent (see fee-analytics-ai-native plan §2.1 and Task A2).
 *
 * One document per `conversationId` (a client-generated UUID held in
 * localStorage per college). Each turn — user + assistant — is appended
 * to `turns[]` in chronological order. Token + cost tallies roll up per
 * conversation so admins can audit per-user spend.
 *
 * Pattern: NOT extending mongoose's `Document` — same workaround as
 * `FeeAlertsCronRun.ts`. Keeps the data interface clean and avoids any
 * future name clash with mongoose-internal members.
 */

export interface IAgentConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IAgentConversation {
  _id: Types.ObjectId;
  collegeId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: string;
  turns: IAgentConversationTurn[];
  lastModel: string;
  lastProvider: 'claude' | 'openai';
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostInr: number;
  createdAt: Date;
  updatedAt: Date;
}

const turnSchema = new Schema<IAgentConversationTurn>(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false },
);

const schema = new Schema<IAgentConversation>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    conversationId: { type: String, required: true },
    turns: { type: [turnSchema], default: [] },
    lastModel: { type: String, required: true },
    lastProvider: {
      type: String,
      enum: ['claude', 'openai'],
      required: true,
    },
    totalInputTokens: { type: Number, required: true, default: 0 },
    totalOutputTokens: { type: Number, required: true, default: 0 },
    totalCostInr: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

// Plan §2.2 — user chat history scroll (newest first).
schema.index({ collegeId: 1, userId: 1, updatedAt: -1 });

export const AgentConversation = model<IAgentConversation>(
  'AgentConversation',
  schema,
);
