import { Schema, model, Document } from 'mongoose';

export interface IAttendanceAlert extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  alertType: string;
  attendancePercent: number;
  threshold: number;
  message: string;
  isRead: boolean;
  isNotified: boolean;
  notifiedAt?: Date;
}

const schema = new Schema<IAttendanceAlert>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  alertType: { type: String, enum: ['warning', 'at_risk', 'detained'], required: true },
  attendancePercent: { type: Number, required: true },
  threshold: { type: Number, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  isNotified: { type: Boolean, default: false },
  notifiedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 });
schema.index({ collegeId: 1, semesterId: 1, alertType: 1, isRead: 1 });

export const AttendanceAlert = model<IAttendanceAlert>('AttendanceAlert', schema);
