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
