import { Schema, model, Document } from 'mongoose';
export interface INSSParticipant extends Document { collegeId: Schema.Types.ObjectId; activityId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; hoursContributed: number; certificateIssued: boolean; }
const schema = new Schema<INSSParticipant>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, activityId: { type: Schema.Types.ObjectId, ref: 'NSSActivity', required: true }, studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true }, hoursContributed: { type: Number, required: true }, certificateIssued: { type: Boolean, default: false } }, { timestamps: true });
schema.index({ collegeId: 1, activityId: 1, studentId: 1 }, { unique: true });
export const NSSParticipant = model<INSSParticipant>('NSSParticipant', schema);
