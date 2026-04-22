import { Schema, model, Document } from 'mongoose';

export interface IFeeReminder extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; lineItemId?: Schema.Types.ObjectId; channel: string; sentAt: Date; dueAmount: number; status: string;
  invoiceId?: Schema.Types.ObjectId;
  escalationStage?: string;
  defaulterRecordId?: Schema.Types.ObjectId;
  templateId?: string;
  // T6 — `skipped_paid` is set by the stub workers when an invoice
  // was paid between cron decision and delivery dispatch (plan §4 R-4).
  deliveryStatus?: string;
  deliveryDetails?: Record<string, unknown>;
  deliveredAt?: Date;
  metadata?: Record<string, unknown>;
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
  deliveryStatus: {
    type: String,
    // `skipped_paid` added in T6 (fee-collection-analytics-and-alerts):
    // stub workers flip to this state when the invoice is already paid
    // by the time the delivery job runs.
    enum: ['delivered', 'read', 'failed', 'pending', 'skipped_paid'],
  },
  deliveryDetails: { type: Schema.Types.Mixed },
  deliveredAt: { type: Date },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });

export const FeeReminder = model<IFeeReminder>('FeeReminder', schema);
