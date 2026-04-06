import { Schema, model, Document } from 'mongoose';

export interface IApplicant extends Document {
  collegeId: Schema.Types.ObjectId;
  inquiryId?: Schema.Types.ObjectId;
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
}

const schema = new Schema<IApplicant>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry' },
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
    enum: ['draft', 'submitted', 'under_review', 'eligible', 'ineligible', 'offered', 'accepted', 'fee_paid', 'enrolled', 'withdrawn', 'rejected'],
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
}, { timestamps: true });

schema.index({ collegeId: 1, applicationNumber: 1 }, { unique: true });
schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, phone: 1 });

export const Applicant = model<IApplicant>('Applicant', schema);
