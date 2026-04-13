import { Schema, model, Document } from 'mongoose';
export interface IMessVendorContract extends Document { collegeId: Schema.Types.ObjectId; vendorId: Schema.Types.ObjectId; messFacilityId: Schema.Types.ObjectId; startDate: Date; endDate: Date; terms?: string; slaMetrics: { minHygieneScore?: number; minFoodQualityScore?: number; maxComplaints?: number }; costPerMeal: number; monthlyFixedCost?: number; status: string; terminationReason?: string; }
const schema = new Schema<IMessVendorContract>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  messFacilityId: { type: Schema.Types.ObjectId, ref: 'MessFacility', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  terms: String,
  slaMetrics: { minHygieneScore: Number, minFoodQualityScore: Number, maxComplaints: Number, _id: false },
  costPerMeal: { type: Number, required: true },
  monthlyFixedCost: Number,
  status: { type: String, enum: ['draft', 'active', 'renewed', 'terminated'], default: 'draft' },
  terminationReason: String,
}, { timestamps: true });
schema.index({ collegeId: 1, messFacilityId: 1 });
export const MessVendorContract = model<IMessVendorContract>('MessVendorContract', schema);
