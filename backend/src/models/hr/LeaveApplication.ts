import { Schema, model, Document } from 'mongoose';

export interface ILeaveApplication extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; leaveTypeId: Schema.Types.ObjectId; fromDate: Date; toDate: Date; days: number; reason: string; status: string; approvedBy?: Schema.Types.ObjectId; remarks?: string;
}

const schema = new Schema<ILeaveApplication>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  days: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['applied', 'approved', 'rejected', 'cancelled'], default: 'applied' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  remarks: String,
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, status: 1 });

export const LeaveApplication = model<ILeaveApplication>('LeaveApplication', schema);
