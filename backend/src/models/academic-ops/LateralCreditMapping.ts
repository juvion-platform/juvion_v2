import { Schema, model, Document } from 'mongoose';

export interface ILateralCreditMapping extends Document {
  collegeId: Schema.Types.ObjectId;
  regulationId: Schema.Types.ObjectId;
  diplomaProgramme: string;
  degreeProgrammeId: Schema.Types.ObjectId;
  mappings: Array<{
    diplomaSubject: string;
    degreeCourseId?: Schema.Types.ObjectId;
    credits: number;
    equivalence: string;
  }>;
  bridgeCourses: Array<{
    courseId: Schema.Types.ObjectId;
    reason: string;
  }>;
  totalCreditsGranted: number;
  isActive: boolean;
}

const schema = new Schema<ILateralCreditMapping>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation', required: true },
  diplomaProgramme: { type: String, required: true },
  degreeProgrammeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  mappings: [{
    diplomaSubject: { type: String, required: true },
    degreeCourseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    credits: { type: Number, required: true },
    equivalence: { type: String, enum: ['exact', 'partial', 'exemption'], required: true },
  }],
  bridgeCourses: [{
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    reason: { type: String, required: true },
  }],
  totalCreditsGranted: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, regulationId: 1, diplomaProgramme: 1 });

export const LateralCreditMapping = model<ILateralCreditMapping>('LateralCreditMapping', schema);
