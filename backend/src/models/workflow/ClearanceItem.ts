import { Schema, model, Document } from 'mongoose';

export interface IClearanceItem extends Document {
  collegeId: Schema.Types.ObjectId;
  clearanceWorkflowId: Schema.Types.ObjectId;
  department: string;
  assigneeRole: string;
  assigneeId?: Schema.Types.ObjectId;
  status: string;
  isApplicable: boolean;
  slaHours: number;
  slaDeadline: Date;
  completedAt?: Date;
  completedBy?: Schema.Types.ObjectId;
  waiverReason?: string;
  waiverApprovedBy?: Schema.Types.ObjectId;
  notes?: string;
  metadata?: Record<string, any>;
}

const schema = new Schema<IClearanceItem>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  clearanceWorkflowId: { type: Schema.Types.ObjectId, ref: 'ClearanceWorkflow', required: true },
  department: {
    type: String,
    enum: ['finance', 'hostel', 'transport', 'library', 'lab', 'academic', 'it_platform'],
    required: true,
  },
  assigneeRole: { type: String, required: true },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'Person' },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'waived', 'blocked'],
    default: 'pending',
  },
  isApplicable: { type: Boolean, default: true },
  slaHours: { type: Number, required: true },
  slaDeadline: { type: Date, required: true },
  completedAt: Date,
  completedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  waiverReason: String,
  waiverApprovedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  notes: String,
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

schema.index({ collegeId: 1, clearanceWorkflowId: 1 });
schema.index({ collegeId: 1, department: 1, status: 1 });

export const ClearanceItem = model<IClearanceItem>('ClearanceItem', schema);
