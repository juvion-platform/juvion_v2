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

// ═══ W04 Workflow Schemas ═══════════════════════════════════

// ─── CRM ────────────────────────────────────────────────────
export const createEngagementLogSchema = z.object({ companyId: z.string().min(1), placementSeasonId: z.string().optional(), type: z.enum(['outreach', 'mou_signed', 'mou_lapsed', 'onboarding', 'feedback', 'blacklist', 'suspension', 'alumni_referral', 'drive_completed', 'general', 'touchpoint']), outcome: z.enum(['interested', 'maybe', 'declined', 'positive', 'negative', 'neutral']).optional(), notes: z.string().min(1), actorId: z.string().min(1) });
export const scorePipelineSchema = z.object({ placementSeasonId: z.string().min(1) });
export const blacklistCompanySchema = z.object({ reason: z.string().min(1) });
export const registerRecruiterAccountSchema = z.object({ personId: z.string().min(1), companyId: z.string().min(1), designation: z.string().min(1), email: z.string().email(), phone: z.string().optional() });
export const verifyRecruiterAccountSchema = z.object({ verifiedBy: z.string().min(1) });
export const deactivateRecruiterAccountSchema = z.object({ reason: z.string().min(1) });

// ─── Season ─────────────────────────────────────────────────
export const transitionSeasonSchema = z.object({ status: z.enum(['planning', 'pre_season', 'open', 'active', 'wind_down', 'closed']) });

// ─── Drive ──────────────────────────────────────────────────
export const createDriveSchema_wf = z.object({ placementSeasonId: z.string().min(1), companyId: z.string().min(1), jobPostingId: z.string().min(1), type: z.enum(['on_campus', 'virtual', 'pool', 'off_campus']).optional(), applicationWindow: z.object({ openDate: z.string().min(1), closeDate: z.string().min(1) }), driveDate: z.string().optional(), venue: z.string().optional(), virtualLink: z.string().optional() });
export const transitionDriveSchema = z.object({ status: z.string().min(1) });
export const cancelDriveSchema = z.object({ reason: z.string().min(1) });
export const applyToDriveSchema = z.object({ driveId: z.string().min(1), jobPostingId: z.string().min(1), studentId: z.string().min(1), resumeUrl: z.string().optional() });
export const withdrawApplicationSchema = z.object({ reason: z.string().min(1) });
export const scheduleInterviewsSchema = z.object({ slots: z.array(z.object({ studentId: z.string(), slotStart: z.string(), slotEnd: z.string(), venue: z.string().optional(), virtualLink: z.string().optional(), panelInfo: z.string().optional() })).min(1) });
export const updateInterviewOutcomeSchema = z.object({ status: z.enum(['scheduled', 'confirmed', 'rescheduled', 'completed', 'no_show', 'cancelled']), outcome: z.enum(['selected', 'not_selected', 'pending']).optional() });
export const checkEligibilitySchema = z.object({ studentId: z.string().min(1), jobPostingId: z.string().min(1) });

// ─── Offer ──────────────────────────────────────────────────
export const createOfferSchema_wf = z.object({ driveId: z.string().min(1), jobPostingId: z.string().min(1), studentId: z.string().min(1), companyId: z.string().min(1), packageLpa: z.number().min(0), role: z.string().optional(), location: z.string().optional(), bondTerms: z.string().optional(), responseDeadline: z.string().optional(), source: z.enum(['campus', 'off_campus', 'ppo']).optional() });
export const releaseOfferSchema = z.object({ dreamOfferId: z.string().min(1) });

// ─── Bar + Opt-Out ──────────────────────────────────────────
export const applyPlacementBarSchema = z.object({ studentId: z.string().min(1), reason: z.string().min(1), barType: z.enum(['disciplinary', 'academic_fraud', 'fee_default', 'other']), appliedBy: z.string().min(1) });
export const liftPlacementBarSchema = z.object({ liftedBy: z.string().min(1), liftConditions: z.string().optional() });
export const recordOptOutSchema = z.object({ studentId: z.string().min(1), placementSeasonId: z.string().min(1), reason: z.enum(['higher_education', 'entrepreneurship', 'family_business', 'personal', 'other']), reasonDetail: z.string().optional(), evidenceUrl: z.string().optional(), recordedBy: z.string().min(1) });
export const voidOptOutSchema = z.object({ voidReason: z.string().min(1) });

// ─── Career Profile ─────────────────────────────────────────
export const initCareerProfilesSchema = z.object({ placementSeasonId: z.string().min(1), studentIds: z.array(z.string()).min(1) });
export const updateCareerProfileSchema_wf = z.object({ careerPreferences: z.object({ targetRoles: z.array(z.string()).optional(), preferredLocations: z.array(z.string()).optional(), expectedCtcLpa: z.number().optional(), willingToRelocate: z.boolean().optional() }).optional(), cocurricularHighlights: z.array(z.object({ type: z.enum(['technical', 'sports', 'cultural', 'service', 'leadership']), title: z.string(), description: z.string(), rank: z.string().optional(), year: z.number() })).optional(), photoUrl: z.string().optional() });
export const validateProfileItemSchema = z.object({ itemIndex: z.number().int().min(0), validated: z.boolean() });
export const refreshAcademicDataSchema = z.object({ cgpa: z.number(), activeBacklogs: z.number().int(), lastResultSemester: z.number().int() });
export const computeBatchReadinessSchema = z.object({ placementSeasonId: z.string().min(1) });

// ─── Skill Records ──────────────────────────────────────────
export const createSkillRecordSchema = z.object({ studentId: z.string().min(1), skillName: z.string().min(1), category: z.enum(['aptitude', 'technical', 'soft_skills', 'domain']), source: z.enum(['assessment', 'training_assessment', 'self_reported', 'certification', 'mock_interview']), score: z.number().optional(), percentile: z.number().optional(), vendor: z.string().optional(), assessedAt: z.string().optional() });
export const updateSkillRecordSchema = createSkillRecordSchema.partial();
export const ingestExternalAssessmentSchema = z.object({ studentId: z.string().min(1), vendor: z.string().min(1), skills: z.array(z.object({ skillName: z.string(), category: z.enum(['aptitude', 'technical', 'soft_skills', 'domain']), score: z.number(), percentile: z.number().optional() })).min(1) });

// ─── Training ───────────────────────────────────────────────
export const updateTrainingSessionSchema_wf = z.object({ sessionIndex: z.number().int().min(0), status: z.enum(['conducted', 'cancelled']) });
export const recordTrainingAssessmentSchema = z.object({ trainingId: z.string().min(1), studentId: z.string().min(1), score: z.number(), skillName: z.string().min(1), skillCategory: z.enum(['aptitude', 'technical', 'soft_skills', 'domain']) });

// ─── Alumni Career ──────────────────────────────────────────
export const initAlumniCareerRecordSchema = z.object({ personId: z.string().min(1), alumniProfileId: z.string().min(1), currentEmployer: z.string().optional(), currentRole: z.string().optional(), ctcRange: z.string().optional(), industry: z.string().optional(), location: z.string().optional(), careerStatus: z.enum(['employed', 'seeking', 'higher_education', 'entrepreneur', 'unknown']).optional(), updateSource: z.enum(['system_seeded', 'self_report', 'tpo_entry', 'survey']) });
export const updateAlumniCareerRecordSchema = initAlumniCareerRecordSchema.partial();
export const batchInitAlumniSchema = z.object({ alumniProfiles: z.array(z.object({ personId: z.string(), alumniProfileId: z.string(), employer: z.string().optional(), role: z.string().optional() })).min(1) });
