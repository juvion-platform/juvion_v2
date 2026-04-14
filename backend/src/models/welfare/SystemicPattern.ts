import { Schema, model, Document } from 'mongoose';
export interface ISystemicPattern extends Document { collegeId: Schema.Types.ObjectId; detectedAt: Date; category: string; pattern: string; grievanceIds: Schema.Types.ObjectId[]; frequency: number; severity: string; status: string; reviewedBy?: Schema.Types.ObjectId; governanceAlertId?: Schema.Types.ObjectId; }
const schema = new Schema<ISystemicPattern>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  detectedAt: { type: Date, required: true, default: Date.now },
  category: { type: String, required: true },
  pattern: { type: String, required: true },
  grievanceIds: [{ type: Schema.Types.ObjectId, ref: 'StudentGrievance' }],
  frequency: { type: Number, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
  status: { type: String, enum: ['detected', 'reviewed', 'actioned', 'dismissed'], default: 'detected' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  governanceAlertId: Schema.Types.ObjectId,
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1 });
export const SystemicPattern = model<ISystemicPattern>('SystemicPattern', schema);
