import { Schema, model, Document } from 'mongoose';

export interface ITranscript extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  transcriptType: string;
  semesterId?: Schema.Types.ObjectId;
  title: string;
  data: Record<string, any>;
  fileUrl?: string;
  generatedAt: Date;
  generatedBy: Schema.Types.ObjectId;
  status: string;
  issuedAt?: Date;
  digiLockerRef?: string;
}

const schema = new Schema<ITranscript>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  transcriptType: { type: String, enum: ['semester', 'consolidated', 'provisional'], required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester' },
  title: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  fileUrl: String,
  generatedAt: { type: Date, required: true, default: Date.now },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  status: { type: String, enum: ['draft', 'generated', 'issued', 'revoked'], required: true, default: 'draft' },
  issuedAt: Date,
  digiLockerRef: String,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, transcriptType: 1 });

export const Transcript = model<ITranscript>('Transcript', schema);
