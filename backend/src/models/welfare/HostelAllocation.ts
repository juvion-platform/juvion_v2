import { Schema, model, Document } from 'mongoose';

/**
 * HostelAllocation — tracks the lifecycle of a student's hostel assignment.
 *
 * The lifecycle is proposal-driven: a warden/admin creates a `proposed`
 * allocation; the student accepts (→ `active`) or declines (→ `declined`).
 * See spec §6 (optional-hostel-transport-allotment) for the full state machine.
 *
 * Legacy statuses (`active`, `vacated`, `transferred`) are retained for
 * backwards compatibility with records created before the propose→accept flow.
 */
export interface IHostelAllocation extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  roomId: Schema.Types.ObjectId;
  bedId?: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId;
  allocatedDate: Date;
  vacatedDate?: Date;
  status: string;
  allocationType: string;
  matchScore?: number;
  preferences: {
    blockPreference?: string;
    floorPreference?: number;
    roomTypePreference?: string;
    roommatePreference?: Schema.Types.ObjectId;
  };
  specialNeeds: { accessibility?: boolean; medical?: string };
  allocationMethod?: string;
  waitlistPosition?: number;

  // ── Propose/accept lifecycle metadata (optional-allotment feature) ──
  proposedBy?: Schema.Types.ObjectId;
  proposedAt?: Date;
  respondedAt?: Date;
  respondedBy?: Schema.Types.ObjectId;
  ttlDays?: number;
  expiresAt?: Date;
  withdrawReason?: string;
  declineReason?: string;
  vacateRequestedAt?: Date;
  vacateApprovedBy?: Schema.Types.ObjectId;

  // ── Clearance-at-vacate fields (populated on vacate approval) ──
  clearanceStatus?: string;
  clearanceNotes?: string;
  damageCharges?: number;
  depositRefund?: number;
}

const schema = new Schema<IHostelAllocation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'HostelRoom', required: true },
  bedId: { type: Schema.Types.ObjectId, ref: 'Bed' },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  allocatedDate: { type: Date, default: Date.now },
  vacatedDate: Date,
  status: {
    type: String,
    enum: [
      'proposed',
      'waitlisted',
      'active',
      'vacate_requested',
      'vacated',
      'cancelled',
      'declined',
      'withdrawn',
      'expired',
      'transferred',
    ],
    default: 'proposed',
  },
  allocationType: { type: String, enum: ['new_intake', 'mid_year', 'change'], default: 'new_intake' },
  matchScore: { type: Number, min: 0, max: 100 },
  preferences: {
    blockPreference: String,
    floorPreference: Number,
    roomTypePreference: String,
    roommatePreference: { type: Schema.Types.ObjectId },
    _id: false,
  },
  specialNeeds: { accessibility: Boolean, medical: String, _id: false },
  allocationMethod: {
    type: String,
    enum: ['ai_recommended', 'manual_override', 'waitlist', 'admin_proposed'],
  },
  waitlistPosition: Number,

  // ── Propose/accept lifecycle metadata ──
  proposedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  proposedAt: { type: Date, default: Date.now },
  respondedAt: Date,
  respondedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  ttlDays: Number,
  expiresAt: Date,
  withdrawReason: String,
  declineReason: String,
  vacateRequestedAt: Date,
  vacateApprovedBy: { type: Schema.Types.ObjectId, ref: 'Person' },

  // ── Clearance-at-vacate fields ──
  clearanceStatus: { type: String, enum: ['pending', 'cleared', 'waived'] },
  clearanceNotes: String,
  damageCharges: Number,
  depositRefund: Number,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 });
// Compound index used by the proposal-expiry worker to scan efficiently.
schema.index({ collegeId: 1, status: 1, expiresAt: 1 });

export const HostelAllocation = model<IHostelAllocation>('HostelAllocation', schema);
