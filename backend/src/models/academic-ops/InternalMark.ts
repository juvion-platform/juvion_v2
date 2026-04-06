import { Schema, model, Document } from 'mongoose';

export interface IInternalMark extends Document {
  collegeId: Schema.Types.ObjectId;
  assessmentId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; marksObtained: number; remarks?: string;
}

const schema = new Schema<IInternalMark>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'InternalAssessment', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  marksObtained: { type: Number, required: true },
  remarks: String,
}, { timestamps: true });

schema.index({ collegeId: 1, assessmentId: 1, studentId: 1 }, { unique: true });

export const InternalMark = model<IInternalMark>('InternalMark', schema);
