import { Schema, model, Document } from 'mongoose';

/**
 * Allowed mime types for student photos. Locked to the formats that
 * `sharp` can decode + re-encode losslessly enough for thumbnails.
 */
export const PERSON_PHOTO_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type PersonPhotoContentType = (typeof PERSON_PHOTO_CONTENT_TYPES)[number];

export interface IPersonPhoto {
  /** S3 key for the original upload, e.g. 'colleges/<cid>/students/<sid>/photo/original.jpg' */
  original: string;
  /** S3 key for the 200x200 cover thumbnail, always JPEG */
  thumb: string;
  contentType: PersonPhotoContentType;
  sizeBytes: number;
  uploadedAt: Date;
}

export const photoSchema = new Schema<IPersonPhoto>(
  {
    original: { type: String, required: true },
    thumb: { type: String, required: true },
    contentType: {
      type: String,
      enum: PERSON_PHOTO_CONTENT_TYPES,
      required: true,
    },
    sizeBytes: { type: Number, required: true, min: 0 },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false },
);

export interface IPerson extends Document {
  collegeId: Schema.Types.ObjectId;
  aadhaar?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  name: string;
  dob?: Date;
  gender?: string;
  preferredLanguage?: string;
  address?: any;
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  photo?: IPersonPhoto | null;
  biometricEnrolled?: boolean;
  // W01 intake enhancements
  nationality?: string;
  digilockerConsent?: boolean;
  digilockerLinked?: boolean;
}

const schema = new Schema<IPerson>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  aadhaar: { type: String, sparse: true },
  phone: { type: String, required: true },
  alternatePhone: String,
  email: String,
  name: { type: String, required: true },
  dob: Date,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  preferredLanguage: String,
  address: { line1: String, line2: String, city: String, state: String, pincode: String },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String,
  },
  // Photo upload is owned by `photo-service.ts` (POST /students/:id/photo).
  // The generic Person create/update body cannot write this field — it's
  // populated only by the dedicated upload endpoint after S3 + thumbnail
  // generation succeed.
  photo: { type: photoSchema, default: undefined },
  biometricEnrolled: { type: Boolean, default: false },
  // W01 intake enhancements
  nationality: String,
  digilockerConsent: { type: Boolean, default: false },
  digilockerLinked: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, aadhaar: 1 }, { unique: true, partialFilterExpression: { aadhaar: { $exists: true, $ne: null } } });
schema.index({ collegeId: 1, phone: 1 });
schema.index({ collegeId: 1, alternatePhone: 1 }, { sparse: true });
// Indexes supporting the global people-search service (regex substring
// queries on these three fields, scoped by collegeId). Regex queries only
// use an index when they're anchored at the start; for substring-match
// the index still prunes by collegeId and provides a good intersection.
schema.index({ collegeId: 1, name: 1 });
schema.index({ collegeId: 1, email: 1 });

export const Person = model<IPerson>('Person', schema);
