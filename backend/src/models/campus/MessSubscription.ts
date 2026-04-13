import { Schema, model, Document } from 'mongoose';
export interface IMessSubscription extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; messFacilityId: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; plan: string; startDate: Date; endDate?: Date; monthlyFee: number; status: string; }
const schema = new Schema<IMessSubscription>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  messFacilityId: { type: Schema.Types.ObjectId, ref: 'MessFacility', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  plan: { type: String, enum: ['full', 'partial'], default: 'full' },
  startDate: { type: Date, required: true },
  endDate: Date,
  monthlyFee: { type: Number, required: true },
  status: { type: String, enum: ['active', 'suspended', 'cancelled'], default: 'active' },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 });
export const MessSubscription = model<IMessSubscription>('MessSubscription', schema);
