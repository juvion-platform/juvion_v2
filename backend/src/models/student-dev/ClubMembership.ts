import { Schema, model, Document } from 'mongoose';
export interface IClubMembership extends Document { collegeId: Schema.Types.ObjectId; clubId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; role: string; joinedDate: Date; status: string; }
const schema = new Schema<IClubMembership>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true }, studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true }, role: { type: String, enum: ['member', 'secretary', 'president', 'treasurer', 'lead'], default: 'member' }, joinedDate: { type: Date, default: Date.now }, status: { type: String, enum: ['active', 'inactive'], default: 'active' } }, { timestamps: true });
schema.index({ collegeId: 1, clubId: 1, studentId: 1 }, { unique: true });
export const ClubMembership = model<IClubMembership>('ClubMembership', schema);
