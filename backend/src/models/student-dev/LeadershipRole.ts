import { Schema, model, Document } from 'mongoose';
export interface ILeadershipRole extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; role: string; body: string; academicYearId: Schema.Types.ObjectId; startDate: Date; endDate?: Date; }
const schema = new Schema<ILeadershipRole>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true }, role: { type: String, required: true }, body: { type: String, enum: ['student_council', 'club', 'department', 'hostel', 'nss', 'ncc', 'sports', 'cultural'], required: true }, academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true }, startDate: { type: Date, required: true }, endDate: Date }, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1 });
export const LeadershipRole = model<ILeadershipRole>('LeadershipRole', schema);
