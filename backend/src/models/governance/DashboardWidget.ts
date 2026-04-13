import { Schema, model, Document } from 'mongoose';

export interface IDashboardWidget extends Document {
  collegeId: Schema.Types.ObjectId;
  widgetType: string;
  title: string;
  description?: string;
  dataSource: string;
  config: Record<string, any>;
  data?: Record<string, any>;
  lastRefreshedAt?: Date;
  refreshIntervalMinutes?: number;
  isActive: boolean;
  position?: number;
  createdBy: Schema.Types.ObjectId;
}

const schema = new Schema<IDashboardWidget>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  widgetType: { type: String, enum: ['academic_performance', 'attendance_analytics', 'exam_results', 'obe_summary', 'risk_overview', 'custom'], required: true },
  title: { type: String, required: true },
  description: String,
  dataSource: { type: String, required: true },
  config: { type: Schema.Types.Mixed, required: true },
  data: Schema.Types.Mixed,
  lastRefreshedAt: Date,
  refreshIntervalMinutes: Number,
  isActive: { type: Boolean, required: true, default: true },
  position: Number,
  createdBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, widgetType: 1 });

export const DashboardWidget = model<IDashboardWidget>('DashboardWidget', schema);
