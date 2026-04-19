import { Schema, model, Document } from 'mongoose';

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
  photo?: string;
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
  photo: String,
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
