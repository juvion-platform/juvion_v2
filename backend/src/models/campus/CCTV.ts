import { Schema, model, Document } from 'mongoose';
export interface ICCTV extends Document { collegeId: Schema.Types.ObjectId; cameraId: string; location: string; buildingId?: Schema.Types.ObjectId; ipAddress?: string; type: string; status: string; installedDate?: Date; }
const schema = new Schema<ICCTV>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, cameraId: { type: String, required: true }, location: { type: String, required: true }, buildingId: { type: Schema.Types.ObjectId, ref: 'Building' }, ipAddress: String, type: { type: String, enum: ['indoor', 'outdoor', 'ptz', 'dome'], default: 'indoor' }, status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' }, installedDate: Date }, { timestamps: true });
schema.index({ collegeId: 1, cameraId: 1 }, { unique: true });
export const CCTV = model<ICCTV>('CCTV', schema);
