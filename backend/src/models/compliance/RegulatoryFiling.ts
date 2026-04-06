import { Schema, model, Document } from 'mongoose';
export interface IRegulatoryFiling extends Document { collegeId: Schema.Types.ObjectId; body: string; filingType: string; dueDate: Date; filedDate?: Date; referenceNumber?: string; documentUrl?: string; status: string; }
const schema = new Schema<IRegulatoryFiling>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, body: { type: String, enum: ['aicte', 'ugc', 'jntu', 'state_govt', 'mhrd', 'other'], required: true }, filingType: { type: String, required: true }, dueDate: { type: Date, required: true }, filedDate: Date, referenceNumber: String, documentUrl: String, status: { type: String, enum: ['upcoming', 'in_progress', 'filed', 'overdue', 'approved', 'rejected'], default: 'upcoming' } }, { timestamps: true });
schema.index({ collegeId: 1, dueDate: 1, status: 1 });
export const RegulatoryFiling = model<IRegulatoryFiling>('RegulatoryFiling', schema);
