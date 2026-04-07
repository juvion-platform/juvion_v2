import { Schema, model, Document } from 'mongoose';

export interface IWorkflowTask extends Document {
  collegeId: Schema.Types.ObjectId;
  workflowInstanceId: Schema.Types.ObjectId;
  workflowId: string;
  stepId: string;
  stepName: string;
  phase: string;
  type: string;                // 'manual' | 'automated' | 'approval' | 'parallel_group'
  assigneeRole?: string;
  assigneeId?: Schema.Types.ObjectId;
  aiAutonomy?: string;         // 'autonomous' | 'flags_for_review' | 'assists' | 'none'
  entityType: string;
  entityId: Schema.Types.ObjectId;
  status: string;              // 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'blocked'
  dueAt?: Date;
  completedAt?: Date;
  completedBy?: string;
  result?: Record<string, any>;
  notes?: string;
  metadata: Record<string, any>;
  createdBy: string;
}

const schema = new Schema<IWorkflowTask>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  workflowInstanceId: { type: Schema.Types.ObjectId, ref: 'WorkflowInstance', required: true, index: true },
  workflowId: { type: String, required: true },
  stepId: { type: String, required: true },
  stepName: { type: String, required: true },
  phase: { type: String, required: true },
  type: { type: String, enum: ['manual', 'automated', 'approval', 'parallel_group'], required: true },
  assigneeRole: String,
  assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
  aiAutonomy: { type: String, enum: ['autonomous', 'flags_for_review', 'assists', 'none'] },
  entityType: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped', 'blocked'],
    default: 'pending',
    index: true,
  },
  dueAt: Date,
  completedAt: Date,
  completedBy: String,
  result: { type: Schema.Types.Mixed },
  notes: String,
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: String, required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, workflowInstanceId: 1, status: 1 });
schema.index({ collegeId: 1, assigneeRole: 1, status: 1 });
schema.index({ collegeId: 1, entityType: 1, entityId: 1 });
schema.index({ dueAt: 1, status: 1 });

export const WorkflowTask = model<IWorkflowTask>('WorkflowTask', schema);
