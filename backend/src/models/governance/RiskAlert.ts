import { Schema, model, Document } from 'mongoose';

export interface IRiskAlert extends Document {
  collegeId: Schema.Types.ObjectId;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  affectedEntity: {
    type: string;
    id: Schema.Types.ObjectId;
    name: string;
  };
  metrics?: Record<string, any>;
  suggestedAction?: string;
  status: string;
  acknowledgedBy?: Schema.Types.ObjectId;
  resolvedAt?: Date;
}

const schema = new Schema<IRiskAlert>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  alertType: { type: String, enum: ['low_attendance', 'high_backlog_rate', 'low_pass_rate', 'low_co_attainment', 'syllabus_delay', 'faculty_shortage', 'custom'], required: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  affectedEntity: {
    type: { type: String, required: true },
    id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
  },
  metrics: Schema.Types.Mixed,
  suggestedAction: String,
  status: { type: String, enum: ['active', 'acknowledged', 'resolved', 'dismissed'], required: true, default: 'active' },
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  resolvedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, alertType: 1, status: 1 });
schema.index({ collegeId: 1, severity: 1 });

export const RiskAlert = model<IRiskAlert>('RiskAlert', schema);
