import { Schema, model, Document } from 'mongoose';

export interface ILeaveType extends Document {
  collegeId: Schema.Types.ObjectId;
  name: string; code: string; maxDaysPerYear: number; isCarryForward: boolean; maxCarryForward: number; applicableTo: string[];
  autoApproveEligible?: boolean; autoApproveMaxDays?: number; minDaysPerRequest?: number; maxConsecutiveDays?: number;
  requiresDocument?: boolean; documentAfterDays?: number; encashmentAllowed?: boolean; maxEncashmentDays?: number;
  halfDayAllowed?: boolean; approvalLevels?: number;
}

const schema = new Schema<ILeaveType>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  maxDaysPerYear: { type: Number, required: true },
  isCarryForward: { type: Boolean, default: false },
  maxCarryForward: { type: Number, default: 0 },
  applicableTo: [{ type: String, enum: ['teaching', 'non_teaching', 'contract', 'all'] }],
  autoApproveEligible: { type: Boolean, default: false },
  autoApproveMaxDays: { type: Number, default: 2 },
  minDaysPerRequest: { type: Number, default: 0.5 },
  maxConsecutiveDays: Number,
  requiresDocument: { type: Boolean, default: false },
  documentAfterDays: { type: Number, default: 3 },
  encashmentAllowed: { type: Boolean, default: false },
  maxEncashmentDays: Number,
  halfDayAllowed: { type: Boolean, default: true },
  approvalLevels: { type: Number, default: 1 },
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const LeaveType = model<ILeaveType>('LeaveType', schema);
