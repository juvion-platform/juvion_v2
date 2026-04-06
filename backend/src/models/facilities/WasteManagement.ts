import { Schema, model, Document } from 'mongoose';
export interface IWasteManagement extends Document { collegeId: Schema.Types.ObjectId; date: Date; wasteType: string; quantityKg: number; disposalMethod: string; handledBy?: string; vendorName?: string; cost?: number; }
const schema = new Schema<IWasteManagement>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, date: { type: Date, required: true }, wasteType: { type: String, enum: ['dry', 'wet', 'e_waste', 'hazardous', 'biomedical'], required: true }, quantityKg: { type: Number, required: true }, disposalMethod: { type: String, enum: ['recycle', 'compost', 'incinerate', 'landfill', 'vendor_pickup'], required: true }, handledBy: String, vendorName: String, cost: Number }, { timestamps: true });
schema.index({ collegeId: 1, date: -1 });
export const WasteManagement = model<IWasteManagement>('WasteManagement', schema);
