import { Schema, model, Document } from 'mongoose';
export interface IHostelLeave extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; leaveType: string; startDate: Date; endDate: Date; destination: string; guardianContact: string; reason?: string; approvedBy?: Schema.Types.ObjectId; status: string; parentNotified: boolean; returnedAt?: Date; }
const schema = new Schema<IHostelLeave>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  leaveType: { type: String, enum: ['home', 'medical', 'emergency'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  destination: { type: String, required: true },
  guardianContact: { type: String, required: true },
  reason: String,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'active', 'returned', 'overdue'], default: 'requested' },
  parentNotified: { type: Boolean, default: false },
  returnedAt: Date,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, startDate: -1 });
export const HostelLeave = model<IHostelLeave>('HostelLeave', schema);
