import { z } from 'zod';

export const createInquirySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  fatherName: z.string().optional(),
  phone: z.string().min(10, 'Valid phone required'),
  altPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().optional(),
  // Address
  city: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  pincode: z.string().optional(),
  // Academic
  tenthPercentage: z.number().min(0).max(100).optional(),
  interPercentage: z.number().min(0).max(100).optional(),
  interStream: z.enum(['MPC', 'BiPC', 'MEC', 'CEC', 'other']).optional(),
  previousCollege: z.string().optional(),
  // Interest
  source: z.enum(['website', 'walk-in', 'referral', 'whatsapp', 'newspaper', 'social_media', 'education_fair', 'phone']),
  programmeInterest: z.string().optional(),
  branchInterest: z.string().optional(),
  // Tracking
  status: z.enum(['new', 'contacted', 'follow_up', 'interested', 'visit_scheduled', 'visited', 'qualified', 'converted', 'lost']).optional(),
  leadScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  followUpDate: z.string().optional(),
  assignedTo: z.string().optional(),
});

export const updateInquirySchema = createInquirySchema.partial();

export const createApplicantSchema = z.object({
  inquiryId: z.string().optional(),
  applicationNumber: z.string().min(1, 'Application number required'),
  name: z.string().min(1, 'Name is required'),
  fatherName: z.string().optional(),
  phone: z.string().min(10, 'Valid phone required'),
  altPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().optional(),
  aadharNumber: z.string().optional(),
  // Address
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  pincode: z.string().optional(),
  // Academic
  tenthBoard: z.string().optional(),
  tenthSchool: z.string().optional(),
  tenthYear: z.number().optional(),
  tenthPercentage: z.number().min(0).max(100).optional(),
  interBoard: z.string().optional(),
  interCollege: z.string().optional(),
  interYear: z.number().optional(),
  interPercentage: z.number().min(0).max(100).optional(),
  interStream: z.enum(['MPC', 'BiPC', 'MEC', 'CEC', 'other']).optional(),
  // Programme
  programmeApplied: z.string().optional(),
  branchPreference1: z.string().optional(),
  branchPreference2: z.string().optional(),
  branchPreference3: z.string().optional(),
  // Quota is admin-managed via FeeQuota CRUD; accept any catalog code.
  quota: z.string().min(1),
  category: z.enum(['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS']).optional(),
  // Entrance exams
  eamcetRank: z.number().optional(),
  eamcetScore: z.number().optional(),
  jeeRank: z.number().optional(),
  jeeScore: z.number().optional(),
  ecetRank: z.number().optional(),
  ecetScore: z.number().optional(),
  // Tracking
  status: z.enum(['draft', 'submitted', 'under_review', 'eligible', 'ineligible', 'offered', 'accepted', 'fee_paid', 'enrolled', 'withdrawn', 'rejected']).optional(),
  notes: z.string().optional(),
});

export const updateApplicantSchema = createApplicantSchema.partial();

export const convertInquirySchema = z.object({
  programmeApplied: z.string().optional(),
  branchPreference1: z.string().optional(),
  // Quota is admin-managed via FeeQuota CRUD; accept any catalog code.
  quota: z.string().min(1),
  category: z.enum(['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS']).optional(),
});

export const createExamScoreSchema = z.object({
  applicantId: z.string().min(1),
  examType: z.enum(['EAMCET', 'JEE', 'ECET']),
  rank: z.number().optional(),
  score: z.number().min(0),
  year: z.number().min(2000).max(2100),
});

export const createCounselingSchema = z.object({
  applicantId: z.string().min(1),
  allotmentOrder: z.number().optional(),
  collegeCode: z.string().optional(),
  branchCode: z.string().optional(),
  round: z.number().min(1),
  status: z.enum(['allotted', 'accepted', 'cancelled', 'upgraded']).optional(),
});

export const createOfferSchema = z.object({
  applicantId: z.string().min(1),
  programmeId: z.string().min(1),
  branchId: z.string().optional(),
  feeQuoted: z.number().min(0),
  validityDate: z.string().min(1),
  status: z.enum(['offered', 'accepted', 'declined', 'lapsed']).optional(),
});

export const updateOfferSchema = createOfferSchema.partial();

export const upsertDocChecklistSchema = z.object({
  documents: z.array(z.object({
    name: z.string(),
    type: z.string().optional(),
    required: z.boolean().optional(),
    uploaded: z.boolean().optional(),
    verified: z.boolean().optional(),
  })),
  status: z.enum(['pending', 'partial', 'complete', 'verified']).optional(),
});

export const createAdmissionSchema = z.object({
  applicantId: z.string().min(1),
  studentId: z.string().optional(),
  admissionDate: z.string().min(1),
  admittedBy: z.string().min(1),
  admissionType: z.enum(['fresh', 'lateral']),
});
