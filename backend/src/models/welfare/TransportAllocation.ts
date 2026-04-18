import { Schema, model, Document, Types } from 'mongoose';

/**
 * TransportAllocation — tracks the lifecycle of a student's transport assignment.
 *
 * Like HostelAllocation, this is proposal-driven: a transport officer proposes
 * a route/stop assignment; the student accepts (→ `active`) or declines.
 * See spec §6 for the full state machine.
 *
 * Terminal vacate state is `cancelled` (not `vacated`) — preserves existing
 * semantic where transport is cancelled, not "vacated" like a room.
 *
 * Interface typing: fields use `Types.ObjectId` (the runtime class) for TS
 * alignment — see HostelAllocation.ts for the rationale.
 */
export interface ITransportAllocation extends Document {
  collegeId: Types.ObjectId;
  studentId: Types.ObjectId;
  routeId: Types.ObjectId;
  stopName: string;
  academicYearId: Types.ObjectId;
  status: string;
  stopId?: Types.ObjectId;
  boardingPoint?: string;
  allocationType?: string;
  feeTriggered: boolean;

  // Propose/accept lifecycle metadata (optional-allotment feature)
  proposedBy?: Types.ObjectId;
  proposedAt?: Date;
  respondedAt?: Date;
  respondedBy?: Types.ObjectId;
  ttlDays?: number;
  expiresAt?: Date;
  withdrawReason?: string;
  declineReason?: string;
  vacateRequestedAt?: Date;
  vacateApprovedBy?: Types.ObjectId;
  waitlistPosition?: number;
}

const schema = new Schema<ITransportAllocation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  routeId: { type: Schema.Types.ObjectId, ref: 'TransportRoute', required: true },
  stopName: { type: String, required: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  status: {
    type: String,
    enum: [
      'proposed',
      'waitlisted',
      'active',
      'vacate_requested',
      'cancelled',
      'declined',
      'withdrawn',
      'expired',
    ],
    default: 'proposed',
  },
  stopId: { type: Schema.Types.ObjectId, ref: 'RouteStop' },
  boardingPoint: String,
  allocationType: { type: String, enum: ['auto', 'student_selected', 'admin_proposed'] },
  feeTriggered: { type: Boolean, default: false },

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
  waitlistPosition: Number,
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, academicYearId: 1 });
// Compound index used by the proposal-expiry worker to scan efficiently.
schema.index({ collegeId: 1, status: 1, expiresAt: 1 });

export const TransportAllocation = model<ITransportAllocation>('TransportAllocation', schema);
