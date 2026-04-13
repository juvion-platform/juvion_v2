import { Schema, model, Document } from 'mongoose';

export interface IFDPComplianceSummary extends Document {
  collegeId: Schema.Types.ObjectId;
  facultyId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  cadre: 'assistant_professor' | 'associate_professor' | 'professor';
  requiredHours: number;
  completedHours: number;
  gap: number;
  complianceStatus: string;
  lastComputedAt: Date;
}

const schema = new Schema<IFDPComplianceSummary>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  cadre: { type: String, enum: ['assistant_professor', 'associate_professor', 'professor'], required: true },
  requiredHours: { type: Number, required: true },
  completedHours: { type: Number, required: true },
  gap: { type: Number, required: true },
  complianceStatus: { type: String, enum: ['compliant', 'partial', 'non_compliant'], required: true },
  lastComputedAt: { type: Date, required: true },
}, { timestamps: true });

schema.index({ collegeId: 1, facultyId: 1, academicYearId: 1 }, { unique: true });

export const FDPComplianceSummary = model<IFDPComplianceSummary>('FDPComplianceSummary', schema);
