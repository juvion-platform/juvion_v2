import { Schema, model, Document } from 'mongoose';
export interface IMessFacility extends Document { collegeId: Schema.Types.ObjectId; name: string; blockId?: Schema.Types.ObjectId; operationModel: string; billingModel: string; capacity?: number; isActive: boolean; coordinatorId?: Schema.Types.ObjectId; }
const schema = new Schema<IMessFacility>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  blockId: { type: Schema.Types.ObjectId, ref: 'HostelBlock' },
  operationModel: { type: String, enum: ['in_house', 'outsourced', 'hybrid'], default: 'in_house' },
  billingModel: { type: String, enum: ['fixed_fee', 'coupon'], default: 'fixed_fee' },
  capacity: Number,
  isActive: { type: Boolean, default: true },
  coordinatorId: { type: Schema.Types.ObjectId, ref: 'Staff' },
}, { timestamps: true });
schema.index({ collegeId: 1, name: 1 }, { unique: true });
export const MessFacility = model<IMessFacility>('MessFacility', schema);
