import { z } from 'zod';
import { refineRange } from "../../shared/validation-helpers";

// ═══ Hostel Block ════════════════════════════════════════
export const createHostelBlockSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['boys', 'girls']),
  totalRooms: z.number().int().min(0),
  wardenId: z.string().optional(),
  isActive: z.boolean().optional(),
});
export const updateHostelBlockSchema = createHostelBlockSchema.partial();

// ═══ Hostel Room ═════════════════════════════════════════
export const createHostelRoomSchema = z.object({
  blockId: z.string().min(1),
  roomNumber: z.string().min(1),
  floor: z.number().int().min(0),
  capacity: z.number().int().min(1),
  occupancy: z.number().int().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  status: z.enum(['available', 'full', 'maintenance', 'reserved']).optional(),
});
export const updateHostelRoomSchema = createHostelRoomSchema.partial();

// ═══ Hostel Allocation ═══════════════════════════════════
export const createHostelAllocationSchema = z.object({
  studentId: z.string().min(1),
  roomId: z.string().min(1),
  academicYearId: z.string().min(1),
  allocatedDate: z.string().optional(),
  vacatedDate: z.string().optional(),
  status: z.enum(['active', 'vacated', 'transferred']).optional(),
});
export const updateHostelAllocationSchema = createHostelAllocationSchema.partial();

// ═══ Hostel Visitor Log ══════════════════════════════════
const hostelVisitorLogShape = z.object({
  studentId: z.string().min(1),
  visitorName: z.string().min(1),
  visitorRelation: z.string().min(1),
  visitorPhone: z.string().min(1),
  inTime: z.string().optional(),
  outTime: z.string().optional(),
  purpose: z.string().min(1),
});
// A visitor leaving before they arrived was accepted silently.
const visitTimeRange = refineRange({
  startField: 'inTime',
  endField: 'outTime',
  allowEqual: false,
  message: 'Out-time must be after in-time',
});
export const createHostelVisitorLogSchema = hostelVisitorLogShape.superRefine(visitTimeRange);
export const updateHostelVisitorLogSchema = hostelVisitorLogShape.partial().superRefine(visitTimeRange);

// ═══ Mess Menu ═══════════════════════════════════════════
export const createMessMenuSchema = z.object({
  blockId: z.string().optional(),
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  meals: z.array(z.object({
    type: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
    items: z.array(z.string()),
  })).optional(),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional(),
});
export const updateMessMenuSchema = createMessMenuSchema.partial();

// ═══ Mess Feedback ═══════════════════════════════════════
export const createMessFeedbackSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().min(1),
  mealType: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
  rating: z.number().int().min(1).max(5),
  comments: z.string().optional(),
});
export const updateMessFeedbackSchema = createMessFeedbackSchema.partial();

// ═══ Transport Route ═════════════════════════════════════
export const createTransportRouteSchema = z.object({
  routeNumber: z.string().min(1),
  name: z.string().min(1),
  stops: z.array(z.object({
    name: z.string().min(1),
    pickupTime: z.string(),
    dropTime: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })).optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  capacity: z.number().int().min(1),
  isActive: z.boolean().optional(),
});
export const updateTransportRouteSchema = createTransportRouteSchema.partial();

// ═══ Transport Allocation ════════════════════════════════
export const createTransportAllocationSchema = z.object({
  studentId: z.string().min(1),
  routeId: z.string().min(1),
  stopName: z.string().min(1),
  academicYearId: z.string().min(1),
  status: z.enum(['active', 'cancelled']).optional(),
});
export const updateTransportAllocationSchema = createTransportAllocationSchema.partial();

// ═══ Health Record ═══════════════════════════════════════
export const createHealthRecordSchema = z.object({
  personId: z.string().min(1),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  emergencyContact: z.string().min(1),
  emergencyPhone: z.string().min(1),
  insuranceId: z.string().optional(),
});
export const updateHealthRecordSchema = createHealthRecordSchema.partial();

// ═══ Medical Visit ═══════════════════════════════════════
export const createMedicalVisitSchema = z.object({
  personId: z.string().min(1),
  visitDate: z.string().optional(),
  complaint: z.string().min(1),
  diagnosis: z.string().optional(),
  prescription: z.string().optional(),
  referredTo: z.string().optional(),
  attendedBy: z.string().min(1),
  followUpDate: z.string().optional(),
});
export const updateMedicalVisitSchema = createMedicalVisitSchema.partial();

// ═══ Counseling Session ══════════════════════════════════
export const createCounselingSessionSchema = z.object({
  studentId: z.string().min(1),
  counselorId: z.string().min(1),
  sessionDate: z.string().min(1),
  type: z.enum(['academic', 'personal', 'career', 'crisis', 'follow_up']),
  notes: z.string().optional(),
  followUpRequired: z.boolean().optional(),
  nextSessionDate: z.string().optional(),
});
export const updateCounselingSessionSchema = createCounselingSessionSchema.partial();

// ═══ Crisis Alert ════════════════════════════════════════
export const createCrisisAlertSchema = z.object({
  reportedBy: z.string().min(1),
  studentId: z.string().optional(),
  type: z.enum(['mental_health', 'ragging', 'harassment', 'medical_emergency', 'substance_abuse', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1),
  status: z.enum(['reported', 'acknowledged', 'in_progress', 'resolved', 'escalated']).optional(),
  assignedTo: z.string().optional(),
  resolution: z.string().optional(),
  resolvedAt: z.string().optional(),
});
export const updateCrisisAlertSchema = createCrisisAlertSchema.partial();

// ═══ Anti-Ragging Complaint ══════════════════════════════
export const createAntiRaggingComplaintSchema = z.object({
  complainantId: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  accusedIds: z.array(z.string()).optional(),
  description: z.string().min(1),
  incidentDate: z.string().min(1),
  severity: z.enum(['minor', 'major', 'severe']),
  status: z.enum(['filed', 'investigating', 'action_taken', 'closed']).optional(),
  committeeRemarks: z.string().optional(),
  actionTaken: z.string().optional(),
});
export const updateAntiRaggingComplaintSchema = createAntiRaggingComplaintSchema.partial();

// ═══ Student Grievance ═══════════════════════════════════
export const createStudentGrievanceSchema = z.object({
  studentId: z.string().min(1),
  category: z.enum(['academic', 'hostel', 'mess', 'transport', 'infrastructure', 'fee', 'other']),
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignedTo: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  resolution: z.string().optional(),
  resolvedAt: z.string().optional(),
});
export const updateStudentGrievanceSchema = createStudentGrievanceSchema.partial();

// ═══ Insurance Claim ═════════════════════════════════════
export const createInsuranceClaimSchema = z.object({
  personId: z.string().min(1),
  insuranceProvider: z.string().min(1),
  policyNumber: z.string().min(1),
  claimAmount: z.number().min(0),
  reason: z.string().min(1),
  claimDate: z.string().optional(),
  status: z.enum(['filed', 'processing', 'approved', 'rejected', 'settled']).optional(),
  settledAmount: z.number().min(0).optional(),
});
export const updateInsuranceClaimSchema = createInsuranceClaimSchema.partial();

// ═══ Parent Meeting ══════════════════════════════════════
export const createParentMeetingSchema = z.object({
  studentId: z.string().min(1),
  parentId: z.string().min(1),
  facultyId: z.string().min(1),
  scheduledDate: z.string().min(1),
  agenda: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
});
export const updateParentMeetingSchema = createParentMeetingSchema.partial();

// ═══════════════════════════════════════════════════════════════
// W06 WORKFLOW VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════

// ═══ GGM Schemas ════════════════════════════════════════════

export const fileGrievanceSchema = z.object({
  complainantId: z.string().min(1),
  complainantType: z.enum(['student', 'parent', 'staff', 'anonymous']),
  category: z.string().min(1),
  subCategory: z.string().optional(),
  subject: z.string().min(1),
  description: z.string().min(1),
  isAnonymous: z.boolean().optional(),
  attachments: z.array(z.string()).optional(),
});

export const triageGrievanceSchema = z.object({
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  assignedDepartment: z.string().optional(),
  assignedTo: z.string().optional(),
  slaHours: z.number().int().min(1).optional(),
  remarks: z.string().optional(),
});

export const resolveGrievanceSchema = z.object({
  resolution: z.string().min(1),
  actionTaken: z.string().min(1),
  preventiveMeasures: z.string().optional(),
});

export const escalateGrievanceSchema = z.object({
  escalateTo: z.string().min(1),
  reason: z.string().min(1),
  newPriority: z.enum(['medium', 'high', 'critical']).optional(),
});

export const grievanceFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comments: z.string().optional(),
  satisfied: z.boolean(),
});

export const reopenGrievanceSchema = z.object({
  reason: z.string().min(1),
});

export const addInternalNoteSchema = z.object({
  note: z.string().min(1),
  visibility: z.enum(['internal', 'committee']).optional(),
});

export const assignGrievanceSchema = z.object({
  assigneeId: z.string().min(1),
  assigneeRole: z.string().optional(),
  remarks: z.string().optional(),
});

export const reviewSystemicPatternSchema = z.object({
  status: z.enum(['acknowledged', 'action_planned', 'resolved', 'dismissed']),
  actionPlan: z.string().optional(),
  remarks: z.string().optional(),
});

// ═══ ARC Schemas ════════════════════════════════════════════

export const fileARCComplaintSchema = z.object({
  complainantId: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  victimId: z.string().optional(),
  accusedIds: z.array(z.string()).optional(),
  incidentDate: z.string().min(1),
  incidentLocation: z.string().optional(),
  description: z.string().min(1),
  severity: z.enum(['minor', 'major', 'severe']).optional(),
  attachments: z.array(z.string()).optional(),
});

export const assessARCSchema = z.object({
  severity: z.enum(['minor', 'major', 'severe']),
  isRagging: z.boolean(),
  remarks: z.string().optional(),
  recommendedAction: z.string().optional(),
});

export const arcInvestigationSchema = z.object({
  investigatorId: z.string().min(1),
  investigationPlan: z.string().optional(),
  deadline: z.string().optional(),
});

export const arcWitnessSchema = z.object({
  witnessId: z.string().min(1),
  statement: z.string().min(1),
  recordedDate: z.string().optional(),
});

export const arcCompleteInvestigationSchema = z.object({
  findings: z.string().min(1),
  evidenceSummary: z.string().optional(),
  recommendation: z.string().optional(),
});

export const arcHearingScheduleSchema = z.object({
  hearingDate: z.string().min(1),
  venue: z.string().optional(),
  panelMembers: z.array(z.string()).optional(),
  agenda: z.string().optional(),
});

export const arcHearingRecordSchema = z.object({
  proceedings: z.string().min(1),
  accusedPresent: z.boolean().optional(),
  complainantPresent: z.boolean().optional(),
  witnessStatements: z.array(z.string()).optional(),
});

export const arcDecisionSchema = z.object({
  decision: z.string().min(1),
  penalty: z.string().optional(),
  penaltyType: z.enum(['warning', 'suspension', 'expulsion', 'rustication', 'fine', 'community_service', 'other']).optional(),
  penaltyDuration: z.string().optional(),
  remarks: z.string().optional(),
});

export const arcAppealSchema = z.object({
  appealReason: z.string().min(1),
  newEvidence: z.string().optional(),
  requestedOutcome: z.string().optional(),
});

export const arcAppealDecisionSchema = z.object({
  decision: z.enum(['upheld', 'modified', 'overturned']),
  modifiedPenalty: z.string().optional(),
  remarks: z.string().optional(),
});

export const arcFirSchema = z.object({
  policeStation: z.string().min(1),
  firNumber: z.string().optional(),
  filingDate: z.string().optional(),
  sections: z.array(z.string()).optional(),
  remarks: z.string().optional(),
});

export const arcUGCReportSchema = z.object({
  reportingPeriod: z.string().min(1),
  year: z.number().int(),
  quarter: z.number().int().min(1).max(4).optional(),
});

// ═══ DISC Schemas ═══════════════════════════════════════════

export const fileMisconductSchema = z.object({
  reportedBy: z.string().min(1),
  studentId: z.string().min(1),
  incidentDate: z.string().min(1),
  incidentLocation: z.string().optional(),
  category: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['minor', 'major', 'severe']).optional(),
  witnessIds: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
});

export const disciplinaryInquiryStartSchema = z.object({
  inquiryOfficerId: z.string().min(1),
  inquiryPlan: z.string().optional(),
  deadline: z.string().optional(),
});

export const disciplinaryInquiryCompleteSchema = z.object({
  findings: z.string().min(1),
  evidenceSummary: z.string().optional(),
  recommendation: z.string().optional(),
});

export const disciplinaryHearingScheduleSchema = z.object({
  hearingDate: z.string().min(1),
  venue: z.string().optional(),
  panelMembers: z.array(z.string()).optional(),
  agenda: z.string().optional(),
});

export const disciplinaryHearingRecordSchema = z.object({
  proceedings: z.string().min(1),
  studentPresent: z.boolean().optional(),
  parentPresent: z.boolean().optional(),
  witnessStatements: z.array(z.string()).optional(),
});

export const disciplinaryDecisionSchema = z.object({
  decision: z.string().min(1),
  penalty: z.string().optional(),
  penaltyType: z.enum(['warning', 'fine', 'suspension', 'rustication', 'expulsion', 'community_service', 'other']).optional(),
  penaltyDuration: z.string().optional(),
  remarks: z.string().optional(),
});

export const disciplinaryAppealSchema = z.object({
  appealReason: z.string().min(1),
  newEvidence: z.string().optional(),
  requestedOutcome: z.string().optional(),
});

export const disciplinaryAppealDecisionSchema = z.object({
  decision: z.enum(['upheld', 'modified', 'overturned']),
  modifiedPenalty: z.string().optional(),
  remarks: z.string().optional(),
});

// ═══ ICC Schemas ════════════════════════════════════════════

export const fileICCComplaintSchema = z.object({
  complainantId: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  respondentId: z.string().optional(),
  respondentType: z.enum(['student', 'staff', 'faculty', 'other']).optional(),
  incidentDate: z.string().min(1),
  incidentLocation: z.string().optional(),
  description: z.string().min(1),
  category: z.enum(['sexual_harassment', 'stalking', 'voyeurism', 'cyber_harassment', 'other']).optional(),
  attachments: z.array(z.string()).optional(),
});

export const assessICCSchema = z.object({
  isPrimaFacie: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  interimMeasures: z.array(z.string()).optional(),
  remarks: z.string().optional(),
});

export const iccInquiryStartSchema = z.object({
  inquiryCommitteeMembers: z.array(z.string()).optional(),
  deadline: z.string().optional(),
});

export const iccInquiryCompleteSchema = z.object({
  findings: z.string().min(1),
  evidenceSummary: z.string().optional(),
  recommendation: z.string().optional(),
});

export const iccHearingScheduleSchema = z.object({
  hearingDate: z.string().min(1),
  venue: z.string().optional(),
  panelMembers: z.array(z.string()).optional(),
});

export const iccHearingRecordSchema = z.object({
  proceedings: z.string().min(1),
  respondentPresent: z.boolean().optional(),
  complainantPresent: z.boolean().optional(),
  witnessStatements: z.array(z.string()).optional(),
});

export const iccRecommendationSchema = z.object({
  recommendation: z.string().min(1),
  penalty: z.string().optional(),
  compensationAmount: z.number().optional(),
  remarks: z.string().optional(),
});

export const iccAppealSchema = z.object({
  appealReason: z.string().min(1),
  newEvidence: z.string().optional(),
});

export const iccAppealDecisionSchema = z.object({
  decision: z.enum(['upheld', 'modified', 'overturned']),
  modifiedRecommendation: z.string().optional(),
  remarks: z.string().optional(),
});

export const iccAnnualReportSchema = z.object({
  year: z.number().int(),
  reportingPeriod: z.string().min(1),
});

// ═══ SCST Schemas ═══════════════════════════════════════════

export const fileSCSTComplaintSchema = z.object({
  complainantId: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  victimId: z.string().optional(),
  accusedId: z.string().optional(),
  incidentDate: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional(),
  actSections: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
});

export const scstInvestigateSchema = z.object({
  investigatorId: z.string().min(1),
  findings: z.string().optional(),
  deadline: z.string().optional(),
});

export const scstDecisionSchema = z.object({
  decision: z.string().min(1),
  actionTaken: z.string().optional(),
  remarks: z.string().optional(),
});

export const scstPoliceReferralSchema = z.object({
  policeStation: z.string().min(1),
  firNumber: z.string().optional(),
  sections: z.array(z.string()).optional(),
  remarks: z.string().optional(),
});

export const scstQuarterlyReportSchema = z.object({
  year: z.number().int(),
  quarter: z.number().int().min(1).max(4),
  reportingPeriod: z.string().min(1),
});

// ═══ GRC Schemas ════════════════════════════════════════════

export const fileGRCComplaintSchema = z.object({
  complainantId: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  respondentId: z.string().optional(),
  category: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().min(1),
  attachments: z.array(z.string()).optional(),
});

export const grcInvestigateSchema = z.object({
  investigatorId: z.string().min(1),
  findings: z.string().optional(),
  deadline: z.string().optional(),
});

export const grcHearingScheduleSchema = z.object({
  hearingDate: z.string().min(1),
  venue: z.string().optional(),
  panelMembers: z.array(z.string()).optional(),
});

export const grcHearingRecordSchema = z.object({
  proceedings: z.string().min(1),
  respondentPresent: z.boolean().optional(),
  complainantPresent: z.boolean().optional(),
});

export const grcDecisionSchema = z.object({
  decision: z.string().min(1),
  remedy: z.string().optional(),
  remarks: z.string().optional(),
});

export const grcOmbudsmanAppealSchema = z.object({
  appealReason: z.string().min(1),
  newEvidence: z.string().optional(),
  requestedOutcome: z.string().optional(),
});

// ═══ Mentoring Schemas ══════════════════════════════════════

export const assignMentorSchema = z.object({
  mentorId: z.string().min(1),
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  semesterId: z.string().optional(),
});

export const bulkAssignMentorsSchema = z.object({
  assignments: z.array(z.object({
    mentorId: z.string().min(1),
    studentIds: z.array(z.string().min(1)),
  })),
  academicYearId: z.string().min(1),
  semesterId: z.string().optional(),
});

export const recordMentorSessionSchema = z.object({
  assignmentId: z.string().min(1),
  mentorId: z.string().min(1),
  studentId: z.string().min(1),
  sessionDate: z.string().min(1),
  sessionType: z.enum(['scheduled', 'walk_in', 'emergency']).optional(),
  topics: z.array(z.string()).optional(),
  notes: z.string().optional(),
  actionItems: z.array(z.string()).optional(),
  followUpDate: z.string().optional(),
});

export const flagMentorConcernSchema = z.object({
  mentorId: z.string().min(1),
  studentId: z.string().min(1),
  category: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1),
});

export const referToCounsellingSchema = z.object({
  studentId: z.string().min(1),
  referralSource: z.enum(['mentor', 'faculty', 'self', 'parent', 'ccd']).optional(),
  referredBy: z.string().min(1),
  reason: z.string().min(1),
  urgency: z.enum(['routine', 'urgent', 'emergency']).optional(),
});

export const updateMentorAssignmentSchema_wf = z.object({
  status: z.string().optional(),
  mentorId: z.string().optional(),
  semesterId: z.string().optional(),
});

export const updateMentorConcernSchema_wf = z.object({
  status: z.string().optional(),
  actionTaken: z.string().optional(),
  severity: z.string().optional(),
});

// ═══ Counselling Schemas ════════════════════════════════════

export const updateCounsellingReferralSchema = z.object({
  status: z.string().optional(),
  appointmentDates: z.array(z.string()).optional(),
  followUpStatus: z.string().optional(),
});

export const closeCounsellingReferralSchema = z.object({
  reason: z.string().min(1),
});

// ═══ CCD Schemas ════════════════════════════════════════════

export const ingestRiskSignalSchema = z.object({
  studentId: z.string().min(1),
  source: z.string().min(1),
  signalType: z.string().min(1),
  weight: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  description: z.string().optional(),
});

export const acknowledgeCCDAlertSchema = z.object({
  initialAssessment: z.string().min(1),
});

export const investigateCCDAlertSchema = z.object({
  findings: z.string().optional(),
});

export const ccdInterventionSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
  assignedTo: z.string().optional(),
  scheduledDate: z.string().optional(),
  outcome: z.string().optional(),
});

export const ccdFalsePositiveSchema = z.object({
  reason: z.string().min(1),
});

export const createCCDThresholdSchema = z.object({
  name: z.string().min(1),
  priority: z.string().min(1),
  scoreThreshold: z.number(),
  crossModuleMinimum: z.number().optional(),
  autoEscalate: z.boolean().optional(),
  notifyRoles: z.array(z.string()).optional(),
});

export const updateCCDThresholdSchema = z.object({
  name: z.string().optional(),
  scoreThreshold: z.number().optional(),
  crossModuleMinimum: z.number().optional(),
  autoEscalate: z.boolean().optional(),
  notifyRoles: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ═══ W10 Exit Interview Schemas ═════════════════════════════
export const recordExitInterviewSchema = z.object({ studentId: z.string().min(1), exitRequestId: z.string().optional(), interviewerId: z.string().min(1), interviewDate: z.string().min(1), primaryReason: z.enum(['financial', 'personal', 'academic', 'family', 'health', 'career_change', 'relocation', 'institutional', 'other']), secondaryReasons: z.array(z.string()).optional(), institutionalFeedback: z.object({ teachingQuality: z.number().min(1).max(5), infrastructure: z.number().min(1).max(5), support: z.number().min(1).max(5), overallSatisfaction: z.number().min(1).max(5), suggestions: z.string().optional() }).optional(), followUpRequired: z.boolean().optional(), followUpNotes: z.string().optional() });
export const scheduleExitInterviewSchema = z.object({ studentId: z.string().min(1), exitRequestId: z.string().optional(), interviewerId: z.string().min(1), interviewDate: z.string().min(1) });
