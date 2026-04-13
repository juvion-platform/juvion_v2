import { z } from 'zod';

// ═══ Employee ════════════════════════════════════════════

export const createEmployeeSchema = z.object({
  personId: z.string().min(1),
  employeeId: z.string().min(1),
  departmentId: z.string().min(1),
  designation: z.string().min(1),
  employeeType: z.enum(['teaching', 'non_teaching', 'contract', 'visiting', 'adjunct']),
  joiningDate: z.string().min(1),
  reportingToId: z.string().optional(),
  status: z.enum(['active', 'on_leave', 'resigned', 'retired', 'terminated']).optional(),
});
export const updateEmployeeSchema = createEmployeeSchema.partial();

// ═══ Leave Type ══════════════════════════════════════════

export const createLeaveTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  maxDaysPerYear: z.number().min(0),
  isCarryForward: z.boolean().optional(),
  maxCarryForward: z.number().optional(),
  applicableTo: z.array(z.enum(['teaching', 'non_teaching', 'contract', 'all'])),
});
export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

// ═══ Leave Application ═══════════════════════════════════

export const createLeaveApplicationSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  days: z.number().min(0),
  reason: z.string().min(1),
  status: z.enum(['applied', 'approved', 'rejected', 'cancelled']).optional(),
  approvedBy: z.string().optional(),
  remarks: z.string().optional(),
});
export const updateLeaveApplicationSchema = createLeaveApplicationSchema.partial();

// ═══ Leave Balance ═══════════════════════════════════════

export const createLeaveBalanceSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  academicYearId: z.string().min(1),
  entitled: z.number().min(0),
  taken: z.number().min(0).optional(),
  balance: z.number(),
});
export const updateLeaveBalanceSchema = createLeaveBalanceSchema.partial();

// ═══ Employee Attendance ═════════════════════════════════

export const createEmployeeAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(['present', 'absent', 'half_day', 'on_duty', 'leave', 'holiday']),
  source: z.enum(['biometric', 'manual', 'app']).optional(),
});
export const updateEmployeeAttendanceSchema = createEmployeeAttendanceSchema.partial();

// ═══ Pay Structure ═══════════════════════════════════════

export const createPayStructureSchema = z.object({
  employeeId: z.string().min(1),
  basicPay: z.number().min(0),
  hra: z.number().min(0).optional(),
  da: z.number().min(0).optional(),
  otherAllowances: z.number().min(0).optional(),
  pfContribution: z.number().min(0).optional(),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional(),
});
export const updatePayStructureSchema = createPayStructureSchema.partial();

// ═══ Payroll ═════════════════════════════════════════════

export const createPayrollSchema = z.object({
  employeeId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  basicPay: z.number().min(0),
  hra: z.number().min(0).optional(),
  da: z.number().min(0).optional(),
  otherAllowances: z.number().min(0).optional(),
  grossPay: z.number().min(0),
  pf: z.number().min(0).optional(),
  esi: z.number().min(0).optional(),
  tds: z.number().min(0).optional(),
  otherDeductions: z.number().min(0).optional(),
  netPay: z.number().min(0),
  status: z.enum(['draft', 'processed', 'paid', 'hold']).optional(),
  paidDate: z.string().optional(),
});
export const updatePayrollSchema = createPayrollSchema.partial();

// ═══ Appraisal ═══════════════════════════════════════════

export const createAppraisalSchema = z.object({
  employeeId: z.string().min(1),
  academicYearId: z.string().min(1),
  reviewerId: z.string().min(1),
  selfRating: z.number().optional(),
  reviewerRating: z.number().optional(),
  finalRating: z.number().optional(),
  status: z.enum(['initiated', 'self_review', 'reviewer_review', 'completed']).optional(),
});
export const updateAppraisalSchema = createAppraisalSchema.partial();

// ═══ Promotion ═══════════════════════════════════════════

export const createPromotionSchema = z.object({
  employeeId: z.string().min(1),
  fromDesignation: z.string().min(1),
  toDesignation: z.string().min(1),
  fromPayScale: z.number().min(0).optional(),
  toPayScale: z.number().min(0).optional(),
  effectiveDate: z.string().min(1),
  remarks: z.string().optional(),
  approvedBy: z.string().optional(),
  status: z.enum(['proposed', 'approved', 'implemented', 'rejected']).optional(),
});
export const updatePromotionSchema = createPromotionSchema.partial();

// ═══ Training ════════════════════════════════════════════

export const createTrainingSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['fdp', 'workshop', 'seminar', 'conference', 'orientation', 'skill_development']),
  conductedBy: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  venue: z.string().optional(),
  maxParticipants: z.number().int().optional(),
  status: z.enum(['planned', 'ongoing', 'completed', 'cancelled']).optional(),
});
export const updateTrainingSchema = createTrainingSchema.partial();

// ═══ Training Participant ════════════════════════════════

export const createTrainingParticipantSchema = z.object({
  trainingId: z.string().min(1),
  employeeId: z.string().min(1),
  status: z.enum(['nominated', 'confirmed', 'attended', 'absent']).optional(),
  feedbackRating: z.number().optional(),
  certificateIssued: z.boolean().optional(),
});
export const updateTrainingParticipantSchema = createTrainingParticipantSchema.partial();

// ═══ Qualification ═══════════════════════════════════════

export const createQualificationSchema = z.object({
  personId: z.string().min(1),
  degree: z.string().min(1),
  specialization: z.string().optional(),
  university: z.string().min(1),
  yearOfPassing: z.number().int(),
  percentage: z.number().optional(),
  cgpa: z.number().optional(),
  isHighest: z.boolean().optional(),
});
export const updateQualificationSchema = createQualificationSchema.partial();

// ═══ Grievance ═══════════════════════════════════════════

export const createGrievanceSchema = z.object({
  raisedBy: z.string().min(1),
  category: z.enum(['salary', 'workplace', 'harassment', 'facilities', 'policy', 'other']),
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedTo: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'escalated']).optional(),
  resolution: z.string().optional(),
});
export const updateGrievanceSchema = createGrievanceSchema.partial();

// ═══ On Duty ═════════════════════════════════════════════

export const createOnDutySchema = z.object({
  employeeId: z.string().min(1),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  purpose: z.string().min(1),
  venue: z.string().optional(),
  status: z.enum(['applied', 'approved', 'rejected']).optional(),
  approvedBy: z.string().optional(),
});
export const updateOnDutySchema = createOnDutySchema.partial();

// ═══ Exit Process ════════════════════════════════════════

export const createExitProcessSchema = z.object({
  employeeId: z.string().min(1),
  exitType: z.enum(['resignation', 'retirement', 'termination', 'contract_end']),
  lastWorkingDate: z.string().min(1),
  reason: z.string().min(1),
  exitInterviewDone: z.boolean().optional(),
  status: z.enum(['initiated', 'in_progress', 'completed']).optional(),
});
export const updateExitProcessSchema = createExitProcessSchema.partial();

// ═══ Recruitment ═════════════════════════════════════════

export const createRecruitmentSchema = z.object({
  position: z.string().min(1),
  departmentId: z.string().min(1),
  vacancies: z.number().int().min(1),
  qualifications: z.string().min(1),
  experience: z.string().optional(),
  salary: z.string().optional(),
  lastDate: z.string().min(1),
  status: z.enum(['open', 'closed', 'on_hold', 'filled']).optional(),
});
export const updateRecruitmentSchema = createRecruitmentSchema.partial();

// ═══ Job Application ═════════════════════════════════════

export const createJobApplicationSchema = z.object({
  recruitmentId: z.string().min(1),
  applicantName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  resumeUrl: z.string().optional(),
  experience: z.number().optional(),
  currentDesignation: z.string().optional(),
  status: z.enum(['applied', 'shortlisted', 'interview', 'selected', 'rejected', 'joined']).optional(),
  interviewDate: z.string().optional(),
  interviewRemarks: z.string().optional(),
});
export const updateJobApplicationSchema = createJobApplicationSchema.partial();

// ═══ Publication ═════════════════════════════════════════

export const createPublicationSchema = z.object({
  facultyId: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['journal', 'conference', 'book', 'book_chapter', 'patent']),
  journalName: z.string().optional(),
  conferenceName: z.string().optional(),
  publishedDate: z.string().optional(),
  doi: z.string().optional(),
  impactFactor: z.number().optional(),
  indexing: z.enum(['scopus', 'sci', 'wos', 'ugc_care', 'other']).optional(),
});
export const updatePublicationSchema = createPublicationSchema.partial();

// ═══ Research Project ════════════════════════════════════

export const createResearchProjectSchema = z.object({
  title: z.string().min(1),
  principalInvestigatorId: z.string().min(1),
  coInvestigators: z.array(z.string()).optional(),
  fundingAgency: z.string().optional(),
  sanctionedAmount: z.number().min(0).optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  status: z.enum(['proposed', 'sanctioned', 'ongoing', 'completed', 'terminated']).optional(),
});
export const updateResearchProjectSchema = createResearchProjectSchema.partial();

// ═══════════════════════════════════════════════════════════
// W05 Phase 1 — Leave & Attendance Workflow Schemas
// ═══════════════════════════════════════════════════════════

// ─── Leave Workflow ─────────────────────────────────────────

export const submitLeaveSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  days: z.number().min(0.5),
  reason: z.string().min(1),
  isHalfDay: z.boolean().optional(),
  documentUrl: z.string().optional(),
});

export const compOffSchema = z.object({
  employeeId: z.string().min(1),
  workedDate: z.string().min(1),
  reason: z.string().min(1),
});

export const annualResetSchema = z.object({
  academicYearId: z.string().min(1),
  newAcademicYearId: z.string().min(1),
});

export const initBalanceSchema = z.object({
  employeeId: z.string().min(1),
  academicYearId: z.string().min(1),
  joiningDate: z.string().min(1),
});

// ─── Attendance Workflow ────────────────────────────────────

export const biometricSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  source: z.enum(['biometric', 'manual', 'app']).optional(),
});

export const odSchema = z.object({
  employeeId: z.string().min(1),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  purpose: z.string().min(1),
  venue: z.string().optional(),
  documentUrl: z.string().optional(),
});

export const correctionSchema = z.object({
  correctionReason: z.string().min(1),
  requestedStatus: z.enum(['present', 'absent', 'half_day', 'on_duty', 'leave', 'holiday']),
});

// ─── Attendance Anomaly CRUD ────────────────────────────────

export const createAttendanceAnomalySchema = z.object({
  employeeId: z.string().min(1),
  anomalyType: z.enum(['chronic_late', 'missing_swipe', 'irregular_pattern']),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  details: z.object({
    lateCount: z.number().optional(),
    missedCheckouts: z.number().optional(),
    patternDescription: z.string().optional(),
  }).optional(),
  severity: z.enum(['info', 'warning', 'critical']),
  referredToDisciplinary: z.boolean().optional(),
  disciplinaryCaseId: z.string().optional(),
});
export const updateAttendanceAnomalySchema = createAttendanceAnomalySchema.partial();

// ─── Attendance Monthly Summary CRUD ────────────────────────

export const createAttendanceMonthlySummarySchema = z.object({
  employeeId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  totalPresent: z.number().min(0).optional(),
  totalAbsent: z.number().min(0).optional(),
  totalLate: z.number().min(0).optional(),
  totalHalfDay: z.number().min(0).optional(),
  totalOnDuty: z.number().min(0).optional(),
  totalLeave: z.number().min(0).optional(),
  totalHoliday: z.number().min(0).optional(),
  lopDays: z.number().min(0).optional(),
  isLocked: z.boolean().optional(),
});
export const updateAttendanceMonthlySummarySchema = createAttendanceMonthlySummarySchema.partial();

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 3 — FDP Tracking & Appraisal Schemas
// ═══════════════════════════════════════════════════════════════════

// ─── FDP Workflow ─────────────────────────────────────────────────

export const submitFDPCertificateSchema = z.object({
  facultyId: z.string().min(1),
  activityType: z.enum(['fdp', 'workshop', 'seminar', 'conference', 'certification']),
  title: z.string().min(1),
  organiser: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  hours: z.number().min(0),
  certificateUrl: z.string().optional(),
  complianceYear: z.number().int(),
});

export const verifyFDPSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  remarks: z.string().optional(),
});

export const computeComplianceSchema = z.object({
  facultyId: z.string().min(1),
  academicYearId: z.string().min(1),
});

// ─── Appraisal Workflow ───────────────────────────────────────────

export const selfAssessmentSchema = z.object({
  selfRating: z.number().min(0).max(10),
  selfAssessmentData: z.record(z.unknown()),
});

export const reviewerAssessmentSchema = z.object({
  reviewerRating: z.number().min(0).max(10),
  reviewerComments: z.string().min(1),
});

export const moderateSchema = z.object({
  moderationAdjustment: z.number(),
});

export const disputeSchema = z.object({
  disputeText: z.string().min(1),
});

export const resolveDisputeSchema = z.object({
  resolution: z.enum(['confirmed', 'revised']),
  revisedRating: z.number().optional(),
});

// ─── Appraisal Cycle CRUD ─────────────────────────────────────────

export const createAppraisalCycleSchema = z.object({
  academicYearId: z.string().min(1),
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  selfAssessmentDeadline: z.string().min(1),
  reviewerDeadline: z.string().min(1),
  moderationDeadline: z.string().min(1),
  applicableTo: z.enum(['faculty', 'staff', 'both']),
  weightageTemplate: z.record(z.number()).optional(),
});
export const updateAppraisalCycleSchema = createAppraisalCycleSchema.partial();

// ─── FDP Record CRUD ──────────────────────────────────────────────

export const createFDPRecordSchema = z.object({
  facultyId: z.string().min(1),
  activityType: z.enum(['fdp', 'workshop', 'seminar', 'conference', 'certification']),
  title: z.string().min(1),
  organiser: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  hours: z.number().min(0),
  certificateUrl: z.string().optional(),
  complianceYear: z.number().int(),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
});
export const updateFDPRecordSchema = createFDPRecordSchema.partial();

// ─── FDP Compliance Summary CRUD ──────────────────────────────────

export const createFDPComplianceSummarySchema = z.object({
  facultyId: z.string().min(1),
  academicYearId: z.string().min(1),
  cadre: z.enum(['assistant_professor', 'associate_professor', 'professor']),
  requiredHours: z.number().min(0),
  completedHours: z.number().min(0),
  gap: z.number().min(0),
  complianceStatus: z.enum(['compliant', 'partial', 'non_compliant']),
  lastComputedAt: z.string().min(1),
});
export const updateFDPComplianceSummarySchema = createFDPComplianceSummarySchema.partial();

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 4 — Exit & Separation Schemas
// ═══════════════════════════════════════════════════════════════════

export const initiateResignationSchema = z.object({
  employeeId: z.string().min(1),
  requestedLastWorkingDay: z.string().min(1),
  reason: z.string().min(1),
});

export const processTerminationSchema = z.object({
  employeeId: z.string().min(1),
  disciplinaryCaseId: z.string().min(1),
  reason: z.string().min(1),
});

export const processDeathNotificationSchema = z.object({
  employeeId: z.string().min(1),
  reason: z.string().min(1),
});

export const rejectResignationSchema = z.object({
  remarks: z.string().min(1),
});

export const waiveNoticeSchema = z.object({
  newLastWorkingDay: z.string().min(1),
});

export const clearItemSchema = z.object({
  department: z.string().min(1),
  status: z.enum(['cleared', 'blocked']),
  remarks: z.string().optional(),
  blockedReason: z.string().optional(),
});

export const createHandoverSchema = z.object({
  items: z.array(z.object({
    category: z.enum(['course', 'mentee', 'research', 'admin', 'asset', 'lab']),
    description: z.string().min(1),
    successorId: z.string().optional(),
    status: z.enum(['pending', 'completed']).optional(),
  })),
});

export const updateHandoverItemSchema = z.object({
  category: z.string().min(1),
  status: z.enum(['pending', 'completed']),
  successorId: z.string().optional(),
  completedAt: z.string().optional(),
});

export const contractRenewalSchema = z.object({
  employeeId: z.string().min(1),
  newContractEndDate: z.string().min(1),
  remarks: z.string().optional(),
});

// ─── Separation Request CRUD ─────────────────────────────────────
export const createSeparationRequestSchema = z.object({
  employeeId: z.string().min(1),
  separationType: z.enum(['resignation', 'retirement', 'termination', 'death', 'contract_end']),
  requestedLastWorkingDay: z.string().optional(),
  reason: z.string().min(1),
});
export const updateSeparationRequestSchema = createSeparationRequestSchema.partial();

// ─── Exit Clearance CRUD ─────────────────────────────────────────
export const createExitClearanceSchema = z.object({
  separationRequestId: z.string().min(1),
  employeeId: z.string().min(1),
});
export const updateExitClearanceSchema = createExitClearanceSchema.partial();

// ─── Handover Record CRUD ────────────────────────────────────────
export const createHandoverRecordSchema = z.object({
  separationRequestId: z.string().min(1),
  employeeId: z.string().min(1),
  items: z.array(z.object({
    category: z.enum(['course', 'mentee', 'research', 'admin', 'asset', 'lab']),
    description: z.string().min(1),
    status: z.enum(['pending', 'completed']).optional(),
  })).optional(),
});
export const updateHandoverRecordSchema = createHandoverRecordSchema.partial();

// ─── Final Settlement CRUD ───────────────────────────────────────
export const createFinalSettlementSchema = z.object({
  separationRequestId: z.string().min(1),
  employeeId: z.string().min(1),
  leaveEncashmentDays: z.number().min(0),
  leaveEncashmentAmount: z.number().min(0),
  netSettlement: z.number(),
});
export const updateFinalSettlementSchema = createFinalSettlementSchema.partial();

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 5 — Disciplinary Proceedings Schemas
// ═══════════════════════════════════════════════════════════════════

export const initiateCaseInternalSchema = z.object({
  employeeId: z.string().min(1),
  allegation: z.string().min(1),
  evidence: z.array(z.string()).optional(),
  investigatingAuthorityId: z.string().optional(),
});

export const receiveReferralSchema = z.object({
  employeeId: z.string().min(1),
  referralSource: z.enum(['m06_icc', 'm06_arc', 'other']),
  referralDetails: z.string().optional(),
  allegation: z.string().min(1),
  evidence: z.array(z.string()).optional(),
});

export const updateInvestigationSchema = z.object({
  investigationFindings: z.string().min(1),
  investigatingAuthorityId: z.string().optional(),
});

export const issueShowCauseSchema = z.object({
  showCauseNoticeUrl: z.string().min(1),
  responseDeadlineDays: z.number().int().min(1).optional(),
});

export const recordResponseSchema = z.object({
  responseText: z.string().min(1),
});

export const recordHearingSchema = z.object({
  hearingDate: z.string().min(1),
  hearingMinutesUrl: z.string().min(1),
});

export const decideOutcomeSchema = z.object({
  outcome: z.enum(['warning', 'fine', 'suspension', 'demotion', 'termination', 'exonerated']),
  outcomeDetails: z.string().optional(),
});

export const implementOutcomeSchema = z.object({
  implementedActions: z.array(z.object({ action: z.string(), module: z.string().optional() })),
  communicationLetterUrl: z.string().optional(),
});

export const submitAppealSchema = z.object({
  appealText: z.string().min(1),
});

export const resolveAppealSchema = z.object({
  resolution: z.enum(['upheld', 'modified', 'overturned']),
  revisedOutcome: z.string().optional(),
  revisedDetails: z.string().optional(),
});

export const closeInsufficientEvidenceSchema = z.object({
  remarks: z.string().min(1),
});

// Disciplinary CRUD
export const createDisciplinaryCaseSchema = z.object({
  employeeId: z.string().min(1),
  allegation: z.string().min(1),
  origin: z.enum(['internal', 'external_referral']),
  evidence: z.array(z.string()).optional(),
});
export const updateDisciplinaryCaseSchema = createDisciplinaryCaseSchema.partial();

export const createDisciplinaryOutcomeSchema = z.object({
  disciplinaryCaseId: z.string().min(1),
  employeeId: z.string().min(1),
  outcomeType: z.enum(['warning', 'fine', 'suspension', 'demotion', 'termination']),
});
export const updateDisciplinaryOutcomeSchema = createDisciplinaryOutcomeSchema.partial();

// ═══════════════════════════════════════════════════════════════════
// W05 Phase 6 — Compliance & Payroll Extract Schemas
// ═══════════════════════════════════════════════════════════════════

export const generatePayrollExtractSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
});

export const attendanceComplianceSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
});

export const createPayrollDataExtractSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  status: z.enum(['draft', 'reviewed', 'released']).optional(),
});
export const updatePayrollDataExtractSchema = createPayrollDataExtractSchema.partial();
