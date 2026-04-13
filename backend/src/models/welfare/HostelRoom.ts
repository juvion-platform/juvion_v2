import { Schema, model, Document } from 'mongoose';
export interface IHostelRoom extends Document { collegeId: Schema.Types.ObjectId; blockId: Schema.Types.ObjectId; roomNumber: string; floor: number; capacity: number; occupancy: number; amenities: string[]; status: string; roomType: string; isAccessible: boolean; currentOccupancy: number; }
const schema = new Schema<IHostelRoom>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  blockId: { type: Schema.Types.ObjectId, ref: 'HostelBlock', required: true },
  roomNumber: { type: String, required: true },
  floor: { type: Number, required: true },
  capacity: { type: Number, required: true },
  occupancy: { type: Number, default: 0 },
  amenities: [String],
  status: { type: String, enum: ['available', 'full', 'maintenance', 'reserved'], default: 'available' },
  roomType: { type: String, enum: ['single', 'double', 'triple', 'dormitory'], default: 'double' },
  isAccessible: { type: Boolean, default: false },
  currentOccupancy: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ collegeId: 1, blockId: 1, roomNumber: 1 }, { unique: true });
export const HostelRoom = model<IHostelRoom>('HostelRoom', schema);
