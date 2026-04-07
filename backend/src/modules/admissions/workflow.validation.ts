import { z } from 'zod';

// ─── Workflow Engine ────────────────────────────────────────

export const startWorkflowSchema = z.object({
  workflowId: z.string().default('W01'),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  academicYearId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const completeTaskSchema = z.object({
  result: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

export const failOrSkipTaskSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

// ─── Lead Interactions ──────────────────────────────────────

export const createLeadInteractionSchema = z.object({
  type: z.enum(['phone_call', 'whatsapp', 'sms', 'email', 'walk_in', 'campus_visit', 'ai_conversation']),
  direction: z.enum(['inbound', 'outbound']),
  channel: z.enum(['manual', 'automated', 'ai']).optional(),
  summary: z.string().min(1, 'Summary is required'),
  outcome: z.enum(['interested', 'callback_requested', 'not_interested', 'no_response', 'visit_scheduled', 'converted']).optional(),
  scheduledAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationMinutes: z.number().min(0).optional(),
  aiGenerated: z.boolean().optional(),
});

// ─── Import Batches ─────────────────────────────────────────

export const createImportBatchSchema = z.object({
  source: z.enum(['eamcet', 'ecet', 'manual_csv', 'website']),
  fileName: z.string().optional(),
  academicYearId: z.string().optional(),
  totalRecords: z.number().min(0).optional(),
  metadata: z.record(z.any()).optional(),
});

// ─── Seat Inventory ─────────────────────────────────────────

export const upsertSeatInventorySchema = z.object({
  academicYearId: z.string().min(1),
  programmeId: z.string().min(1),
  branchId: z.string().min(1),
  sanctionedIntake: z.number().min(0),
  convenerSeats: z.number().min(0).optional(),
  managementSeats: z.number().min(0).optional(),
  nriSeats: z.number().min(0).optional(),
  spotSeats: z.number().min(0).optional(),
  lateralEntrySeats: z.number().min(0).optional(),
  status: z.enum(['draft', 'published', 'frozen']).optional(),
});

// ─── Allotment Rounds ───────────────────────────────────────

export const createAllotmentRoundSchema = z.object({
  academicYearId: z.string().min(1),
  roundNumber: z.number().min(1),
  name: z.string().min(1),
  type: z.enum(['management', 'spot', 'lateral']),
  criteria: z.object({
    sortBy: z.enum(['merit_score', 'eamcet_rank', 'inter_percentage']).optional(),
    programmeIds: z.array(z.string()).optional(),
    branchIds: z.array(z.string()).optional(),
    quotas: z.array(z.string()).optional(),
  }).optional(),
  applicationDeadline: z.string().optional(),
  publishDate: z.string().optional(),
  acceptanceDeadline: z.string().optional(),
});

export const updateAllotmentRoundSchema = createAllotmentRoundSchema.partial();

// ─── Allotment Results ──────────────────────────────────────

export const createAllotmentResultSchema = z.object({
  allotmentRoundId: z.string().min(1),
  applicantId: z.string().min(1),
  meritRank: z.number().min(1),
  meritScore: z.number().min(0),
  allottedProgrammeId: z.string().optional(),
  allottedBranchId: z.string().optional(),
  preferenceNumber: z.number().optional(),
  status: z.enum(['allotted', 'waitlisted', 'not_eligible']).optional(),
});

export const updateAllotmentResultSchema = z.object({
  status: z.enum(['allotted', 'waitlisted', 'not_eligible', 'accepted', 'declined', 'lapsed']).optional(),
  declineReason: z.string().optional(),
});

// ─── Waitlist ───────────────────────────────────────────────

export const addToWaitlistSchema = z.object({
  academicYearId: z.string().min(1),
  applicantId: z.string().min(1),
  programmeId: z.string().min(1),
  branchId: z.string().min(1),
  waitlistPosition: z.number().min(1),
  meritScore: z.number().min(0),
  quota: z.enum(['convener', 'management', 'nri', 'spot']),
  expiresAt: z.string().optional(),
});

// ─── Fee Negotiations ───────────────────────────────────────

export const createFeeNegotiationSchema = z.object({
  applicantId: z.string().min(1),
  offerId: z.string().min(1),
  originalFee: z.number().min(0),
  requestedWaiver: z.number().min(0),
  requestedReason: z.string().min(1, 'Reason is required'),
});

export const resolveFeeNegotiationSchema = z.object({
  status: z.enum(['approved', 'rejected', 'counter_offered']),
  approvedWaiver: z.number().min(0).optional(),
  finalFee: z.number().min(0).optional(),
  counterOffer: z.number().min(0).optional(),
  notes: z.string().optional(),
});

// ─── Cancellations ──────────────────────────────────────────

export const createCancellationSchema = z.object({
  admissionId: z.string().optional(),
  applicantId: z.string().min(1),
  studentId: z.string().optional(),
  cancellationType: z.enum(['pre_enrolment', 'post_enrolment', 'convener_surrender']),
  reason: z.string().min(1, 'Reason is required'),
  reasonCategory: z.enum(['student_request', 'fee_default', 'document_fraud', 'disciplinary', 'convener_reallocation']),
  refundAmount: z.number().min(0).optional(),
});

export const updateCancellationSchema = z.object({
  status: z.enum(['requested', 'approved', 'in_progress', 'completed', 'rejected']).optional(),
  approvedBy: z.string().optional(),
  refundStatus: z.enum(['not_applicable', 'pending', 'processed', 'failed']).optional(),
  notes: z.string().optional(),
});
