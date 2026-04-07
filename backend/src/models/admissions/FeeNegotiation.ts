import { Schema, model, Document } from 'mongoose';

export interface IFeeNegotiation extends Document {
  collegeId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId;
  offerId: Schema.Types.ObjectId;
  // Original fee
  originalFee: number;
  // Negotiation
  requestedWaiver: number;
  requestedReason: string;
  // AI assessment
  aiRecommendedWaiver?: number;
  aiConfidence?: number;
  aiReason?: string;
  // Decision
  approvedWaiver: number;
  finalFee: number;
  approvedBy?: string;
  approvalLevel: string;          // 'ai_auto' | 'staff' | 'leadership'
  // Status
  status: string;                 // 'pending' | 'ai_approved' | 'escalated' | 'approved' | 'rejected' | 'counter_offered'
  counterOffer?: number;
  counterOfferBy?: string;
  // Audit
  negotiatedBy: string;
  resolvedAt?: Date;
  notes?: string;
}

const schema = new Schema<IFeeNegotiation>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  offerId: { type: Schema.Types.ObjectId, ref: 'AdmissionOffer', required: true },
  originalFee: { type: Number, required: true },
  requestedWaiver: { type: Number, required: true },
  requestedReason: { type: String, required: true },
  aiRecommendedWaiver: Number,
  aiConfidence: Number,
  aiReason: String,
  approvedWaiver: { type: Number, default: 0 },
  finalFee: { type: Number, required: true },
  approvedBy: String,
  approvalLevel: {
    type: String,
    enum: ['ai_auto', 'staff', 'leadership'],
    default: 'staff',
  },
  status: {
    type: String,
    enum: ['pending', 'ai_approved', 'escalated', 'approved', 'rejected', 'counter_offered'],
    default: 'pending',
  },
  counterOffer: Number,
  counterOfferBy: String,
  negotiatedBy: { type: String, required: true },
  resolvedAt: Date,
  notes: String,
}, { timestamps: true });

schema.index({ collegeId: 1, applicantId: 1 });
schema.index({ collegeId: 1, status: 1 });

export const FeeNegotiation = model<IFeeNegotiation>('FeeNegotiation', schema);
