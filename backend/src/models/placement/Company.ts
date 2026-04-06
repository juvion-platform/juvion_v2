import { Schema, model, Document } from 'mongoose';

export interface ICompany extends Document {
  collegeId: Schema.Types.ObjectId;
  name: string; industry: string; website?: string; contactPerson: string; contactEmail: string; contactPhone: string; tier: string; isActive: boolean;
}

const schema = new Schema<ICompany>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  industry: { type: String, required: true },
  website: String,
  contactPerson: { type: String, required: true },
  contactEmail: { type: String, required: true },
  contactPhone: String,
  tier: { type: String, enum: ['dream', 'super_dream', 'regular', 'mass'], default: 'regular' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, name: 1 });

export const Company = model<ICompany>('Company', schema);
