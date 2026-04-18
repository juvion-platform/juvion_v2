import { Schema, model, Document } from 'mongoose';
export interface IEvidenceType extends Document { collegeId: Schema.Types.ObjectId; name: string; code: string; sourceModule: string; category: string; collectionMethod: string; requiredComponents: string[]; applicableBodies: string[]; isActive: boolean; }
const schema = new Schema<IEvidenceType>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, code: { type: String, required: true }, sourceModule: { type: String, required: true }, category: { type: String, enum: ['academic', 'research', 'infrastructure', 'financial', 'governance', 'student_support', 'faculty', 'outreach'], required: true }, collectionMethod: { type: String, enum: ['event_driven', 'periodic_sync', 'manual'], required: true }, requiredComponents: [{ type: String }], applicableBodies: [{ type: String }], isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ collegeId: 1, code: 1 }, { unique: true });
schema.index({ collegeId: 1, sourceModule: 1 });
export const EvidenceType = model<IEvidenceType>('EvidenceType', schema);
