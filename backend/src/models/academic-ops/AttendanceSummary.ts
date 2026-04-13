import { Schema, model, Document } from 'mongoose';

export interface IAttendanceSummary extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  totalClasses: number;
  attended: number;
  percentage: number;
  category: string;
  projectedFinal?: number;
  lastUpdatedAt?: Date;
}

const schema = new Schema<IAttendanceSummary>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  totalClasses: { type: Number, default: 0 },
  attended: { type: Number, default: 0 },
  percentage: { type: Number, default: 0, min: 0, max: 100 },
  category: { type: String, enum: ['safe', 'warning', 'at_risk', 'detained'], default: 'safe' },
  projectedFinal: { type: Number, min: 0, max: 100 },
  lastUpdatedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, courseOfferingId: 1 }, { unique: true });
schema.index({ collegeId: 1, semesterId: 1, category: 1 });

export const AttendanceSummary = model<IAttendanceSummary>('AttendanceSummary', schema);
