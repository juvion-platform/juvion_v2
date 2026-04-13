import { Schema, model, Document } from 'mongoose';
export interface IRouteStop extends Document { collegeId: Schema.Types.ObjectId; routeId: Schema.Types.ObjectId; name: string; sequence: number; pickupTime?: string; dropTime?: string; latitude?: number; longitude?: number; isActive: boolean; }
const schema = new Schema<IRouteStop>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  routeId: { type: Schema.Types.ObjectId, ref: 'TransportRoute', required: true },
  name: { type: String, required: true },
  sequence: { type: Number, required: true },
  pickupTime: String,
  dropTime: String,
  latitude: Number,
  longitude: Number,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ collegeId: 1, routeId: 1, sequence: 1 }, { unique: true });
export const RouteStop = model<IRouteStop>('RouteStop', schema);
