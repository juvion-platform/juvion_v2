import { Schema, model, Document } from 'mongoose';
export interface IClub extends Document { collegeId: Schema.Types.ObjectId; name: string; type: string; description?: string; coordinatorId?: Schema.Types.ObjectId; facultyAdvisorId?: Schema.Types.ObjectId; isActive: boolean; }
const schema = new Schema<IClub>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, type: { type: String, enum: ['technical', 'cultural', 'sports', 'literary', 'social_service', 'entrepreneurship'], required: true }, description: String, coordinatorId: { type: Schema.Types.ObjectId, ref: 'Student' }, facultyAdvisorId: { type: Schema.Types.ObjectId, ref: 'Faculty' }, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ collegeId: 1, name: 1 }, { unique: true });
export const Club = model<IClub>('Club', schema);
