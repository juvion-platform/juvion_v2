import { Schema, model, Document } from 'mongoose';

export interface IFeeReminder extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; lineItemId?: Schema.Types.ObjectId; channel: string; sentAt: Date; dueAmount: number; status: string;
}

const schema = new Schema<IFeeReminder>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  lineItemId: { type: Schema.Types.ObjectId, ref: 'FeeLineItem' },
  channel: { type: String, enum: ['sms', 'email', 'whatsapp', 'app'], required: true },
  sentAt: { type: Date, default: Date.now },
  dueAmount: { type: Number, required: true },
  status: { type: String, enum: ['sent', 'delivered', 'failed'], default: 'sent' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });

export const FeeReminder = model<IFeeReminder>('FeeReminder', schema);
