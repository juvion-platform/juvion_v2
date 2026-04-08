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
  photo: z.string().optional(),
  biometricEnrolled: z.boolean().optional(),
});

// ── Person (base identity) ───────────────────────────
export const createPersonSchema = basePersonSchema;
export const updatePersonSchema = createPersonSchema.partial();

// ── Student ──────────────────────────────────────────
export const createStudentSchema = basePersonSchema.extend({
  admissionYear: z.number().min(2000).max(2100),
  category: z.string().optional(),
  quota: z.enum(['convener', 'management', 'nri']).optional(),
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
export const createFacultySchema = basePersonSchema.extend({
  employeeCode: z.string().min(1, 'Employee code required'),
  designation: z.string().min(1, 'Designation required'),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  contractType: z.enum(['regular', 'contract', 'adjunct', 'visiting']).optional(),
  status: z.enum(['active', 'on_leave', 'separated']).optional(),
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
