import { Schema, model, Document } from 'mongoose';

export interface IFeeReminder extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; lineItemId?: Schema.Types.ObjectId; channel: string; sentAt: Date; dueAmount: number; status: string;
  invoiceId?: Schema.Types.ObjectId;
  escalationStage?: string;
  defaulterRecordId?: Schema.Types.ObjectId;
  templateId?: string;
  deliveryStatus?: string;
  deliveryDetails?: Record<string, unknown>;
}

const schema = new Schema<IFeeReminder>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  lineItemId: { type: Schema.Types.ObjectId, ref: 'FeeLineItem' },
  channel: { type: String, enum: ['sms', 'email', 'whatsapp', 'app'], required: true },
  sentAt: { type: Date, default: Date.now },
  dueAmount: { type: Number, required: true },
  status: { type: String, enum: ['sent', 'delivered', 'failed'], default: 'sent' },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  escalationStage: { type: String, enum: ['stage_1', 'stage_2', 'stage_3', 'stage_4'] },
  defaulterRecordId: { type: Schema.Types.ObjectId, ref: 'DefaulterRecord' },
  templateId: { type: String },
  deliveryStatus: { type: String, enum: ['delivered', 'read', 'failed', 'pending'] },
  deliveryDetails: { type: Schema.Types.Mixed },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });

export const FeeReminder = model<IFeeReminder>('FeeReminder', schema);
