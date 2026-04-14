import { Schema, model, Document } from 'mongoose';

export interface IClearanceWorkflow extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  exitType: string;
  urgency: string;
  status: string;
  initiatedBy: Schema.Types.ObjectId;
  initiatedAt: Date;
  completedAt?: Date;
  totalItems: number;
  completedItems: number;
  metadata?: Record<string, any>;
}

const schema = new Schema<IClearanceWorkflow>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  exitType: {
    type: String,
    enum: ['graduation', 'withdrawal', 'expulsion', 'dropout', 'transfer'],
    required: true,
  },
  urgency: {
    type: String,
    enum: ['standard', 'urgent'],
    default: 'standard',
  },
  status: {
    type: String,
    enum: ['initiated', 'in_progress', 'completed', 'completed_with_exceptions', 'cancelled'],
    default: 'initiated',
  },
  initiatedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  initiatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  totalItems: { type: Number, default: 0 },
  completedItems: { type: Number, default: 0 },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });
schema.index({ collegeId: 1, status: 1 });

export const ClearanceWorkflow = model<IClearanceWorkflow>('ClearanceWorkflow', schema);
