import { Schema, model, Document } from 'mongoose';

export interface IDutyLog extends Document {
  collegeId: Schema.Types.ObjectId;
  facultyId: Schema.Types.ObjectId;
  dutyType: string;
  examScheduleId?: Schema.Types.ObjectId;
  date: Date;
  startTime?: string;
  endTime?: string;
  venue?: string;
  status: string;
  swappedWith?: Schema.Types.ObjectId;
  remarks?: string;
}

const schema = new Schema<IDutyLog>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  dutyType: { type: String, enum: ['invigilation', 'evaluation', 'question_paper_setting', 'practical_exam', 'viva_voce', 'supervision'], required: true },
  examScheduleId: { type: Schema.Types.ObjectId, ref: 'ExamSchedule' },
  date: { type: Date, required: true },
  startTime: String,
  endTime: String,
  venue: String,
  status: { type: String, enum: ['assigned', 'completed', 'swapped', 'cancelled'], default: 'assigned' },
  swappedWith: { type: Schema.Types.ObjectId, ref: 'Faculty' },
  remarks: String,
}, { timestamps: true });

schema.index({ collegeId: 1, facultyId: 1, date: -1 });

export const DutyLog = model<IDutyLog>('DutyLog', schema);
