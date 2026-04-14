import { Schema, model, Document } from 'mongoose';

export interface IAlumniCareer extends Document {
  collegeId: Schema.Types.ObjectId;
  alumniId: Schema.Types.ObjectId;
  companyName: string;
  jobTitle: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  packageLpa?: number;
  source: 'placement' | 'self_reported' | 'linkedin' | 'tracking_form';
  verifiedBy?: Schema.Types.ObjectId;
  verifiedAt?: Date;
}

const schema = new Schema<IAlumniCareer>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  alumniId: { type: Schema.Types.ObjectId, ref: 'Alumni', required: true },
  companyName: { type: String, required: true },
  jobTitle: { type: String, required: true },
  location: String,
  startDate: { type: Date, required: true },
  endDate: Date,
  isCurrent: { type: Boolean, default: false },
  packageLpa: Number,
  source: { type: String, enum: ['placement', 'self_reported', 'linkedin', 'tracking_form'], required: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  verifiedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, alumniId: 1 });

export const AlumniCareer = model<IAlumniCareer>('AlumniCareer', schema);
