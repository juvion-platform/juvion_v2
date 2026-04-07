import { Schema, model, Document } from 'mongoose';

export interface IWaitlist extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  branchId: Schema.Types.ObjectId;
  allotmentRoundId?: Schema.Types.ObjectId;
  waitlistPosition: number;
  meritScore: number;
  quota: string;
  status: string;                // 'waiting' | 'promoted' | 'expired' | 'withdrawn'
  promotedAt?: Date;
  promotedToOfferId?: Schema.Types.ObjectId;
  expiresAt?: Date;
}

const schema = new Schema<IWaitlist>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  allotmentRoundId: { type: Schema.Types.ObjectId, ref: 'AllotmentRound' },
  waitlistPosition: { type: Number, required: true },
  meritScore: { type: Number, required: true },
  quota: { type: String, enum: ['convener', 'management', 'nri', 'spot'], required: true },
  status: {
    type: String,
    enum: ['waiting', 'promoted', 'expired', 'withdrawn'],
    default: 'waiting',
  },
  promotedAt: Date,
  promotedToOfferId: { type: Schema.Types.ObjectId, ref: 'AdmissionOffer' },
  expiresAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, programmeId: 1, branchId: 1, quota: 1, status: 1 });
schema.index({ collegeId: 1, applicantId: 1 });

export const Waitlist = model<IWaitlist>('Waitlist', schema);
