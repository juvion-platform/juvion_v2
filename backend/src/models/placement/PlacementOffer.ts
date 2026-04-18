import { Schema, model, Document } from 'mongoose';

export interface IPlacementOffer extends Document {
  collegeId: Schema.Types.ObjectId;
  jobPostingId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; companyId: Schema.Types.ObjectId; packageLpa: number; offerDate: Date; joiningDate?: Date; offerLetterUrl?: string; status: string;
  source: string;
  driveId?: Schema.Types.ObjectId;
  role?: string;
  location?: string;
  bondTerms?: string;
  responseDeadline?: Date;
  dreamOverrideReason?: string;
  previousOfferId?: Schema.Types.ObjectId;
}

const schema = new Schema<IPlacementOffer>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  jobPostingId: { type: Schema.Types.ObjectId, ref: 'JobPosting', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  packageLpa: { type: Number, required: true },
  offerDate: { type: Date, required: true },
  joiningDate: Date,
  offerLetterUrl: String,
  status: { type: String, enum: ['extended', 'accepted', 'rejected', 'revoked', 'reneged', 'lapsed', 'released'], default: 'extended' },
  source: { type: String, enum: ['campus', 'off_campus', 'ppo'], default: 'campus' },
  driveId: { type: Schema.Types.ObjectId, ref: 'PlacementDrive' },
  role: String,
  location: String,
  bondTerms: String,
  responseDeadline: Date,
  dreamOverrideReason: String,
  previousOfferId: { type: Schema.Types.ObjectId, ref: 'PlacementOffer' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, companyId: 1 });

export const PlacementOffer = model<IPlacementOffer>('PlacementOffer', schema);
