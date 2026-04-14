import { Schema, model, Document } from 'mongoose';
export interface IICCAnnualReport extends Document { collegeId: Schema.Types.ObjectId; year: number; totalComplaints: number; resolvedCount: number; pendingCount: number; averageResolutionDays: number; status: string; submittedTo?: string; submittedAt?: Date; regulatoryFilingId?: Schema.Types.ObjectId; }
const schema = new Schema<IICCAnnualReport>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  year: { type: Number, required: true },
  totalComplaints: { type: Number, required: true, default: 0 },
  resolvedCount: { type: Number, default: 0 },
  pendingCount: { type: Number, default: 0 },
  averageResolutionDays: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
  submittedTo: String,
  submittedAt: Date,
  regulatoryFilingId: Schema.Types.ObjectId,
}, { timestamps: true });
schema.index({ collegeId: 1, year: 1 }, { unique: true });
export const ICCAnnualReport = model<IICCAnnualReport>('ICCAnnualReport', schema);
