import { Schema, model, Document } from 'mongoose';
export interface IQualityInspection extends Document { collegeId: Schema.Types.ObjectId; messFacilityId: Schema.Types.ObjectId; inspectedBy: Schema.Types.ObjectId; date: Date; hygieneScore: number; foodQualityScore: number; complianceStatus: string; issues: { area: string; description: string; severity: string }[]; vendorContractId?: Schema.Types.ObjectId; remarks?: string; }
const schema = new Schema<IQualityInspection>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  messFacilityId: { type: Schema.Types.ObjectId, ref: 'MessFacility', required: true },
  inspectedBy: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: Date, required: true },
  hygieneScore: { type: Number, min: 0, max: 10, required: true },
  foodQualityScore: { type: Number, min: 0, max: 10, required: true },
  complianceStatus: { type: String, enum: ['compliant', 'minor_issues', 'major_issues', 'non_compliant'], required: true },
  issues: [{ area: String, description: String, severity: String, _id: false }],
  vendorContractId: { type: Schema.Types.ObjectId, ref: 'MessVendorContract' },
  remarks: String,
}, { timestamps: true });
schema.index({ collegeId: 1, messFacilityId: 1, date: -1 });
export const QualityInspection = model<IQualityInspection>('QualityInspection', schema);
