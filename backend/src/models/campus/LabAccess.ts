import { Schema, model, Document } from 'mongoose';

export interface ILabAccess extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  labId: Schema.Types.ObjectId;
  courseOfferingId?: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  batchGroup?: string;
  status: string;
  grantedAt: Date;
  revokedAt?: Date;
}

const schema = new Schema<ILabAccess>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  labId: { type: Schema.Types.ObjectId, ref: 'Lab', required: true },
  courseOfferingId: { type: Schema.Types.ObjectId, ref: 'CourseOffering' },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  batchGroup: String,
  status: { type: String, enum: ['active', 'revoked', 'completed'], default: 'active' },
  grantedAt: { type: Date, default: Date.now },
  revokedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, labId: 1 });
schema.index({ collegeId: 1, labId: 1, status: 1 });

export const LabAccess = model<ILabAccess>('LabAccess', schema);
