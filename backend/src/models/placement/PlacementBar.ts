import { Schema, model, Document } from 'mongoose';

export interface IPlacementBar extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; reason: string; barType: string; status: string; appliedBy: Schema.Types.ObjectId; appliedAt: Date; liftedBy?: Schema.Types.ObjectId; liftedAt?: Date; liftConditions?: string;
}

const schema = new Schema<IPlacementBar>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  reason: { type: String, required: true },
  barType: { type: String, enum: ['disciplinary', 'academic_fraud', 'fee_default', 'other'], required: true },
  status: { type: String, enum: ['active', 'lifted'], default: 'active' },
  appliedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  appliedAt: { type: Date, default: Date.now },
  liftedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  liftedAt: Date,
  liftConditions: String,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, status: 1 });

export const PlacementBar = model<IPlacementBar>('PlacementBar', schema);
