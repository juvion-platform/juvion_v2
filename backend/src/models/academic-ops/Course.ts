import { Schema, model, Document } from 'mongoose';

export interface ICourse extends Document {
  collegeId: Schema.Types.ObjectId;
  code: string; name: string; regulationId: Schema.Types.ObjectId; departmentId: Schema.Types.ObjectId; credits: number; lectureHrs: number; tutorialHrs: number; practicalHrs: number; type: string; isElective: boolean;
  prerequisites?: Schema.Types.ObjectId[];
}

const schema = new Schema<ICourse>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  credits: { type: Number, required: true },
  lectureHrs: { type: Number, default: 0 },
  tutorialHrs: { type: Number, default: 0 },
  practicalHrs: { type: Number, default: 0 },
  type: { type: String, enum: ['theory', 'lab', 'project', 'seminar', 'audit'], required: true },
  isElective: { type: Boolean, default: false },
  prerequisites: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
}, { timestamps: true });

schema.index({ collegeId: 1, code: 1, regulationId: 1 }, { unique: true });

export const Course = model<ICourse>('Course', schema);
