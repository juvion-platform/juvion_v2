import { Schema, model, Document } from 'mongoose';

export interface IParent extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId;
  relationship: string;
  linkedStudents: Schema.Types.ObjectId[];
  primaryContact: boolean;
  occupation?: string;
  employer?: string;
  annualIncomeBand?: string;
  isFeeResponsible: boolean;
  communicationPreference?: string;
}

const schema = new Schema<IParent>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  relationship: { type: String, enum: ['father', 'mother', 'guardian'], required: true },
  linkedStudents: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  primaryContact: { type: Boolean, default: false },
  occupation: String,
  employer: String,
  annualIncomeBand: String,
  isFeeResponsible: { type: Boolean, default: false },
  communicationPreference: { type: String, enum: ['call', 'sms', 'whatsapp', 'email'] },
}, { timestamps: true });



export const Parent = model<IParent>('Parent', schema);
