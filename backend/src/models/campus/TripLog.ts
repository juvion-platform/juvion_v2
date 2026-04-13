import { Schema, model, Document } from 'mongoose';
export interface ITripLog extends Document { collegeId: Schema.Types.ObjectId; routeId: Schema.Types.ObjectId; vehicleId: Schema.Types.ObjectId; driverId: Schema.Types.ObjectId; tripDate: Date; tripType: string; startTime?: Date; endTime?: Date; gpsTrack: { lat: number; lng: number; timestamp: Date }[]; status: string; remarks?: string; }
const schema = new Schema<ITripLog>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  routeId: { type: Schema.Types.ObjectId, ref: 'TransportRoute', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  tripDate: { type: Date, required: true },
  tripType: { type: String, enum: ['morning', 'evening'], required: true },
  startTime: Date,
  endTime: Date,
  gpsTrack: [{ lat: Number, lng: Number, timestamp: Date, _id: false }],
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled' },
  remarks: String,
}, { timestamps: true });
schema.index({ collegeId: 1, routeId: 1, tripDate: -1 });
export const TripLog = model<ITripLog>('TripLog', schema);
