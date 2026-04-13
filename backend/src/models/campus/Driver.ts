import { Schema, model, Document } from 'mongoose';
export interface IDriver extends Document { collegeId: Schema.Types.ObjectId; personId: Schema.Types.ObjectId; licenseNumber: string; licenseType?: string; licenseExpiry: Date; vehicleAssignment?: Schema.Types.ObjectId; isActive: boolean; }
const schema = new Schema<IDriver>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  licenseNumber: { type: String, required: true },
  licenseType: String,
  licenseExpiry: { type: Date, required: true },
  vehicleAssignment: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ collegeId: 1, personId: 1 }, { unique: true });
export const Driver = model<IDriver>('Driver', schema);
