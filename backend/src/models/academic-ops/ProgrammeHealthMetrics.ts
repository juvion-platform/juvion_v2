import { Schema, model, Document } from 'mongoose';

export interface IProgrammeHealthMetrics extends Document {
  collegeId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  passRate: number;
  avgCGPA: number;
  backlogRatio: number;
  attendanceAvg: number;
  coAttainmentAvg: number;
  poAttainmentAvg: number;
  syllabusCompletion: number;
  feedbackAvg: number;
}

const schema = new Schema<IProgrammeHealthMetrics>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  passRate: { type: Number, required: true },
  avgCGPA: { type: Number, required: true },
  backlogRatio: { type: Number, required: true },
  attendanceAvg: { type: Number, required: true },
  coAttainmentAvg: { type: Number, required: true },
  poAttainmentAvg: { type: Number, required: true },
  syllabusCompletion: { type: Number, required: true },
  feedbackAvg: { type: Number, required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, programmeId: 1, semesterId: 1 }, { unique: true });

export const ProgrammeHealthMetrics = model<IProgrammeHealthMetrics>('ProgrammeHealthMetrics', schema);
