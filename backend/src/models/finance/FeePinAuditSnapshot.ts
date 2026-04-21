import { Schema, model, Document, Types } from 'mongoose';

/**
 * FeePinAuditSnapshot — daily per-college audit roll-up written by the
 * T17 `fee-pin-audit` BullMQ worker (see
 * `backend/src/workers/fee-pin-audit.worker.ts`).
 *
 * Plan §5 (observability): the Finance dashboard reads the latest
 * snapshot per college to render pin-coverage, invariant-mismatch,
 * deferred-pin and commitment-sheet-failure metrics without needing to
 * re-aggregate on every page load.
 *
 * Retention: the worker prunes snapshots older than 90 days at the end
 * of each run. Keeping historical snapshots lets us plot trend lines
 * (coverage over the semester, mismatch count per run) when a
 * dashboard UI is built in a later task.
 */

export interface IFeePinAuditSnapshotMissingStudent {
  studentId: Types.ObjectId;
  rollNumber: string;
  programmeId: Types.ObjectId | null;
  currentYearOfStudy: number;
}

export interface IFeePinAuditSnapshotMismatch {
  invoiceId: Types.ObjectId;
  studentId: Types.ObjectId;
  pinId: Types.ObjectId;
  pinnedTotal: number;
  invoiceTotal: number;
  delta: number;
}

export interface IFeePinAuditSnapshot extends Document {
  _id: Types.ObjectId;
  collegeId: Types.ObjectId;
  runAt: Date;
  coverage: {
    totalActiveStudents: number;
    studentsWithActivePinForCurrentYear: number;
    coveragePercent: number;
    missingSample: IFeePinAuditSnapshotMissingStudent[];
  };
  invariants: {
    totalInvoicesChecked: number;
    mismatches: IFeePinAuditSnapshotMismatch[];
  };
  deferredPinsCount: number;
  commitmentSheetFailureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const missingStudentSchema = new Schema<IFeePinAuditSnapshotMissingStudent>(
  {
    studentId: { type: Schema.Types.ObjectId, required: true },
    rollNumber: { type: String, required: false, default: '' },
    programmeId: { type: Schema.Types.ObjectId, default: null },
    currentYearOfStudy: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const mismatchSchema = new Schema<IFeePinAuditSnapshotMismatch>(
  {
    invoiceId: { type: Schema.Types.ObjectId, required: true },
    studentId: { type: Schema.Types.ObjectId, required: true },
    pinId: { type: Schema.Types.ObjectId, required: true },
    pinnedTotal: { type: Number, required: true },
    invoiceTotal: { type: Number, required: true },
    delta: { type: Number, required: true },
  },
  { _id: false },
);

const schema = new Schema<IFeePinAuditSnapshot>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true },
    runAt: { type: Date, required: true, default: () => new Date() },
    coverage: {
      totalActiveStudents: { type: Number, required: true, default: 0 },
      studentsWithActivePinForCurrentYear: {
        type: Number,
        required: true,
        default: 0,
      },
      coveragePercent: { type: Number, required: true, default: 0 },
      missingSample: { type: [missingStudentSchema], default: [] },
    },
    invariants: {
      totalInvoicesChecked: { type: Number, required: true, default: 0 },
      mismatches: { type: [mismatchSchema], default: [] },
    },
    deferredPinsCount: { type: Number, required: true, default: 0 },
    commitmentSheetFailureCount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

// Dashboard query pattern: "latest snapshot per college".
schema.index({ collegeId: 1, runAt: -1 });

export const FeePinAuditSnapshot = model<IFeePinAuditSnapshot>(
  'FeePinAuditSnapshot',
  schema,
);
