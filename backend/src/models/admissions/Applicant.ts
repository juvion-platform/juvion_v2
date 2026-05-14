import { Schema, model, Document } from 'mongoose';

export interface IApplicant extends Document {
  collegeId: Schema.Types.ObjectId;
  inquiryId?: Schema.Types.ObjectId;
  academicYearId?: Schema.Types.ObjectId;
  applicationNumber: string;
  // Personal
  name: string;
  fatherName?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: Date;
  aadharNumber?: string;
  // Address
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  pincode?: string;
  // Academic background
  tenthBoard?: string;
  tenthSchool?: string;
  tenthYear?: number;
  tenthPercentage?: number;
  interBoard?: string;
  interCollege?: string;
  interYear?: number;
  interPercentage?: number;
  interStream?: string;
  // Programme
  programmeApplied?: string;
  branchPreference1?: string;
  branchPreference2?: string;
  branchPreference3?: string;
  quota: string;
  category?: string;
  // Entrance exams
  eamcetRank?: number;
  eamcetScore?: number;
  jeeRank?: number;
  jeeScore?: number;
  ecetRank?: number;
  ecetScore?: number;
  // Tracking
  applicationDate: Date;
  status: string;
  notes?: string;
  // Offer
  offeredProgramme?: string;
  offeredBranch?: string;
  feeQuoted?: number;
  offerDate?: Date;
  offerValidTill?: Date;
  offerStatus?: string;
  // Enrollment
  admissionDate?: Date;
  enrollmentNumber?: string;
  admittedBy?: string;
  // W01 enhancements
  admissionType?: string;         // 'fresh' | 'lateral'
  eligibilityStatus?: string;     // 'pending' | 'eligible' | 'ineligible' | 'conditional' | 'edge_case'
  eligibilityVerifiedAt?: Date;
  eligibilityVerifiedBy?: string;
  eligibilityNotes?: string;
  meritScore?: number;
  workflowInstanceId?: Schema.Types.ObjectId;
  importBatchId?: Schema.Types.ObjectId;
  // W01 intake enhancements
  nriPassportNumber?: string;
  nriVisaValidity?: Date;
  scholarshipEligible?: boolean;
  scholarshipScheme?: string;

  // ─── Strategic Gap 5 — CRM depth (Phase A) ─────────────────────────
  // UTM attribution carried forward from the source Inquiry when
  // converted. Useful for ROI reporting per marketing campaign:
  // "we spent ₹X on UTM source/medium/campaign → got N enrollments".
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;

  // Verification flags. emailVerified + mobileVerified carry forward
  // from Inquiry; applicationFeeVerified is admission-stage only.
  emailVerified?: boolean;
  mobileVerified?: boolean;
  applicationFeeVerified?: boolean;

  // Officer hierarchy — carries forward from the source Inquiry but
  // can be overridden during application processing if a different
  // officer takes over.
  assignedOfficerId?: Schema.Types.ObjectId;
  clusterHeadId?: Schema.Types.ObjectId;
}

const schema = new Schema<IApplicant>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry' },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear' },
  applicationNumber: { type: String, required: true },
  // Personal
  name: { type: String, required: true },
  fatherName: String,
  phone: { type: String, required: true },
  altPhone: String,
  email: String,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dateOfBirth: Date,
  aadharNumber: String,
  // Address
  address: String,
  city: String,
  state: String,
  district: String,
  pincode: String,
  // Academic background
  tenthBoard: String,
  tenthSchool: String,
  tenthYear: Number,
  tenthPercentage: Number,
  interBoard: String,
  interCollege: String,
  interYear: Number,
  interPercentage: Number,
  interStream: { type: String, enum: ['MPC', 'BiPC', 'MEC', 'CEC', 'other'] },
  // Programme
  programmeApplied: String,
  branchPreference1: String,
  branchPreference2: String,
  branchPreference3: String,
  quota: { type: String, enum: ['convener', 'management', 'nri', 'spot'], required: true },
  category: { type: String, enum: ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS'] },
  // Entrance exams
  eamcetRank: Number,
  eamcetScore: Number,
  jeeRank: Number,
  jeeScore: Number,
  ecetRank: Number,
  ecetScore: Number,
  // Tracking
  applicationDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: [
      // Pre-submit
      'draft',
      'submitted',
      // Verification
      'under_review',
      'documents_pending',
      'documents_verified',
      // Eligibility decision
      'eligible',
      'ineligible',
      'conditional_eligible',
      // Offer lifecycle
      'offered',
      'offer_declined',
      'offer_lapsed',
      'accepted',
      // Fee + enrollment
      'fee_pending',
      'fee_paid',
      'enrolled',
      // Withdrawn / rejected
      'withdrawn',
      'rejected',
    ],
    default: 'draft',
  },
  notes: String,
  // Offer
  offeredProgramme: String,
  offeredBranch: String,
  feeQuoted: Number,
  offerDate: Date,
  offerValidTill: Date,
  offerStatus: { type: String, enum: ['pending', 'offered', 'accepted', 'declined', 'lapsed'] },
  // Enrollment
  admissionDate: Date,
  enrollmentNumber: String,
  admittedBy: String,
  // W01 enhancements
  admissionType: { type: String, enum: ['fresh', 'lateral'] },
  eligibilityStatus: { type: String, enum: ['pending', 'eligible', 'ineligible', 'conditional', 'edge_case'] },
  eligibilityVerifiedAt: Date,
  eligibilityVerifiedBy: String,
  eligibilityNotes: String,
  meritScore: Number,
  workflowInstanceId: { type: Schema.Types.ObjectId, ref: 'WorkflowInstance' },
  importBatchId: { type: Schema.Types.ObjectId, ref: 'LeadImportBatch' },
  // W01 intake enhancements
  nriPassportNumber: String,
  nriVisaValidity: Date,
  scholarshipEligible: { type: Boolean, default: false },
  scholarshipScheme: String,

  // ─── Strategic Gap 5 — CRM depth (Phase A) ───────────────────────
  // UTM attribution carried forward from Inquiry at convert time.
  utmSource: { type: String, trim: true },
  utmMedium: { type: String, trim: true },
  utmCampaign: { type: String, trim: true },
  utmTerm: { type: String, trim: true },
  utmContent: { type: String, trim: true },

  // Verification flags.
  emailVerified: { type: Boolean, default: false },
  mobileVerified: { type: Boolean, default: false },
  applicationFeeVerified: { type: Boolean, default: false },

  // Officer hierarchy carried forward from Inquiry (can be overridden).
  assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'Person' },
  clusterHeadId: { type: Schema.Types.ObjectId, ref: 'Person' },
}, { timestamps: true });

schema.index({ collegeId: 1, applicationNumber: 1 }, { unique: true });
schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, phone: 1 });
// CRM dashboard indexes.
schema.index({ collegeId: 1, assignedOfficerId: 1, status: 1 });
schema.index({ collegeId: 1, utmCampaign: 1 });

export const Applicant = model<IApplicant>('Applicant', schema);
