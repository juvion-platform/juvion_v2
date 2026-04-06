import { Schema, model, Document } from 'mongoose';

export interface IParent extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId; relationship: string; linkedStudents: Schema.Types.ObjectId[]; primaryContact: boolean;
}

const schema = new Schema<IParent>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  relationship: { type: String, enum: ['father', 'mother', 'guardian'], required: true },
  linkedStudents: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  primaryContact: { type: Boolean, default: false },
}, { timestamps: true });



export const Parent = model<IParent>('Parent', schema);
