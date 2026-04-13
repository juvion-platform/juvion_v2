import { Schema, model, Document } from 'mongoose';

export interface ISection extends Document {
  collegeId: Schema.Types.ObjectId;
  name: string; branchId: Schema.Types.ObjectId; batchId: Schema.Types.ObjectId; year: number; semester: number; capacity: number; classAdvisorId?: Schema.Types.ObjectId;
  labBatchCount?: number;
  studentIds?: Schema.Types.ObjectId[];
}

const schema = new Schema<ISection>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
  year: { type: Number, required: true },
  semester: { type: Number, required: true },
  capacity: { type: Number, default: 60 },
  classAdvisorId: { type: Schema.Types.ObjectId, ref: 'Faculty' },
  labBatchCount: { type: Number, default: 0 },
  studentIds: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
}, { timestamps: true });

schema.index({ collegeId: 1, branchId: 1, batchId: 1, name: 1 }, { unique: true });

export const Section = model<ISection>('Section', schema);
