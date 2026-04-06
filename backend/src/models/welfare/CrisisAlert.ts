import { Schema, model, Document } from 'mongoose';
export interface ICrisisAlert extends Document { collegeId: Schema.Types.ObjectId; reportedBy: Schema.Types.ObjectId; studentId?: Schema.Types.ObjectId; type: string; severity: string; description: string; status: string; assignedTo?: Schema.Types.ObjectId; resolution?: string; resolvedAt?: Date; }
const schema = new Schema<ICrisisAlert>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  type: { type: String, enum: ['mental_health', 'ragging', 'harassment', 'medical_emergency', 'substance_abuse', 'other'], required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['reported', 'acknowledged', 'in_progress', 'resolved', 'escalated'], default: 'reported' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Person' },
  resolution: String,
  resolvedAt: Date,
}, { timestamps: true });
schema.index({ collegeId: 1, status: 1, severity: 1 });
export const CrisisAlert = model<ICrisisAlert>('CrisisAlert', schema);
