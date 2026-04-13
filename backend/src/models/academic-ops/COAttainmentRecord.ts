import { Schema, model, Document } from 'mongoose';

export interface ICOAttainmentRecord extends Document {
  collegeId: Schema.Types.ObjectId;
  courseOfferingId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  coCode: string;
  directAttainment: number;
  indirectAttainment: number;
  overallAttainment: number;
  attainmentLevel: number;
  threshold: number;
  studentsAboveThreshold: number;
  totalStudents: number;
}

const schema = new Schema<ICOAttainmentRecord>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  coCode: { type: String, required: true },
  directAttainment: { type: Number, required: true },
  indirectAttainment: { type: Number, required: true },
  overallAttainment: { type: Number, required: true },
  attainmentLevel: { type: Number, required: true },
  threshold: { type: Number, required: true },
  studentsAboveThreshold: { type: Number, required: true },
  totalStudents: { type: Number, required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, courseOfferingId: 1, coCode: 1 }, { unique: true });

export const COAttainmentRecord = model<ICOAttainmentRecord>('COAttainmentRecord', schema);
