import { Schema, model, Document } from 'mongoose';

export interface IAdmissionOffer extends Document {
  collegeId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  branchId: Schema.Types.ObjectId;
  feeQuoted: number;
  validityDate: Date;
  status: string;
  // W01 enhancements
  allotmentRoundId?: Schema.Types.ObjectId;
  allotmentResultId?: Schema.Types.ObjectId;
  negotiatedFee?: number;
  waiverAmount?: number;
  waiverApprovedBy?: string;
  negotiationId?: Schema.Types.ObjectId;
  offerLetterUrl?: string;
  acceptedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
  remindersSent?: number;
  lastReminderAt?: Date;
}

const schema = new Schema<IAdmissionOffer>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  feeQuoted: { type: Number, required: true },
  validityDate: { type: Date, required: true },
  status: { type: String, enum: ['offered', 'accepted', 'declined', 'lapsed'], default: 'offered' },
  // W01 enhancements
  allotmentRoundId: { type: Schema.Types.ObjectId, ref: 'AllotmentRound' },
  allotmentResultId: { type: Schema.Types.ObjectId, ref: 'AllotmentResult' },
  negotiatedFee: Number,
  waiverAmount: { type: Number, default: 0 },
  waiverApprovedBy: String,
  negotiationId: { type: Schema.Types.ObjectId, ref: 'FeeNegotiation' },
  offerLetterUrl: String,
  acceptedAt: Date,
  declinedAt: Date,
  declineReason: String,
  remindersSent: { type: Number, default: 0 },
  lastReminderAt: Date,
}, { timestamps: true });



export const AdmissionOffer = model<IAdmissionOffer>('AdmissionOffer', schema);
