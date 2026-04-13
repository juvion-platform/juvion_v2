import { Schema, model, Document } from 'mongoose';

export interface IAttendanceMonthlySummary extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  month: number; year: number;
  totalPresent: number; totalAbsent: number; totalLate: number;
  totalHalfDay: number; totalOnDuty: number; totalLeave: number;
  totalHoliday: number; lopDays: number;
  isLocked: boolean; lockedAt?: Date; lockedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<IAttendanceMonthlySummary>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  totalPresent: { type: Number, default: 0 },
  totalAbsent: { type: Number, default: 0 },
  totalLate: { type: Number, default: 0 },
  totalHalfDay: { type: Number, default: 0 },
  totalOnDuty: { type: Number, default: 0 },
  totalLeave: { type: Number, default: 0 },
  totalHoliday: { type: Number, default: 0 },
  lopDays: { type: Number, default: 0 },
  isLocked: { type: Boolean, default: false },
  lockedAt: Date,
  lockedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });

export const AttendanceMonthlySummary = model<IAttendanceMonthlySummary>('AttendanceMonthlySummary', schema);
