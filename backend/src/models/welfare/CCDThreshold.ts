import { Schema, model, Document } from 'mongoose';
export interface ICCDThreshold extends Document { collegeId: Schema.Types.ObjectId; name: string; priority: string; scoreThreshold: number; crossModuleMinimum: number; temporalWindowDays: number; compoundingMultiplier: number; decayDays: number; isActive: boolean; updatedBy?: Schema.Types.ObjectId; }
const schema = new Schema<ICCDThreshold>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  priority: { type: String, enum: ['P1', 'P2', 'P3'], required: true },
  scoreThreshold: { type: Number, required: true },
  crossModuleMinimum: { type: Number, default: 1 },
  temporalWindowDays: { type: Number, default: 14 },
  compoundingMultiplier: { type: Number, default: 1.5 },
  decayDays: { type: Number, default: 30 },
  isActive: { type: Boolean, default: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });
schema.index({ collegeId: 1, isActive: 1, priority: 1 });
export const CCDThreshold = model<ICCDThreshold>('CCDThreshold', schema);
