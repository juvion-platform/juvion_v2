import { Schema, model, Document } from 'mongoose';
export interface IHostelAttendance extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; allocationId: Schema.Types.ObjectId; date: Date; status: string; recordedBy?: Schema.Types.ObjectId; method: string; }
const schema = new Schema<IHostelAttendance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  allocationId: { type: Schema.Types.ObjectId, ref: 'HostelAllocation', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'on_leave'], required: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  method: { type: String, enum: ['manual', 'card_swipe'], default: 'manual' },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, date: 1 }, { unique: true });
export const HostelAttendance = model<IHostelAttendance>('HostelAttendance', schema);
