import { Schema, model, Document } from 'mongoose';

export interface IBatch extends Document {
  collegeId: Schema.Types.ObjectId;
  code: string; name: string; admissionYear: number; programmeId: Schema.Types.ObjectId; regulationId: Schema.Types.ObjectId; isActive: boolean;
}

const schema = new Schema<IBatch>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  admissionYear: { type: Number, required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Batch = model<IBatch>('Batch', schema);
