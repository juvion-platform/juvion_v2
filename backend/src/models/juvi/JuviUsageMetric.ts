import { Schema, model, Document } from 'mongoose';
export interface IJuviUsageMetric extends Document { collegeId: Schema.Types.ObjectId; date: Date; personaType: string; totalConversations: number; totalMessages: number; totalTokens: number; avgResponseTime: number; satisfactionScore: number; topIntents: { intent: string; count: number }[]; }
const schema = new Schema<IJuviUsageMetric>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, date: { type: Date, required: true }, personaType: { type: String, required: true }, totalConversations: { type: Number, default: 0 }, totalMessages: { type: Number, default: 0 }, totalTokens: { type: Number, default: 0 }, avgResponseTime: { type: Number, default: 0 }, satisfactionScore: { type: Number, default: 0 }, topIntents: [{ intent: String, count: Number }] }, { timestamps: true });
schema.index({ collegeId: 1, date: -1, personaType: 1 });
export const JuviUsageMetric = model<IJuviUsageMetric>('JuviUsageMetric', schema);
