import { Schema, model, Document } from 'mongoose';

export interface IOrganization extends Document {
  collegeId: Schema.Types.ObjectId;
  name: string;
  type: string;
  address?: string;
  contact?: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  partnershipType?: string;
  status?: string;
}

const schema = new Schema<IOrganization>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  address: String,
  contact: String,
  contactPersonName: String,
  contactPersonEmail: String,
  contactPersonPhone: String,
  partnershipType: String,
  status: { type: String, enum: ['prospect', 'active', 'inactive'], default: 'active' },
}, { timestamps: true });



export const Organization = model<IOrganization>('Organization', schema);
