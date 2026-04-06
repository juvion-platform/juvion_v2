import { Schema, model, Document } from 'mongoose';
export interface IEResource extends Document { collegeId: Schema.Types.ObjectId; title: string; type: string; provider: string; url?: string; accessType: string; subscriptionStart?: Date; subscriptionEnd?: Date; isActive: boolean; }
const schema = new Schema<IEResource>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, title: { type: String, required: true }, type: { type: String, enum: ['e_journal', 'e_book', 'database', 'video_lecture', 'nptel', 'mooc'], required: true }, provider: { type: String, required: true }, url: String, accessType: { type: String, enum: ['open', 'subscribed', 'institutional'], required: true }, subscriptionStart: Date, subscriptionEnd: Date, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ collegeId: 1, type: 1 });
export const EResource = model<IEResource>('EResource', schema);
