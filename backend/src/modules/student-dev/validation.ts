import { z } from 'zod';

// ═══ Club ══════════════════════════════════════════════════

export const createClubSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['technical', 'cultural', 'sports', 'literary', 'social_service', 'entrepreneurship']),
  description: z.string().optional(),
  coordinatorId: z.string().optional(),
  facultyAdvisorId: z.string().optional(),
  isActive: z.boolean().optional(),
});
export const updateClubSchema = createClubSchema.partial();

// ═══ Club Membership ═══════════════════════════════════════

export const createClubMembershipSchema = z.object({
  clubId: z.string().min(1),
  studentId: z.string().min(1),
  role: z.enum(['member', 'secretary', 'president', 'treasurer', 'lead']).optional(),
  joinedDate: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export const updateClubMembershipSchema = createClubMembershipSchema.partial();

// ═══ Event ═════════════════════════════════════════════════

export const createEventSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['technical', 'cultural', 'sports', 'workshop', 'hackathon', 'fest', 'seminar', 'guest_lecture']),
  clubId: z.string().optional(),
  departmentId: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  venue: z.string().optional(),
  budget: z.number().optional(),
  coordinatorId: z.string().optional(),
  status: z.enum(['planned', 'approved', 'ongoing', 'completed', 'cancelled']).optional(),
});
export const updateEventSchema = createEventSchema.partial();

// ═══ Event Registration ════════════════════════════════════

export const createEventRegistrationSchema = z.object({
  eventId: z.string().min(1),
  participantId: z.string().min(1),
  participantType: z.enum(['student', 'faculty', 'external']).optional(),
  teamName: z.string().optional(),
  registeredAt: z.string().optional(),
  status: z.enum(['registered', 'attended', 'winner', 'no_show']).optional(),
});
export const updateEventRegistrationSchema = createEventRegistrationSchema.partial();

// ═══ Achievement ═══════════════════════════════════════════

export const createAchievementSchema = z.object({
  studentId: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(['academic', 'technical', 'cultural', 'sports', 'social', 'entrepreneurship', 'other']),
  level: z.enum(['college', 'university', 'state', 'national', 'international']),
  date: z.string().min(1),
  description: z.string().optional(),
  certificateUrl: z.string().optional(),
  verifiedBy: z.string().optional(),
});
export const updateAchievementSchema = createAchievementSchema.partial();

// ═══ Mentoring ═════════════════════════════════════════════

export const createMentoringSchema = z.object({
  mentorId: z.string().min(1),
  menteeId: z.string().min(1),
  academicYearId: z.string().min(1),
  meetingDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'completed']).optional(),
});
export const updateMentoringSchema = createMentoringSchema.partial();

// ═══ Sports Team ═══════════════════════════════════════════

export const createSportsTeamSchema = z.object({
  sport: z.string().min(1),
  category: z.enum(['men', 'women', 'mixed']),
  coachId: z.string().optional(),
  captain: z.string().optional(),
  academicYearId: z.string().min(1),
});
export const updateSportsTeamSchema = createSportsTeamSchema.partial();

// ═══ Sports Team Member ════════════════════════════════════

export const createSportsTeamMemberSchema = z.object({
  teamId: z.string().min(1),
  studentId: z.string().min(1),
  position: z.string().optional(),
  joinedDate: z.string().optional(),
});
export const updateSportsTeamMemberSchema = createSportsTeamMemberSchema.partial();

// ═══ NSS Activity ══════════════════════════════════════════

export const createNSSActivitySchema = z.object({
  title: z.string().min(1),
  type: z.enum(['camp', 'blood_donation', 'awareness', 'tree_plantation', 'cleanliness', 'community_service', 'other']),
  date: z.string().min(1),
  venue: z.string().optional(),
  description: z.string().optional(),
  coordinatorId: z.string().optional(),
  participantCount: z.number().optional(),
  hours: z.number().min(0),
  status: z.enum(['planned', 'completed', 'cancelled']).optional(),
});
export const updateNSSActivitySchema = createNSSActivitySchema.partial();

// ═══ NSS Participant ═══════════════════════════════════════

export const createNSSParticipantSchema = z.object({
  activityId: z.string().min(1),
  studentId: z.string().min(1),
  hoursContributed: z.number().min(0),
  certificateIssued: z.boolean().optional(),
});
export const updateNSSParticipantSchema = createNSSParticipantSchema.partial();

// ═══ Skill Certification ══════════════════════════════════

export const createSkillCertificationSchema = z.object({
  studentId: z.string().min(1),
  certificationName: z.string().min(1),
  provider: z.string().min(1),
  completedDate: z.string().min(1),
  certificateUrl: z.string().optional(),
  credentialId: z.string().optional(),
  validUntil: z.string().optional(),
});
export const updateSkillCertificationSchema = createSkillCertificationSchema.partial();

// ═══ Student Project ═══════════════════════════════════════

export const createStudentProjectSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['mini_project', 'major_project', 'industry_project', 'research_project']),
  teamMembers: z.array(z.string()).optional(),
  guideId: z.string().optional(),
  semester: z.number().int().min(1),
  description: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  repoUrl: z.string().optional(),
  status: z.enum(['proposed', 'in_progress', 'completed', 'presented']).optional(),
  grade: z.string().optional(),
});
export const updateStudentProjectSchema = createStudentProjectSchema.partial();

// ═══ Community Project ════════════════════════════════════

export const createCommunityProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  leadStudentId: z.string().min(1),
  facultyMentorId: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  beneficiaries: z.string().optional(),
  status: z.enum(['proposed', 'approved', 'ongoing', 'completed']).optional(),
});
export const updateCommunityProjectSchema = createCommunityProjectSchema.partial();

// ═══ Leadership Role ══════════════════════════════════════

export const createLeadershipRoleSchema = z.object({
  studentId: z.string().min(1),
  role: z.string().min(1),
  body: z.enum(['student_council', 'club', 'department', 'hostel', 'nss', 'ncc', 'sports', 'cultural']),
  academicYearId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
});
export const updateLeadershipRoleSchema = createLeadershipRoleSchema.partial();

// ═══ W09 Workflow Schemas ═══════════════════════════════════

// ─── ORG ────────────────────────────────────────────────────
export const proposeClubSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['technical', 'cultural', 'sports', 'literary', 'social_service', 'entrepreneurship']),
  description: z.string().optional(),
  objectives: z.string().optional(),
  scope: z.enum(['club', 'department', 'institution']).optional(),
  foundingMembers: z.array(z.string()).min(5),
});
export const approveClubWfSchema = z.object({ approvedBy: z.string().min(1), facultyAdvisorId: z.string().min(1) });
export const rejectClubWfSchema = z.object({ rejectedReason: z.string().min(1) });
export const openRegistrationWindowSchema = z.object({ academicYearId: z.string().min(1), startDate: z.string().min(1), endDate: z.string().min(1) });
export const applyForMembershipSchema = z.object({ clubId: z.string().min(1), studentId: z.string().min(1) });
export const openElectionSchema = z.object({ positions: z.array(z.object({ role: z.string().min(1), body: z.string().min(1) })).min(1), academicYearId: z.string().optional() });
export const castVoteSchema = z.object({ electionId: z.string().min(1), candidateId: z.string().min(1), voterId: z.string().min(1) });
export const appointPositionSchema = z.object({ positionId: z.string().min(1), studentId: z.string().min(1), nominatedBy: z.string().min(1) });
export const transitionMembershipStatusSchema = z.object({ status: z.enum(['active', 'inactive', 'alumni']), exitReason: z.string().optional() });
export const submitAnnualReviewSchema = z.object({ reviewNotes: z.string().min(1) });
export const dissolveClubSchema = z.object({ reason: z.string().min(1) });

// ─── EVT: Fest ──────────────────────────────────────────────
export const proposeFestSchema = z.object({ name: z.string().min(1), type: z.enum(['technical', 'cultural', 'sports', 'literary', 'multi']), academicYearId: z.string().min(1), startDate: z.string().min(1), endDate: z.string().min(1), description: z.string().optional(), estimatedBudget: z.number().optional(), estimatedAttendance: z.number().optional(), proposedBy: z.string().min(1) });
export const approveFestSchema = z.object({ approvedBy: z.string().min(1) });
export const rejectFestSchema = z.object({ rejectedReason: z.string().min(1) });
export const updateFestLogisticsSchema = z.object({ orgCommittee: z.array(z.object({ personId: z.string(), role: z.string() })).optional(), venueBookingIds: z.array(z.string()).optional(), description: z.string().optional(), estimatedBudget: z.number().optional(), estimatedAttendance: z.number().optional() });
export const closeFestSchema = z.object({ actualAttendance: z.number().optional(), feedbackSummary: z.string().optional() });
export const cancelFestSchema = z.object({ reason: z.string().min(1) });
export const postponeFestSchema = z.object({ newStartDate: z.string().min(1), newEndDate: z.string().min(1), reason: z.string().min(1) });

// ─── EVT: Competition ───────────────────────────────────────
export const proposeCompetitionSchema = z.object({ name: z.string().min(1), type: z.enum(['hackathon', 'coding', 'quiz', 'debate', 'sports_match', 'cultural_performance', 'other']), parentType: z.enum(['fest', 'standalone', 'inter_college']), parentId: z.string().optional(), clubId: z.string().optional(), departmentId: z.string().optional(), startDate: z.string().min(1), endDate: z.string().min(1), venue: z.string().optional(), maxParticipants: z.number().optional(), teamSize: z.object({ min: z.number(), max: z.number() }).optional(), eligibilityCriteria: z.string().optional(), registrationDeadline: z.string().optional() });
export const approveCompetitionSchema = z.object({ approvedBy: z.string().min(1) });
export const registerForCompetitionSchema = z.object({ participantId: z.string().min(1), teamName: z.string().optional(), teamMembers: z.array(z.string()).optional() });
export const checkInSchema = z.object({ participantId: z.string().min(1), checkedInBy: z.string().min(1) });
export const declareResultsSchema = z.object({ results: z.array(z.object({ rank: z.number(), participantId: z.string(), teamName: z.string().optional(), score: z.number().optional() })).min(1) });

// ─── EVT: Workshop ──────────────────────────────────────────
export const proposeWorkshopSchema = z.object({ name: z.string().min(1), topic: z.string().min(1), parentType: z.enum(['fest', 'standalone', 'programme']), parentId: z.string().optional(), clubId: z.string().optional(), departmentId: z.string().optional(), instructorId: z.string().optional(), externalInstructor: z.object({ name: z.string(), affiliation: z.string(), bio: z.string().optional() }).optional(), date: z.string().min(1), duration: z.number().min(0.5), maxCapacity: z.number().optional(), completionCriteria: z.string().optional(), venue: z.string().optional(), materials: z.array(z.string()).optional() });
export const approveWorkshopSchema = z.object({ approvedBy: z.string().min(1) });
export const registerForWorkshopSchema = z.object({ participantId: z.string().min(1) });

// ─── EVT: Programme ─────────────────────────────────────────
export const createSDProgrammeSchema = z.object({ type: z.enum(['ncc', 'nss', 'nso', 'yrc', 'other']), name: z.string().min(1), academicYearId: z.string().min(1), officerId: z.string().min(1), capacity: z.number().optional(), startDate: z.string().min(1), endDate: z.string().min(1), description: z.string().optional() });
export const enrollInProgrammeSchema = z.object({ studentId: z.string().min(1) });
export const logProgrammeHoursSchema = z.object({ studentId: z.string().min(1), activityId: z.string().min(1), hours: z.number().min(0) });

// ─── ACH: Achievement Verification ─────────────────────────
export const autoCaptureAchievementSchema = z.object({ studentId: z.string().min(1), title: z.string().min(1), category: z.enum(['academic', 'technical', 'cultural', 'sports', 'social', 'entrepreneurship', 'other']), level: z.enum(['college', 'university', 'state', 'national', 'international']), date: z.string().min(1), source: z.literal('internal_event'), eventId: z.string().optional(), skillTags: z.array(z.string()).optional() });
export const claimExternalAchievementSchema = z.object({ studentId: z.string().min(1), title: z.string().min(1), category: z.enum(['academic', 'technical', 'cultural', 'sports', 'social', 'entrepreneurship', 'other']), level: z.enum(['college', 'university', 'state', 'national', 'international']), date: z.string().min(1), description: z.string().optional(), source: z.string().min(1), evidenceFiles: z.array(z.string()).optional() });
export const verifyAchievementSchema_wf = z.object({ reviewedBy: z.string().min(1) });
export const rejectAchievementSchema_wf = z.object({ rejectedReason: z.string().min(1), reviewedBy: z.string().min(1) });
export const syncExternalAchievementsSchema = z.object({ source: z.string().min(1), achievements: z.array(z.object({ studentId: z.string(), title: z.string(), category: z.string(), level: z.string(), date: z.string() })).min(1) });

// ─── ACH: Award ─────────────────────────────────────────────
export const createAwardSchema = z.object({ name: z.string().min(1), category: z.enum(['academic', 'sports', 'cultural', 'service', 'leadership', 'innovation']), level: z.enum(['department', 'institution']), description: z.string().optional(), criteria: z.string().optional() });
export const updateAwardSchema = createAwardSchema.partial();
export const nominateForAwardSchema = z.object({ awardId: z.string().min(1), studentId: z.string().min(1), academicYearId: z.string().min(1), nominatedBy: z.string().min(1), justification: z.string().optional() });
export const conferAwardSchema = z.object({ approvedBy: z.string().min(1) });

// ─── ACH: Certificate ──────────────────────────────────────
export const generateCertificateSchema = z.object({ type: z.enum(['participation', 'achievement', 'ncc_rank', 'nss_completion', 'award', 'workshop_completion']), studentId: z.string().min(1), sourceType: z.enum(['achievement', 'event', 'award', 'programme']), sourceId: z.string().min(1), templateId: z.string().optional(), generatedData: z.record(z.string()).optional(), signedBy: z.string().optional() });
export const issueCertificateSchema = z.object({ signedBy: z.string().min(1), fileUrl: z.string().optional() });

// ─── BUD: Budget ────────────────────────────────────────────
export const requestBudgetSchema = z.object({ entityType: z.enum(['club', 'event', 'fest', 'programme', 'pool']), entityId: z.string().optional(), academicYearId: z.string().min(1), requestedBy: z.string().min(1), requestedAmount: z.number().min(0), justification: z.string().optional(), lineItems: z.array(z.object({ category: z.string(), description: z.string(), estimatedAmount: z.number() })).min(1) });
export const approveBudgetSchema = z.object({ approvedBy: z.string().min(1), approvedAmount: z.number().optional() });
export const rejectBudgetSchema = z.object({ rejectedReason: z.string().min(1) });
export const recordExpenseSchema = z.object({ lineItemId: z.string().min(1), amount: z.number().min(0), transactionRef: z.string().optional() });
export const reconcileBudgetSchema = z.object({ varianceNotes: z.string().optional() });
export const allocateActivityFeePoolSchema = z.object({ academicYearId: z.string().min(1), amount: z.number().min(0), allocatedBy: z.string().min(1) });

// ─── BUD: Line Items ───────────────────────────────────────
export const createBudgetLineItemSchema = z.object({ budgetId: z.string().min(1), category: z.string().min(1), description: z.string().min(1), estimatedAmount: z.number().min(0) });
export const updateBudgetLineItemSchema = createBudgetLineItemSchema.partial();

// ─── BUD: Sponsor Contact ──────────────────────────────────
export const createSponsorContactSchema = z.object({ name: z.string().min(1), company: z.string().min(1), designation: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), notes: z.string().optional() });
export const updateSponsorContactSchema = createSponsorContactSchema.partial();

// ─── BUD: Sponsorship ──────────────────────────────────────
export const createSponsorshipSchema = z.object({ eventType: z.enum(['fest', 'event', 'competition']), eventId: z.string().min(1), sponsorContactId: z.string().min(1), type: z.enum(['cash', 'in_kind', 'mixed']), committedAmount: z.number().optional() });
export const updateSponsorshipStatusSchema = z.object({ status: z.enum(['prospective', 'approached', 'committed', 'received', 'fulfilled', 'withdrawn']), receivedAmount: z.number().optional(), deliverables: z.array(z.object({ description: z.string(), status: z.enum(['pending', 'delivered', 'partial']) })).optional() });

// ─── PORT: Portfolio ────────────────────────────────────────
export const assemblePortfolioSchema = z.object({ studentId: z.string().min(1) });
export const updatePortfolioEntrySchema_wf = z.object({ isFeatured: z.boolean().optional(), isHidden: z.boolean().optional(), displayOrder: z.number().optional(), description: z.string().optional(), title: z.string().optional() });
export const addManualEntrySchema = z.object({ portfolioId: z.string().min(1), section: z.string().min(1), title: z.string().min(1), description: z.string().optional(), skillTags: z.array(z.string()).optional(), date: z.string().optional(), evidenceUrls: z.array(z.string()).optional() });
export const publishPortfolioSchema = z.object({ studentId: z.string().min(1) });
export const unpublishPortfolioSchema = z.object({ studentId: z.string().min(1) });
