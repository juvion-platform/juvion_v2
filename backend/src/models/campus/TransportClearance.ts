import { Schema, model, Document } from 'mongoose';
export interface ITransportClearance extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; allocationId?: Schema.Types.ObjectId; duesCleared: boolean; status: string; blockingItems: { item: string; reason: string }[]; clearedAt?: Date; clearedBy?: Schema.Types.ObjectId; }
const schema = new Schema<ITransportClearance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  allocationId: { type: Schema.Types.ObjectId, ref: 'TransportAllocation' },
  duesCleared: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'cleared', 'blocked'], default: 'pending' },
  blockingItems: [{ item: String, reason: String, _id: false }],
  clearedAt: Date,
  clearedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1 });
export const TransportClearance = model<ITransportClearance>('TransportClearance', schema);
