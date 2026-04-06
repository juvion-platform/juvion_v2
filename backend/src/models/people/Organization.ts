import { Schema, model, Document } from 'mongoose';

export interface IOrganization extends Document {
  collegeId: Schema.Types.ObjectId;
  name: string; type: string; address?: string; contact?: string;
}

const schema = new Schema<IOrganization>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  address: String,
  contact: String,
}, { timestamps: true });



export const Organization = model<IOrganization>('Organization', schema);
