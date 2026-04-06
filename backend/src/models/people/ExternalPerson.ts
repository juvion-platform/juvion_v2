import { Schema, model, Document } from 'mongoose';

export interface IExternalPerson extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId; type: string; organizationId?: Schema.Types.ObjectId;
}

const schema = new Schema<IExternalPerson>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  type: { type: String, required: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
}, { timestamps: true });



export const ExternalPerson = model<IExternalPerson>('ExternalPerson', schema);
