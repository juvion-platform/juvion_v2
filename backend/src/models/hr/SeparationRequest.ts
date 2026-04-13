import { Schema, model, Document } from 'mongoose';

export interface IApprovalStep {
  level: number;
  approverId: Schema.Types.ObjectId;
  status: string;
  decidedAt?: Date;
  remarks?: string;
}

export interface ISeparationRequest extends Document {
  collegeId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  separationType: 'resignation' | 'retirement' | 'termination' | 'death' | 'contract_end';
  requestedLastWorkingDay?: Date;
  confirmedLastWorkingDay?: Date;
  noticePeriodDays?: number;
  noticePeriodWaived?: boolean;
  waiverApprovedBy?: Schema.Types.ObjectId;
  reason: string;
  approvalChain?: IApprovalStep[];
  currentApproverLevel?: number;
  status: 'submitted' | 'accepted' | 'in_clearance' | 'settled' | 'completed' | 'rejected';
  relatedDisciplinaryCaseId?: Schema.Types.ObjectId;
  isRetirementProactive?: boolean;
}

const approvalStepSchema = new Schema(
  {
    level: { type: Number, required: true },
    approverId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    decidedAt: Date,
    remarks: String,
  },
  { _id: false },
);

const schema = new Schema<ISeparationRequest>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    separationType: {
      type: String,
      enum: ['resignation', 'retirement', 'termination', 'death', 'contract_end'],
      required: true,
    },
    requestedLastWorkingDay: Date,
    confirmedLastWorkingDay: Date,
    noticePeriodDays: Number,
    noticePeriodWaived: { type: Boolean, default: false },
    waiverApprovedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    reason: { type: String, required: true },
    approvalChain: [approvalStepSchema],
    currentApproverLevel: Number,
    status: {
      type: String,
      enum: ['submitted', 'accepted', 'in_clearance', 'settled', 'completed', 'rejected'],
      default: 'submitted',
    },
    relatedDisciplinaryCaseId: { type: Schema.Types.ObjectId },
    isRetirementProactive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, employeeId: 1 });
schema.index({ collegeId: 1, status: 1 });

export const SeparationRequest = model<ISeparationRequest>('SeparationRequest', schema);
