import { Schema, model, Document } from 'mongoose';

export interface IEscalationAction extends Document {
  collegeId: Schema.Types.ObjectId;
  defaulterRecordId: Schema.Types.ObjectId;
  actionType: 'sms_reminder' | 'whatsapp_parent' | 'hold_recommendation' | 'phone_call_flag' | 'legal_notice_flag' | 'welfare_referral';
  status: 'scheduled' | 'executed' | 'cancelled';
  executedAt?: Date;
  outcome?: string;
  notes?: string;
}

const schema = new Schema<IEscalationAction>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  defaulterRecordId: { type: Schema.Types.ObjectId, ref: 'DefaulterRecord', required: true },
  actionType: {
    type: String,
    enum: ['sms_reminder', 'whatsapp_parent', 'hold_recommendation', 'phone_call_flag', 'legal_notice_flag', 'welfare_referral'],
    required: true,
  },
  status: {
    type: String,
    enum: ['scheduled', 'executed', 'cancelled'],
    default: 'scheduled',
  },
  executedAt: { type: Date },
  outcome: { type: String },
  notes: { type: String },
}, { timestamps: true });

schema.index({ collegeId: 1, defaulterRecordId: 1 });

export const EscalationAction = model<IEscalationAction>('EscalationAction', schema);
