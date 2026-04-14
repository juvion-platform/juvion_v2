import { Schema, model, Document } from 'mongoose';
export interface IMentorConcern extends Document { collegeId: Schema.Types.ObjectId; mentorId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; sessionId?: Schema.Types.ObjectId; concernType: string; description: string; severity: string; actionTaken?: string; escalatedToCCD: boolean; riskSignalId?: Schema.Types.ObjectId; status: string; }
const schema = new Schema<IMentorConcern>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  mentorId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'MentorSession' },
  concernType: { type: String, enum: ['academic', 'personal', 'financial', 'health', 'behavioral', 'other'], required: true },
  description: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
  actionTaken: String,
  escalatedToCCD: { type: Boolean, default: false },
  riskSignalId: Schema.Types.ObjectId,
  status: { type: String, enum: ['open', 'addressed', 'escalated', 'closed'], default: 'open' },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, status: 1 });
export const MentorConcern = model<IMentorConcern>('MentorConcern', schema);
