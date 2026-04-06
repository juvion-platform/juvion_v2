import { Schema, model, Document } from 'mongoose';
export interface IEmailLog extends Document { collegeId: Schema.Types.ObjectId; recipientEmail: string; recipientId?: Schema.Types.ObjectId; subject: string; body: string; status: string; sentAt: Date; openedAt?: Date; }
const schema = new Schema<IEmailLog>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, recipientEmail: { type: String, required: true }, recipientId: { type: Schema.Types.ObjectId, ref: 'Person' }, subject: { type: String, required: true }, body: String, status: { type: String, enum: ['queued', 'sent', 'delivered', 'opened', 'bounced', 'failed'], default: 'queued' }, sentAt: { type: Date, default: Date.now }, openedAt: Date }, { timestamps: true });
schema.index({ collegeId: 1, sentAt: -1 });
export const EmailLog = model<IEmailLog>('EmailLog', schema);
