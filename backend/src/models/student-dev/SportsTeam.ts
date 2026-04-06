import { Schema, model, Document } from 'mongoose';
export interface ISportsTeam extends Document { collegeId: Schema.Types.ObjectId; sport: string; category: string; coachId?: Schema.Types.ObjectId; captain?: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; }
const schema = new Schema<ISportsTeam>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, sport: { type: String, required: true }, category: { type: String, enum: ['men', 'women', 'mixed'], required: true }, coachId: { type: Schema.Types.ObjectId, ref: 'Person' }, captain: { type: Schema.Types.ObjectId, ref: 'Student' }, academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true } }, { timestamps: true });
schema.index({ collegeId: 1, sport: 1, category: 1, academicYearId: 1 });
export const SportsTeam = model<ISportsTeam>('SportsTeam', schema);
