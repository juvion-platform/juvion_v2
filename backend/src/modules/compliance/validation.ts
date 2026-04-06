import { z } from 'zod';

// ═══ Accreditation Body ═════════════════════════════════════

export const createAccreditationBodySchema = z.object({
  name: z.string().min(1),
  acronym: z.string().min(1),
  website: z.string().optional(),
  type: z.enum(['naac', 'nba', 'nirf', 'abet', 'aicte', 'ugc', 'other']),
});
export const updateAccreditationBodySchema = createAccreditationBodySchema.partial();

// ═══ Accreditation Cycle ════════════════════════════════════

export const createAccreditationCycleSchema = z.object({
  bodyId: z.string().min(1),
  cycle: z.number().int().min(1),
  applicationDate: z.string().optional(),
  visitDate: z.string().optional(),
  grade: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  status: z.enum(['preparing', 'applied', 'visit_scheduled', 'visited', 'accredited', 'expired']).optional(),
});
export const updateAccreditationCycleSchema = createAccreditationCycleSchema.partial();

// ═══ Compliance Criteria ════════════════════════════════════

export const createComplianceCriteriaSchema = z.object({
  accreditationCycleId: z.string().min(1),
  criterionNumber: z.string().min(1),
  title: z.string().min(1),
  maxScore: z.number().min(0),
  selfScore: z.number().optional(),
  peerScore: z.number().optional(),
  evidence: z.array(z.object({ description: z.string(), fileUrl: z.string().optional() })).optional(),
  status: z.enum(['not_started', 'in_progress', 'submitted', 'reviewed']).optional(),
});
export const updateComplianceCriteriaSchema = createComplianceCriteriaSchema.partial();

// ═══ Regulatory Filing ══════════════════════════════════════

export const createRegulatoryFilingSchema = z.object({
  body: z.enum(['aicte', 'ugc', 'jntu', 'state_govt', 'mhrd', 'other']),
  filingType: z.string().min(1),
  dueDate: z.string().min(1),
  filedDate: z.string().optional(),
  referenceNumber: z.string().optional(),
  documentUrl: z.string().optional(),
  status: z.enum(['upcoming', 'in_progress', 'filed', 'overdue', 'approved', 'rejected']).optional(),
});
export const updateRegulatoryFilingSchema = createRegulatoryFilingSchema.partial();

// ═══ AICTE Approval ═════════════════════════════════════════

export const createAICTEApprovalSchema = z.object({
  academicYearId: z.string().min(1),
  applicationId: z.string().optional(),
  approvalDate: z.string().optional(),
  approvedIntake: z.array(z.object({
    programmeId: z.string().min(1),
    branchId: z.string().min(1),
    intake: z.number().int().min(0),
  })).optional(),
  eoa: z.string().optional(),
  status: z.enum(['applied', 'inspection', 'approved', 'conditional', 'rejected']).optional(),
});
export const updateAICTEApprovalSchema = createAICTEApprovalSchema.partial();

// ═══ Affiliation Status ═════════════════════════════════════

export const createAffiliationStatusSchema = z.object({
  universityName: z.string().min(1),
  affiliationNumber: z.string().optional(),
  validFrom: z.string().min(1),
  validTo: z.string().min(1),
  programmes: z.array(z.string()).optional(),
  status: z.enum(['active', 'expired', 'renewal_pending', 'revoked']).optional(),
});
export const updateAffiliationStatusSchema = createAffiliationStatusSchema.partial();

// ═══ Audit Finding ══════════════════════════════════════════

export const createAuditFindingSchema = z.object({
  auditType: z.enum(['internal', 'external', 'naac', 'nba', 'iso', 'financial']),
  auditorName: z.string().min(1),
  auditDate: z.string().min(1),
  finding: z.string().min(1),
  severity: z.enum(['observation', 'minor_nc', 'major_nc', 'critical']),
  department: z.string().optional(),
  correctionAction: z.string().optional(),
  correctionDeadline: z.string().optional(),
  status: z.enum(['open', 'action_taken', 'verified', 'closed']).optional(),
});
export const updateAuditFindingSchema = createAuditFindingSchema.partial();

// ═══ IQAC Report ════════════════════════════════════════════

export const createIQACReportSchema = z.object({
  academicYearId: z.string().min(1),
  reportType: z.enum(['aqar', 'ssr', 'annual_report', 'best_practices', 'feedback_analysis']),
  data: z.record(z.any()).optional(),
  submittedDate: z.string().optional(),
  status: z.enum(['draft', 'review', 'submitted', 'accepted']).optional(),
});
export const updateIQACReportSchema = createIQACReportSchema.partial();

// ═══ RTI Request ════════════════════════════════════════════

export const createRTIRequestSchema = z.object({
  applicantName: z.string().min(1),
  applicationDate: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().optional(),
  feeReceived: z.number().min(0).optional(),
  assignedTo: z.string().optional(),
  responseDate: z.string().optional(),
  response: z.string().optional(),
  appealFiled: z.boolean().optional(),
  status: z.enum(['received', 'processing', 'responded', 'appeal', 'closed']).optional(),
});
export const updateRTIRequestSchema = createRTIRequestSchema.partial();

// ═══ Legal Case ═════════════════════════════════════════════

export const createLegalCaseSchema = z.object({
  caseNumber: z.string().min(1),
  courtName: z.string().min(1),
  caseType: z.enum(['civil', 'criminal', 'consumer', 'labour', 'writ', 'other']),
  filedDate: z.string().min(1),
  opposingParty: z.string().min(1),
  description: z.string().optional(),
  lawyerName: z.string().optional(),
  nextHearingDate: z.string().optional(),
  status: z.enum(['active', 'hearing', 'stayed', 'disposed', 'closed']).optional(),
  outcome: z.string().optional(),
});
export const updateLegalCaseSchema = createLegalCaseSchema.partial();
