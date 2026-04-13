import { Schema, model, Document } from 'mongoose';
export interface IFacilityUsageLog extends Document { collegeId: Schema.Types.ObjectId; bookingId: Schema.Types.ObjectId; roomId: Schema.Types.ObjectId; actualStartTime?: Date; actualEndTime?: Date; attendeeCount?: number; usageNotes?: string; noShow: boolean; loggedBy?: Schema.Types.ObjectId; }
const schema = new Schema<IFacilityUsageLog>({ collegeId: { type: Schema.Types.ObjectId, required: true, index: true }, bookingId: { type: Schema.Types.ObjectId, ref: 'RoomBooking', required: true }, roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true }, actualStartTime: Date, actualEndTime: Date, attendeeCount: Number, usageNotes: String, noShow: { type: Boolean, default: false }, loggedBy: { type: Schema.Types.ObjectId, ref: 'Staff' } }, { timestamps: true });
schema.index({ collegeId: 1, bookingId: 1 });
export const FacilityUsageLog = model<IFacilityUsageLog>('FacilityUsageLog', schema);
