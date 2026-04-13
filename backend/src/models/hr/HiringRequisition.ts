import { Schema, model, Document } from 'mongoose';

export interface IApprovalStep {
  level: number;
  approverId: string;
  status: string;
  decidedAt?: Date;
  remarks?: string;
}

export interface IHiringRequisition extends Document {
  collegeId: Schema.Types.ObjectId;
  departmentId: Schema.Types.ObjectId;
  positionType: 'faculty' | 'staff';
  designation: string;
  justification: string;
  justificationType: 'new' | 'replacement';
  vacatedBy?: Schema.Types.ObjectId;
  headcountAtRequest: number;
  withinSanctionedStrength: boolean;
  approvalChain: IApprovalStep[];
  currentApproverLevel: number;
  status: 'draft' | 'submitted' | 'validated' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
}

const approvalStepSchema = new Schema({
  level: { type: Number, required: true },
  approverId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  decidedAt: Date,
  remarks: String,
}, { _id: false });

const schema = new Schema<IHiringRequisition>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  positionType: { type: String, enum: ['faculty', 'staff'], required: true },
  designation: { type: String, required: true },
  justification: { type: String, required: true },
  justificationType: { type: String, enum: ['new', 'replacement'], required: true },
  vacatedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
  headcountAtRequest: { type: Number, required: true },
  withinSanctionedStrength: { type: Boolean, default: false },
  approvalChain: [approvalStepSchema],
  currentApproverLevel: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'submitted', 'validated', 'approved', 'rejected', 'cancelled'], default: 'draft' },
  approvedBy: { type: Schema.Types.ObjectId },
  approvedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, departmentId: 1 });

export const HiringRequisition = model<IHiringRequisition>('HiringRequisition', schema);
