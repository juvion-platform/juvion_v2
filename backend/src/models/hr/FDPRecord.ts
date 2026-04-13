import { Schema, model, Document } from 'mongoose';

export interface IFDPRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  facultyId: Schema.Types.ObjectId;
  activityType: 'fdp' | 'workshop' | 'seminar' | 'conference' | 'certification';
  title: string;
  organiser: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  certificateUrl?: string;
  ocrExtractedData?: Record<string, unknown>;
  ocrConfidence?: number;
  isDuplicate?: boolean;
  verificationStatus: string;
  verifiedBy?: Schema.Types.ObjectId;
  verifiedAt?: Date;
  complianceYear: number;
}

const schema = new Schema<IFDPRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  activityType: { type: String, enum: ['fdp', 'workshop', 'seminar', 'conference', 'certification'], required: true },
  title: { type: String, required: true },
  organiser: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  hours: { type: Number, required: true },
  certificateUrl: String,
  ocrExtractedData: { type: Schema.Types.Mixed },
  ocrConfidence: Number,
  isDuplicate: { type: Boolean, default: false },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
  verifiedAt: Date,
  complianceYear: { type: Number, required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, facultyId: 1, complianceYear: 1 });
schema.index({ collegeId: 1, verificationStatus: 1 });

export const FDPRecord = model<IFDPRecord>('FDPRecord', schema);
