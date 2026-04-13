import { Schema, model, Document } from 'mongoose';

export interface IApprovalChainEntry {
  level: number; approverId: string; status: string; decidedAt?: Date; remarks?: string;
}

export interface ILeaveApplication extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId; leaveTypeId: Schema.Types.ObjectId; fromDate: Date; toDate: Date; days: number; reason: string; status: string; approvedBy?: Schema.Types.ObjectId; remarks?: string;
  approvalChain?: IApprovalChainEntry[]; currentApproverLevel?: number;
  examClashDetected?: boolean; examClashDetails?: string; substitutionTriggered?: boolean;
  isHalfDay?: boolean; documentUrl?: string; autoApproved?: boolean; withdrawnAt?: Date;
}

const schema = new Schema<ILeaveApplication>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  days: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['applied', 'pending', 'approved', 'rejected', 'cancelled', 'withdrawn'], default: 'applied' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  remarks: String,
  approvalChain: [new Schema({ level: Number, approverId: String, status: String, decidedAt: Date, remarks: String }, { _id: false })],
  currentApproverLevel: { type: Number, default: 1 },
  examClashDetected: { type: Boolean, default: false },
  examClashDetails: String,
  substitutionTriggered: { type: Boolean, default: false },
  isHalfDay: { type: Boolean, default: false },
  documentUrl: String,
  autoApproved: { type: Boolean, default: false },
  withdrawnAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1, status: 1 });

export const LeaveApplication = model<ILeaveApplication>('LeaveApplication', schema);
