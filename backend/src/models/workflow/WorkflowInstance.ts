import { Schema, model, Document } from 'mongoose';

export interface IWorkflowHistoryEntry {
  step: string;
  status: string;
  at: Date;
  by: string;
  notes?: string;
}

export interface IWorkflowInstance extends Document {
  collegeId: Schema.Types.ObjectId;
  workflowId: string;            // e.g. 'W01'
  workflowVersion: number;
  entityType: string;            // 'Applicant', 'Employee', etc.
  entityId: Schema.Types.ObjectId;
  academicYearId?: Schema.Types.ObjectId;
  currentPhase: string;
  currentStep: string;
  status: string;                // 'active' | 'completed' | 'cancelled' | 'suspended' | 'failed'
  initiatedBy: string;
  completedAt?: Date;
  metadata: Record<string, any>;
  history: IWorkflowHistoryEntry[];
}

const historyEntrySchema = new Schema({
  step: { type: String, required: true },
  status: { type: String, required: true },
  at: { type: Date, required: true },
  by: { type: String, required: true },
  notes: String,
}, { _id: false });

const schema = new Schema<IWorkflowInstance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  workflowId: { type: String, required: true, index: true },
  workflowVersion: { type: Number, required: true },
  entityType: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear' },
  currentPhase: { type: String, required: true },
  currentStep: { type: String, required: true },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'suspended', 'failed'],
    default: 'active',
    index: true,
  },
  initiatedBy: { type: String, required: true },
  completedAt: Date,
  metadata: { type: Schema.Types.Mixed, default: {} },
  history: [historyEntrySchema],
}, { timestamps: true });

schema.index({ collegeId: 1, workflowId: 1, status: 1 });
schema.index({ collegeId: 1, entityType: 1, entityId: 1 });
schema.index({ collegeId: 1, status: 1, createdAt: -1 });

export const WorkflowInstance = model<IWorkflowInstance>('WorkflowInstance', schema);
