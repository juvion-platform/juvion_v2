import { Schema, model, Document } from 'mongoose';
export interface ITransportAttendance extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; tripLogId: Schema.Types.ObjectId; stopId?: Schema.Types.ObjectId; boardedAt?: Date; alightedAt?: Date; }
const schema = new Schema<ITransportAttendance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  tripLogId: { type: Schema.Types.ObjectId, ref: 'TripLog', required: true },
  stopId: { type: Schema.Types.ObjectId, ref: 'RouteStop' },
  boardedAt: Date,
  alightedAt: Date,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, tripLogId: 1 });
export const TransportAttendance = model<ITransportAttendance>('TransportAttendance', schema);
