import { Schema, model, Document } from 'mongoose';

export interface IAllotmentResult extends Document {
  collegeId: Schema.Types.ObjectId;
  allotmentRoundId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId;
  meritRank: number;
  meritScore: number;
  // Allotment
  allottedProgrammeId?: Schema.Types.ObjectId;
  allottedBranchId?: Schema.Types.ObjectId;
  preferenceNumber?: number;       // which preference was allotted
  status: string;                  // 'allotted' | 'waitlisted' | 'not_eligible' | 'accepted' | 'declined' | 'lapsed'
  // Response
  acceptedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
}

const schema = new Schema<IAllotmentResult>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  allotmentRoundId: { type: Schema.Types.ObjectId, ref: 'AllotmentRound', required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  meritRank: { type: Number, required: true },
  meritScore: { type: Number, required: true },
  allottedProgrammeId: { type: Schema.Types.ObjectId, ref: 'Programme' },
  allottedBranchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  preferenceNumber: Number,
  status: {
    type: String,
    enum: ['allotted', 'waitlisted', 'not_eligible', 'accepted', 'declined', 'lapsed'],
    default: 'allotted',
  },
  acceptedAt: Date,
  declinedAt: Date,
  declineReason: String,
}, { timestamps: true });

schema.index({ collegeId: 1, allotmentRoundId: 1, applicantId: 1 }, { unique: true });
schema.index({ collegeId: 1, allotmentRoundId: 1, meritRank: 1 });

export const AllotmentResult = model<IAllotmentResult>('AllotmentResult', schema);
