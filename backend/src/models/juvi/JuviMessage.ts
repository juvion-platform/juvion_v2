import { Schema, model, Document } from 'mongoose';
export interface IJuviMessage extends Document { collegeId: Schema.Types.ObjectId; conversationId: Schema.Types.ObjectId; role: string; content: string; intent?: string; entities?: Record<string, any>; toolCalls?: { tool: string; params: Record<string, any>; result?: any }[]; tokens?: number; }
const schema = new Schema<IJuviMessage>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, conversationId: { type: Schema.Types.ObjectId, ref: 'JuviConversation', required: true }, role: { type: String, enum: ['user', 'assistant', 'system', 'tool'], required: true }, content: { type: String, required: true }, intent: String, entities: Schema.Types.Mixed, toolCalls: [{ tool: String, params: Schema.Types.Mixed, result: Schema.Types.Mixed }], tokens: Number }, { timestamps: true });
schema.index({ collegeId: 1, conversationId: 1, createdAt: 1 });
export const JuviMessage = model<IJuviMessage>('JuviMessage', schema);
