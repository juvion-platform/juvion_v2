import { Schema, model, Document } from 'mongoose';

export interface IAttendanceSession extends Document {
  collegeId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId; date: Date; period: number; facultyId: Schema.Types.ObjectId; topicCovered?: string; status: string;
}

const schema = new Schema<IAttendanceSession>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  date: { type: Date, required: true },
  period: { type: Number, required: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  topicCovered: String,
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true });

schema.index({ collegeId: 1, courseOfferingId: 1, date: 1 });

export const AttendanceSession = model<IAttendanceSession>('AttendanceSession', schema);
