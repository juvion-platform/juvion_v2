import { Schema, model, Document } from 'mongoose';
export interface IHostelAllocation extends Document { collegeId: Schema.Types.ObjectId; studentId: Schema.Types.ObjectId; roomId: Schema.Types.ObjectId; bedId?: Schema.Types.ObjectId; academicYearId: Schema.Types.ObjectId; allocatedDate: Date; vacatedDate?: Date; status: string; allocationType: string; matchScore?: number; preferences: { blockPreference?: string; floorPreference?: number; roomTypePreference?: string; roommatePreference?: Schema.Types.ObjectId }; specialNeeds: { accessibility?: boolean; medical?: string }; allocationMethod?: string; waitlistPosition?: number; clearanceStatus?: string; clearanceNotes?: string; damageCharges?: number; depositRefund?: number; }
const schema = new Schema<IHostelAllocation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'HostelRoom', required: true },
  bedId: { type: Schema.Types.ObjectId, ref: 'Bed' },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  allocatedDate: { type: Date, default: Date.now },
  vacatedDate: Date,
  status: { type: String, enum: ['active', 'vacated', 'transferred'], default: 'active' },
  allocationType: { type: String, enum: ['new_intake', 'mid_year', 'change'], default: 'new_intake' },
  matchScore: { type: Number, min: 0, max: 100 },
  preferences: { blockPreference: String, floorPreference: Number, roomTypePreference: String, roommatePreference: { type: Schema.Types.ObjectId }, _id: false },
  specialNeeds: { accessibility: Boolean, medical: String, _id: false },
  allocationMethod: { type: String, enum: ['ai_recommended', 'manual_override', 'waitlist'] },
  waitlistPosition: Number,
  clearanceStatus: { type: String, enum: ['pending', 'cleared', 'waived'] },
  clearanceNotes: String,
  damageCharges: Number,
  depositRefund: Number,
}, { timestamps: true });
schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 });
export const HostelAllocation = model<IHostelAllocation>('HostelAllocation', schema);
