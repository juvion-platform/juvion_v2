import { z } from 'zod';

const contactSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});

const emergencyContactSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  relationship: z.string().optional(),
});

const onboardingChecklistSchema = z.object({
  profileVerified: z.boolean().optional(),
  documentsVerified: z.boolean().optional(),
  feePlanConfirmed: z.boolean().optional(),
  portalAccessShared: z.boolean().optional(),
  idCardIssued: z.boolean().optional(),
});

const basePersonSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Valid phone required'),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  aadhaar: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  preferredLanguage: z.string().optional(),
  address: contactSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  // photo is no longer settable via the generic Person body — writes flow
  // through POST /api/people/students/:id/photo (multipart) which returns
  // the S3 keys + metadata.
  biometricEnrolled: z.boolean().optional(),
});

// ── Person (base identity) ───────────────────────────
export const createPersonSchema = basePersonSchema;
export const updatePersonSchema = createPersonSchema.partial();

// ── Student ──────────────────────────────────────────
//
// IMPORTANT: every field the form sends MUST be declared here. Zod 3
// strips unknown keys by default — any field not listed gets silently
// dropped before the controller ever sees it. Missing programmeId /
// branchId / regulationId / batchId / studyYearAtAdmission was the
// root cause of "branch is not getting saved" (and would have been
// the same for the other refs if anyone had relied on the API path).
export const createStudentSchema = basePersonSchema.extend({
  admissionYear: z.number().min(2000).max(2100),
  category: z.string().optional(),
  // Quota is admin-managed via the FeeQuota CRUD
  // (/api/finance/fee-quotas), so the validator accepts any catalog
  // code as a free string. Matching is by string equality in
  // fee-pin-service.
  quota: z.string().optional(),
  // Academic-structure references — optional on the body so blanks
  // are allowed; nullable so the form can clear them.
  programmeId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  regulationId: z.string().nullable().optional(),
  batchId: z.string().nullable().optional(),
  studyYearAtAdmission: z.number().int().min(1).max(6).optional(),
  primaryParentId: z.string().nullable().optional(),
  feeResponsibleParentId: z.string().nullable().optional(),
  rollNumber: z.string().optional(),
  status: z.enum(['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni']).optional(),
  onboardingStatus: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  onboardingCompletedAt: z.string().optional(),
  onboardingChecklist: onboardingChecklistSchema.optional(),
});
export const updateStudentSchema = createStudentSchema.partial();

// ── Faculty ──────────────────────────────────────────

// External-credential identifiers — Strategic Gap 1 (Faculty Profile
// depth). 33 NAAC-relevant IDs across 5 logical groups. Every field
// is OPTIONAL — institutions populate over time. The validator MUST
// list every key the model accepts, otherwise Zod's strip-on-parse
// behaviour silently drops them (see the branchId bug for the same
// class of failure). See models/people/Faculty.ts for the field
// list of record.
const facultyExternalIdsSchema = z.object({
  // Indian regulators / portals
  aicte: z.string().trim().optional(),
  aishe: z.string().trim().optional(),
  shodhganga: z.string().trim().optional(),
  irins: z.string().trim().optional(),
  vidwan: z.string().trim().optional(),
  // International research
  orcid: z.string().trim().optional(),
  scopus: z.string().trim().optional(),
  webOfScience: z.string().trim().optional(),
  researchGate: z.string().trim().optional(),
  googleScholar: z.string().trim().optional(),
  researcherId: z.string().trim().optional(),
  clarivate: z.string().trim().optional(),
  academia: z.string().trim().optional(),
  semanticScholar: z.string().trim().optional(),
  publons: z.string().trim().optional(),
  ssrn: z.string().trim().optional(),
  elsevierReviewer: z.string().trim().optional(),
  // Editorial / review
  springerReviewer: z.string().trim().optional(),
  // MOOC / learning
  swayam: z.string().trim().optional(),
  nptel: z.string().trim().optional(),
  nptelLearner: z.string().trim().optional(),
  atal: z.string().trim().optional(),
  // Code platforms
  github: z.string().trim().optional(),
  hackerRank: z.string().trim().optional(),
  hackerEarth: z.string().trim().optional(),
  leetCode: z.string().trim().optional(),
  replit: z.string().trim().optional(),
  codeChef: z.string().trim().optional(),
  exercism: z.string().trim().optional(),
  codecademy: z.string().trim().optional(),
  // Social & web
  linkedIn: z.string().trim().optional(),
  youtube: z.string().trim().optional(),
  website: z.string().trim().optional(),
});

// Bio / professional summary — public-facing free-text profile block
// added in Phase B1 of the Faculty Profile depth spec.
const facultyLanguageSchema = z.object({
  code: z.string().trim().min(1),
  proficiency: z.enum(['native', 'fluent', 'conversational', 'basic']).optional(),
});

const facultyProfileBioSchema = z.object({
  summary: z.string().trim().optional(),
  tagline: z.string().trim().optional(),
  expertiseTags: z.array(z.string().trim().min(1)).optional(),
  researchInterests: z.array(z.string().trim().min(1)).optional(),
  teachingInterests: z.array(z.string().trim().min(1)).optional(),
  languages: z.array(facultyLanguageSchema).optional(),
});

const facultyOfficeSchema = z.object({
  building: z.string().trim().optional(),
  cabinNumber: z.string().trim().optional(),
  phoneExtension: z.string().trim().optional(),
  weeklyHours: z.string().trim().optional(),
});

export const createFacultySchema = basePersonSchema.extend({
  employeeCode: z.string().min(1, 'Employee code required'),
  designation: z.string().min(1, 'Designation required'),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  // Academic structure refs — same lesson as the Student schema fix
  // (branchId silently dropped). Must be declared or Zod strips.
  departmentId: z.string().nullable().optional(),
  contractType: z.enum(['regular', 'contract', 'adjunct', 'visiting']).optional(),
  status: z.enum(['active', 'on_leave', 'separated']).optional(),
  externalIds: facultyExternalIdsSchema.optional(),
  profileBio: facultyProfileBioSchema.optional(),
  office: facultyOfficeSchema.optional(),
});
export const updateFacultySchema = createFacultySchema.partial();

// ── Staff ────────────────────────────────────────────
export const createStaffSchema = basePersonSchema.extend({
  employeeCode: z.string().min(1, 'Employee code required'),
  designation: z.string().min(1, 'Designation required'),
  staffType: z.string().min(1, 'Staff type required'),
  status: z.enum(['active', 'on_leave', 'separated']).optional(),
});
export const updateStaffSchema = createStaffSchema.partial();

// ── Parent ───────────────────────────────────────────
export const createParentSchema = basePersonSchema.extend({
  relationship: z.enum(['father', 'mother', 'guardian']),
  linkedStudents: z.array(z.string()).optional(),
  primaryContact: z.boolean().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  annualIncomeBand: z.string().optional(),
  isFeeResponsible: z.boolean().optional(),
  communicationPreference: z.enum(['call', 'sms', 'whatsapp', 'email']).optional(),
});
export const updateParentSchema = createParentSchema.partial();

// ── Organization ─────────────────────────────────────
export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  address: z.string().optional(),
  contact: z.string().optional(),
  contactPersonName: z.string().optional(),
  contactPersonEmail: z.string().email().optional().or(z.literal('')),
  contactPersonPhone: z.string().optional(),
  partnershipType: z.string().optional(),
  status: z.enum(['prospect', 'active', 'inactive']).optional(),
});
export const updateOrganizationSchema = createOrganizationSchema.partial();

// ═══ W10 Exit Workflow Schemas ═══════════════════════════════
export const submitExitRequestSchema = z.object({ studentId: z.string().min(1), exitType: z.enum(['withdrawal', 'transfer', 'expulsion', 'dropout_formalization']), reason: z.string().min(1), reasonCategory: z.enum(['personal', 'financial', 'academic', 'transfer', 'family', 'health', 'disciplinary', 'other']), reasonDetails: z.string().optional(), requestedBy: z.string().min(1), destinationInstitution: z.string().optional(), destinationUniversity: z.string().optional(), disciplinaryCaseId: z.string().optional(), dropoutRiskAlertId: z.string().optional(), outreachExhausted: z.boolean().optional() });
export const approveExitRequestSchema = z.object({ approvedBy: z.string().min(1), notes: z.string().optional() });
export const rejectExitRequestSchema = z.object({ notes: z.string().min(1) });
export const transitionStudentSchema = z.object({ status: z.string().min(1) });
export const initiateClearanceSchema = z.object({ studentId: z.string().min(1), exitType: z.enum(['graduation', 'withdrawal', 'expulsion', 'dropout', 'transfer']), initiatedBy: z.string().min(1), urgency: z.enum(['standard', 'urgent']).optional() });
export const completeClearanceItemSchema = z.object({ completedBy: z.string().min(1) });
export const waiveClearanceItemSchema = z.object({ waiverReason: z.string().min(1), waiverApprovedBy: z.string().min(1) });
export const logEscalationSchema = z.object({ clearanceItemId: z.string().min(1), clearanceWorkflowId: z.string().min(1), level: z.enum(['reminder', 'hod', 'principal']), escalatedTo: z.string().min(1), reason: z.string().min(1), slaPercentage: z.number() });
export const createDocumentTemplateSchema_wf = z.object({ type: z.enum(['transcript', 'provisional_certificate', 'degree_certificate', 'transfer_certificate', 'migration_certificate', 'no_dues_certificate', 'character_certificate', 'bonafide', 'study_certificate']), name: z.string().min(1), version: z.string().min(1), templateUrl: z.string().optional(), placeholders: z.array(z.string()).optional(), signatureSlots: z.array(z.object({ role: z.string(), position: z.string() })).optional(), regulationId: z.string().optional(), universityFormat: z.string().optional() });
export const generateDocumentSchema = z.object({ studentId: z.string().min(1), templateId: z.string().optional(), type: z.enum(['transcript', 'provisional_certificate', 'degree_certificate', 'transfer_certificate', 'migration_certificate', 'no_dues_certificate', 'character_certificate', 'bonafide', 'study_certificate']), title: z.string().min(1), exitRequestId: z.string().optional() });
export const signDocumentSchema = z.object({ role: z.string().min(1), signedBy: z.string().min(1), signatureType: z.string().optional() });
export const issueDocumentSchema = z.object({ serialNumber: z.string().optional() });
export const revokeDocumentSchema = z.object({ reason: z.string().min(1) });
export const createAlumniRecordSchema = z.object({ personId: z.string().min(1), studentId: z.string().min(1), programmeId: z.string().min(1), branchId: z.string().min(1), batchId: z.string().optional(), regulationId: z.string().optional(), graduationDate: z.string().min(1), degreeAwarded: z.string().min(1), finalCgpa: z.number(), classObtained: z.enum(['first_class_distinction', 'first_class', 'second_class', 'pass']) });
