import { Schema, model, Document } from 'mongoose';
export interface ISponsorContact extends Document { collegeId: Schema.Types.ObjectId; name: string; company: string; designation?: string; email?: string; phone?: string; pastSponsorships: { eventId: Schema.Types.ObjectId; year: number; amount: number }[]; notes?: string; }
const schema = new Schema<ISponsorContact>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, company: { type: String, required: true }, designation: String, email: String, phone: String, pastSponsorships: [{ eventId: { type: Schema.Types.ObjectId }, year: Number, amount: Number }], notes: String }, { timestamps: true });
schema.index({ collegeId: 1, company: 1 });
export const SponsorContact = model<ISponsorContact>('SponsorContact', schema);
