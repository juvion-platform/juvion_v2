import { Schema, model, Document } from 'mongoose';

export interface IPerson extends Document {
  collegeId: Schema.Types.ObjectId;
  aadhaar?: string; phone: string; email?: string; name: string; dob?: Date; gender?: string; address?: any; photo?: string; biometricEnrolled?: boolean;
}

const schema = new Schema<IPerson>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  aadhaar: { type: String, sparse: true },
  phone: { type: String, required: true },
  email: String,
  name: { type: String, required: true },
  dob: Date,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  address: { line1: String, line2: String, city: String, state: String, pincode: String },
  photo: String,
  biometricEnrolled: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, aadhaar: 1 }, { unique: true, partialFilterExpression: { aadhaar: { $exists: true, $ne: null } } });
schema.index({ collegeId: 1, phone: 1 });

export const Person = model<IPerson>('Person', schema);
