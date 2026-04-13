import { Schema, model, Document } from 'mongoose';

export interface IFinalSettlement extends Document {
  collegeId: Schema.Types.ObjectId;
  separationRequestId: Schema.Types.ObjectId;
  employeeId: Schema.Types.ObjectId;
  leaveEncashmentDays: number;
  leaveEncashmentAmount: number;
  pendingReimbursements: number;
  gratuityAmount: number;
  gratuityEligible: boolean;
  gratuityYearsOfService: number;
  grossSettlement: number;
  advanceDeductions: number;
  dueDeductions: number;
  netSettlement: number;
  computedAt: Date;
  status: 'computed' | 'approved' | 'processed' | 'disputed';
  approvedBy?: Schema.Types.ObjectId;
  processedAt?: Date;
  paymentInstructionId?: Schema.Types.ObjectId;
}

const schema = new Schema<IFinalSettlement>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    separationRequestId: { type: Schema.Types.ObjectId, ref: 'SeparationRequest', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveEncashmentDays: { type: Number, required: true },
    leaveEncashmentAmount: { type: Number, required: true },
    pendingReimbursements: { type: Number, default: 0 },
    gratuityAmount: { type: Number, required: true },
    gratuityEligible: { type: Boolean, required: true },
    gratuityYearsOfService: { type: Number, required: true },
    grossSettlement: { type: Number, required: true },
    advanceDeductions: { type: Number, default: 0 },
    dueDeductions: { type: Number, default: 0 },
    netSettlement: { type: Number, required: true },
    computedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['computed', 'approved', 'processed', 'disputed'],
      default: 'computed',
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    processedAt: Date,
    paymentInstructionId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, separationRequestId: 1 }, { unique: true });

export const FinalSettlement = model<IFinalSettlement>('FinalSettlement', schema);
