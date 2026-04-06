import { Schema, model, Document } from 'mongoose';
export interface IEnergyConsumption extends Document { collegeId: Schema.Types.ObjectId; buildingId?: Schema.Types.ObjectId; month: number; year: number; electricityUnits: number; electricityCost: number; waterUnits?: number; waterCost?: number; solarGenerated?: number; }
const schema = new Schema<IEnergyConsumption>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, buildingId: { type: Schema.Types.ObjectId, ref: 'Building' }, month: { type: Number, required: true }, year: { type: Number, required: true }, electricityUnits: { type: Number, required: true }, electricityCost: { type: Number, required: true }, waterUnits: Number, waterCost: Number, solarGenerated: Number }, { timestamps: true });
schema.index({ collegeId: 1, year: 1, month: 1 });
export const EnergyConsumption = model<IEnergyConsumption>('EnergyConsumption', schema);
