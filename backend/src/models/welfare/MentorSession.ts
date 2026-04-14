import { Schema, model, Document } from 'mongoose';
export interface IMentorSession extends Document { collegeId: Schema.Types.ObjectId; assignmentId: Schema.Types.ObjectId; mentorId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; sessionDate: Date; duration?: number; mode: string; topicsSummary?: string; concernFlagged: boolean; concernType?: string; referralMade: boolean; referralType?: string; }
const schema = new Schema<IMentorSession>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  assignmentId: { type: Schema.Types.ObjectId, ref: 'MentorAssignment', required: true },
  mentorId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  sessionDate: { type: Date, required: true },
  duration: Number,
  mode: { type: String, enum: ['in_person', 'online'], required: true },
  topicsSummary: String,
  concernFlagged: { type: Boolean, default: false },
  concernType: { type: String, enum: ['academic', 'personal', 'financial', 'health', 'other'] },
  referralMade: { type: Boolean, default: false },
  referralType: { type: String, enum: ['counselling', 'financial_aid', 'academic_support'] },
}, { timestamps: true });
schema.index({ collegeId: 1, mentorId: 1, sessionDate: -1 });
schema.index({ collegeId: 1, studentId: 1, sessionDate: -1 });
export const MentorSession = model<IMentorSession>('MentorSession', schema);
