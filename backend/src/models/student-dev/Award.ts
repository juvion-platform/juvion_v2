import { Schema, model, Document } from 'mongoose';
export interface IAward extends Document { collegeId: Schema.Types.ObjectId; name: string; category: string; level: string; description?: string; criteria?: string; isActive: boolean; }
const schema = new Schema<IAward>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, category: { type: String, enum: ['academic', 'sports', 'cultural', 'service', 'leadership', 'innovation'], required: true }, level: { type: String, enum: ['department', 'institution'], required: true }, description: String, criteria: String, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ collegeId: 1, category: 1 });
export const Award = model<IAward>('Award', schema);
