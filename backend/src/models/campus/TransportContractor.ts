import { Schema, model, Document } from 'mongoose';
export interface ITransportContractor extends Document { collegeId: Schema.Types.ObjectId; vendorId: Schema.Types.ObjectId; contractNumber: string; vehicleIds: Schema.Types.ObjectId[]; startDate: Date; endDate: Date; terms?: string; slaMetrics: { onTimeRate?: number; vehicleConditionScore?: number }; monthlyRate?: number; status: string; terminationReason?: string; }
const schema = new Schema<ITransportContractor>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  contractNumber: { type: String, required: true },
  vehicleIds: [{ type: Schema.Types.ObjectId, ref: 'Vehicle' }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  terms: String,
  slaMetrics: { onTimeRate: Number, vehicleConditionScore: Number, _id: false },
  monthlyRate: Number,
  status: { type: String, enum: ['draft', 'active', 'renewed', 'terminated'], default: 'draft' },
  terminationReason: String,
}, { timestamps: true });
schema.index({ collegeId: 1, contractNumber: 1 }, { unique: true });
export const TransportContractor = model<ITransportContractor>('TransportContractor', schema);
