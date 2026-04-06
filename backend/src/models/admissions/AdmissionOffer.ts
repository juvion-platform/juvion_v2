import { Schema, model, Document } from 'mongoose';

export interface IAdmissionOffer extends Document {
  collegeId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId; programmeId: Schema.Types.ObjectId; branchId: Schema.Types.ObjectId; feeQuoted: number; validityDate: Date; status: string;
}

const schema = new Schema<IAdmissionOffer>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  feeQuoted: { type: Number, required: true },
  validityDate: { type: Date, required: true },
  status: { type: String, enum: ['offered', 'accepted', 'declined', 'lapsed'], default: 'offered' },
}, { timestamps: true });



export const AdmissionOffer = model<IAdmissionOffer>('AdmissionOffer', schema);
