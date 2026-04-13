import { Schema, model, Document } from 'mongoose';
export interface IBed extends Document { collegeId: Schema.Types.ObjectId; roomId: Schema.Types.ObjectId; bedNumber: string; status: string; isAccessible: boolean; }
const schema = new Schema<IBed>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'HostelRoom', required: true },
  bedNumber: { type: String, required: true },
  status: { type: String, enum: ['available', 'allocated', 'maintenance', 'reserved'], default: 'available' },
  isAccessible: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ collegeId: 1, roomId: 1, bedNumber: 1 }, { unique: true });
export const Bed = model<IBed>('Bed', schema);
