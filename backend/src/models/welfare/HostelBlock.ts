import { Schema, model, Document } from 'mongoose';
export interface IHostelBlock extends Document { collegeId: Schema.Types.ObjectId; name: string; type: string; totalRooms: number; wardenId?: Schema.Types.ObjectId; isActive: boolean; chiefWardenId?: Schema.Types.ObjectId; totalCapacity: number; currentOccupancy: number; }
const schema = new Schema<IHostelBlock>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['boys', 'girls'], required: true },
  totalRooms: { type: Number, required: true },
  wardenId: { type: Schema.Types.ObjectId, ref: 'Person' },
  isActive: { type: Boolean, default: true },
  chiefWardenId: { type: Schema.Types.ObjectId, ref: 'Staff' },
  totalCapacity: { type: Number, default: 0 },
  currentOccupancy: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ collegeId: 1, name: 1 }, { unique: true });
export const HostelBlock = model<IHostelBlock>('HostelBlock', schema);
