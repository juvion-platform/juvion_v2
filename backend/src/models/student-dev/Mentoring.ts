import { Schema, model, Document } from 'mongoose';
export interface IMentoring extends Document { collegeId: Schema.Types.ObjectId; mentorId: Schema.Types.ObjectId; menteeId: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; meetingDate?: Date; notes?: string; status: string; }
const schema = new Schema<IMentoring>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, mentorId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true }, menteeId: { type: Schema.Types.ObjectId, ref: 'Student', required: true }, academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true }, meetingDate: Date, notes: String, status: { type: String, enum: ['active', 'completed'], default: 'active' } }, { timestamps: true });
schema.index({ collegeId: 1, mentorId: 1, menteeId: 1 });
export const Mentoring = model<IMentoring>('Mentoring', schema);
