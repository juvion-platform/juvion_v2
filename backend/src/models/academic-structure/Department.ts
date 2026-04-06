import { Schema, model, Document } from 'mongoose';

export interface IDepartment extends Document {
  collegeId: Schema.Types.ObjectId;
  code: string; name: string; hodId?: Schema.Types.ObjectId; isActive: boolean;
}

const schema = new Schema<IDepartment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  hodId: { type: Schema.Types.ObjectId, ref: 'Faculty' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Department = model<IDepartment>('Department', schema);
