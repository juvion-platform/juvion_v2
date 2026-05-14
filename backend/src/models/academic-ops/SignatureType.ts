import { Schema, model, Document, Types } from 'mongoose';

/**
 * SignatureType + SignatureVersion — versioned signatures applied to
 * official documents (memos, certificates, hall tickets). Strategic
 * Gap 6 Phase A.
 *
 * Why versions: when a Principal/Controller changes, the institution
 * needs to keep historical certificates verifiable with the
 * signature that was valid at issue-time. A new SignatureVersion is
 * added when the holder changes; old certificates continue to render
 * with the version that was active for their `issuedAt` date.
 *
 * `role` is the slot (`principal`, `controller_of_examinations`,
 * `dean_academic`, etc.). `versions[*].academicYearStart/End` define
 * the validity window. At document-render time the caller picks the
 * version whose window contains the issue date.
 *
 * `imageUrl` points to S3 — actual signature image is stored there,
 * not in Mongo.
 */
export interface ISignatureVersion {
  versionNumber: number;
  holderName: string;
  holderDesignation: string;
  imageUrl: string;
  /** Inclusive start of validity. */
  validFrom: Date;
  /** Inclusive end of validity; null = still active. */
  validUntil?: Date;
  status: 'active' | 'retired';
}

export interface ISignatureType extends Document {
  collegeId: Types.ObjectId;
  role: string;
  /** Display label (e.g. "Principal", "Controller of Examinations"). */
  label: string;
  versions: ISignatureVersion[];
}

const versionSchema = new Schema<ISignatureVersion>(
  {
    versionNumber: { type: Number, required: true },
    holderName: { type: String, required: true, trim: true },
    holderDesignation: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date },
    status: { type: String, enum: ['active', 'retired'], default: 'active' },
  },
  { _id: false },
);

const schema = new Schema<ISignatureType>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    versions: { type: [versionSchema], default: [] },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, role: 1 }, { unique: true });

export const SignatureType = model<ISignatureType>('SignatureType', schema);
