import { z } from 'zod';

// ═══ Placement Season ════════════════════════════════════

export const createPlacementSeasonSchema = z.object({
  academicYearId: z.string().min(1),
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(['planning', 'active', 'completed']).optional(),
});
export const updatePlacementSeasonSchema = createPlacementSeasonSchema.partial();

// ═══ Company ═════════════════════════════════════════════

export const createCompanySchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  website: z.string().optional(),
  contactPerson: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  tier: z.enum(['dream', 'super_dream', 'regular', 'mass']).optional(),
  isActive: z.boolean().optional(),
});
export const updateCompanySchema = createCompanySchema.partial();

// ═══ Job Posting ═════════════════════════════════════════

export const createJobPostingSchema = z.object({
  placementSeasonId: z.string().min(1),
  companyId: z.string().min(1),
  role: z.string().min(1),
  description: z.string().optional(),
  packageLpa: z.number().min(0),
  eligibilityCriteria: z.any().optional(),
  registrationDeadline: z.string().optional(),
  maxPositions: z.number().int().min(1).optional(),
  status: z.enum(['draft', 'open', 'closed', 'filled']).optional(),
});
export const updateJobPostingSchema = createJobPostingSchema.partial();

// ═══ Placement Registration ══════════════════════════════

export const createPlacementRegistrationSchema = z.object({
  jobPostingId: z.string().min(1),
  studentId: z.string().min(1),
  resumeUrl: z.string().optional(),
  status: z.enum(['registered', 'shortlisted', 'placed', 'not_placed']).optional(),
  appliedAt: z.string().optional(),
});
export const updatePlacementRegistrationSchema = createPlacementRegistrationSchema.partial();

// ═══ Placement Round ═════════════════════════════════════

export const createPlacementRoundSchema = z.object({
  jobPostingId: z.string().min(1),
  roundNumber: z.number().int().min(1),
  name: z.string().min(1),
  type: z.enum(['aptitude', 'technical', 'coding', 'gd', 'hr', 'final']),
  date: z.string().optional(),
  venue: z.string().optional(),
  status: z.enum(['scheduled', 'ongoing', 'completed']).optional(),
});
export const updatePlacementRoundSchema = createPlacementRoundSchema.partial();

// ═══ Round Result ════════════════════════════════════════

export const createRoundResultSchema = z.object({
  roundId: z.string().min(1),
  studentId: z.string().min(1),
  result: z.enum(['pass', 'fail', 'absent']),
  score: z.number().optional(),
  remarks: z.string().optional(),
});
export const updateRoundResultSchema = createRoundResultSchema.partial();

// ═══ Placement Offer ═════════════════════════════════════

export const createPlacementOfferSchema = z.object({
  jobPostingId: z.string().min(1),
  studentId: z.string().min(1),
  companyId: z.string().min(1),
  packageLpa: z.number().min(0),
  offerDate: z.string().min(1),
  joiningDate: z.string().optional(),
  offerLetterUrl: z.string().optional(),
  status: z.enum(['offered', 'accepted', 'declined', 'revoked']).optional(),
});
export const updatePlacementOfferSchema = createPlacementOfferSchema.partial();

// ═══ Internship Posting ══════════════════════════════════

export const createInternshipPostingSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  stipend: z.number().min(0).optional(),
  durationWeeks: z.number().int().min(1),
  startDate: z.string().optional(),
  lastDateToApply: z.string().min(1),
  status: z.enum(['open', 'closed']).optional(),
});
export const updateInternshipPostingSchema = createInternshipPostingSchema.partial();

// ═══ Internship Application ══════════════════════════════

export const createInternshipApplicationSchema = z.object({
  internshipId: z.string().min(1),
  studentId: z.string().min(1),
  status: z.enum(['applied', 'shortlisted', 'selected', 'rejected', 'completed']).optional(),
  appliedAt: z.string().optional(),
});
export const updateInternshipApplicationSchema = createInternshipApplicationSchema.partial();

// ═══ Placement Training ══════════════════════════════════

export const createPlacementTrainingSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['aptitude', 'soft_skills', 'technical', 'mock_interview', 'resume']),
  trainer: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(['planned', 'ongoing', 'completed']).optional(),
});
export const updatePlacementTrainingSchema = createPlacementTrainingSchema.partial();

// ═══ Training Attendance ═════════════════════════════════

export const createTrainingAttendanceSchema = z.object({
  trainingId: z.string().min(1),
  studentId: z.string().min(1),
  attended: z.boolean().optional(),
});
export const updateTrainingAttendanceSchema = createTrainingAttendanceSchema.partial();

// ═══ Mock Interview ══════════════════════════════════════

export const createMockInterviewSchema = z.object({
  studentId: z.string().min(1),
  interviewerId: z.string().min(1),
  date: z.string().min(1),
  type: z.enum(['technical', 'hr', 'mixed']),
  rating: z.number().min(0).max(10).optional(),
  feedback: z.string().optional(),
});
export const updateMockInterviewSchema = createMockInterviewSchema.partial();

// ═══ Higher Studies Application ══════════════════════════

export const createHigherStudiesApplicationSchema = z.object({
  studentId: z.string().min(1),
  examType: z.enum(['gate', 'gre', 'cat', 'gmat', 'ielts', 'toefl', 'other']),
  examScore: z.number().optional(),
  targetUniversity: z.string().optional(),
  country: z.string().optional(),
  programmeApplied: z.string().optional(),
  status: z.enum(['preparing', 'applied', 'admitted', 'rejected']).optional(),
});
export const updateHigherStudiesApplicationSchema = createHigherStudiesApplicationSchema.partial();

// ═══ Entrepreneur Profile ════════════════════════════════

export const createEntrepreneurProfileSchema = z.object({
  studentId: z.string().min(1),
  ventureIdea: z.string().min(1),
  stage: z.enum(['ideation', 'prototype', 'launched', 'scaled']).optional(),
  mentorId: z.string().optional(),
  incubationStatus: z.enum(['not_applied', 'applied', 'accepted', 'graduated']).optional(),
});
export const updateEntrepreneurProfileSchema = createEntrepreneurProfileSchema.partial();

// ═══ Alumni Profile ══════════════════════════════════════

export const createAlumniProfileSchema = z.object({
  personId: z.string().min(1),
  graduationYear: z.number().int().min(1900),
  currentCompany: z.string().optional(),
  currentDesignation: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().optional(),
  willingToMentor: z.boolean().optional(),
});
export const updateAlumniProfileSchema = createAlumniProfileSchema.partial();

// ═══ Alumni Event ════════════════════════════════════════

export const createAlumniEventSchema = z.object({
  title: z.string().min(1),
  eventType: z.enum(['reunion', 'talk', 'mentoring', 'networking']),
  date: z.string().min(1),
  venue: z.string().optional(),
  description: z.string().optional(),
  organizerId: z.string().optional(),
  status: z.enum(['planned', 'ongoing', 'completed']).optional(),
});
export const updateAlumniEventSchema = createAlumniEventSchema.partial();

// ═══ Placement Report ════════════════════════════════════

export const createPlacementReportSchema = z.object({
  placementSeasonId: z.string().min(1),
  reportType: z.enum(['company_wise', 'branch_wise', 'package_analysis', 'trend']),
  data: z.any().optional(),
});
export const updatePlacementReportSchema = createPlacementReportSchema.partial();
