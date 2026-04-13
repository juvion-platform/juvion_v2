import { Schema, model, Document } from 'mongoose';

export interface ILeaveBalance extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; leaveTypeId: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; entitled: number; taken: number; balance: number;
  carriedForward?: number; lapsed?: number; encashed?: number; encashedAmount?: number; lopDays?: number;
}

const schema = new Schema<ILeaveBalance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  entitled: { type: Number, required: true },
  taken: { type: Number, default: 0 },
  balance: { type: Number, required: true },
  carriedForward: { type: Number, default: 0 },
  lapsed: { type: Number, default: 0 },
  encashed: { type: Number, default: 0 },
  encashedAmount: { type: Number, default: 0 },
  lopDays: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, leaveTypeId: 1, academicYearId: 1 }, { unique: true });

export const LeaveBalance = model<ILeaveBalance>('LeaveBalance', schema);
