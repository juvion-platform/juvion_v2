import { Schema, model, Document } from 'mongoose';
export interface IHostelAllocation extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; roomId: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; allocatedDate: Date; vacatedDate?: Date; status: string; }
const schema = new Schema<IHostelAllocation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'HostelRoom', required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  allocatedDate: { type: Date, default: Date.now },
  vacatedDate: Date,
  status: { type: String, enum: ['active', 'vacated', 'transferred'], default: 'active' },
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 });
export const HostelAllocation = model<IHostelAllocation>('HostelAllocation', schema);
