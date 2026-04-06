import { Schema, model, Document } from 'mongoose';
export interface ICommunityProject extends Document { collegeId: Schema.Types.ObjectId; title: string; description: string; leadStudentId: Schema.Types.ObjectId; facultyMentorId?: Schema.Types.ObjectId; startDate: Date; endDate?: Date; beneficiaries?: string; status: string; }
const schema = new Schema<ICommunityProject>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, title: { type: String, required: true }, description: String, leadStudentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true }, facultyMentorId: { type: Schema.Types.ObjectId, ref: 'Faculty' }, startDate: { type: Date, required: true }, endDate: Date, beneficiaries: String, status: { type: String, enum: ['proposed', 'approved', 'ongoing', 'completed'], default: 'proposed' } }, { timestamps: true });
schema.index({ collegeId: 1, status: 1 });
export const CommunityProject = model<ICommunityProject>('CommunityProject', schema);
