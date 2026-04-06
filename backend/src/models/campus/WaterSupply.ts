import { Schema, model, Document } from 'mongoose';
export interface IWaterSupply extends Document { collegeId: Schema.Types.ObjectId; source: string; tankName: string; capacityLitres: number; currentLevel?: number; location: string; lastCleaningDate?: Date; nextCleaningDate?: Date; }
const schema = new Schema<IWaterSupply>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, source: { type: String, enum: ['borewell', 'municipal', 'tanker', 'rainwater'], required: true }, tankName: { type: String, required: true }, capacityLitres: { type: Number, required: true }, currentLevel: Number, location: { type: String, required: true }, lastCleaningDate: Date, nextCleaningDate: Date }, { timestamps: true });
schema.index({ collegeId: 1 });
export const WaterSupply = model<IWaterSupply>('WaterSupply', schema);
