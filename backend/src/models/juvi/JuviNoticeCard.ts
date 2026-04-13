import { Schema, model, Document } from 'mongoose';

export interface IJuviNoticeCard extends Document {
  collegeId: Schema.Types.ObjectId;
  title: string;
  body: string;
  noticeType: string;
  targetAudience: string;
  targetIds?: Schema.Types.ObjectId[];
  semesterId?: Schema.Types.ObjectId;
  publishedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdBy: Schema.Types.ObjectId;
}

const schema = new Schema<IJuviNoticeCard>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  noticeType: { type: String, enum: ['exam_schedule', 'result_published', 'attendance_warning', 'assignment_due', 'general'], required: true },
  targetAudience: { type: String, enum: ['all', 'branch', 'section', 'individual'], required: true },
  targetIds: [{ type: Schema.Types.ObjectId }],
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester' },
  publishedAt: Date,
  expiresAt: Date,
  isActive: { type: Boolean, required: true, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, noticeType: 1, isActive: 1 });

export const JuviNoticeCard = model<IJuviNoticeCard>('JuviNoticeCard', schema);
