import { Schema, model, Document } from 'mongoose';

export interface IAttendanceSummaryEntry {
  employeeId: Schema.Types.ObjectId;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalLeave: number;
  lopDays: number;
}

export interface ILeaveConsumedEntry {
  employeeId: Schema.Types.ObjectId;
  leaveType: string;
  daysConsumed: number;
}

export interface IJoinerEntry {
  employeeId: Schema.Types.ObjectId;
  joiningDate: Date;
  designation: string;
}

export interface ISeparationEntry {
  employeeId: Schema.Types.ObjectId;
  lastWorkingDay: Date;
  separationType: string;
}

export interface IPayrollDataExtract extends Document {
  collegeId: Schema.Types.ObjectId;
  month: number;
  year: number;
  attendanceSummary: IAttendanceSummaryEntry[];
  leaveConsumed: ILeaveConsumedEntry[];
  lopDays: { employeeId: Schema.Types.ObjectId; days: number }[];
  newJoiners: IJoinerEntry[];
  separations: ISeparationEntry[];
  status: 'draft' | 'reviewed' | 'released';
  reviewedBy?: Schema.Types.ObjectId;
  releasedAt?: Date;
}

const attendanceSummaryEntrySchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    totalPresent: { type: Number, default: 0 },
    totalAbsent: { type: Number, default: 0 },
    totalLate: { type: Number, default: 0 },
    totalLeave: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
  },
  { _id: false },
);

const leaveConsumedEntrySchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: { type: String, required: true },
    daysConsumed: { type: Number, required: true },
  },
  { _id: false },
);

const lopDaysEntrySchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    days: { type: Number, required: true },
  },
  { _id: false },
);

const joinerEntrySchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    joiningDate: { type: Date, required: true },
    designation: { type: String, required: true },
  },
  { _id: false },
);

const separationEntrySchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    lastWorkingDay: { type: Date, required: true },
    separationType: { type: String, required: true },
  },
  { _id: false },
);

const schema = new Schema<IPayrollDataExtract>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    attendanceSummary: [attendanceSummaryEntrySchema],
    leaveConsumed: [leaveConsumedEntrySchema],
    lopDays: [lopDaysEntrySchema],
    newJoiners: [joinerEntrySchema],
    separations: [separationEntrySchema],
    status: { type: String, enum: ['draft', 'reviewed', 'released'], default: 'draft' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    releasedAt: Date,
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, month: 1, year: 1 }, { unique: true });
schema.index({ collegeId: 1, status: 1 });

export const PayrollDataExtract = model<IPayrollDataExtract>('PayrollDataExtract', schema);
