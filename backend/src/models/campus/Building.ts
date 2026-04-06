import { Schema, model, Document } from 'mongoose';
export interface IBuilding extends Document { collegeId: Schema.Types.ObjectId; name: string; code: string; floors: number; totalRooms: number; location?: string; isActive: boolean; }
const schema = new Schema<IBuilding>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true }, code: { type: String, required: true }, floors: { type: Number, required: true }, totalRooms: { type: Number, required: true }, location: String, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ collegeId: 1, code: 1 }, { unique: true });
export const Building = model<IBuilding>('Building', schema);
