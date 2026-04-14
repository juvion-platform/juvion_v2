import { Schema, model, Document } from 'mongoose';

export interface IExitDocumentSignature {
  role: string;
  signedBy: Schema.Types.ObjectId;
  signedAt: Date;
  signatureType: string;
}

export interface IExitDocument extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  alumniId?: Schema.Types.ObjectId;
  templateId?: Schema.Types.ObjectId;
  type: string;
  title: string;
  serialNumber?: string;
  fileUrl?: string;
  status: string;
  generatedAt: Date;
  signedAt?: Date;
  issuedAt?: Date;
  revokedAt?: Date;
  revokedReason?: string;
  signatures: IExitDocumentSignature[];
  digiLockerStatus: string;
  digiLockerPushedAt?: Date;
  digiLockerDocumentId?: string;
  isSealed: boolean;
  exitRequestId?: Schema.Types.ObjectId;
  metadata?: Record<string, any>;
}

const signatureSchema = new Schema({
  role: { type: String, required: true },
  signedBy: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  signedAt: { type: Date, required: true },
  signatureType: { type: String, required: true },
}, { _id: false });

const schema = new Schema<IExitDocument>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  alumniId: { type: Schema.Types.ObjectId },
  templateId: { type: Schema.Types.ObjectId, ref: 'DocumentTemplate' },
  type: {
    type: String,
    enum: [
      'transcript', 'provisional_certificate', 'degree_certificate',
      'transfer_certificate', 'migration_certificate', 'no_dues_certificate',
      'character_certificate', 'bonafide', 'study_certificate',
    ],
    required: true,
  },
  title: { type: String, required: true },
  serialNumber: String,
  fileUrl: String,
  status: {
    type: String,
    enum: ['draft', 'pending_signature', 'signed', 'issued', 'revoked'],
    default: 'draft',
  },
  generatedAt: { type: Date, default: Date.now },
  signedAt: Date,
  issuedAt: Date,
  revokedAt: Date,
  revokedReason: String,
  signatures: [signatureSchema],
  digiLockerStatus: {
    type: String,
    enum: ['not_pushed', 'pushed', 'push_failed', 'revoked'],
    default: 'not_pushed',
  },
  digiLockerPushedAt: Date,
  digiLockerDocumentId: String,
  isSealed: { type: Boolean, default: false },
  exitRequestId: { type: Schema.Types.ObjectId, ref: 'ExitRequest' },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1 });
schema.index({ collegeId: 1, type: 1, status: 1 });

export const ExitDocument = model<IExitDocument>('ExitDocument', schema);
