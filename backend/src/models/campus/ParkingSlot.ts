import { Schema, model, Document } from 'mongoose';
export interface IParkingSlot extends Document { collegeId: Schema.Types.ObjectId; zone: string; slotNumber: string; type: string; allocatedTo?: Schema.Types.ObjectId; status: string; }
const schema = new Schema<IParkingSlot>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, zone: { type: String, required: true }, slotNumber: { type: String, required: true }, type: { type: String, enum: ['two_wheeler', 'four_wheeler', 'visitor', 'reserved'], required: true }, allocatedTo: { type: Schema.Types.ObjectId, ref: 'Person' }, status: { type: String, enum: ['available', 'occupied', 'reserved', 'blocked'], default: 'available' } }, { timestamps: true });
schema.index({ collegeId: 1, zone: 1, slotNumber: 1 }, { unique: true });
export const ParkingSlot = model<IParkingSlot>('ParkingSlot', schema);
