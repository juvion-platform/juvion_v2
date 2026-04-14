import { Schema, model, Document } from 'mongoose';
export interface IParentMeeting extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; parentId: Schema.Types.ObjectId; facultyId: Schema.Types.ObjectId; scheduledDate: Date; agenda?: string; notes?: string; status: string; triggeringCaseId?: Schema.Types.ObjectId; triggeringCaseType?: string; welfareContext?: string; }
const schema = new Schema<IParentMeeting>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Parent', required: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  scheduledDate: { type: Date, required: true },
  agenda: String,
  notes: String,
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'no_show'], default: 'scheduled' },
  triggeringCaseId: { type: Schema.Types.ObjectId },
  triggeringCaseType: { type: String, enum: ['grievance', 'disciplinary', 'crisis', 'mentoring', 'academic'] },
  welfareContext: String,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, scheduledDate: -1 });
export const ParentMeeting = model<IParentMeeting>('ParentMeeting', schema);
