import { Schema, model, Document } from 'mongoose';

export interface IExitRequest extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  exitType: string;
  reason: string;
  reasonCategory: string;
  reasonDetails?: string;
  requestedBy: Schema.Types.ObjectId;
  requestedAt: Date;
  parentConsentObtained: boolean;
  parentConsentDate?: Date;
  principalApproval?: {
    approved: boolean;
    approvedBy?: Schema.Types.ObjectId;
    approvedAt?: Date;
    notes?: string;
  };
  clearanceWorkflowId?: Schema.Types.ObjectId;
  status: string;
  completedAt?: Date;
  destinationInstitution?: string;
  destinationUniversity?: string;
  disciplinaryCaseId?: Schema.Types.ObjectId;
  outreachExhausted: boolean;
}

const schema = new Schema<IExitRequest>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  exitType: {
    type: String,
    enum: ['withdrawal', 'transfer', 'expulsion', 'dropout_formalization'],
    required: true,
  },
  reason: { type: String, required: true },
  reasonCategory: {
    type: String,
    enum: ['personal', 'financial', 'academic', 'transfer', 'family', 'health', 'disciplinary', 'other'],
    required: true,
  },
  reasonDetails: String,
  requestedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  requestedAt: { type: Date, default: Date.now },
  parentConsentObtained: { type: Boolean, default: false },
  parentConsentDate: Date,
  principalApproval: {
    approved: Boolean,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    approvedAt: Date,
    notes: String,
  },
  clearanceWorkflowId: { type: Schema.Types.ObjectId, ref: 'ClearanceWorkflow' },
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'clearance_in_progress', 'completed', 'rejected', 'cancelled'],
    default: 'submitted',
  },
  completedAt: Date,
  destinationInstitution: String,
  destinationUniversity: String,
  disciplinaryCaseId: { type: Schema.Types.ObjectId },
  outreachExhausted: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });
schema.index({ collegeId: 1, status: 1 });

export const ExitRequest = model<IExitRequest>('ExitRequest', schema);
