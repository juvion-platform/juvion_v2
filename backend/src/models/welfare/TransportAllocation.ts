import { Schema, model, Document } from 'mongoose';
export interface ITransportAllocation extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; routeId: Schema.Types.ObjectId; stopName: string; academicYearId: Schema.Types.ObjectId; status: string; }
const schema = new Schema<ITransportAllocation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  routeId: { type: Schema.Types.ObjectId, ref: 'TransportRoute', required: true },
  stopName: { type: String, required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 });
export const TransportAllocation = model<ITransportAllocation>('TransportAllocation', schema);
