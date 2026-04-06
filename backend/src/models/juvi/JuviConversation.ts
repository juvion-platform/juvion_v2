import { Schema, model, Document } from 'mongoose';
export interface IJuviConversation extends Document { collegeId: Schema.Types.ObjectId; userId: Schema.Types.ObjectId; personaType: string; startedAt: Date; lastMessageAt: Date; messageCount: number; status: string; }
const schema = new Schema<IJuviConversation>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, userId: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, personaType: { type: String, required: true }, startedAt: { type: Date, default: Date.now }, lastMessageAt: { type: Date, default: Date.now }, messageCount: { type: Number, default: 0 }, status: { type: String, enum: ['active', 'closed', 'archived'], default: 'active' } }, { timestamps: true });
schema.index({ collegeId: 1, userId: 1, lastMessageAt: -1 });
export const JuviConversation = model<IJuviConversation>('JuviConversation', schema);
