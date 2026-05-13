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
  // Tracking — expanded enum mirrors Inquiry model status taxonomy
  // (Strategic Gap 5 Phase A). 27 prospect statuses covering the
  // full CampX-mirror funnel depth.
  status: z.enum([
    'new', 'enrichment_pending',
    'first_contact_attempt', 'contacted', 'no_response', 'callback_requested',
    'wrong_number', 'do_not_contact',
    'follow_up', 'follow_up_overdue', 'interested', 'sent_brochure',
    'mql', 'sql',
    'visit_scheduled', 'visit_completed', 'visited',
    'counsellor_meeting_scheduled', 'counsellor_meeting_done',
    'parent_meeting_done',
    'qualified', 'eligibility_pending', 'fee_quoted',
    'converted', 'lost', 'disqualified', 'dormant',
    'duplicate_merged',
  ]).optional(),
  leadScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  followUpDate: z.string().optional(),
  assignedTo: z.string().optional(),

  // ─── Strategic Gap 5 — CRM depth (Phase A) ───────────────────────
  utmSource: z.string().trim().optional(),
  utmMedium: z.string().trim().optional(),
  utmCampaign: z.string().trim().optional(),
  utmTerm: z.string().trim().optional(),
  utmContent: z.string().trim().optional(),
  mqlSqlClassification: z.enum(['mql', 'sql', 'disqualified']).optional(),
  emailVerified: z.boolean().optional(),
  mobileVerified: z.boolean().optional(),
  // Officer refs as string ObjectIds (mongo casts later). Nullable
  // so the operator can clear an assignment in an update.
  assignedOfficerId: z.string().nullable().optional(),
  clusterHeadId: z.string().nullable().optional(),
  assignedByRuleId: z.string().nullable().optional(),
  // Lead grade — was on the model but missing from the schema, so
  // Zod was silently stripping it (same class as the branchId bug).
  // Capture it here too for the Phase A sweep.
  leadGrade: z.enum(['hot', 'warm', 'cold', 'dormant']).optional(),
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
  // Tracking — expanded enum mirrors Applicant model status taxonomy
  // (Strategic Gap 5 Phase A). 16 application statuses covering the
  // verification → eligibility → offer → fee → enroll funnel.
  status: z.enum([
    'draft', 'submitted',
    'under_review', 'documents_pending', 'documents_verified',
    'eligible', 'ineligible', 'conditional_eligible',
    'offered', 'offer_declined', 'offer_lapsed', 'accepted',
    'fee_pending', 'fee_paid', 'enrolled',
    'withdrawn', 'rejected',
  ]).optional(),
  notes: z.string().optional(),

  // ─── Strategic Gap 5 — CRM depth (Phase A) ───────────────────────
  utmSource: z.string().trim().optional(),
  utmMedium: z.string().trim().optional(),
  utmCampaign: z.string().trim().optional(),
  utmTerm: z.string().trim().optional(),
  utmContent: z.string().trim().optional(),
  emailVerified: z.boolean().optional(),
  mobileVerified: z.boolean().optional(),
  applicationFeeVerified: z.boolean().optional(),
  assignedOfficerId: z.string().nullable().optional(),
  clusterHeadId: z.string().nullable().optional(),
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

// ─── Strategic Gap 5 — AssignmentRule schemas ──────────────────────

const assignmentRuleConditionSchema = z.object({
  field: z.enum([
    'source', 'utmSource', 'utmMedium', 'utmCampaign',
    'programmeInterest', 'branchInterest',
    'leadScore', 'leadGrade',
    'state', 'city', 'interStream',
  ]),
  operator: z.enum(['equals', 'not_equals', 'in', 'gt', 'gte', 'lt', 'lte', 'contains']),
  // RHS varies: string for textual ops, number for comparisons,
  // string[] for `in`. Express tolerantly as Mixed at validation
  // time; the evaluator enforces operator+type compatibility.
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const createAssignmentRuleSchema = z.object({
  name: z.string().trim().min(1, 'Rule name required'),
  description: z.string().trim().optional(),
  conditions: z.array(assignmentRuleConditionSchema).min(1, 'At least one condition required'),
  assignedOfficerId: z.string().min(1, 'Officer required'),
  clusterHeadId: z.string().nullable().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  enabled: z.boolean().optional(),
});

export const updateAssignmentRuleSchema = createAssignmentRuleSchema.partial();

export const previewAssignmentRuleSchema = z.object({
  // Loose object — the evaluator only reads the fields it has
  // conditions on, so we accept any field shape. Defensive validation
  // is the rule-engine's job, not the schema's.
  inquiry: z.record(z.unknown()),
});
