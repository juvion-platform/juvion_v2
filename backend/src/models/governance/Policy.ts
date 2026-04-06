import { Schema, model, Document } from 'mongoose';
export interface IPolicy extends Document { collegeId: Schema.Types.ObjectId; title: string; category: string; description: string; documentUrl?: string; version: number; effectiveDate: Date; approvedBy?: Schema.Types.ObjectId; status: string; }
const schema = new Schema<IPolicy>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, title: { type: String, required: true }, category: { type: String, enum: ['academic', 'hr', 'finance', 'student', 'hostel', 'it', 'safety', 'other'], required: true }, description: String, documentUrl: String, version: { type: Number, default: 1 }, effectiveDate: { type: Date, required: true }, approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' }, status: { type: String, enum: ['draft', 'approved', 'active', 'retired'], default: 'draft' } }, { timestamps: true });
schema.index({ collegeId: 1, category: 1 });
export const Policy = model<IPolicy>('Policy', schema);
