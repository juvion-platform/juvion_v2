import { Schema, model, Document } from 'mongoose';
export interface ITransportAllocation extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; routeId: Schema.Types.ObjectId; stopName: string; academicYearId: Schema.Types.ObjectId; status: string; stopId?: Schema.Types.ObjectId; boardingPoint?: string; allocationType?: string; feeTriggered: boolean; }
const schema = new Schema<ITransportAllocation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  routeId: { type: Schema.Types.ObjectId, ref: 'TransportRoute', required: true },
  stopName: { type: String, required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  status: { type: String, enum: ['active', 'cancelled', 'exit_cleared'], default: 'active' },
  stopId: { type: Schema.Types.ObjectId, ref: 'RouteStop' },
  boardingPoint: String,
  allocationType: { type: String, enum: ['auto', 'student_selected'] },
  feeTriggered: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 });
export const TransportAllocation = model<ITransportAllocation>('TransportAllocation', schema);
