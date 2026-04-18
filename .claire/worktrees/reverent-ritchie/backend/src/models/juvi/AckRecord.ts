import { Schema, model, Document } from 'mongoose';

export interface IAckRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  noticeCardId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  acknowledgedAt: Date;
  channel: string;
}

const schema = new Schema<IAckRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  noticeCardId: { type: Schema.Types.ObjectId, ref: 'JuviNoticeCard', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  acknowledgedAt: { type: Date, required: true, default: Date.now },
  channel: { type: String, enum: ['app', 'email', 'sms'], required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, noticeCardId: 1, studentId: 1 }, { unique: true });

export const AckRecord = model<IAckRecord>('AckRecord', schema);
