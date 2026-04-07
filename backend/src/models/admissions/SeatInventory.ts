import { Schema, model, Document } from 'mongoose';

export interface ISeatInventory extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  programmeId: Schema.Types.ObjectId;
  branchId: Schema.Types.ObjectId;
  // Sanctioned intake (AICTE approved)
  sanctionedIntake: number;
  // Quota-wise split
  convenerSeats: number;
  managementSeats: number;
  nriSeats: number;
  spotSeats: number;
  lateralEntrySeats: number;
  // Filled counts (auto-updated via events)
  convenerFilled: number;
  managementFilled: number;
  nriFilled: number;
  spotFilled: number;
  lateralFilled: number;
  // Computed
  totalFilled: number;
  totalVacant: number;
  fillPercentage: number;
  // Status
  status: string;  // 'draft' | 'published' | 'frozen'
  lastUpdatedBy: string;
}

const schema = new Schema<ISeatInventory>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  // Sanctioned
  sanctionedIntake: { type: Number, required: true, min: 0 },
  // Quota-wise
  convenerSeats: { type: Number, default: 0, min: 0 },
  managementSeats: { type: Number, default: 0, min: 0 },
  nriSeats: { type: Number, default: 0, min: 0 },
  spotSeats: { type: Number, default: 0, min: 0 },
  lateralEntrySeats: { type: Number, default: 0, min: 0 },
  // Filled
  convenerFilled: { type: Number, default: 0, min: 0 },
  managementFilled: { type: Number, default: 0, min: 0 },
  nriFilled: { type: Number, default: 0, min: 0 },
  spotFilled: { type: Number, default: 0, min: 0 },
  lateralFilled: { type: Number, default: 0, min: 0 },
  // Computed
  totalFilled: { type: Number, default: 0 },
  totalVacant: { type: Number, default: 0 },
  fillPercentage: { type: Number, default: 0 },
  // Status
  status: { type: String, enum: ['draft', 'published', 'frozen'], default: 'draft' },
  lastUpdatedBy: { type: String, required: true },
}, { timestamps: true });

// Recalculate computed fields before save
schema.pre('save', function () {
  this.totalFilled = this.convenerFilled + this.managementFilled + this.nriFilled + this.spotFilled + this.lateralFilled;
  this.totalVacant = this.sanctionedIntake - this.totalFilled;
  this.fillPercentage = this.sanctionedIntake > 0 ? Math.round((this.totalFilled / this.sanctionedIntake) * 10000) / 100 : 0;
});

schema.index({ collegeId: 1, academicYearId: 1, programmeId: 1, branchId: 1 }, { unique: true });

export const SeatInventory = model<ISeatInventory>('SeatInventory', schema);
