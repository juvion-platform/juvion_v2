import { Schema, model, Document } from 'mongoose';

export interface ITimetableSlot extends Document {
  collegeId: Schema.Types.ObjectId;
  timetableId: Schema.Types.ObjectId; day: string; period: number; startTime: string; endTime: string; courseOfferingId: Schema.Types.ObjectId; roomId?: Schema.Types.ObjectId; slotType: string;
}

const schema = new Schema<ITimetableSlot>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  timetableId: { type: Schema.Types.ObjectId, ref: 'Timetable', required: true },
  day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], required: true },
  period: { type: Number, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
  slotType: { type: String, enum: ['lecture', 'tutorial', 'lab', 'free'], default: 'lecture' },
}, { timestamps: true });

schema.index({ collegeId: 1, timetableId: 1, day: 1, period: 1 });

export const TimetableSlot = model<ITimetableSlot>('TimetableSlot', schema);
