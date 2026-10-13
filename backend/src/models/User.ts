import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  collegeId?: mongoose.Types.ObjectId;
  email: string;
  password: string;
  name: string;
  role: string;
  personaType: string;
  /** 010 — every persona the user holds; `personaType` is the primary one. */
  personas: string[];
  personId?: mongoose.Types.ObjectId;
  /** The Juvi app's only login key. Globally unique; minted once, never re-minted. */
  juviId?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt?: Date;
  /** 010 — bumped on persona/role/deactivation changes; JWTs carry it as `tv`. */
  tokenVersion: number;
}

const userSchema = new Schema<IUser>(
  {
    collegeId: { type: Schema.Types.ObjectId, index: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true, enum: ['super_admin', 'admin', 'principal', 'hod', 'faculty', 'staff', 'student', 'parent'], default: 'admin' },
    personaType: { type: String, required: true, default: 'L-PRIN' },
    personas: { type: [String], default: [] },
    personId: { type: Schema.Types.ObjectId, ref: 'Person' },
    juviId: { type: String },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Unique email per college; superadmin (no collegeId) gets global uniqueness
userSchema.index(
  { collegeId: 1, email: 1 },
  { unique: true, partialFilterExpression: { collegeId: { $exists: true } } },
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { collegeId: { $exists: false } } },
);

// The Juvi ID is the one key that is unique across every college, so the index is
// global. Partial, so the Users that are not Juvi accounts — ERP admins, and
// super_admin, which carries no collegeId at all — stay out of it entirely.
userSchema.index(
  { juviId: 1 },
  { unique: true, partialFilterExpression: { juviId: { $type: 'string' } } },
);

export const User = mongoose.model<IUser>('User', userSchema);
