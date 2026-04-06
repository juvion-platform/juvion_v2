import { Schema, model, Document } from 'mongoose';
export interface IAssetAllocation extends Document { collegeId: Schema.Types.ObjectId; assetId: Schema.Types.ObjectId; allocatedTo: Schema.Types.ObjectId; allocatedDate: Date; returnDate?: Date; condition: string; status: string; }
const schema = new Schema<IAssetAllocation>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true }, allocatedTo: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, allocatedDate: { type: Date, default: Date.now }, returnDate: Date, condition: { type: String, enum: ['good', 'fair', 'poor', 'damaged'], default: 'good' }, status: { type: String, enum: ['allocated', 'returned', 'lost'], default: 'allocated' } }, { timestamps: true });
schema.index({ collegeId: 1, assetId: 1 });
export const AssetAllocation = model<IAssetAllocation>('AssetAllocation', schema);
