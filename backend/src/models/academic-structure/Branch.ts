import { Schema, model, Document } from 'mongoose';

export interface IBranch extends Document {
  collegeId: Schema.Types.ObjectId;
  code: string; name: string; programmeId: Schema.Types.ObjectId; departmentId?: Schema.Types.ObjectId; intake: number; isActive: boolean;
}

const schema = new Schema<IBranch>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  intake: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Branch = model<IBranch>('Branch', schema);
