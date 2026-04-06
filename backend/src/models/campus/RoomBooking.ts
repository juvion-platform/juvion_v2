import { Schema, model, Document } from 'mongoose';
export interface IRoomBooking extends Document { collegeId: Schema.Types.ObjectId; roomId: Schema.Types.ObjectId; bookedBy: Schema.Types.ObjectId; date: Date; startTime: string; endTime: string; purpose: string; status: string; }
const schema = new Schema<IRoomBooking>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true }, bookedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true }, date: { type: Date, required: true }, startTime: { type: String, required: true }, endTime: { type: String, required: true }, purpose: { type: String, required: true }, status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' } }, { timestamps: true });
schema.index({ collegeId: 1, roomId: 1, date: 1 });
export const RoomBooking = model<IRoomBooking>('RoomBooking', schema);
