import { Schema, model, Document } from 'mongoose';
export interface ICounselingSession extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; counselorId: Schema.Types.ObjectId; sessionDate: Date; type: string; notes?: string; followUpRequired: boolean; nextSessionDate?: Date; }
const schema = new Schema<ICounselingSession>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  counselorId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  sessionDate: { type: Date, required: true },
  type: { type: String, enum: ['academic', 'personal', 'career', 'crisis', 'follow_up'], required: true },
  notes: String,
  followUpRequired: { type: Boolean, default: false },
  nextSessionDate: Date,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, sessionDate: -1 });
export const CounselingSession = model<ICounselingSession>('CounselingSession', schema);
