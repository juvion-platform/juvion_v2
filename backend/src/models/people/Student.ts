import { Schema, model, Document, Types } from 'mongoose';

/**
 * FeePin — per-student, per-year snapshot of the applicable
 * FeeStructureInstance. Embedded on Student.feePins[].
 *
 * See `.captain/specs/fee-configuration/spec.md` (§AC Snapshot/Pin) and
 * plan §2.1 for the full lifecycle. Invariant (enforced at service
 * layer, NOT the DB): at most one pin per (studentId, yearOfStudy) has
 * `archivedAt === null`.
 */
export type FeePinReason =
  | 'initial'
  | 'branch_change'
  | 'quota_change'
  | 'programme_transfer'
  | 'admin_override'
  | 'data_correction'
  | 'year_back_carryforward';

export type FeePinCommitmentSheetStatus = 'queued' | 'generated' | 'failed';

export interface IFeePin {
  _id: Types.ObjectId;
  yearOfStudy: number;
  feeStructureInstanceId: Types.ObjectId;
  pinnedAt: Date;
  pinnedBy: string;
  reason: FeePinReason;
  remarks?: string;
  staleSince?: Date | null;
  archivedAt?: Date | null;
  archiveReason?: string;
  commitmentSheetDocumentId?: Types.ObjectId;
  commitmentSheetStatus?: FeePinCommitmentSheetStatus;
}

const feePinSchema = new Schema<IFeePin>(
  {
    yearOfStudy: { type: Number, required: true, min: 1, max: 8 },
    feeStructureInstanceId: {
      type: Schema.Types.ObjectId,
      ref: 'FeeStructureInstance',
      required: true,
    },
    pinnedAt: { type: Date, required: true, default: () => new Date() },
    pinnedBy: { type: String, required: true },
    reason: {
      type: String,
      enum: [
        'initial',
        'branch_change',
        'quota_change',
        'programme_transfer',
        'admin_override',
        'data_correction',
        'year_back_carryforward',
      ],
      required: true,
    },
    remarks: String,
    staleSince: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    archiveReason: String,
    commitmentSheetDocumentId: { type: Schema.Types.ObjectId, ref: 'Document' },
    commitmentSheetStatus: {
      type: String,
      enum: ['queued', 'generated', 'failed'],
    },
  },
  { _id: true },
);

export interface IStudent extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId;
  admissionYear: number;
  category?: string;
  quota?: string;
  regulationId?: Schema.Types.ObjectId;
  programmeId?: Schema.Types.ObjectId;
  branchId?: Schema.Types.ObjectId;
  batchId?: Schema.Types.ObjectId;
  primaryParentId?: Schema.Types.ObjectId;
  feeResponsibleParentId?: Schema.Types.ObjectId;
  rollNumber?: string;
  status: string;
  onboardingStatus: string;
  onboardingCompletedAt?: Date;
  onboardingChecklist?: {
    profileVerified?: boolean;
    documentsVerified?: boolean;
    feePlanConfirmed?: boolean;
    portalAccessShared?: boolean;
    idCardIssued?: boolean;
  };
  feeStatus?: 'paid' | 'partial' | 'overdue' | 'clear';
  hasFinancialHold?: boolean;
  scholarshipStatus?: 'active' | 'none' | 'pending';
  graduationEligible?: boolean;
  graduationDate?: Date;
  degreeAwarded?: string;
  finalCgpa?: number;
  exitDate?: Date;
  exitType?: string;
  exitReason?: string;
  exitRequestId?: Schema.Types.ObjectId;
  isSealed: boolean;
  sealedAt?: Date;
  sealedBy?: string;
  alumniId?: Schema.Types.ObjectId;
  feePins: Types.DocumentArray<IFeePin & Types.Subdocument>;
}

const schema = new Schema<IStudent>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  admissionYear: { type: Number, required: true },
  category: String,
  quota: { type: String, enum: ['convener', 'management', 'nri'] },
  regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation' },
  programmeId: { type: Schema.Types.ObjectId, ref: 'Programme' },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
  primaryParentId: { type: Schema.Types.ObjectId, ref: 'Parent' },
  feeResponsibleParentId: { type: Schema.Types.ObjectId, ref: 'Parent' },
  rollNumber: String,
  status: { type: String, enum: ['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni', 'withdrawal_pending', 'expulsion_pending', 'transfer_pending', 'graduation_pending', 'withdrawn', 'expelled', 'transferred', 'deceased'], default: 'prospective' },
  onboardingStatus: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
  onboardingCompletedAt: Date,
  onboardingChecklist: {
    profileVerified: { type: Boolean, default: false },
    documentsVerified: { type: Boolean, default: false },
    feePlanConfirmed: { type: Boolean, default: false },
    portalAccessShared: { type: Boolean, default: false },
    idCardIssued: { type: Boolean, default: false },
  },
  feeStatus: { type: String, enum: ['paid', 'partial', 'overdue', 'clear'] },
  hasFinancialHold: { type: Boolean, default: false },
  scholarshipStatus: { type: String, enum: ['active', 'none', 'pending'] },
  graduationEligible: Boolean,
  graduationDate: Date,
  degreeAwarded: String,
  finalCgpa: Number,
  exitDate: Date,
  exitType: { type: String, enum: ['graduation', 'withdrawal', 'expulsion', 'dropout', 'transfer'] },
  exitReason: String,
  exitRequestId: { type: Schema.Types.ObjectId, ref: 'ExitRequest' },
  isSealed: { type: Boolean, default: false },
  sealedAt: Date,
  sealedBy: String,
  alumniId: { type: Schema.Types.ObjectId, ref: 'Alumni' },
  feePins: { type: [feePinSchema], default: [] },
}, { timestamps: true });

schema.index({ collegeId: 1, rollNumber: 1 }, { unique: true, sparse: true });
// Sparse index to accelerate nightly audit + pin-coverage queries that
// join students ↔ FeeStructureInstance on the pinned id (plan §2.1).
schema.index({ 'feePins.feeStructureInstanceId': 1 }, { sparse: true });

export const Student = model<IStudent>('Student', schema);
