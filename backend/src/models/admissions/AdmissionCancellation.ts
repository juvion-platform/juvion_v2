import { Schema, model, Document } from 'mongoose';

export interface IAdmissionCancellation extends Document {
  collegeId: Schema.Types.ObjectId;
  admissionId?: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId;
  studentId?: Schema.Types.ObjectId;
  // Type
  cancellationType: string;      // 'pre_enrolment' | 'post_enrolment' | 'convener_surrender'
  reason: string;
  reasonCategory: string;        // 'student_request' | 'fee_default' | 'document_fraud' | 'disciplinary' | 'convener_reallocation'
  // Reversal tracking
  reversals: Array<{
    module: string;              // 'M02' | 'M03' | 'M04' | 'M08' | 'M12' | 'Juvi'
    action: string;
    status: string;              // 'pending' | 'completed' | 'failed'
    completedAt?: Date;
    error?: string;
  }>;
  // Financial
  refundAmount?: number;
  refundStatus?: string;         // 'not_applicable' | 'pending' | 'processed' | 'failed'
  refundTransactionId?: string;
  // Seat
  seatReleased: boolean;
  waitlistPromotionTriggered: boolean;
  // Approval
  requestedBy: string;
  approvedBy?: string;
  approvalLevel: string;         // 'staff' | 'leadership'
  status: string;                // 'requested' | 'approved' | 'in_progress' | 'completed' | 'rejected'
  completedAt?: Date;
}

const schema = new Schema<IAdmissionCancellation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  admissionId: { type: Schema.Types.ObjectId, ref: 'Admission' },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  cancellationType: {
    type: String,
    enum: ['pre_enrolment', 'post_enrolment', 'convener_surrender'],
    required: true,
  },
  reason: { type: String, required: true },
  reasonCategory: {
    type: String,
    enum: ['student_request', 'fee_default', 'document_fraud', 'disciplinary', 'convener_reallocation'],
    required: true,
  },
  reversals: [{
    module: { type: String, required: true },
    action: { type: String, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    completedAt: Date,
    error: String,
  }],
  refundAmount: Number,
  refundStatus: { type: String, enum: ['not_applicable', 'pending', 'processed', 'failed'] },
  refundTransactionId: String,
  seatReleased: { type: Boolean, default: false },
  waitlistPromotionTriggered: { type: Boolean, default: false },
  requestedBy: { type: String, required: true },
  approvedBy: String,
  approvalLevel: { type: String, enum: ['staff', 'leadership'], default: 'staff' },
  status: {
    type: String,
    enum: ['requested', 'approved', 'in_progress', 'completed', 'rejected'],
    default: 'requested',
  },
  completedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, applicantId: 1 });
schema.index({ collegeId: 1, status: 1 });

export const AdmissionCancellation = model<IAdmissionCancellation>('AdmissionCancellation', schema);
