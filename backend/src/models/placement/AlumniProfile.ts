import { Schema, model, Document } from 'mongoose';

export interface IAlumniProfile extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId; graduationYear: number; currentCompany?: string; currentDesignation?: string; location?: string; linkedinUrl?: string; willingToMentor: boolean;
}

const schema = new Schema<IAlumniProfile>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  graduationYear: { type: Number, required: true },
  currentCompany: String,
  currentDesignation: String,
  location: String,
  linkedinUrl: String,
  willingToMentor: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, personId: 1 }, { unique: true });

export const AlumniProfile = model<IAlumniProfile>('AlumniProfile', schema);
