import { Schema, model, Document } from 'mongoose';

export interface ILeadInteraction extends Document {
  collegeId: Schema.Types.ObjectId;
  inquiryId: Schema.Types.ObjectId;
  type: string;           // 'phone_call' | 'whatsapp' | 'sms' | 'email' | 'walk_in' | 'campus_visit' | 'ai_conversation'
  direction: string;      // 'inbound' | 'outbound'
  channel: string;        // 'manual' | 'automated' | 'ai'
  summary: string;
  outcome?: string;       // 'interested' | 'callback_requested' | 'not_interested' | 'no_response' | 'visit_scheduled' | 'converted'
  scheduledAt?: Date;
  completedAt?: Date;
  durationMinutes?: number;
  performedBy: string;
  aiGenerated: boolean;
  metadata?: Record<string, any>;
}

const schema = new Schema<ILeadInteraction>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', required: true, index: true },
  type: {
    type: String,
    enum: ['phone_call', 'whatsapp', 'sms', 'email', 'walk_in', 'campus_visit', 'ai_conversation'],
    required: true,
  },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  channel: { type: String, enum: ['manual', 'automated', 'ai'], default: 'manual' },
  summary: { type: String, required: true },
  outcome: {
    type: String,
    enum: ['interested', 'callback_requested', 'not_interested', 'no_response', 'visit_scheduled', 'converted'],
  },
  scheduledAt: Date,
  completedAt: Date,
  durationMinutes: Number,
  performedBy: { type: String, required: true },
  aiGenerated: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

schema.index({ collegeId: 1, inquiryId: 1, createdAt: -1 });

export const LeadInteraction = model<ILeadInteraction>('LeadInteraction', schema);
