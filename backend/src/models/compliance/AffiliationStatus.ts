import { Schema, model, Document } from 'mongoose';
export interface IAffiliationStatus extends Document { collegeId: Schema.Types.ObjectId; universityName: string; affiliationNumber?: string; validFrom: Date; validTo: Date; programmes: Schema.Types.ObjectId[]; status: string; }
const schema = new Schema<IAffiliationStatus>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, universityName: { type: String, required: true }, affiliationNumber: String, validFrom: { type: Date, required: true }, validTo: { type: Date, required: true }, programmes: [{ type: Schema.Types.ObjectId, ref: 'Programme' }], status: { type: String, enum: ['active', 'expired', 'renewal_pending', 'revoked'], default: 'active' } }, { timestamps: true });
schema.index({ collegeId: 1 });
export const AffiliationStatus = model<IAffiliationStatus>('AffiliationStatus', schema);
