# W06 -- Student Welfare & Crisis Response: Implementation Spec

**Status:** DRAFT | 2026-04-13
**Workflow:** W06 -- 80 Sub-Workflows across M06 (9 sub-domains) + M02, M03, M04, M05, M08, M10, M11, M12, Juvi
**Primary Module:** M06 Welfare (`/api/welfare`)
**Source:** `W06_L2_Workflow_Decomposition.xlsx`

---

## 1. Executive Summary

W06 transforms M06 Welfare from a pure-CRUD data store (16 models, 81 service functions) into a full lifecycle workflow engine covering grievance management, anti-ragging investigations, ICC/POSH compliance, SC/ST cell operations, Grievance Redressal Committee proceedings, mentoring, counselling referrals, disciplinary cases, and compound crisis detection.

The workflow spans 80 sub-workflows across 9 sub-domains (M06.1 GGM through M06.9 CCD) with deep cross-module integration into People (M02), Academics (M03), Finance (M04), HR (M05), Campus Ops (M08), Compliance (M10), Governance (M11), Platform (M12), and Juvi AI.

### NON-NEGOTIABLE PRINCIPLE

> **AI flags; humans decide. No autonomous AI decisions on student welfare outcomes.**

This is the cardinal rule of W06. AI performs NLP classification, severity suggestion, duplicate detection, SLA monitoring, risk signal ingestion, compound score computation, and pattern detection. AI NEVER decides outcomes, initiates interventions, adjudicates complaints, or takes disciplinary action. Every substantive welfare decision requires a human actor.

Key regulatory constraints:
- **POSH Act (M06.3 ICC):** Human adjudication mandatory. ICC confidentiality has legal consequences for breach.
- **SC/ST Atrocities Act (M06.4 SCST):** Police referral is non-discretionary. All substantive decisions require human judgment.
- **UGC Grievance Redressal Regulations 2012 (M06.5 GRC):** Statutory timelines -- 3/15/30 day SLAs.
- **UGC Anti-Ragging Regulations (M06.2 ARC):** Mandatory FIR for severe cases. Zero-tolerance mandate.
- **M06.9 CCD:** Student NEVER sees their risk score. Outreach must feel natural, not surveillance.

---

## 2. Current Codebase State

### 2.1 Existing Models (16)

| Model | File | Key Fields | Gap Summary |
|---|---|---|---|
| `StudentGrievance` | `models/welfare/StudentGrievance.ts` | studentId, category (7 enums), priority (low/med/high), status (4 states), assignedTo, resolution | No anonymous filing, no SLA tracking, no AI triage fields, no escalation history, no duplicate references, no internal notes |
| `AntiRaggingComplaint` | `models/welfare/AntiRaggingComplaint.ts` | complainantId, isAnonymous, accusedIds[], severity (minor/major/severe), status (4 states) | No investigation phases, no hearing records, no evidence attachment, no FIR tracking, no UGC report linkage, no witness tracking |
| `CrisisAlert` | `models/welfare/CrisisAlert.ts` | reportedBy, studentId, type (6 enums), severity (4 levels), status (5 states), assignedTo | No compound risk scoring, no signal sources, no temporal windowing, no intervention tracking, no decay logic |
| `CounselingSession` | `models/welfare/CounselingSession.ts` | studentId, counselorId, sessionDate, type (5 enums), notes, followUpRequired | Clinical notes stored in DB (violates spec -- clinical notes must be OUTSIDE Juvion), no referral tracking, no intake vs follow-up distinction |
| `HostelBlock` | `models/welfare/HostelBlock.ts` | name, type, totalRooms, wardenId, isActive | Adequate for W06 signal source (warden concern) |
| `HostelRoom` | `models/welfare/HostelRoom.ts` | blockId, roomNumber, floor, capacity, status | Adequate |
| `HostelAllocation` | `models/welfare/HostelAllocation.ts` | studentId, roomId, academicYearId, status | Adequate |
| `HostelVisitorLog` | `models/welfare/HostelVisitorLog.ts` | studentId, visitorName, visitorRelation, purpose | Adequate |
| `TransportRoute` | `models/welfare/TransportRoute.ts` | routeNumber, stops[], vehicleNumber, driverName | Adequate |
| `TransportAllocation` | `models/welfare/TransportAllocation.ts` | studentId, routeId, stopName, status | Adequate |
| `HealthRecord` | `models/welfare/HealthRecord.ts` | personId, bloodGroup, allergies[], chronicConditions[], emergencyContact | Adequate |
| `MedicalVisit` | `models/welfare/MedicalVisit.ts` | personId, visitDate, complaint, diagnosis, prescription | Adequate |
| `InsuranceClaim` | `models/welfare/InsuranceClaim.ts` | personId, insuranceProvider, policyNumber, claimAmount, status | Adequate |
| `MessMenu` | `models/welfare/MessMenu.ts` | blockId, day, meals[], effectiveFrom | Adequate (signal source: mess attendance) |
| `MessFeedback` | `models/welfare/MessFeedback.ts` | studentId, date, mealType, rating, comments | Adequate |
| `ParentMeeting` | `models/welfare/ParentMeeting.ts` | studentId, parentId, facultyId, scheduledDate, agenda, status | Needs welfare-context fields (triggeringCaseId, caseType) |

### 2.2 Existing Service Layer

All 81 service functions follow pure CRUD pattern:
- `list*()` / `get*()` / `create*()` / `update*()` / `delete*()`
- No state machine transitions
- No SLA computation
- No cross-module event emission
- No confidentiality-aware data filtering
- No AI integration hooks

### 2.3 Existing Routes

All routes under `/api/welfare/` use flat `authorize('welfare', 'read|create|update|delete')`. No sub-domain authorization (e.g., `authorize('welfare.icc', 'read')` does not exist). No role-based visibility filtering.

### 2.4 Infrastructure Available

- **WorkflowEngine:** `backend/src/shared/workflow/WorkflowEngine.ts` -- state machine with phases, steps, transitions, guards, parallel groups. Used by W01 (Admissions). Fully reusable for W06.
- **WorkflowDefinition:** Generic type system supporting `manual`, `automated`, `approval`, `parallel_group` task types with `aiAutonomy` levels.
- **EventBus:** `backend/src/shared/events.ts` -- in-process EventEmitter (will migrate to BullMQ). Convention: `module:entity:action`.
- **Committee model:** `models/governance/Committee.ts` -- supports types `anti_ragging`, `icc`, `grievance`, `disciplinary`. Can be reused for M06.2/M06.3/M06.5/M06.8 committee membership.

---

## 3. Sub-Workflow Catalog

### 3.1 M06.1 GGM -- General Grievance Management (8 sub-workflows)

| ID | Name | Category | Trigger | AI Scope | Key Entities |
|---|---|---|---|---|---|
| W06-L2-001 | File Routine Grievance | Routine | Student submits via Juvi/portal | NLP classification, severity suggestion, duplicate detection | Grievance (C), Notification (C) |
| W06-L2-002 | Auto-Triage & Route Grievance | Routine | Grievance created | NLP analysis, handler mapping, confidence scoring | Grievance (U), Assignment (C) |
| W06-L2-003 | Investigate & Resolve Grievance | Routine | Grievance assigned | SLA countdown, deadline alerts | Grievance (U), Investigation Note (C), Resolution (C) |
| W06-L2-004 | Escalate Overdue Grievance | Exception | SLA breach detected | Auto-escalation trigger, SLA monitoring | Grievance (U), Escalation (C), Notification (C) |
| W06-L2-005 | Close & Feedback Grievance | Routine | Resolution proposed | Satisfaction tracking | Grievance (U), Feedback (C) |
| W06-L2-006 | Reopen Grievance | Exception | Student disputes resolution | Pattern detection (repeat complaints) | Grievance (U), Reopen Log (C) |
| W06-L2-007 | Detect Systemic Grievance Pattern | Periodic | Weekly AI scan | NLP clustering, trend detection | Systemic Pattern (C), Governance Alert (C via M11) |
| W06-L2-008 | Produce Grievance Analytics | Periodic | Monthly / on-demand | Aggregation, anonymization | Compliance Evidence (C via M10) |

**SLA Tiers:** P1 = 24 hours, P2 = 3 business days, P3 = 7 business days.
**Confidentiality:** Anonymous identity stored encrypted, visible only to Principal. Handler sees case but not identity. Internal notes separate from student-visible notes.

### 3.2 M06.2 ARC -- Anti-Ragging Cell (7 sub-workflows)

| ID | Name | Category | Trigger | AI Scope | Key Entities |
|---|---|---|---|---|---|
| W06-L2-009 | File Anti-Ragging Complaint | Statutory | Victim/witness/anonymous report | Severity suggestion only | ARC Complaint (C) |
| W06-L2-010 | ARC Initial Assessment | Statutory | Complaint filed | Prior history lookup | ARC Assessment (C), ARC Complaint (U) |
| W06-L2-011 | ARC Investigation | Statutory | Assessment recommends | Serial pattern flagging | ARC Investigation (C/U) |
| W06-L2-012 | ARC Hearing & Decision | Statutory | Investigation complete | Deadline tracking only | ARC Hearing (C), ARC Decision (C) |
| W06-L2-013 | ARC Penalty Execution | Statutory | Decision with penalty | None | Disciplinary Record (C via M02), HR Action (C via M05) |
| W06-L2-014 | ARC Appeal Process | Exception | Respondent appeals | Deadline tracking | ARC Appeal (C/U), ARC Decision (U) |
| W06-L2-015 | ARC UGC Reporting | Statutory | Quarterly / on incidents | Document assembly | UGC Report (C), Compliance Evidence (C via M10) |

**Regulatory:** UGC Anti-Ragging Regulations. Severe cases require mandatory FIR. No AI role in adjudication whatsoever. AI confidence < 70% forces mandatory human triage.
**Confidentiality:** Complainant identity protected until hearing. Committee sees case. Principal sees all.

### 3.3 M06.3 ICC -- Internal Complaints Committee / POSH (7 sub-workflows)

| ID | Name | Category | Trigger | AI Scope | Key Entities |
|---|---|---|---|---|---|
| W06-L2-016 | Constitute ICC | Statutory | Annual / vacancy | Composition compliance check | ICC Cell (C), Committee Membership (C) |
| W06-L2-017 | File ICC Complaint | Statutory | Complainant files | 90-day deadline tracking only | ICC Complaint (C) |
| W06-L2-018 | ICC Preliminary Assessment | Statutory | Complaint filed | Document assembly | ICC Assessment (C) |
| W06-L2-019 | ICC Inquiry | Statutory | Assessment recommends inquiry | Deadline tracking (90 days) | ICC Inquiry (C/U) |
| W06-L2-020 | ICC Hearing & Recommendation | Statutory | Inquiry complete | Report assembly | ICC Hearing (C), ICC Recommendation (C) |
| W06-L2-021 | ICC Appeal | Statutory | Party appeals | Deadline tracking | ICC Appeal (C/U) |
| W06-L2-022 | ICC Annual Report | Statutory | End of calendar year | Aggregation only (no case details) | ICC Annual Report (C), RegulatoryFiling (C via M10) |

**Regulatory:** POSH Act (Sexual Harassment of Women at Workplace Act, 2013). Human adjudication is MANDATORY. 90-day inquiry deadline is statutory.
**Confidentiality:** HIGHEST. ICC members ONLY see cases. ALL other faculty, ALL students, and ST5 (unless ICC member) are excluded. Legal consequences for breach. Content never surfaces in aggregate reports -- only counts.

### 3.4 M06.4 SCST -- SC/ST Cell (6 sub-workflows)

| ID | Name | Category | Trigger | AI Scope | Key Entities |
|---|---|---|---|---|---|
| W06-L2-023 | Constitute SC/ST Cell | Statutory | Annual / vacancy | Composition check | SCST Cell (C), Committee Membership (C) |
| W06-L2-024 | File SC/ST Complaint | Statutory | Student/faculty files | Deadline tracking only | SCST Complaint (C) |
| W06-L2-025 | SCST Investigation | Statutory | Complaint accepted | Document assembly | SCST Investigation (C/U) |
| W06-L2-026 | SCST Decision & Action | Statutory | Investigation complete | None | SCST Decision (C), Police Referral (C if applicable) |
| W06-L2-027 | SCST Police Referral | Statutory | Atrocities Act triggered | None | Police Referral (C), LegalCase (C via M10) |
| W06-L2-028 | SCST Reporting | Statutory | Quarterly | Aggregation | Compliance Evidence (C via M10) |

**Regulatory:** SC/ST (Prevention of Atrocities) Act, 1989. Police referral is non-discretionary when Act triggered. Caste data has limited visibility. Minimal AI -- all decisions human.

### 3.5 M06.5 GRC -- Grievance Redressal Committee (5 sub-workflows)

| ID | Name | Category | Trigger | AI Scope | Key Entities |
|---|---|---|---|---|---|
| W06-L2-029 | Escalate to GRC | Statutory | Department fails to resolve within SLA / student appeals | Escalation suggestion | GRC Complaint (C), Grievance (U) |
| W06-L2-030 | Constitute GRC | Statutory | Start of academic year | Composition compliance check | GRC Cell (C), Committee Membership (C) |
| W06-L2-031 | Investigate GRC Complaint | Statutory | GRC complaint accepted | Deadline tracking (hearing within 15 days) | GRC Investigation (C/U) |
| W06-L2-032 | Conduct GRC Hearing & Decision | Statutory | Investigation complete | Scheduling, deadline enforcement (30 days) | GRC Hearing (C), GRC Decision (C) |
| W06-L2-033 | GRC Appeal to Ombudsman | Exception | Student appeals GRC decision | Document assembly, deadline tracking | GRC Appeal (C), External Referral (C) |

**Regulatory:** UGC Grievance Redressal Regulations 2012. Hearing within 15 days, decision within 30 days. GRC composition is public.

### 3.6 M06.6 MENT -- Mentoring System (5 sub-workflows)

| ID | Name | Category | Trigger | AI Scope | Key Entities |
|---|---|---|---|---|---|
| W06-L2-034 | Assign Mentors | Routine | Start of semester | Mentor assignment suggestion (load balancing) | MentorAssignment (C) |
| W06-L2-035 | Conduct Mentor Session | Routine | Scheduled / ad-hoc | Low-engagement detection | MentorSession (C) |
| W06-L2-036 | Flag At-Risk Mentee | Exception | AI detects risk signals | At-risk surfacing from M03/M04 signals | MentorConcern (C), CCD RiskSignal (C) |
| W06-L2-037 | Refer Mentee to Counselling | Exception | Mentor determines need | Follow-up tracking | CounsellingReferral (C) |
| W06-L2-038 | Mentor Engagement Analytics | Periodic | Monthly | Aggregate patterns, coverage gaps | Compliance Evidence (C via M10) |

**Confidentiality:** Low. Mentor sees own mentees. HOD sees coverage. Session notes are optional and mentor-controlled. No AI in mentoring conversations.

### 3.7 M06.7 COUNS -- Counselling Referral Management (4 sub-workflows)

| ID | Name | Category | Trigger | AI Scope | Key Entities |
|---|---|---|---|---|---|
| W06-L2-039 | Create Counselling Referral | Routine | Mentor/ST5/self-referral | Follow-up tracking | CounsellingReferral (C) |
| W06-L2-040 | Track Counselling Follow-Up | Routine | Referral active | Multiple-referral surfacing | CounsellingFollowUp (U) |
| W06-L2-041 | Close Counselling Referral | Routine | Counsellor marks complete | None | CounsellingReferral (U) |
| W06-L2-042 | Counselling Aggregate Report | Periodic | Semester-end | Aggregate patterns only (no names, no clinical data) | Compliance Evidence (C via M10) |

**Confidentiality:** HIGHEST. Zero AI in clinical process. No clinical data stored in Juvion -- only dates, referral status, and follow-up status. Counsellor sees dates only. Student sees own status. ST5 sees follow-up status only. Mentor told only "referral made." Principal sees aggregates. NEVER content.

### 3.8 M06.8 DISC -- Disciplinary Proceedings (6 sub-workflows)

| ID | Name | Category | Trigger | AI Scope | Key Entities |
|---|---|---|---|---|---|
| W06-L2-043 | File Misconduct Report | Routine | Faculty/warden/student reports | Pattern detection (multiple violations) | MisconductReport (C) |
| W06-L2-044 | Preliminary Inquiry | Routine | Report assessed as warranting inquiry | Deadline tracking | DisciplinaryInquiry (C) |
| W06-L2-045 | Conduct Disciplinary Hearing | Statutory | Inquiry recommends hearing | Scheduling, deadline enforcement | DisciplinaryHearing (C), DisciplinaryDecision (C) |
| W06-L2-046 | Execute Penalty | Statutory | Decision issued | None | DisciplinaryRecord (C via M02), StudentStatus (U via M02) |
| W06-L2-047 | Disciplinary Appeal | Exception | Student appeals | Deadline tracking | DisciplinaryAppeal (C/U) |
| W06-L2-048 | Academic Fraud Investigation | Exception | Plagiarism/impersonation detected | Plagiarism integration (M03 external tool) | AcademicFraudCase (C), DisciplinaryInquiry (C) |

**Confidentiality:** High. Committee sees case. Respondent sees charges. Parent notified for serious cases. Other students and non-committee faculty have no access.

### 3.9 M06.9 CCD -- Compound Crisis Detection (7 sub-workflows)

| ID | Name | Category | Trigger | AI Scope | Key Entities |
|---|---|---|---|---|---|
| W06-L2-058 | Ingest Academic Risk Signals | Automated | M03 attendance/grade/backlog events | Signal ingestion, weight computation | RiskSignal (C) |
| W06-L2-059 | Acknowledge & Triage CCD Alert | Routine | Alert generated at threshold | None -- human acknowledges | CCDAlert (U) |
| W06-L2-060 | Investigate CCD Concern | Routine | ST5 decides to investigate | None | CCDInvestigation (C) |
| W06-L2-061 | Ingest Financial Risk Signals | Automated | M04 fee default/scholarship events | Signal ingestion, weight computation | RiskSignal (C) |
| W06-L2-062 | Execute CCD Intervention | Routine | Investigation recommends | None -- human executes | Intervention (C) |
| W06-L2-065 | Ingest Campus Risk Signals | Automated | M08 warden concern/mess drop events | Signal ingestion, weight computation | RiskSignal (C) |
| W06-L2-079 | Ingest Communication Risk Signals | Automated | Juvi messaging withdrawal/sentiment events | METADATA ONLY -- message content NEVER read | RiskSignal (C) |

**Compound Score Logic:**
- Base weights: Low=15, Medium=25, High=40, Context=10
- First-generation (S6 student) modifier: adds percentage to base weight (e.g., fee_default +25%)
- Cross-module compounding: >=3 modules contributing -> 1.5x multiplier
- Temporal windowing: signals within 2-week window -> 1.5x weight
- Score range: 0-100. P1 >= 75, P2 >= 50, P3 >= 35
- Signal decay: > 30 days old signals decay. Active intervention suppresses double-alert.

**Confidentiality:** STUDENT NEVER SEES RISK SCORE. ST5 sees alerts + score. Principal sees P1 + score. Mentor sees priority only (not score). Intervention presented as proactive outreach, not surveillance.

### 3.10 Supporting Module Sub-Workflows

| ID | Module | Name | Direction |
|---|---|---|---|
| W06-L2-049 | M02 People | Write Disciplinary Record to Student Profile | M06 -> M02 |
| W06-L2-050 | M02 People | Read Student Profile for Welfare Context | M02 -> M06 |
| W06-L2-051-053 | M03 Academics | Attendance/Grade/Backlog Signal Emission | M03 -> M06 |
| W06-L2-054-055 | M04 Finance | Fee Default Signal + Distress Score | M04 -> M06 |
| W06-L2-056-057 | M05 HR | Committee Findings -> HR Action | M06 -> M05 |
| W06-L2-063-064 | M08 Campus | Warden Concern + Mess Attendance Signal | M08 -> M06 |
| W06-L2-066-068 | M10 Compliance | Committee Reports + UGC Filings | M06 -> M10 |
| W06-L2-069-070 | M11 Governance | CCD Threshold Policy + Pattern Analytics | M06 <-> M11 |
| W06-L2-071-074 | M12 Platform | NLP Engine + SLA Monitor + Encryption | M12 -> M06 |
| W06-L2-075-078 | Juvi | Grievance Interface + Signal Emission | Juvi <-> M06 |

---

## 4. Entity Gap Analysis

### 4.1 Models to Enhance (Schema Changes Required)

#### StudentGrievance -- Major Enhancement

```
NEW FIELDS:
  isAnonymous: Boolean (default false)
  encryptedIdentity?: String          // AES-256, decryptable only by Principal
  aiClassification?: {
    suggestedCategory: String
    suggestedSeverity: 'P1' | 'P2' | 'P3'
    confidence: Number (0-1)
    duplicateCandidates: ObjectId[]
    classifiedAt: Date
  }
  severity: 'P1' | 'P2' | 'P3'       // replaces priority with SLA-linked values
  sla: {
    deadline: Date
    breached: Boolean
    breachedAt?: Date
    escalationLevel: Number (0-3)
  }
  handlerDepartment?: String
  escalationHistory: [{
    from: ObjectId
    to: ObjectId
    reason: String
    escalatedAt: Date
    escalatedBy: String
  }]
  internalNotes: [{                    // not visible to student
    note: String
    by: ObjectId
    at: Date
  }]
  duplicateOf?: ObjectId              // link to merged grievance
  feedbackRating?: Number
  feedbackComment?: String
  reopenCount: Number (default 0)
  reopenHistory: [{ reason: String, at: Date }]

ENUM CHANGES:
  category: add 'administrative', 'interpersonal', 'service' (currently missing)
  status: add 'escalated', 'reopened', 'awaiting_feedback'
  remove 'priority', replace with 'severity'
```

#### AntiRaggingComplaint -- Major Enhancement

```
NEW FIELDS:
  encryptedComplainantIdentity?: String
  witnessIds: ObjectId[]
  evidenceAttachments: [{
    fileId: String
    type: 'photo' | 'video' | 'document' | 'audio'
    uploadedAt: Date
    uploadedBy: ObjectId
  }]
  incidentLocation?: String
  assessmentPhase: {
    assessedBy: ObjectId
    assessedAt: Date
    recommendation: 'investigate' | 'dismiss' | 'mediate'
    remarks: String
    priorHistory: { count: Number, details: String }
  }
  investigationPhase: {
    investigatorIds: ObjectId[]
    startedAt: Date
    completedAt?: Date
    findings: String
    witnessStatements: [{ witnessId: ObjectId, statement: String, recordedAt: Date }]
  }
  hearingPhase: {
    hearingDate: Date
    attendees: ObjectId[]
    proceedings: String
    decisionDate: Date
  }
  decision: {
    outcome: 'guilty' | 'not_guilty' | 'insufficient_evidence'
    penalty?: String
    penaltySeverity?: 'warning' | 'suspension' | 'expulsion' | 'fir'
    decidedBy: ObjectId
    decidedAt: Date
  }
  firDetails?: {
    firNumber: String
    policeStation: String
    filedDate: Date
    filedBy: ObjectId
  }
  appealPhase?: {
    appealedBy: ObjectId
    appealedAt: Date
    grounds: String
    reviewCommittee: ObjectId[]
    outcome?: 'upheld' | 'modified' | 'overturned'
    decidedAt?: Date
  }
  ugcReportId?: ObjectId
  committeeId: ObjectId              // ref to Committee model

ENUM CHANGES:
  status: expand to 'filed' | 'assessing' | 'investigating' | 'hearing_scheduled' |
          'hearing_complete' | 'decision_issued' | 'penalty_executing' | 'appealed' |
          'appeal_decided' | 'closed' | 'referred_to_police'
```

#### CrisisAlert -- Major Enhancement (becomes CCDAlert)

```
RENAME: CrisisAlert -> CCDAlert

NEW FIELDS:
  signals: [{
    signalId: ObjectId (ref: RiskSignal)
    source: 'M03' | 'M04' | 'M08' | 'Juvi' | 'M06'
    type: String
    weight: Number
    receivedAt: Date
  }]
  compoundScore: Number (0-100)
  scoreBreakdown: {
    baseTotal: Number
    firstGenModifier: Number
    crossModuleMultiplier: Number
    temporalMultiplier: Number
    finalScore: Number
  }
  priority: 'P1' | 'P2' | 'P3'
  acknowledgment: {
    acknowledgedBy: ObjectId
    acknowledgedAt: Date
    initialAssessment: String
  }
  investigation?: {
    investigatorId: ObjectId
    startedAt: Date
    findings: String
    completedAt?: Date
  }
  intervention?: {
    type: 'mentor_outreach' | 'counselling_referral' | 'parent_contact' | 'financial_aid' | 'academic_support' | 'other'
    description: String
    executedBy: ObjectId
    executedAt: Date
    outcome?: String
    followUpDate?: Date
  }
  falsePositive: Boolean (default false)
  falsePositiveReason?: String
  suppressDoubleAlert: Boolean (default false)

REMOVE:
  type, reportedBy (replaced by signal-driven generation)

ENUM CHANGES:
  status: 'generated' | 'acknowledged' | 'investigating' | 'intervening' | 'resolved' | 'false_positive'
```

#### CounselingSession -- Restructure

```
REMOVE:
  notes field (clinical notes must NOT be stored in Juvion)

RESTRUCTURE AS: CounsellingReferral (new purpose)
  referredBy: ObjectId
  referralSource: 'mentor' | 'st5' | 'self' | 'parent' | 'faculty' | 'ccd_alert'
  triggeringCaseId?: ObjectId
  triggeringCaseType?: 'grievance' | 'crisis' | 'misconduct' | 'academic'
  status: 'referred' | 'accepted' | 'in_progress' | 'completed' | 'declined'
  appointmentDates: Date[]           // dates only, no session content
  followUpStatus: 'pending' | 'on_track' | 'missed' | 'completed'
  closedAt?: Date
  closedReason?: String

NOTE: The existing CounselingSession model with notes violates the spec.
It must be replaced with CounsellingReferral that tracks only metadata.
```

#### ParentMeeting -- Minor Enhancement

```
NEW FIELDS:
  triggeringCaseId?: ObjectId
  triggeringCaseType?: 'grievance' | 'disciplinary' | 'crisis' | 'mentoring' | 'academic'
  welfareContext?: String
```

### 4.2 New Models Required (20 new entities)

#### M06.1 GGM Entities

**GrievanceAssignment**
```typescript
{
  collegeId: ObjectId
  grievanceId: ObjectId (ref: StudentGrievance)
  assignedTo: ObjectId (ref: Person)
  assignedBy: ObjectId | 'AI_TRIAGE'
  department: String
  assignedAt: Date
  acceptedAt?: Date
  status: 'pending' | 'accepted' | 'reassigned' | 'completed'
}
```

**SystemicPattern**
```typescript
{
  collegeId: ObjectId
  detectedAt: Date
  category: String
  pattern: String                     // AI-generated description
  grievanceIds: ObjectId[]            // related grievances
  frequency: Number
  severity: 'low' | 'medium' | 'high'
  status: 'detected' | 'reviewed' | 'actioned' | 'dismissed'
  reviewedBy?: ObjectId
  governanceAlertId?: ObjectId        // M11 linkage
}
```

#### M06.3 ICC Entities

**ICCComplaint**
```typescript
{
  collegeId: ObjectId
  complainantId: ObjectId
  encryptedComplainantIdentity?: String
  respondentId: ObjectId
  respondentType: 'student' | 'faculty' | 'staff'
  description: String
  incidentDate: Date
  filedDate: Date
  deadlineDate: Date                  // filedDate + 90 days
  status: 'filed' | 'preliminary_assessment' | 'inquiry' | 'hearing' |
          'recommendation_issued' | 'appealed' | 'closed'
  committeeId: ObjectId
  assessmentPhase?: { ... }
  inquiryPhase?: { ... }
  hearingPhase?: { ... }
  recommendation?: {
    action: String
    decidedBy: ObjectId
    decidedAt: Date
  }
  appealPhase?: { ... }
  confidentialityLevel: 'icc_only'    // enforced at query layer
}
```

**ICCAnnualReport**
```typescript
{
  collegeId: ObjectId
  year: Number
  totalComplaints: Number
  resolvedCount: Number
  pendingCount: Number
  averageResolutionDays: Number
  status: 'draft' | 'submitted'
  submittedTo: String                 // regulatory body
  submittedAt?: Date
  regulatoryFilingId?: ObjectId       // M10 linkage
}
```

#### M06.4 SCST Entities

**SCSTComplaint**
```typescript
{
  collegeId: ObjectId
  complainantId: ObjectId
  respondentId: ObjectId
  description: String
  incidentDate: Date
  casteCategory: String
  status: 'filed' | 'investigating' | 'decision' | 'police_referred' | 'closed'
  committeeId: ObjectId
  investigationPhase?: { ... }
  decision?: { ... }
  policeReferral?: {
    referralDate: Date
    policeStation: String
    firNumber?: String
    referredBy: ObjectId
    isAtrocitiesAct: Boolean
  }
}
```

#### M06.5 GRC Entities

**GRCComplaint**
```typescript
{
  collegeId: ObjectId
  escalatedFrom?: ObjectId            // original StudentGrievance
  complainantId: ObjectId
  description: String
  filedDate: Date
  hearingDeadline: Date               // filedDate + 15 days
  decisionDeadline: Date              // filedDate + 30 days
  status: 'filed' | 'investigating' | 'hearing_scheduled' | 'hearing_complete' |
          'decision_issued' | 'appealed_to_ombudsman' | 'closed'
  committeeId: ObjectId
  investigationPhase?: { ... }
  hearingPhase?: { ... }
  decision?: { ... }
  ombudsmanAppeal?: {
    filedDate: Date
    referenceNumber?: String
    outcome?: String
  }
}
```

#### M06.6 MENT Entities

**MentorAssignment**
```typescript
{
  collegeId: ObjectId
  mentorId: ObjectId (ref: Faculty)
  studentId: ObjectId (ref: Student)
  academicYearId: ObjectId
  semesterId?: ObjectId
  assignedDate: Date
  assignedBy: ObjectId                // HOD who approved
  status: 'active' | 'transferred' | 'completed'
  aiSuggested: Boolean                // whether AI suggested this pairing
}
```

**MentorSession**
```typescript
{
  collegeId: ObjectId
  assignmentId: ObjectId (ref: MentorAssignment)
  mentorId: ObjectId
  studentId: ObjectId
  sessionDate: Date
  duration?: Number                   // minutes
  mode: 'in_person' | 'online'
  topicsSummary?: String              // mentor-controlled, optional
  concernFlagged: Boolean (default false)
  concernType?: 'academic' | 'personal' | 'financial' | 'health' | 'other'
  referralMade: Boolean (default false)
  referralType?: 'counselling' | 'financial_aid' | 'academic_support'
}
```

**MentorConcern**
```typescript
{
  collegeId: ObjectId
  mentorId: ObjectId
  studentId: ObjectId
  sessionId?: ObjectId (ref: MentorSession)
  concernType: 'academic' | 'personal' | 'financial' | 'health' | 'behavioral' | 'other'
  description: String
  severity: 'low' | 'medium' | 'high'
  actionTaken?: String
  escalatedToCCD: Boolean (default false)
  riskSignalId?: ObjectId             // if fed to CCD
  status: 'open' | 'addressed' | 'escalated' | 'closed'
}
```

#### M06.8 DISC Entities

**MisconductReport**
```typescript
{
  collegeId: ObjectId
  reportedBy: ObjectId
  reporterRole: 'faculty' | 'warden' | 'student' | 'staff'
  studentId: ObjectId
  category: 'academic_fraud' | 'behavioral' | 'property_damage' | 'substance' | 'violence' | 'other'
  description: String
  incidentDate: Date
  evidenceAttachments: [{ fileId: String, type: String, uploadedAt: Date }]
  priorViolationCount: Number
  status: 'filed' | 'preliminary_inquiry' | 'hearing_scheduled' | 'hearing_complete' |
          'penalty_issued' | 'penalty_executing' | 'appealed' | 'appeal_decided' | 'closed'
  inquiryPhase?: { ... }
  hearingPhase?: { ... }
  decision?: {
    outcome: 'warning' | 'fine' | 'suspension' | 'rustication' | 'expulsion' | 'exonerated'
    details: String
    decidedBy: ObjectId
    decidedAt: Date
  }
  appealPhase?: { ... }
  committeeId: ObjectId
  m02DisciplinaryRecordId?: ObjectId  // written to student profile
}
```

#### M06.9 CCD Entities

**RiskSignal**
```typescript
{
  collegeId: ObjectId
  studentId: ObjectId
  source: 'M03' | 'M04' | 'M08' | 'Juvi' | 'M06'
  signalType: 'attendance_drop' | 'failing_grades' | 'backlog_accumulation' |
              'fee_default' | 'scholarship_loss' | 'warden_concern' |
              'mess_attendance_drop' | 'messaging_withdrawal' | 'sentiment_anomaly' |
              'isolation_indicators' | 'grievance_filed' | 'counselling_active'
  baseWeight: Number                  // Low=15, Medium=25, High=40, Context=10
  firstGenModifier: Number            // percentage boost
  computedWeight: Number              // after modifier
  triggerData: Record<string, any>    // source-specific context (never contains message content)
  receivedAt: Date
  expiresAt: Date                     // receivedAt + 30 days
  decayed: Boolean (default false)
  consumedByAlertId?: ObjectId        // which CCDAlert used this signal
  status: 'active' | 'decayed' | 'consumed' | 'suppressed'
}
// Index: { collegeId: 1, studentId: 1, status: 1, receivedAt: -1 }
```

**CCDThreshold** (M11-managed, M06-read)
```typescript
{
  collegeId: ObjectId
  name: String
  priority: 'P1' | 'P2' | 'P3'
  scoreThreshold: Number              // P1>=75, P2>=50, P3>=35
  crossModuleMinimum: Number          // minimum distinct modules (default 1)
  temporalWindowDays: Number          // default 14
  compoundingMultiplier: Number       // default 1.5
  decayDays: Number                   // default 30
  isActive: Boolean
  updatedBy: ObjectId
}
```

**CCDIntervention**
```typescript
{
  collegeId: ObjectId
  alertId: ObjectId (ref: CCDAlert)
  studentId: ObjectId
  type: 'mentor_outreach' | 'counselling_referral' | 'parent_contact' |
        'financial_aid_referral' | 'academic_support' | 'hostel_check' | 'other'
  description: String
  executedBy: ObjectId
  executedAt: Date
  outcome?: String
  followUpDate?: Date
  followUpStatus?: 'pending' | 'completed' | 'overdue'
  linkedEntityId?: ObjectId           // e.g., CounsellingReferral or ParentMeeting
  linkedEntityType?: String
}
```

### 4.3 Entity Count Summary

| Category | Current | After W06 | Delta |
|---|---|---|---|
| Enhanced models | 0 | 5 | +5 schema changes |
| New models (GGM) | 0 | 2 | +2 |
| New models (ICC) | 0 | 2 | +2 |
| New models (SCST) | 0 | 1 | +1 |
| New models (GRC) | 0 | 1 | +1 |
| New models (MENT) | 0 | 3 | +3 |
| New models (DISC) | 0 | 1 | +1 |
| New models (CCD) | 0 | 3 | +3 |
| New models (shared) | 0 | 1 | +1 (CounsellingReferral replaces CounselingSession) |
| **Total models** | **16** | **30** | **+14 new, 5 enhanced, 1 replaced** |

---

## 5. API Endpoint Gap Analysis

### 5.1 Existing Endpoints (pure CRUD, all under `/api/welfare/`)

All 16 entities have standard CRUD: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.
Total: 80 routes (16 entities x 5) + 1 stats = 81.

### 5.2 New Endpoints Required

#### M06.1 GGM Endpoints

```
POST   /api/welfare/grievances                        # File grievance (with optional anonymous)
POST   /api/welfare/grievances/:id/triage             # AI triage (returns suggestion, human confirms)
POST   /api/welfare/grievances/:id/confirm-triage     # Human confirms/overrides AI triage
POST   /api/welfare/grievances/:id/assign             # Assign to handler
POST   /api/welfare/grievances/:id/escalate           # Escalate (manual or SLA-triggered)
POST   /api/welfare/grievances/:id/resolve            # Propose resolution
POST   /api/welfare/grievances/:id/feedback           # Student feedback on resolution
POST   /api/welfare/grievances/:id/reopen             # Reopen after resolution
POST   /api/welfare/grievances/:id/close              # Final close
POST   /api/welfare/grievances/:id/add-note           # Internal note (not visible to student)
GET    /api/welfare/grievances/:id/duplicates          # AI-suggested duplicates
GET    /api/welfare/grievances/sla-dashboard           # SLA status overview
GET    /api/welfare/grievances/analytics               # Aggregated analytics
POST   /api/welfare/grievances/detect-patterns         # Trigger systemic pattern scan
```

#### M06.2 ARC Endpoints

```
POST   /api/welfare/arc/complaints                     # File ARC complaint
POST   /api/welfare/arc/complaints/:id/assess          # Record initial assessment
POST   /api/welfare/arc/complaints/:id/start-investigation   # Begin investigation
POST   /api/welfare/arc/complaints/:id/record-witness   # Record witness statement
POST   /api/welfare/arc/complaints/:id/complete-investigation # Submit investigation findings
POST   /api/welfare/arc/complaints/:id/schedule-hearing # Schedule hearing
POST   /api/welfare/arc/complaints/:id/record-hearing   # Record hearing proceedings
POST   /api/welfare/arc/complaints/:id/issue-decision   # Issue decision
POST   /api/welfare/arc/complaints/:id/execute-penalty  # Execute penalty (triggers M02/M05)
POST   /api/welfare/arc/complaints/:id/appeal           # File appeal
POST   /api/welfare/arc/complaints/:id/decide-appeal    # Decide appeal
POST   /api/welfare/arc/complaints/:id/file-fir         # Record FIR details
GET    /api/welfare/arc/complaints/:id/history          # Full complaint lifecycle
POST   /api/welfare/arc/ugc-report                     # Generate UGC report
GET    /api/welfare/arc/ugc-reports                    # List UGC reports
```

#### M06.3 ICC Endpoints

```
POST   /api/welfare/icc/complaints                     # File ICC complaint
POST   /api/welfare/icc/complaints/:id/preliminary      # Record preliminary assessment
POST   /api/welfare/icc/complaints/:id/start-inquiry    # Begin inquiry
POST   /api/welfare/icc/complaints/:id/complete-inquiry  # Submit inquiry findings
POST   /api/welfare/icc/complaints/:id/schedule-hearing  # Schedule hearing
POST   /api/welfare/icc/complaints/:id/record-hearing    # Record hearing
POST   /api/welfare/icc/complaints/:id/issue-recommendation # Issue recommendation
POST   /api/welfare/icc/complaints/:id/appeal           # File appeal
POST   /api/welfare/icc/complaints/:id/decide-appeal    # Decide appeal
GET    /api/welfare/icc/complaints/:id/timeline         # Full 90-day timeline
GET    /api/welfare/icc/deadline-dashboard              # Track 90-day deadlines
POST   /api/welfare/icc/annual-report                  # Generate annual report
GET    /api/welfare/icc/annual-reports                 # List annual reports
```

#### M06.4 SCST Endpoints

```
POST   /api/welfare/scst/complaints                    # File SCST complaint
POST   /api/welfare/scst/complaints/:id/investigate     # Record investigation
POST   /api/welfare/scst/complaints/:id/decide          # Issue decision
POST   /api/welfare/scst/complaints/:id/refer-police    # Police referral (non-discretionary)
GET    /api/welfare/scst/complaints/:id/timeline        # Full timeline
POST   /api/welfare/scst/quarterly-report              # Generate quarterly report
```

#### M06.5 GRC Endpoints

```
POST   /api/welfare/grc/complaints                     # File/escalate to GRC
POST   /api/welfare/grc/complaints/:id/investigate      # Record investigation
POST   /api/welfare/grc/complaints/:id/schedule-hearing  # Schedule hearing (15-day deadline)
POST   /api/welfare/grc/complaints/:id/record-hearing    # Record hearing
POST   /api/welfare/grc/complaints/:id/issue-decision    # Issue decision (30-day deadline)
POST   /api/welfare/grc/complaints/:id/appeal-ombudsman  # Appeal to ombudsman
GET    /api/welfare/grc/deadline-dashboard              # Track 15/30-day deadlines
```

#### M06.6 MENT Endpoints

```
POST   /api/welfare/mentor/assignments                 # Create mentor assignment
POST   /api/welfare/mentor/assignments/bulk-assign      # Semester bulk assignment (AI-suggested)
GET    /api/welfare/mentor/assignments                 # List assignments
GET    /api/welfare/mentor/my-mentees                  # Mentor: list own mentees
POST   /api/welfare/mentor/sessions                    # Record mentor session
GET    /api/welfare/mentor/sessions                    # List sessions
POST   /api/welfare/mentor/concerns                    # Flag mentee concern
POST   /api/welfare/mentor/concerns/:id/escalate       # Escalate to CCD
GET    /api/welfare/mentor/at-risk                     # AI-surfaced at-risk mentees
GET    /api/welfare/mentor/coverage-analytics          # Coverage and engagement analytics
```

#### M06.7 COUNS Endpoints

```
POST   /api/welfare/counselling/referrals              # Create referral
GET    /api/welfare/counselling/referrals              # List referrals (filtered by role)
PUT    /api/welfare/counselling/referrals/:id          # Update referral status
POST   /api/welfare/counselling/referrals/:id/close    # Close referral
GET    /api/welfare/counselling/follow-up-dashboard    # Follow-up status overview
GET    /api/welfare/counselling/aggregate-report       # Aggregated counts only
```

#### M06.8 DISC Endpoints

```
POST   /api/welfare/disciplinary/reports               # File misconduct report
GET    /api/welfare/disciplinary/reports               # List reports
POST   /api/welfare/disciplinary/reports/:id/inquiry    # Begin preliminary inquiry
POST   /api/welfare/disciplinary/reports/:id/schedule-hearing  # Schedule hearing
POST   /api/welfare/disciplinary/reports/:id/record-hearing    # Record hearing
POST   /api/welfare/disciplinary/reports/:id/issue-decision    # Issue decision
POST   /api/welfare/disciplinary/reports/:id/execute-penalty   # Execute penalty (M02 write)
POST   /api/welfare/disciplinary/reports/:id/appeal            # File appeal
POST   /api/welfare/disciplinary/reports/:id/decide-appeal     # Decide appeal
GET    /api/welfare/disciplinary/reports/:id/history           # Full case lifecycle
GET    /api/welfare/disciplinary/student/:studentId/record     # Student's disciplinary record
```

#### M06.9 CCD Endpoints

```
POST   /api/welfare/ccd/signals                        # Ingest risk signal (internal, from event bus)
GET    /api/welfare/ccd/alerts                         # List alerts (ST5/Principal)
GET    /api/welfare/ccd/alerts/:id                     # Get alert with signals and score breakdown
POST   /api/welfare/ccd/alerts/:id/acknowledge         # Acknowledge alert
POST   /api/welfare/ccd/alerts/:id/investigate         # Begin investigation
POST   /api/welfare/ccd/alerts/:id/intervene           # Record intervention
POST   /api/welfare/ccd/alerts/:id/resolve             # Resolve alert
POST   /api/welfare/ccd/alerts/:id/false-positive      # Mark as false positive
GET    /api/welfare/ccd/student/:studentId/risk-profile # Student risk profile (ST5 only)
GET    /api/welfare/ccd/dashboard                      # CCD dashboard with heat map
POST   /api/welfare/ccd/recompute/:studentId           # Force recomputation of student score
```

#### Committee Management (shared across ARC/ICC/SCST/GRC/DISC)

```
POST   /api/welfare/committees                         # Constitute committee
GET    /api/welfare/committees                         # List welfare committees
GET    /api/welfare/committees/:id                     # Get committee details
PUT    /api/welfare/committees/:id                     # Update committee membership
GET    /api/welfare/committees/:id/cases               # List cases assigned to committee
```

### 5.3 Endpoint Count Summary

| Sub-domain | New Endpoints | Notes |
|---|---|---|
| GGM | 14 | Replaces flat grievance CRUD |
| ARC | 15 | Replaces flat complaint CRUD |
| ICC | 13 | Entirely new |
| SCST | 6 | Entirely new |
| GRC | 7 | Entirely new |
| MENT | 10 | Entirely new |
| COUNS | 6 | Replaces flat session CRUD |
| DISC | 11 | Entirely new |
| CCD | 11 | Replaces flat crisis CRUD |
| Committees | 5 | Shared across sub-domains |
| **Total new** | **98** | Replacing ~25 existing CRUD endpoints |

---

## 6. State Machine Definitions

### 6.1 W06 Workflow Definition (WorkflowEngine integration)

W06 requires multiple interconnected state machines. Unlike W01 (single linear flow per applicant), W06 has independent state machines per sub-domain that can run concurrently for the same student.

#### 6.1.1 Grievance Lifecycle (GGM)

```
States: filed -> ai_triaged -> assigned -> investigating -> resolution_proposed ->
        awaiting_feedback -> closed
        
Branch: ai_triaged -> [confidence < 70%] -> manual_triage -> assigned
Branch: resolution_proposed -> [student rejects] -> reopened -> investigating
Branch: investigating -> [SLA breached] -> escalated -> [re-assigned] -> investigating
Branch: closed -> [student reopens] -> reopened (max 2 reopens)

Terminal States: closed
```

```typescript
// WorkflowDefinition for W06-GGM
const W06_GGM: WorkflowDefinition = {
  id: 'W06-GGM',
  name: 'General Grievance Management',
  version: 1,
  entityType: 'StudentGrievance',
  phases: [
    {
      id: 'M06.1_FILE',
      name: 'Filing & Triage',
      description: 'Grievance filing, AI classification, and routing',
      order: 1,
      steps: [
        {
          id: 'grievance_file', name: 'File Grievance', phase: 'M06.1_FILE',
          type: 'manual', assigneeRole: 'student',
          aiAutonomy: 'none',
          onComplete: 'welfare:grievance:filed',
        },
        {
          id: 'grievance_ai_triage', name: 'AI Triage & Classification', phase: 'M06.1_FILE',
          type: 'automated', aiAutonomy: 'flags_for_review',
          onComplete: 'welfare:grievance:triaged',
          metadata: { description: 'NLP classification, severity suggestion, duplicate detection' },
        },
        {
          id: 'grievance_manual_triage', name: 'Manual Triage (Low Confidence)', phase: 'M06.1_FILE',
          type: 'manual', assigneeRole: 'welfare_officer',
          aiAutonomy: 'assists',
        },
        {
          id: 'grievance_confirm_route', name: 'Confirm Triage & Route', phase: 'M06.1_FILE',
          type: 'manual', assigneeRole: 'welfare_officer',
          aiAutonomy: 'assists',
          onComplete: 'welfare:grievance:routed',
        },
      ],
    },
    {
      id: 'M06.1_RESOLVE',
      name: 'Investigation & Resolution',
      description: 'Handle, investigate, and resolve the grievance',
      order: 2,
      steps: [
        {
          id: 'grievance_investigate', name: 'Investigate Grievance', phase: 'M06.1_RESOLVE',
          type: 'manual', assigneeRole: 'handler',
          timeout: 168, // 7 days max (P3 SLA)
          onComplete: 'welfare:grievance:investigated',
        },
        {
          id: 'grievance_resolve', name: 'Propose Resolution', phase: 'M06.1_RESOLVE',
          type: 'manual', assigneeRole: 'handler',
          onComplete: 'welfare:grievance:resolution_proposed',
        },
        {
          id: 'grievance_feedback', name: 'Student Feedback', phase: 'M06.1_RESOLVE',
          type: 'manual', assigneeRole: 'student',
          timeout: 72, // 3 days to respond
          onComplete: 'welfare:grievance:feedback_received',
        },
        {
          id: 'grievance_close', name: 'Close Grievance', phase: 'M06.1_RESOLVE',
          type: 'automated', aiAutonomy: 'autonomous',
          onComplete: 'welfare:grievance:closed',
        },
      ],
    },
    {
      id: 'M06.1_ESCALATE',
      name: 'Escalation',
      description: 'SLA breach or manual escalation path',
      order: 3,
      steps: [
        {
          id: 'grievance_escalate', name: 'Escalate Grievance', phase: 'M06.1_ESCALATE',
          type: 'automated', aiAutonomy: 'flags_for_review',
          onComplete: 'welfare:grievance:escalated',
        },
      ],
    },
  ],
  transitions: [
    { from: 'grievance_file', to: 'grievance_ai_triage', event: 'complete' },
    { from: 'grievance_ai_triage', to: 'grievance_manual_triage', event: 'complete', guard: 'low_ai_confidence' },
    { from: 'grievance_ai_triage', to: 'grievance_confirm_route', event: 'complete', guard: 'high_ai_confidence' },
    { from: 'grievance_manual_triage', to: 'grievance_confirm_route', event: 'complete' },
    { from: 'grievance_confirm_route', to: 'grievance_investigate', event: 'complete' },
    { from: 'grievance_investigate', to: 'grievance_resolve', event: 'complete' },
    { from: 'grievance_investigate', to: 'grievance_escalate', event: 'complete', guard: 'sla_breached' },
    { from: 'grievance_resolve', to: 'grievance_feedback', event: 'complete' },
    { from: 'grievance_feedback', to: 'grievance_close', event: 'complete', guard: 'feedback_positive' },
    { from: 'grievance_feedback', to: 'grievance_investigate', event: 'complete', guard: 'feedback_negative' },
    { from: 'grievance_escalate', to: 'grievance_investigate', event: 'complete' },
  ],
  initialStep: 'grievance_file',
  terminalSteps: ['grievance_close'],
};
```

#### 6.1.2 ARC Investigation Lifecycle

```
States: filed -> assessing -> [dismiss | mediate | investigate]
        investigate -> hearing_scheduled -> hearing_complete -> decision_issued
        decision_issued -> [penalty_executing | appealed]
        penalty_executing -> closed
        appealed -> appeal_decided -> [closed | penalty_executing_modified]
        
Branch: assessing -> [severe] -> referred_to_police (parallel to investigation)
Terminal States: closed, dismissed, mediated
```

#### 6.1.3 ICC Inquiry Lifecycle (90-day statutory deadline)

```
States: filed -> preliminary_assessment -> [dismiss | conciliate | inquiry]
        inquiry (90-day deadline) -> hearing -> recommendation_issued
        recommendation_issued -> [action_executed | appealed]
        appealed -> appeal_decided -> closed
        
HARD CONSTRAINT: inquiry MUST complete within 90 days of filing.
AI monitors only. All decisions are human.
Terminal States: closed, dismissed, conciliated
```

#### 6.1.4 Disciplinary Case Lifecycle

```
States: reported -> preliminary_inquiry -> [dismiss | hearing_scheduled]
        hearing_scheduled -> hearing_complete -> decision_issued
        decision_issued -> penalty_executing -> [closed | appealed]
        appealed -> appeal_decided -> [closed | penalty_modified]

Branch: reported -> [academic_fraud] -> academic_fraud_investigation -> hearing_scheduled
Terminal States: closed, dismissed, exonerated
```

#### 6.1.5 CCD Alert Lifecycle

```
States: generated -> acknowledged -> [investigating | false_positive]
        investigating -> [intervening | resolved]
        intervening -> [resolved | follow_up_needed]
        follow_up_needed -> [resolved | intervening]

HARD CONSTRAINT: AI generates. Human acknowledges. Human investigates. Human intervenes.
AI NEVER auto-initiates contact with student.
Terminal States: resolved, false_positive
```

### 6.2 SLA Timer Definitions

| Sub-domain | SLA | Timer Source | Escalation |
|---|---|---|---|
| GGM P1 | 24 hours | grievance.sla.deadline | Level 1: HOD. Level 2: Dean. Level 3: Principal |
| GGM P2 | 3 business days | grievance.sla.deadline | Same chain, +24h per level |
| GGM P3 | 7 business days | grievance.sla.deadline | Same chain |
| ARC | Case-specific | Committee sets timeline | Chairman -> Principal |
| ICC | 90 calendar days | complaint.deadlineDate | Presiding Officer -> Principal -> District Officer |
| GRC | 15 days (hearing), 30 days (decision) | complaint.hearingDeadline / decisionDeadline | Chair -> Principal -> Ombudsman |
| CCD P1 | 4 hours acknowledgment | alert.createdAt + 4h | Auto-notify Principal if unacknowledged |
| CCD P2 | 24 hours acknowledgment | alert.createdAt + 24h | Auto-notify Dean |
| CCD P3 | 72 hours acknowledgment | alert.createdAt + 72h | Auto-notify HOD |

**SLA Monitoring Implementation:** BullMQ repeatable job (`welfare:sla:check`) runs every 15 minutes. Checks all open entities with SLA deadlines. Emits `welfare:sla:breached` events. Creates Notification records and escalation log entries.

---

## 7. Business Logic Requirements

### 7.1 NLP Classification (M12-provided)

**Service:** `M12.NLPService.classifyGrievance(text: string)`

**Returns:**
```typescript
{
  category: string           // infrastructure | academic | administrative | interpersonal | service
  suggestedSeverity: 'P1' | 'P2' | 'P3'
  confidence: number         // 0.0 - 1.0
  keywords: string[]
  suggestedDepartment: string
}
```

**Rules:**
- Confidence >= 70%: auto-apply classification, route to suggested handler. ST5 can override.
- Confidence < 70%: flag for mandatory human triage. AI suggestion shown as reference.
- Keywords containing "ragging", "harassment", "sexual", "caste" -> auto-flag for committee routing (ARC/ICC/SCST), regardless of original category.
- Implementation: Call M12 Platform AI service. M12 does NOT store grievance content -- stateless NLP computation.

### 7.2 Severity Scoring

**Grievance Severity (P1/P2/P3):**
- P1 (24h): Physical safety, discrimination, harassment, legal exposure
- P2 (3-day): Service disruption, repeated complaints, multi-student impact
- P3 (7-day): Individual convenience, first-time minor issue

**AI Severity Suggestion Factors:**
- Keyword analysis (safety terms, legal terms, urgency language)
- Student history (repeat grievances on same topic)
- Category-severity mapping (infrastructure/safety defaults to P2+)
- Volume detection (>3 grievances on same topic in 7 days -> P2+)

### 7.3 SLA Tracking

**Schema:**
```typescript
interface SLAConfig {
  P1: { hours: 24, businessHoursOnly: false }
  P2: { hours: 72, businessHoursOnly: true }
  P3: { hours: 168, businessHoursOnly: true }
}
```

**Business Hours:** 9:00 AM - 6:00 PM, Monday-Saturday. College holidays excluded (read from M03 AcademicCalendar).

**SLA Breach Handling:**
1. SLA check job detects breach
2. Create SLA breach event: `welfare:sla:breached`
3. Auto-escalate to next level (HOD -> Dean -> Principal)
4. Mark `grievance.sla.breached = true`, `grievance.sla.breachedAt = now`
5. Add escalation to `grievance.escalationHistory[]`
6. Send notification to new handler AND previous handler's supervisor

### 7.4 Duplicate Detection

**Algorithm:**
1. Extract key terms from new grievance description (M12 NLP)
2. Search open grievances for same `collegeId` with:
   - Same or overlapping category
   - Text similarity score > 0.7 (cosine similarity on TF-IDF vectors)
   - Filed within last 30 days
3. Return ranked candidate list with similarity scores
4. Student sees: "Similar grievances found. Would you like to merge or proceed?"
5. Decision is always student's / ST5's -- AI never auto-merges.

### 7.5 Compound Risk Scoring (CCD)

**Signal Ingestion:**
```typescript
async function ingestSignal(collegeId: string, signal: {
  studentId: string;
  source: SignalSource;
  signalType: SignalType;
  triggerData: Record<string, any>;
}): Promise<RiskSignal> {
  const baseWeight = SIGNAL_WEIGHTS[signal.signalType].base;
  const student = await Student.findOne({ _id: signal.studentId, collegeId });
  const isFirstGen = student?.category === 'first_gen'; // S6 persona
  const firstGenMod = isFirstGen ? SIGNAL_WEIGHTS[signal.signalType].firstGenModifier : 0;
  const computedWeight = baseWeight + (baseWeight * firstGenMod / 100);

  return RiskSignal.create({
    collegeId,
    studentId: signal.studentId,
    source: signal.source,
    signalType: signal.signalType,
    baseWeight,
    firstGenModifier: firstGenMod,
    computedWeight,
    triggerData: signal.triggerData,
    receivedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600_000), // 30-day TTL
    status: 'active',
  });
}
```

**Score Computation:**
```typescript
async function computeRiskScore(collegeId: string, studentId: string): Promise<{
  score: number;
  priority: 'P1' | 'P2' | 'P3' | null;
  breakdown: ScoreBreakdown;
}> {
  const thresholds = await CCDThreshold.find({ collegeId, isActive: true });
  const windowDays = thresholds[0]?.temporalWindowDays ?? 14;
  const cutoff = new Date(Date.now() - windowDays * 24 * 3600_000);

  const activeSignals = await RiskSignal.find({
    collegeId, studentId, status: 'active', receivedAt: { $gte: cutoff },
  });

  if (activeSignals.length === 0) return { score: 0, priority: null, breakdown: ... };

  const baseTotal = activeSignals.reduce((sum, s) => sum + s.computedWeight, 0);
  const distinctModules = new Set(activeSignals.map(s => s.source)).size;
  const crossModuleMultiplier = distinctModules >= 3 ? 1.5 : 1.0;

  // Temporal clustering: signals within 14-day window
  const recentSignals = activeSignals.filter(s =>
    s.receivedAt.getTime() > Date.now() - windowDays * 24 * 3600_000
  );
  const temporalMultiplier = recentSignals.length >= 2 ? 1.5 : 1.0;

  const rawScore = baseTotal * crossModuleMultiplier * temporalMultiplier;
  const score = Math.min(100, Math.round(rawScore));

  const priority = score >= 75 ? 'P1' : score >= 50 ? 'P2' : score >= 35 ? 'P3' : null;

  return { score, priority, breakdown: { baseTotal, crossModuleMultiplier, temporalMultiplier, finalScore: score } };
}
```

**Signal Decay:** BullMQ job `welfare:ccd:decay` runs hourly. Marks signals > 30 days old as `decayed`. Recomputes affected student scores.

**Double-Alert Suppression:** If student has an active (non-resolved) CCDAlert, new signals are added to that alert rather than generating a new one. Score is recomputed but no new alert notification is sent unless priority escalates.

### 7.6 Confidentiality Enforcement

**Implementation:** Middleware-level query filtering based on user role and sub-domain.

```typescript
// Confidentiality middleware for ICC
function iccConfidentialityFilter(req: AuthRequest): FilterQuery {
  const userId = req.user?.id;
  const roles = req.user?.roles;

  // Only ICC committee members can access ICC complaints
  if (!roles?.includes('icc_member') && !roles?.includes('icc_presiding_officer')) {
    throw new AppError(403, 'ICC records are restricted to ICC committee members');
  }

  // Presiding Officer sees all; members see assigned cases
  if (roles?.includes('icc_presiding_officer')) {
    return { collegeId: req.collegeId };
  }

  return {
    collegeId: req.collegeId,
    committeeId: { $in: await getCommitteesForMember(req.collegeId!, userId!) },
  };
}
```

**Confidentiality Levels by Sub-Domain:**

| Level | Sub-Domains | Access Pattern |
|---|---|---|
| HIGHEST | ICC, COUNS | Role-restricted at middleware. No data in aggregates. |
| High | ARC, SCST, DISC, CCD | Committee/designated staff only. Aggregated stats allowed. |
| Low-Medium | GGM, GRC | Handler + supervisory chain. Student sees own. |
| Low | MENT | Mentor + HOD. Student sees own mentor. |

**Anonymous Identity Encryption:**
- Anonymous grievance/complaint: `complainantId` set to null in public view.
- `encryptedIdentity` field stores AES-256 encrypted identity, decryptable only with Principal's key.
- Key management via M12 Platform encryption service.
- Audit log records every decryption attempt.

---

## 8. Cross-Module Integration Points

### 8.1 M02 People (Read + Write)

**Read:**
- Student profile (demographics, category, first-gen status for CCD weighting)
- Prior disciplinary records (for pattern detection in ARC/DISC)
- Parent contact information (for crisis intervention)

**Write:**
- Disciplinary record entry when DISC penalty is executed
- Student status update (suspension, rustication) via DISC/ARC decisions

**Events:**
- `welfare:disciplinary:penalty_executed` -> M02 writes DisciplinaryRecord
- `welfare:arc:fir_filed` -> M02 flags student record

### 8.2 M03 Academics (Signal Source)

**Signals Emitted (M03 -> M06):**
- `academics:attendance:dropped` -- attendance drop > 15% in 2 weeks
- `academics:grades:failing` -- below pass in multiple subjects
- `academics:backlogs:accumulated` -- > 2 backlogs in semester

**Read:**
- Academic calendar (for SLA business-hours computation)
- Student academic performance (for CCD context in investigation)

### 8.3 M04 Finance (Signal Source + Handoff)

**Signals Emitted (M04 -> M06):**
- `finance:fee:defaulted` -- fee overdue > 30 days
- `finance:scholarship:lost` -- lost eligibility

**Handoff Protocol (W06 <-> W03):**
1. M04 detects default > 30 days
2. M04 + M12 compute distress score
3. Distress score > threshold -> `finance:welfare:referral` event
4. M06 ST5 assesses: genuine hardship vs negligence
5. Genuine hardship: M06 -> M04 recommendation for concession/aid
6. No distress: M06 -> M04 clearance to resume normal escalation

### 8.4 M05 HR (Output)

**Write:**
- Committee findings against faculty/staff -> HR disciplinary process
- ICC recommendations involving employees -> HR action

**Events:**
- `welfare:committee:action_against_employee` -> M05 initiates HR process

### 8.5 M08 Campus Ops (Signal + Support)

**Signals Emitted (M08 -> M06):**
- `campus:warden:concern_filed` -- formal warden concern report
- `campus:mess:attendance_dropped` -- significant mess attendance drop

**Read:**
- Hostel allocation data (for crisis response: which room, which block)
- Warden details (for CCD alert routing)

### 8.6 M10 Compliance (Output)

**Write:**
- Committee reports (ARC UGC, ICC annual, SCST quarterly) -> Compliance Evidence
- Regulatory filings generated from committee data

**Events:**
- `welfare:report:generated` -> M10 creates ComplianceEvidence
- `welfare:arc:ugc_report_filed` -> M10 creates RegulatoryFiling
- `welfare:icc:annual_report_filed` -> M10 creates RegulatoryFiling

### 8.7 M11 Governance (Output + Policy)

**Write:**
- Systemic grievance patterns -> Governance alerts
- CCD trend analytics -> Policy recommendations

**Policy Read:**
- CCD threshold configuration (managed by M11, read by M06.9)
- Escalation policies for committees

### 8.8 M12 Platform (AI Engine)

**Services Consumed:**
- `NLPService.classifyGrievance(text)` -- text classification
- `NLPService.detectDuplicates(text, candidateTexts)` -- similarity scoring
- `NLPService.detectPatterns(grievanceTexts)` -- clustering for systemic patterns
- `EncryptionService.encrypt(data, keyId)` -- anonymous identity encryption
- `EncryptionService.decrypt(ciphertext, keyId)` -- Principal-only decryption
- `SLAMonitorService.scheduleCheck(entityId, deadline)` -- SLA timer registration

**Critical Rule:** M12 performs pure computation. It does NOT store grievance content. Stateless processing only.

### 8.9 Juvi (Interface + Signal Source)

**Interface:**
- Grievance filing form (student-facing)
- Status checking (student sees own grievances)
- Anonymous reporting channel

**Signals Emitted (Juvi -> M06):**
- `juvi:messaging:withdrawal` -- > 50% activity drop in 2 weeks (METADATA ONLY)
- `juvi:sentiment:anomaly` -- negative spike (METADATA ONLY)
- `juvi:isolation:detected` -- leaving groups, not responding (METADATA ONLY)

**CRITICAL RULE:** Message CONTENT is never read by AI. Only metadata patterns (frequency, response rates, group membership changes). This is not content analysis -- it is behavioral pattern detection on metadata.

---

## 9. AI Agent Scope

### 9.1 Decision Boundary Matrix

| Action | AI Does | Human Decides |
|---|---|---|
| **Classify grievance** | Suggests category + severity | Confirms or overrides |
| **Route grievance** | Suggests handler department | ST5 confirms routing |
| **Detect duplicates** | Computes similarity scores | Student/ST5 decides merge |
| **Monitor SLA** | Detects breach, triggers alert | Human handles escalation |
| **Auto-escalate** | Creates escalation event | Next-level handler takes over |
| **Score risk** | Computes compound score | ST5 reviews alert, decides action |
| **Flag patterns** | Clusters grievances, detects trends | M11 governance acts |
| **Track deadlines** | Countdown, reminders | Committee acts |
| **Suggest mentor** | Proposes assignment (load balancing) | HOD approves |
| **Surface at-risk** | Identifies from signals | Mentor decides response |
| **Assemble documents** | Collates case timeline | Committee reviews |
| **Generate reports** | Aggregates, anonymizes | Submitted by designated officer |

### 9.2 AI Autonomy Levels by Sub-Domain

| Sub-Domain | Autonomy Level | Detail |
|---|---|---|
| M06.1 GGM | `flags_for_review` | AI suggests; ST5 acts. Confidence < 70% forces manual triage. |
| M06.2 ARC | `assists` | AI assists with history lookup and deadline tracking. No role in adjudication. |
| M06.3 ICC | `none` (minimal) | POSH Act: human adjudication mandatory. AI tracks 90-day deadline only. |
| M06.4 SCST | `none` (minimal) | Atrocities Act: human judgment only. AI tracks deadlines, assembles documents. |
| M06.5 GRC | `assists` | AI assists with escalation suggestions and deadline tracking. |
| M06.6 MENT | `flags_for_review` | AI suggests mentor assignments, detects low engagement. HOD approves. |
| M06.7 COUNS | `none` | Zero AI in clinical process. Follow-up tracking only. |
| M06.8 DISC | `flags_for_review` | Pattern detection (multiple violations). All investigation/hearing human. |
| M06.9 CCD | `flags_for_review` | AI FLAGS; HUMANS DECIDE. AI computes score, generates alert. Human acknowledges, investigates, intervenes. AI NEVER auto-initiates contact with student. |

### 9.3 Guardrails

1. **No autonomous welfare decisions.** Every AI output in W06 is a suggestion, flag, or computation. The human actor explicitly confirms before any action affects a student.

2. **Confidence threshold.** AI classification confidence < 70% -> mandatory human triage. No exceptions.

3. **No clinical data.** AI never accesses counselling session content. Juvion stores only referral metadata (dates, status). Clinical notes are maintained outside the system.

4. **No message content.** Juvi signals are derived from metadata only (frequency, response rate, group membership). Message content is never analyzed.

5. **Score invisibility.** CCD risk scores are never shown to students. Intervention is framed as proactive outreach, never as "you have been flagged."

6. **Audit trail.** Every AI suggestion and every human override is logged to AuditLog with full context.

7. **No automated penalties.** AI can detect plagiarism patterns and flag repeat offenders, but penalty decisions are always made by human committees.

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)

**Goal:** Schema migrations, workflow engine integration, core GGM lifecycle.

**Tasks:**
1. Create 14 new model files in `backend/src/models/welfare/`
2. Enhance 5 existing models (StudentGrievance, AntiRaggingComplaint, CrisisAlert -> CCDAlert, CounselingSession -> CounsellingReferral, ParentMeeting)
3. Register `W06-GGM` workflow definition in `backend/src/shared/workflow/definitions/W06-GGM.ts`
4. Implement GGM service functions: file, triage, assign, escalate, resolve, feedback, reopen, close
5. Add GGM routes with sub-domain authorization (`authorize('welfare.ggm', 'read|create|update')`)
6. Implement SLA tracking BullMQ job (`welfare:sla:check`)
7. Add confidentiality middleware for sub-domain access control
8. Add GGM Zod validation schemas
9. Unit tests for grievance lifecycle state transitions
10. E2E tests for grievance filing through resolution

**Models Created:** GrievanceAssignment, SystemicPattern, MentorAssignment, MentorSession, MentorConcern

**Endpoints Delivered:** ~14 GGM endpoints

### Phase 2: Statutory Committees -- ARC, DISC (Weeks 4-6)

**Goal:** Anti-ragging and disciplinary investigation lifecycles.

**Tasks:**
1. Register `W06-ARC` and `W06-DISC` workflow definitions
2. Implement ARC service functions: file, assess, investigate, hear, decide, penalty, appeal, FIR
3. Implement DISC service functions: report, inquiry, hearing, decision, penalty, appeal
4. Implement committee management endpoints (shared across sub-domains)
5. Cross-module integration: M02 disciplinary record write, M05 HR action
6. Add MisconductReport model and AcademicFraudCase handling
7. ARC UGC reporting endpoint
8. Role-based access control for committee members
9. Evidence attachment handling (file upload integration)
10. E2E tests for ARC complaint through decision and DISC case lifecycle

**Models Created:** MisconductReport

**Endpoints Delivered:** ~15 ARC + 11 DISC + 5 committees = 31 endpoints

### Phase 3: Statutory Committees -- ICC, SCST, GRC (Weeks 7-9)

**Goal:** POSH, SC/ST cell, and GRC operations with strict confidentiality.

**Tasks:**
1. Register `W06-ICC`, `W06-SCST`, `W06-GRC` workflow definitions
2. Implement ICC service with 90-day deadline enforcement
3. Implement ICC confidentiality middleware (HIGHEST level)
4. Implement SCST service with police referral workflow
5. Implement GRC service with 15/30-day deadline enforcement
6. ICC annual report generation
7. SCST quarterly report generation
8. GRC-to-ombudsman appeal pathway
9. Cross-module integration: M10 compliance evidence + regulatory filings
10. Anonymous identity encryption via M12
11. E2E tests for ICC lifecycle (90-day compliance), SCST police referral, GRC escalation

**Models Created:** ICCComplaint, ICCAnnualReport, SCSTComplaint, GRCComplaint

**Endpoints Delivered:** ~13 ICC + 6 SCST + 7 GRC = 26 endpoints

### Phase 4: Mentoring, Counselling, CCD (Weeks 10-13)

**Goal:** Proactive welfare -- mentoring, counselling referrals, compound crisis detection.

**Tasks:**
1. Implement mentor assignment service (with AI suggestion)
2. Implement mentor session tracking and concern flagging
3. Implement counselling referral service (metadata only, no clinical data)
4. Register `W06-CCD` workflow definition
5. Implement RiskSignal ingestion from M03, M04, M08, Juvi event bus listeners
6. Implement compound risk score computation engine
7. Implement CCDAlert generation with priority thresholds
8. Implement CCD dashboard and risk profile endpoints
9. Implement CCDIntervention tracking
10. Signal decay BullMQ job (`welfare:ccd:decay`)
11. Cross-module integration: M11 threshold management, M04 welfare handoff
12. Double-alert suppression logic
13. False positive feedback loop
14. CCD E2E tests: signal -> score -> alert -> acknowledge -> intervene -> resolve

**Models Created:** RiskSignal, CCDThreshold (M11-managed), CCDIntervention, CounsellingReferral

**Endpoints Delivered:** ~10 MENT + 6 COUNS + 11 CCD = 27 endpoints

### Phase 5: NLP Integration & Pattern Detection (Weeks 14-15)

**Goal:** M12 AI service integration for classification, duplicate detection, pattern analysis.

**Tasks:**
1. Implement M12 NLP service interface (classify, duplicates, patterns)
2. Wire NLP into GGM triage step
3. Implement duplicate detection endpoint
4. Implement systemic pattern detection (weekly scan)
5. Wire pattern results to M11 governance alerts
6. Confidence threshold enforcement (< 70% -> manual triage)
7. Integration tests for NLP pipeline

### Phase 6: Analytics, Reporting & Hardening (Weeks 16-17)

**Goal:** Dashboards, compliance reports, performance optimization.

**Tasks:**
1. GGM analytics endpoint (category trends, SLA compliance rates, resolution times)
2. CCD dashboard with risk heat map
3. Mentor coverage analytics
4. Counselling aggregate report (counts only, no PII)
5. Audit log review for all welfare operations
6. Performance optimization: compound indexes, query tuning
7. Load testing for CCD signal ingestion (high-volume scenario)
8. Security audit: confidentiality enforcement verification
9. Full E2E regression test suite

### Dependency Chain

```
Phase 1 (GGM + Foundation)
  |
  +-> Phase 2 (ARC + DISC) -- depends on committee management from Phase 1
  |     |
  |     +-> Phase 3 (ICC + SCST + GRC) -- reuses committee and investigation patterns
  |
  +-> Phase 4 (MENT + COUNS + CCD) -- depends on event bus from Phase 1
        |
        +-> Phase 5 (NLP) -- enhances GGM + CCD from Phases 1 & 4
              |
              +-> Phase 6 (Analytics) -- aggregates all sub-domains
```

### Estimated Totals

| Metric | Count |
|---|---|
| New/enhanced models | 20 (14 new + 5 enhanced + 1 replaced) |
| New API endpoints | ~98 |
| Workflow definitions | 6 (GGM, ARC, ICC, DISC, GRC, CCD) |
| BullMQ jobs | 3 (SLA check, CCD decay, pattern scan) |
| Event bus events | ~25 new event types |
| Cross-module integrations | 9 modules |
| Implementation duration | 17 weeks |
