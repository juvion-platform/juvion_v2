import { Schema, model, Document } from 'mongoose';
export interface IRoomChangeRequest extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; currentRoomId: Schema.Types.ObjectId; currentBedId?: Schema.Types.ObjectId; requestedRoomId?: Schema.Types.ObjectId; preferredBlockId?: Schema.Types.ObjectId; reason: string; reasonCategory: string; status: string; approvedBy?: Schema.Types.ObjectId; newRoomId?: Schema.Types.ObjectId; newBedId?: Schema.Types.ObjectId; rejectionReason?: string; }
const schema = new Schema<IRoomChangeRequest>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  currentRoomId: { type: Schema.Types.ObjectId, ref: 'HostelRoom', required: true },
  currentBedId: { type: Schema.Types.ObjectId, ref: 'Bed' },
  requestedRoomId: { type: Schema.Types.ObjectId, ref: 'HostelRoom' },
  preferredBlockId: { type: Schema.Types.ObjectId, ref: 'HostelBlock' },
  reason: { type: String, required: true },
  reasonCategory: { type: String, enum: ['roommate_conflict', 'medical', 'preference', 'other'], required: true },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'completed'], default: 'requested' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  newRoomId: { type: Schema.Types.ObjectId, ref: 'HostelRoom' },
  newBedId: { type: Schema.Types.ObjectId, ref: 'Bed' },
  rejectionReason: String,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1 });
export const RoomChangeRequest = model<IRoomChangeRequest>('RoomChangeRequest', schema);
