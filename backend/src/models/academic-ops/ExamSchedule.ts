import { Schema, model, Document } from 'mongoose';

export interface IExamSchedule extends Document {
  collegeId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId; courseId: Schema.Types.ObjectId; examType: string; date: Date; startTime: string; endTime: string; venue?: string; status: string;
  seatingPlanId?: Schema.Types.ObjectId;
  invigilationRosterId?: Schema.Types.ObjectId;
}

const schema = new Schema<IExamSchedule>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  examType: { type: String, enum: ['regular', 'supplementary', 'improvement'], required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  venue: String,
  status: { type: String, enum: ['scheduled', 'conducted', 'cancelled'], default: 'scheduled' },
  seatingPlanId: { type: Schema.Types.ObjectId, ref: 'SeatingPlan' },
  invigilationRosterId: { type: Schema.Types.ObjectId, ref: 'InvigilationRoster' },
}, { timestamps: true });

schema.index({ collegeId: 1, semesterId: 1, date: 1 });

export const ExamSchedule = model<IExamSchedule>('ExamSchedule', schema);
