import { Schema, model, Document } from 'mongoose';

export interface IInquiry extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId?: Schema.Types.ObjectId;
  // Personal
  name: string; fatherName?: string; phone: string; altPhone?: string; email?: string;
  gender?: string; dateOfBirth?: Date;
  // Address
  city?: string; state?: string; district?: string; pincode?: string;
  // Academic background
  tenthPercentage?: number; interPercentage?: number; interStream?: string;
  previousCollege?: string;
  // Interest
  source: string; programmeInterest?: string; branchInterest?: string;
  // Tracking
  date: Date; status: string; leadScore?: number;
  notes?: string; followUpDate?: Date;
  assignedTo?: string;
  // W01 enhancements
  leadGrade?: string;            // 'hot' | 'warm' | 'cold' | 'dormant'
  tags?: string[];
  lastInteractionAt?: Date;
  interactionCount?: number;
  importBatchId?: Schema.Types.ObjectId;
  workflowInstanceId?: Schema.Types.ObjectId;
  // Conversion
  convertedToApplicantId?: Schema.Types.ObjectId;
  // W01 intake enhancements
  aadhaarNumber?: string;
  languagePreference?: string;
}

const schema = new Schema<IInquiry>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear' },
  // Personal
  name: { type: String, required: true },
  fatherName: String,
  phone: { type: String, required: true },
  altPhone: String,
  email: String,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dateOfBirth: Date,
  // Address
  city: String,
  state: String,
  district: String,
  pincode: String,
  // Academic background
  tenthPercentage: Number,
  interPercentage: Number,
  interStream: { type: String, enum: ['MPC', 'BiPC', 'MEC', 'CEC', 'other'] },
  previousCollege: String,
  // Interest
  source: { type: String, enum: ['website', 'walk-in', 'referral', 'whatsapp', 'newspaper', 'social_media', 'education_fair', 'phone'], required: true },
  programmeInterest: String,
  branchInterest: String,
  // Tracking
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['new', 'contacted', 'follow_up', 'interested', 'visit_scheduled', 'visited', 'qualified', 'converted', 'lost'], default: 'new' },
  leadScore: Number,
  notes: String,
  followUpDate: Date,
  assignedTo: String,
  // W01 enhancements
  leadGrade: { type: String, enum: ['hot', 'warm', 'cold', 'dormant'] },
  tags: [String],
  lastInteractionAt: Date,
  interactionCount: { type: Number, default: 0 },
  importBatchId: { type: Schema.Types.ObjectId, ref: 'LeadImportBatch' },
  workflowInstanceId: { type: Schema.Types.ObjectId, ref: 'WorkflowInstance' },
  // Conversion
  convertedToApplicantId: { type: Schema.Types.ObjectId, ref: 'Applicant' },
  // W01 intake enhancements
  aadhaarNumber: String,
  languagePreference: String,
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, phone: 1 });

export const Inquiry = model<IInquiry>('Inquiry', schema);
