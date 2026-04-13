import { Schema, model, Document } from 'mongoose';

export interface IAttendanceAnomaly extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  anomalyType: string;
  month: number; year: number;
  details: { lateCount?: number; missedCheckouts?: number; patternDescription?: string };
  severity: string;
  referredToDisciplinary: boolean;
  disciplinaryCaseId?: Schema.Types.ObjectId;
  flaggedAt: Date;
}

const detailsSchema = new Schema({
  lateCount: Number,
  missedCheckouts: Number,
  patternDescription: String,
}, { _id: false });

const schema = new Schema<IAttendanceAnomaly>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  anomalyType: { type: String, enum: ['chronic_late', 'missing_swipe', 'irregular_pattern'], required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  details: { type: detailsSchema, default: {} },
  severity: { type: String, enum: ['info', 'warning', 'critical'], required: true },
  referredToDisciplinary: { type: Boolean, default: false },
  disciplinaryCaseId: { type: Schema.Types.ObjectId },
  flaggedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, month: 1, year: 1 });

export const AttendanceAnomaly = model<IAttendanceAnomaly>('AttendanceAnomaly', schema);
