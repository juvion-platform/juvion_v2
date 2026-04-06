import { Schema, model, Document } from 'mongoose';
export interface IWhatsAppLog extends Document { collegeId: Schema.Types.ObjectId; recipientPhone: string; recipientId?: Schema.Types.ObjectId; templateName?: string; message: string; mediaUrl?: string; status: string; sentAt: Date; }
const schema = new Schema<IWhatsAppLog>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, recipientPhone: { type: String, required: true }, recipientId: { type: Schema.Types.ObjectId, ref: 'Person' }, templateName: String, message: String, mediaUrl: String, status: { type: String, enum: ['queued', 'sent', 'delivered', 'read', 'failed'], default: 'queued' }, sentAt: { type: Date, default: Date.now } }, { timestamps: true });
schema.index({ collegeId: 1, sentAt: -1 });
export const WhatsAppLog = model<IWhatsAppLog>('WhatsAppLog', schema);
