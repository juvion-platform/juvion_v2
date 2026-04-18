import { Schema, model, Document } from 'mongoose';

export interface IOptOutRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId; placementSeasonId: Schema.Types.ObjectId; reason: string; reasonDetail?: string; evidenceUrl?: string; status: string; recordedBy: Schema.Types.ObjectId; recordedAt: Date; voidedAt?: Date; voidReason?: string;
}

const schema = new Schema<IOptOutRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  placementSeasonId: { type: Schema.Types.ObjectId, ref: 'PlacementSeason', required: true },
  reason: { type: String, enum: ['higher_education', 'entrepreneurship', 'family_business', 'personal', 'other'], required: true },
  reasonDetail: String,
  evidenceUrl: String,
  status: { type: String, enum: ['active', 'voided'], default: 'active' },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  recordedAt: { type: Date, default: Date.now },
  voidedAt: Date,
  voidReason: String,
}, { timestamps: true });

schema.index({ collegeId: 1, placementSeasonId: 1, studentId: 1 }, { unique: true });

export const OptOutRecord = model<IOptOutRecord>('OptOutRecord', schema);
