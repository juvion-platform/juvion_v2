import { Schema, model, Document } from 'mongoose';
export interface IJuviKnowledgeBase extends Document { collegeId: Schema.Types.ObjectId; category: string; question: string; answer: string; tags: string[]; source?: string; isActive: boolean; usageCount: number; }
const schema = new Schema<IJuviKnowledgeBase>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, category: { type: String, required: true }, question: { type: String, required: true }, answer: { type: String, required: true }, tags: [String], source: String, isActive: { type: Boolean, default: true }, usageCount: { type: Number, default: 0 } }, { timestamps: true });
schema.index({ collegeId: 1, category: 1 });
schema.index({ question: 'text', answer: 'text', tags: 'text' });
export const JuviKnowledgeBase = model<IJuviKnowledgeBase>('JuviKnowledgeBase', schema);
