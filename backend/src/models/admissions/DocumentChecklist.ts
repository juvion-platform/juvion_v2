import { Schema, model, Document } from 'mongoose';

export interface IDocumentChecklist extends Document {
  collegeId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId;
  documents: any[];
  status: string;
  // W01 enhancements
  ocrJobId?: string;
  ocrStatus?: string;              // 'pending' | 'processing' | 'completed' | 'failed'
  ocrCompletedAt?: Date;
  deficiencyNotifiedAt?: Date;
  deficiencyDeadline?: Date;
  fraudFlagged?: boolean;
  fraudNotes?: string;
}

const schema = new Schema<IDocumentChecklist>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  documents: [{
    name: String,
    type: String,
    required: Boolean,
    uploaded: Boolean,
    verified: Boolean,
    verifiedBy: String,
    verificationDate: Date,
    // W01 AI fields
    fileUrl: String,
    ocrConfidence: Number,
    ocrExtractedData: { type: Schema.Types.Mixed },
    ocrStatus: { type: String, enum: ['pending', 'processing', 'verified', 'flagged', 'deficient'] },
  }],
  status: { type: String, enum: ['pending', 'partial', 'complete', 'verified'], default: 'pending' },
  // W01 enhancements
  ocrJobId: String,
  ocrStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'] },
  ocrCompletedAt: Date,
  deficiencyNotifiedAt: Date,
  deficiencyDeadline: Date,
  fraudFlagged: { type: Boolean, default: false },
  fraudNotes: String,
}, { timestamps: true });



export const DocumentChecklist = model<IDocumentChecklist>('DocumentChecklist', schema);
