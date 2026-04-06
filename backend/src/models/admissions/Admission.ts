import { Schema, model, Document } from 'mongoose';

export interface IAdmission extends Document {
  collegeId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; admissionDate: Date; admittedBy: string; admissionType: string;
}

const schema = new Schema<IAdmission>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  admissionDate: { type: Date, required: true },
  admittedBy: { type: String, required: true },
  admissionType: { type: String, enum: ['fresh', 'lateral'], required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, applicantId: 1 }, { unique: true });

export const Admission = model<IAdmission>('Admission', schema);
