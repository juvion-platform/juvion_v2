import { Schema, model, Document } from 'mongoose';
export interface ISMSLog extends Document { collegeId: Schema.Types.ObjectId; recipientPhone: string; recipientId?: Schema.Types.ObjectId; message: string; templateId?: string; provider: string; status: string; sentAt: Date; deliveredAt?: Date; cost?: number; }
const schema = new Schema<ISMSLog>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, recipientPhone: { type: String, required: true }, recipientId: { type: Schema.Types.ObjectId, ref: 'Person' }, message: { type: String, required: true }, templateId: String, provider: String, status: { type: String, enum: ['queued', 'sent', 'delivered', 'failed', 'bounced'], default: 'queued' }, sentAt: { type: Date, default: Date.now }, deliveredAt: Date, cost: Number }, { timestamps: true });
schema.index({ collegeId: 1, sentAt: -1 });
export const SMSLog = model<ISMSLog>('SMSLog', schema);
