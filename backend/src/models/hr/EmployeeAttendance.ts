import { Schema, model, Document } from 'mongoose';

export interface IEmployeeAttendance extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; date: Date; checkIn?: Date; checkOut?: Date; status: string; source: string;
  lateMinutes?: number; isLocked?: boolean; anomalyFlags?: string[];
  correctionRequestedBy?: Schema.Types.ObjectId; correctionApprovedBy?: Schema.Types.ObjectId;
  correctionReason?: string; originalStatus?: string;
}

const schema = new Schema<IEmployeeAttendance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  checkIn: Date,
  checkOut: Date,
  status: { type: String, enum: ['present', 'absent', 'half_day', 'on_duty', 'leave', 'holiday'], required: true },
  source: { type: String, enum: ['biometric', 'manual', 'app'], default: 'biometric' },
  lateMinutes: { type: Number, default: 0 },
  isLocked: { type: Boolean, default: false },
  anomalyFlags: [{ type: String }],
  correctionRequestedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  correctionApprovedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  correctionReason: String,
  originalStatus: String,
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, date: 1 }, { unique: true });

export const EmployeeAttendance = model<IEmployeeAttendance>('EmployeeAttendance', schema);
