import { Schema, model, Document } from 'mongoose';

export interface IAlumniEngagement extends Document {
  collegeId: Schema.Types.ObjectId;
  alumniId: Schema.Types.ObjectId;
  type: 'career_tracking_invitation' | 'career_update' | 'mentor_registration' | 'event_participation' | 'guest_lecture' | 'donation';
  sentAt: Date;
  respondedAt?: Date;
  status: 'sent' | 'opened' | 'responded' | 'declined' | 'expired';
  reminderCount: number;
  lastReminderAt?: Date;
  metadata?: Schema.Types.Mixed;
}

const schema = new Schema<IAlumniEngagement>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  alumniId: { type: Schema.Types.ObjectId, ref: 'Alumni', required: true },
  type: { type: String, enum: ['career_tracking_invitation', 'career_update', 'mentor_registration', 'event_participation', 'guest_lecture', 'donation'], required: true },
  sentAt: { type: Date, default: Date.now },
  respondedAt: Date,
  status: { type: String, enum: ['sent', 'opened', 'responded', 'declined', 'expired'], default: 'sent' },
  reminderCount: { type: Number, default: 0 },
  lastReminderAt: Date,
  metadata: Schema.Types.Mixed,
}, { timestamps: true });

schema.index({ collegeId: 1, alumniId: 1, type: 1 });

export const AlumniEngagement = model<IAlumniEngagement>('AlumniEngagement', schema);
