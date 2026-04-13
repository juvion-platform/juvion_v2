import { Schema, model, Document } from 'mongoose';

export interface ILabBatch extends Document {
  collegeId: Schema.Types.ObjectId;
  sectionId: Schema.Types.ObjectId;
  name: string;
  capacity: number;
  studentIds?: Schema.Types.ObjectId[];
  semesterId: Schema.Types.ObjectId;
}

const schema = new Schema<ILabBatch>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true },
  name: { type: String, required: true },
  capacity: { type: Number, default: 25 },
  studentIds: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, sectionId: 1, name: 1, semesterId: 1 }, { unique: true });

export const LabBatch = model<ILabBatch>('LabBatch', schema);
