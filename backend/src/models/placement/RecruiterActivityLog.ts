import { Schema, model, Document } from 'mongoose';

export interface IRecruiterActivityLog extends Document {
  collegeId: Schema.Types.ObjectId;
  recruiterAccountId: Schema.Types.ObjectId; action: string; targetEntityType?: string; targetEntityId?: Schema.Types.ObjectId; metadata?: Record<string, unknown>; timestamp: Date;
}

const schema = new Schema<IRecruiterActivityLog>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  recruiterAccountId: { type: Schema.Types.ObjectId, ref: 'RecruiterAccount', required: true },
  action: { type: String, enum: ['registration', 'verification', 'jd_post', 'profile_view', 'shortlist_review', 'offer_submit', 'deactivation', 'login'], required: true },
  targetEntityType: String,
  targetEntityId: Schema.Types.ObjectId,
  metadata: Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, recruiterAccountId: 1, timestamp: -1 });

export const RecruiterActivityLog = model<IRecruiterActivityLog>('RecruiterActivityLog', schema);
