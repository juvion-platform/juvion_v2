import { Schema, model, Document } from 'mongoose';

export interface ICurriculumMap extends Document {
  collegeId: Schema.Types.ObjectId;
  regulationId: Schema.Types.ObjectId; programmeId: Schema.Types.ObjectId; branchId: Schema.Types.ObjectId; semester: number; courseId: Schema.Types.ObjectId; isElective: boolean; electiveGroup?: string;
}

const schema = new Schema<ICurriculumMap>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  semester: { type: Number, required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  isElective: { type: Boolean, default: false },
  electiveGroup: String,
}, { timestamps: true });

schema.index({ collegeId: 1, regulationId: 1, branchId: 1, semester: 1 });

export const CurriculumMap = model<ICurriculumMap>('CurriculumMap', schema);
