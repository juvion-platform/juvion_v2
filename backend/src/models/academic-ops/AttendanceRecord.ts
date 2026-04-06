import { Schema, model, Document } from 'mongoose';

export interface IAttendanceRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  sessionId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; status: string; markedBy: Schema.Types.ObjectId; remarks?: string;
}

const schema = new Schema<IAttendanceRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'od', 'leave'], required: true },
  markedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  remarks: String,
}, { timestamps: true });

schema.index({ collegeId: 1, sessionId: 1, studentId: 1 }, { unique: true });
schema.index({ collegeId: 1, studentId: 1 });

export const AttendanceRecord = model<IAttendanceRecord>('AttendanceRecord', schema);
