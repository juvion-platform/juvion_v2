import { Schema, model, Document } from 'mongoose';
export interface ITransportRoute extends Document { collegeId: Schema.Types.ObjectId; routeNumber: string; name: string; stops: { name: string; pickupTime: string; dropTime: string; latitude?: number; longitude?: number }[]; vehicleNumber?: string; driverName?: string; driverPhone?: string; capacity: number; isActive: boolean; vehicleId?: Schema.Types.ObjectId; currentRidership: number; }
const schema = new Schema<ITransportRoute>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  routeNumber: { type: String, required: true },
  name: { type: String, required: true },
  stops: [{ name: String, pickupTime: String, dropTime: String, latitude: Number, longitude: Number }],
  vehicleNumber: String,
  driverName: String,
  driverPhone: String,
  capacity: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  currentRidership: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ collegeId: 1, routeNumber: 1 }, { unique: true });
export const TransportRoute = model<ITransportRoute>('TransportRoute', schema);
