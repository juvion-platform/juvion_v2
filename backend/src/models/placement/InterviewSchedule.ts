import { Schema, model, Document } from 'mongoose';
export interface IInterviewSchedule extends Document { collegeId: Schema.Types.ObjectId; driveId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; slotStart: Date; slotEnd: Date; venue?: string; virtualLink?: string; panelInfo?: string; status: string; outcome?: string; }
const schema = new Schema<IInterviewSchedule>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, driveId: { type: Schema.Types.ObjectId, ref: 'PlacementDrive', required: true }, studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true }, slotStart: { type: Date, required: true }, slotEnd: { type: Date, required: true }, venue: String, virtualLink: String, panelInfo: String, status: { type: String, enum: ['scheduled', 'confirmed', 'rescheduled', 'completed', 'no_show', 'cancelled'], default: 'scheduled' }, outcome: { type: String, enum: ['selected', 'not_selected', 'pending'] } }, { timestamps: true });
schema.index({ collegeId: 1, driveId: 1 });
schema.index({ collegeId: 1, studentId: 1, slotStart: 1 });
export const InterviewSchedule = model<IInterviewSchedule>('InterviewSchedule', schema);
