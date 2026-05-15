import { z } from 'zod';

// ═══ Committee ══════════════════════════════════════════

export const createCommitteeSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['statutory', 'academic', 'administrative', 'disciplinary', 'grievance', 'anti_ragging', 'icc', 'iqac', 'other']),
  purpose: z.string().optional(),
  chairpersonId: z.string().optional(),
  members: z.array(z.object({
    personId: z.string().min(1),
    role: z.string().optional(),
  })).optional(),
  formedDate: z.string().min(1),
  isActive: z.boolean().optional(),
});
export const updateCommitteeSchema = createCommitteeSchema.partial();

// ═══ Committee Meeting ══════════════════════════════════

export const createMeetingSchema = z.object({
  committeeId: z.string().min(1),
  meetingDate: z.string().min(1),
  agenda: z.string().min(1),
  minutes: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  decisions: z.array(z.string()).optional(),
  nextMeetingDate: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
});
export const updateMeetingSchema = createMeetingSchema.partial();

// ═══ Policy ═════════════════════════════════════════════

export const createPolicySchema = z.object({
  title: z.string().min(1),
  category: z.enum(['academic', 'hr', 'finance', 'student', 'hostel', 'it', 'safety', 'other']),
  description: z.string().optional(),
  documentUrl: z.string().optional(),
  version: z.number().int().optional(),
  effectiveDate: z.string().min(1),
  approvedBy: z.string().optional(),
  status: z.enum(['draft', 'approved', 'active', 'retired']).optional(),
});
export const updatePolicySchema = createPolicySchema.partial();

// ═══ Governing Body Member ══════════════════════════════

export const createBoardMemberSchema = z.object({
  personId: z.string().optional(),
  externalName: z.string().optional(),
  designation: z.string().min(1),
  role: z.enum(['chairperson', 'secretary', 'member', 'nominee', 'invitee']),
  appointedDate: z.string().min(1),
  tenure: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export const updateBoardMemberSchema = createBoardMemberSchema.partial();

// ═══ Strategic Goal ═════════════════════════════════════

export const createGoalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(['academic_excellence', 'research', 'infrastructure', 'placement', 'accreditation', 'outreach', 'revenue']),
  targetDate: z.string().min(1),
  kpis: z.array(z.object({
    metric: z.string().min(1),
    target: z.number(),
    current: z.number().optional(),
  })).optional(),
  ownerId: z.string().optional(),
  status: z.enum(['active', 'achieved', 'on_track', 'at_risk', 'missed']).optional(),
});
export const updateGoalSchema = createGoalSchema.partial();

// ═══ 003-ai-nl-report-queries ═══════════════════════════

export const nlQuerySchema = z.object({
  question: z.string().trim().min(1, 'Question required').max(500, 'Question too long (max 500 chars)'),
}).strict();

export const nlStatsRangeSchema = z.enum(['today', 'week', 'month']);
