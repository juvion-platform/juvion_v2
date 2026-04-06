import { Schema, model, Document } from 'mongoose';

export interface IGrievance extends Document {
  collegeId: Schema.Types.ObjectId;
  raisedBy: Schema.Types.ObjectId; category: string; subject: string; description: string; priority: string; assignedTo?: Schema.Types.ObjectId; status: string; resolution?: string; resolvedAt?: Date;
}

const schema = new Schema<IGrievance>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  raisedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  category: { type: String, enum: ['salary', 'workplace', 'harassment', 'facilities', 'policy', 'other'], required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Person' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed', 'escalated'], default: 'open' },
  resolution: String,
  resolvedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });

export const Grievance = model<IGrievance>('Grievance', schema);
