import { Schema, model, Document } from 'mongoose';

export interface IEscalationLog extends Document {
  collegeId: Schema.Types.ObjectId;
  clearanceItemId: Schema.Types.ObjectId;
  clearanceWorkflowId: Schema.Types.ObjectId;
  level: string;
  escalatedAt: Date;
  escalatedTo: Schema.Types.ObjectId;
  reason: string;
  slaPercentage: number;
  resolvedAt?: Date;
  resolvedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<IEscalationLog>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  clearanceItemId: { type: Schema.Types.ObjectId, ref: 'ClearanceItem', required: true },
  clearanceWorkflowId: { type: Schema.Types.ObjectId, ref: 'ClearanceWorkflow', required: true },
  level: {
    type: String,
    enum: ['reminder', 'hod', 'principal'],
    required: true,
  },
  escalatedAt: { type: Date, default: Date.now },
  escalatedTo: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  reason: { type: String, required: true },
  slaPercentage: { type: Number, required: true },
  resolvedAt: Date,
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, clearanceWorkflowId: 1 });
schema.index({ collegeId: 1, clearanceItemId: 1 });

export const EscalationLog = model<IEscalationLog>('EscalationLog', schema);
