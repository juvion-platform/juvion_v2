import { Schema, model, Document } from 'mongoose';

export interface ILeaveType extends Document {
  collegeId: Schema.Types.ObjectId;
  name: string; code: string; maxDaysPerYear: number; isCarryForward: boolean; maxCarryForward: number; applicableTo: string[];
}

const schema = new Schema<ILeaveType>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  maxDaysPerYear: { type: Number, required: true },
  isCarryForward: { type: Boolean, default: false },
  maxCarryForward: { type: Number, default: 0 },
  applicableTo: [{ type: String, enum: ['teaching', 'non_teaching', 'contract', 'all'] }],
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const LeaveType = model<ILeaveType>('LeaveType', schema);
