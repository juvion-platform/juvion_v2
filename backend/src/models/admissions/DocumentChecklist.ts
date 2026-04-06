import { Schema, model, Document } from 'mongoose';

export interface IDocumentChecklist extends Document {
  collegeId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId; documents: any[]; status: string;
}

const schema = new Schema<IDocumentChecklist>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  documents: [{ name: String, type: String, required: Boolean, uploaded: Boolean, verified: Boolean, verifiedBy: String, verificationDate: Date }],
  status: { type: String, enum: ['pending', 'partial', 'complete', 'verified'], default: 'pending' },
}, { timestamps: true });



export const DocumentChecklist = model<IDocumentChecklist>('DocumentChecklist', schema);
