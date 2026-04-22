import { Schema, model, Document } from 'mongoose';

export interface IFinancialHold extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  defaulterRecordId: Schema.Types.ObjectId;
  holdType: 'exam_debarment' | 'hostel_restriction' | 'transcript_hold' | 'full_clearance_block';
  /**
   * 'pending_approval' added by the fee-alerts-cron feature (T5): holds
   * auto-raised on a stage_4 transition start in this state; Principal
   * activates/waives via the fee-holds-service (T4). Until T4 lands, the
   * enum extension here is the minimum cross-task dependency the cron
   * worker needs to auto-create a pending hold.
   */
  holdStatus: 'active' | 'released' | 'pending_approval';
  effectiveDate: Date;
  /**
   * Approver is optional at creation: cron-raised `pending_approval`
   * holds have no approver yet (Principal fills this in on activate).
   */
  approvedBy?: Schema.Types.ObjectId;
  releaseDate?: Date;
  releasedBy?: Schema.Types.ObjectId;
  releaseReason?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const schema = new Schema<IFinancialHold>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  defaulterRecordId: { type: Schema.Types.ObjectId, ref: 'DefaulterRecord', required: true },
  holdType: {
    type: String,
    enum: ['exam_debarment', 'hostel_restriction', 'transcript_hold', 'full_clearance_block'],
    required: true,
  },
  holdStatus: {
    type: String,
    enum: ['active', 'released', 'pending_approval'],
    default: 'active',
  },
  effectiveDate: { type: Date, default: Date.now },
  // Approver is optional — auto-raised pending_approval holds have no
  // approver until the Principal activates them.
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  releaseDate: { type: Date },
  releasedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
  releaseReason: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, holdStatus: 1 });

export const FinancialHold = model<IFinancialHold>('FinancialHold', schema);
