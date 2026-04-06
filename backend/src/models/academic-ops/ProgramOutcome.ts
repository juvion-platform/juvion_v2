import { Schema, model, Document } from 'mongoose';

export interface IProgramOutcome extends Document {
  collegeId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId; code: string; description: string;
}

const schema = new Schema<IProgramOutcome>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  code: { type: String, required: true },
  description: { type: String, required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, programmeId: 1, code: 1 }, { unique: true });

export const ProgramOutcome = model<IProgramOutcome>('ProgramOutcome', schema);
