import { Schema, model, Document } from 'mongoose';

export interface ISeatingPlan extends Document {
  collegeId: Schema.Types.ObjectId;
  examScheduleId: Schema.Types.ObjectId;
  roomId?: Schema.Types.ObjectId;
  roomName: string;
  capacity: number;
  assignments: {
    seatNumber: string;
    studentId: Schema.Types.ObjectId;
    examRegistrationId: Schema.Types.ObjectId;
  }[];
  status: string;
  generatedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<ISeatingPlan>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  examScheduleId: { type: Schema.Types.ObjectId, ref: 'ExamSchedule', required: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
  roomName: { type: String, required: true },
  capacity: { type: Number, required: true },
  assignments: [{
    seatNumber: { type: String, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    examRegistrationId: { type: Schema.Types.ObjectId, ref: 'ExamRegistration', required: true },
  }],
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, examScheduleId: 1 });

export const SeatingPlan = model<ISeatingPlan>('SeatingPlan', schema);
