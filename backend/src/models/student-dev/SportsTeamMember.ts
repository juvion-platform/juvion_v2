import { Schema, model, Document } from 'mongoose';
export interface ISportsTeamMember extends Document { collegeId: Schema.Types.ObjectId; teamId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; position?: string; joinedDate: Date; }
const schema = new Schema<ISportsTeamMember>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, teamId: { type: Schema.Types.ObjectId, ref: 'SportsTeam', required: true }, studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true }, position: String, joinedDate: { type: Date, default: Date.now } }, { timestamps: true });
schema.index({ collegeId: 1, teamId: 1, studentId: 1 }, { unique: true });
export const SportsTeamMember = model<ISportsTeamMember>('SportsTeamMember', schema);
