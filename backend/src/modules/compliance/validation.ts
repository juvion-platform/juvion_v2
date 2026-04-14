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

// ═══ W07 Workflow Schemas ═══════════════════════════════════

// ─── Evidence Types ─────────────────────────────────────────
export const createEvidenceTypeSchema = z.object({ name: z.string().min(1), code: z.string().min(1), sourceModule: z.string().min(1), category: z.enum(['academic', 'research', 'infrastructure', 'financial', 'governance', 'student_support', 'faculty', 'outreach']), collectionMethod: z.enum(['event_driven', 'periodic_sync', 'manual']), requiredComponents: z.array(z.string()).optional(), applicableBodies: z.array(z.string()).optional() });
export const updateEvidenceTypeSchema = createEvidenceTypeSchema.partial();

// ─── Collection Rules ───────────────────────────────────────
export const createCollectionRuleSchema = z.object({ evidenceTypeId: z.string().min(1), triggerEvent: z.string().optional(), syncSchedule: z.string().optional(), qualityThresholds: z.object({ minPresenceScore: z.number().optional(), minCompletenessScore: z.number().optional(), maxAgeDays: z.number().optional() }).optional() });
export const updateCollectionRuleSchema = createCollectionRuleSchema.partial();

// ─── Evidence Records ───────────────────────────────────────
export const uploadEvidenceSchema = z.object({ evidenceTypeId: z.string().optional(), title: z.string().min(1), description: z.string().min(1), fileUrl: z.string().min(1), academicYearId: z.string().optional(), programmeId: z.string().optional(), departmentId: z.string().optional(), sourceModule: z.string().optional(), sourceEntityType: z.string().optional(), sourceEntityId: z.string().optional() });
export const overrideQualitySchema = z.object({ reason: z.string().min(1) });

// ─── Criterion Mappings ─────────────────────────────────────
export const createCriterionMappingSchema = z.object({ criterionId: z.string().min(1), evidenceTypeId: z.string().min(1), contributionWeight: z.number().min(0).max(100).optional(), isMandatory: z.boolean().optional(), notes: z.string().optional() });
export const updateCriterionMappingSchema = createCriterionMappingSchema.partial();

// ─── Assessment Rubrics ─────────────────────────────────────
export const createRubricSchema = z.object({ criterionId: z.string().min(1), bodyId: z.string().min(1), gradeDescriptors: z.array(z.object({ grade: z.string(), minScore: z.number(), maxScore: z.number(), description: z.string() })), scoringMethod: z.enum(['quantitative', 'qualitative', 'mixed']), maxScore: z.number(), weightageInOverall: z.number(), version: z.string().min(1) });
export const updateRubricSchema = createRubricSchema.partial();

// ─── Criteria Enhancement ───────────────────────────────────
export const interpretCriterionSchema = z.object({ interpretationNotes: z.string().min(1), isAmbiguous: z.boolean().optional() });
export const loadFrameworkSchema = z.object({ bodyId: z.string().min(1), criteria: z.array(z.object({ criterionNumber: z.string(), title: z.string(), level: z.string().optional(), parentCriterionId: z.string().optional(), keyIndicators: z.array(z.string()).optional(), weightage: z.number().optional() })).min(1) });

// ─── Readiness ──────────────────────────────────────────────
export const computeReadinessSchema = z.object({ bodyId: z.string().min(1), programmeId: z.string().optional() });
export const createSnapshotSchema = z.object({ bodyId: z.string().min(1), programmeId: z.string().optional(), trigger: z.enum(['manual', 'cycle_start', 'scheduled', 'pre_submission']), createdBy: z.string().min(1) });

// ─── Gaps ───────────────────────────────────────────────────
export const detectGapsSchema = z.object({ bodyId: z.string().min(1) });
export const assignGapSchema = z.object({ assignedTo: z.string().min(1) });
export const updateGapPrioritySchema = z.object({ priority: z.number().min(0).max(100) });

// ─── Remediation ────────────────────────────────────────────
export const createRemediationPlanSchema = z.object({ bodyId: z.string().min(1), accreditationCycleId: z.string().optional(), title: z.string().min(1), targetCompletionDate: z.string().min(1), tasks: z.array(z.object({ gapRecordId: z.string().optional(), description: z.string(), assignedTo: z.string().optional(), dueDate: z.string(), priority: z.enum(['critical', 'high', 'medium', 'low']) })).min(1), createdBy: z.string().min(1) });
export const updateRemediationPlanSchema = z.object({ title: z.string().optional(), targetCompletionDate: z.string().optional(), effectiveness: z.string().optional(), lessonsLearned: z.string().optional() });
export const updateRemediationTaskSchema = z.object({ status: z.enum(['pending', 'in_progress', 'completed', 'stalled', 'verified', 'cancelled']).optional(), progress: z.number().min(0).max(100).optional(), milestones: z.array(z.string()).optional() });
export const verifyRemediationTaskSchema = z.object({ verifiedBy: z.string().min(1) });
export const closeRemediationPlanSchema = z.object({ effectiveness: z.string().optional(), lessonsLearned: z.string().optional() });

// ─── Report Templates ───────────────────────────────────────
export const createReportTemplateSchema = z.object({ bodyId: z.string().min(1), reportType: z.enum(['naac_ssr', 'nba_sar', 'aicte_annual', 'aishe_return', 'university_affiliation']), version: z.string().min(1), sections: z.array(z.object({ sectionNumber: z.number(), title: z.string(), sectionType: z.enum(['narrative', 'data_table', 'metric', 'evidence_list', 'mixed']), criterionId: z.string().optional(), description: z.string().optional(), requiredFields: z.array(z.string()).optional(), formatInstructions: z.string().optional() })) });

// ─── Reports ────────────────────────────────────────────────
export const initiateReportSchema = z.object({ bodyId: z.string().min(1), accreditationCycleId: z.string().min(1), programmeId: z.string().optional(), reportType: z.enum(['naac_ssr', 'nba_sar', 'aicte_annual', 'aishe_return', 'university_affiliation']), templateId: z.string().optional(), assessmentPeriod: z.object({ from: z.string(), to: z.string() }) });
export const updateSectionSchema = z.object({ content: z.string().optional(), tables: z.any().optional(), evidenceRecordIds: z.array(z.string()).optional() });
export const reviewSectionSchema = z.object({ reviewedBy: z.string().min(1), reviewNotes: z.string().optional() });
export const approveSectionSchema = z.object({ approvedBy: z.string().min(1) });
export const requestRevisionSchema = z.object({ reviewNotes: z.string().min(1) });
export const approveReportSchema = z.object({ approvedBy: z.string().min(1) });
export const submitReportSchema = z.object({ submissionReference: z.string().optional() });

// ─── Deadlines + Visit ──────────────────────────────────────
export const createDeadlineSchema = z.object({ body: z.string().min(1), filingType: z.string().min(1), dueDate: z.string().min(1), responsiblePersonId: z.string().optional(), linkedReportId: z.string().optional() });
export const updateDeadlineSchema = createDeadlineSchema.partial();
export const acknowledgeDeadlineSchema = z.object({ personId: z.string().min(1), alertLevel: z.string().min(1) });
export const recordVisitOutcomeSchema = z.object({ grade: z.string().optional(), validityPeriod: z.string().optional(), observations: z.string().optional(), assessorRecommendations: z.string().optional(), findings: z.array(z.object({ finding: z.string(), severity: z.string(), correctionAction: z.string().optional() })).optional() });
export const transitionCycleSchema = z.object({ status: z.string().min(1) });
