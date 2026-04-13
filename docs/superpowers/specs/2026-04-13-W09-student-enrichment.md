# W09 -- Student Enrichment & Development: Implementation Specification

> **Status**: DRAFT | Date: 2026-04-13
> **Scope**: Club lifecycle, event management, achievement verification, activity budgets, student portfolio
> **Primary Module**: M09 (Student Dev & Engagement)
> **Supporting Modules**: M08 (Campus Ops), M07 (Placement), M10 (Compliance), M02 (People), M04 (Finance), M12 (Platform), Juvi
> **Sub-Workflows**: 45 (W09-L2-001 through W09-L2-045)

---

## 1. Executive Summary

W09 transforms M09 Student Development from a pure CRUD data store into a full workflow engine spanning five sub-domains: club/organisation lifecycle (ORG), event management (EVT), achievement verification (ACH), activity budgets (BUD), and student portfolio (PORT). The current codebase has 14 models and 71 service functions -- all basic create/read/update/delete with no workflow logic, no state machines, no cross-module integration, no AI assistance, and no verification pipelines.

The workflow decomposition defines 45 sub-workflows across 8 modules. Of these, 37 are owned by M09 and 8 are cross-module integrations (M08 facility booking, M07 career profile feed, M10 compliance evidence, M02 identity linking, M04 financial transactions, M12 notifications, Juvi surface management).

**Key gaps to close**:
- 5 new entity models required (Fest, Competition, Workshop, ActivityBudget/BudgetLineItem, Sponsorship, Portfolio/PortfolioEntry, Award/AwardInstance, Certificate, Position, Programme)
- State machines for club lifecycle, event lifecycle, achievement verification, budget approval
- Approval workflows with threshold-based routing
- AI agents for duplicate detection, proposal scoring, achievement verification, portfolio assembly
- Cross-module event bus for M08/M07/M10/M02/M04/M12/Juvi integration
- Certificate generation pipeline
- Portfolio auto-assembly and completeness scoring

---

## 2. Current Codebase State

### 2.1 Models (14 existing -- `backend/src/models/student-dev/`)

| Model | File | Fields | Status Enum | Gaps |
|-------|------|--------|-------------|------|
| Club | `Club.ts` | name, type, description, coordinatorId, facultyAdvisorId, isActive | boolean `isActive` only | No lifecycle states (proposed/approved/dormant/dissolved); no scope field; no objectives/founding members |
| ClubMembership | `ClubMembership.ts` | clubId, studentId, role, joinedDate, status | `active\|inactive` | Missing `alumni` status; no exit reason; no position linking |
| Event | `Event.ts` | name, type, clubId, departmentId, description, startDate, endDate, venue, budget, coordinatorId, status | `planned\|approved\|ongoing\|completed\|cancelled` | Single entity for all event types; no proposal scoring; no capacity/registration config; no approval chain tracking |
| EventRegistration | `EventRegistration.ts` | eventId, participantId, participantType, teamName, registeredAt, status | `registered\|attended\|winner\|no_show` | No check-in timestamp; no team entity; no eligibility tracking; no waitlist |
| Achievement | `Achievement.ts` | studentId, title, category, level, date, description, certificateUrl, verifiedBy | None (implicit) | No verification status (claimed/under_review/verified/rejected); no source tracking; no evidence files; no skill tags |
| LeadershipRole | `LeadershipRole.ts` | studentId, role, body, academicYearId, startDate, endDate | None | No status field; no linked clubId/orgId; no election/appointment tracking |
| StudentProject | `StudentProject.ts` | title, type, teamMembers[], guideId, semester, description, technologies[], repoUrl, status, grade | `proposed\|in_progress\|completed\|presented` | Adequate for CRUD; no portfolio integration |
| Mentoring | `Mentoring.ts` | mentorId, menteeId, academicYearId, meetingDate, notes, status | `active\|completed` | Adequate for CRUD |
| SportsTeam | `SportsTeam.ts` | sport, category, coachId, captain, academicYearId | None | No season tracking; no result/fixture support |
| SportsTeamMember | `SportsTeamMember.ts` | teamId, studentId, position, joinedDate | None | No status field |
| NSSActivity | `NSSActivity.ts` | title, type, date, venue, description, coordinatorId, participantCount, hours, status | `planned\|completed\|cancelled` | No programme linking; no camp tracking |
| NSSParticipant | `NSSParticipant.ts` | activityId, studentId, hoursContributed, certificateIssued | None | No cumulative hours tracking; no rank progression |
| CommunityProject | `CommunityProject.ts` | title, description, leadStudentId, facultyMentorId, startDate, endDate, beneficiaries, status | `proposed\|approved\|ongoing\|completed` | Adequate for CRUD |
| SkillCertification | `SkillCertification.ts` | studentId, certificationName, provider, completedDate, certificateUrl, credentialId, validUntil | None | No verification status; no skill tags |

### 2.2 Service Layer (`backend/src/modules/student-dev/service.ts`)

- **71 functions**: 1 `getStats()` dashboard + 5 CRUD functions x 14 entities (list, get, create, update, delete)
- **All pure CRUD**: No business logic beyond basic find/create/update/delete
- **No state transitions**: Status changes happen via generic `update()` with no validation guards
- **No cross-entity logic**: Creating an event does not interact with budgets, clubs, or facilities
- **No approval workflows**: Any user with module access can set any status
- **No AI integration**: Zero AI agent calls
- **RBAC-aware**: Uses `authScope` and `applyAuthScope()` in list functions

### 2.3 Routes (`backend/src/modules/student-dev/routes.ts`)

- **70 routes**: 5 CRUD routes x 14 entities + 1 dashboard stats
- All under `/api/student-dev/` prefix
- Uses `authenticate` + `authorize('student-dev', action)` middleware
- Uses `validate(schema)` for create/update operations
- No workflow-specific endpoints (no `/propose`, `/approve`, `/verify`, `/publish`)

### 2.4 Validation (`backend/src/modules/student-dev/validation.ts`)

- 28 Zod schemas (create + update for each entity)
- Basic field validation only; no cross-field rules
- No workflow-step validation (e.g., "cannot approve if status != proposed")

---

## 3. Sub-Workflow Catalog

### 3.1 M09.1 ORG -- Organisations & Membership (8 sub-workflows)

| ID | Name | Trigger | Resolution | Key Logic |
|----|------|---------|------------|-----------|
| W09-L2-001 | Propose New Club | Student submits proposal | Proposal created, routed to approver | AI duplicate detection + proposal scoring; min 5 founding members; scope-based routing (dept -> HOD, institution -> Principal) |
| W09-L2-002 | Approve/Reject Club Proposal | Proposal submitted | Club approved or rejected | Assign faculty advisor; create founding memberships; trigger Juvi channel creation; create Position records (president/secretary) |
| W09-L2-003 | Open Annual Club Registration | Academic year start | Registration window opened | Admin sets window dates; AI generates personalised club recommendations per student; NCC/NSS capacity-limited |
| W09-L2-004 | Process Membership Application | Student applies | Membership created or rejected | Open clubs: auto-approve; structured (NCC/NSS): selection process; academic standing check; portfolio entry auto-queued |
| W09-L2-005 | Conduct Position Election/Appointment | Term end or vacancy | Position filled | F1 opens nominations; election via Juvi poll or appointment by F1; portfolio auto-add (high-signal) |
| W09-L2-006 | Manage Membership Status Changes | Student exit/inactivity | Membership updated | AI flags 3-month inactivity; position holder inactive triggers vacancy; alumni status for graduated; Juvi channel downgrade |
| W09-L2-007 | Conduct Annual Club Review | Year end | Club status confirmed | AI health report (membership, events, trends); dormancy detection (6+ months no activity); revival window for dormant clubs |
| W09-L2-008 | Dissolve Club | Dormancy confirmed | Club dissolved, archived | Bulk membership -> alumni; all positions ended; budget reconciled via M04; Juvi channel archived; AI cannot auto-dissolve |

### 3.2 M09.2 EVT -- Events & Activities (12 sub-workflows)

| ID | Name | Trigger | Resolution | Key Logic |
|----|------|---------|------------|-----------|
| W09-L2-009 | Propose Event (Club-level) | Club wants to host event | Proposal created, routed to F1 | AI scores: historical success, calendar conflicts (M03), turnout prediction; budget request linked |
| W09-L2-010 | Propose Fest (Institution-level) | Annual cycle or directive | Fest proposal created, routed to L1 | AI fest scoring, peer benchmarking; organising committee nominated; multiple approval stages for large budget |
| W09-L2-011 | Approve Event/Fest | Proposal submitted | Approved or rejected | Triggers M08 facility booking; activates M09.4 budget; M12 announcement queued; venue-based routing |
| W09-L2-012 | Plan Event Logistics | Event approved | Logistics finalised | M08 venue confirmation; schedule/sessions/judges setup; registration config (eligibility, capacity, teams); AI turnout prediction |
| W09-L2-013 | Process Event Registration | Student registers | Participation recorded | Eligibility check; team formation; capacity management with waitlist; add to event channel |
| W09-L2-014 | Execute Event/Fest | Event start date | Event completed | QR check-in via Juvi; attendance tracking; competition results; feedback form auto-push; AI sentiment analysis |
| W09-L2-015 | Close Event/Fest | All results declared | Event closed | Final tally; budget reconciliation trigger; AI event report; evidence package for M10; archive communications |
| W09-L2-016 | Manage NCC/NSS Programme Cycle | Programme start (August) | Certifications issued | Capacity-limited enrollment; activity schedule; hours tracking; camp management; NCC rank progression (A->B->C) |
| W09-L2-017 | Manage Sports Season | Season start | Season completed | Team selection trials; fixture scheduling; match results; achievements auto-captured; M08 facility booking |
| W09-L2-018 | Cancel/Postpone Event | Force majeure or low registrations | Event cancelled/rescheduled | Bulk notification; M04 refund processing; M08 venue release; budget adjustment |
| W09-L2-019 | Handle Inter-College/External Events | External participation | Participation recorded | External participant registration; evidence-based verification for results; travel logistics |
| W09-L2-020 | Conduct Student Initiative | Student proposes initiative | Initiative executed, documented | AI novelty/feasibility scoring; mentor assignment; budget allocation if needed; outcomes documented |

### 3.3 M09.3 ACH -- Achievements & Recognition (6 sub-workflows)

| ID | Name | Trigger | Resolution | Key Logic |
|----|------|---------|------------|-----------|
| W09-L2-021 | Auto-Capture from Internal Event | Competition results declared | Achievement auto-verified | Winners: Achievement created (status=verified); participants: prompt to add to portfolio; AI skill tag extraction |
| W09-L2-022 | Claim External Achievement | Student submits claim | Routed for verification | Evidence upload to M02 vault; AI source matching; integrated sources auto-verify (SIH, NCC, university sports); implausibility flagging |
| W09-L2-023 | Verify Achievement (Manual) | Claim requires verification | Verified or rejected | F1 reviews evidence; AI pre-screens; 7-day reminder timeout; portfolio auto-push for high-signal |
| W09-L2-024 | Nominate for Institutional Award | Nomination period | Award conferred | F1 nominates; F2/L1 approves; certificate generated; portfolio auto-added; M12 announcement |
| W09-L2-025 | Auto-Verify from Integrated Source | External sync trigger | Achievement auto-verified | Pull from SIH API, NCC database, university portal; cross-reference enrolled students; audit trail |
| W09-L2-026 | Generate Achievement Certificate | Verified or award conferred | Certificate issued | Template selection by type; auto-populate; digital signature; store in M02 vault; Juvi download |

### 3.4 M09.4 BUD -- Activity Budgets & Sponsorship (6 sub-workflows)

| ID | Name | Trigger | Resolution | Key Logic |
|----|------|---------|------------|-----------|
| W09-L2-027 | Request Activity Budget | Club plan or event proposal | Budget request created | AI reasonableness scoring vs historical; threshold routing: <10K F1, 10K-1L F2, >1L L1; line item breakdown |
| W09-L2-028 | Approve/Reject Budget | Request submitted | Budget active or rejected | Full/partial/reject options; M04 fund reservation on approval; adjusted line items for partial |
| W09-L2-029 | Track Budget Utilisation | Budget active, expenses incurred | Alerts raised at thresholds | M04 transaction data read; AI monitors utilisation; alerts at 80% and 100%; unusual spending pattern detection |
| W09-L2-030 | Manage Sponsorship | Event needs sponsors | Sponsorship secured | AI suggests past/aligned sponsors; cash -> M04 receipt; in-kind deliverable tracking; post-event acknowledgment |
| W09-L2-031 | Reconcile Budget at Close | Event closed or year end | Budget reconciled | Planned vs actual per line item; variance justification; AI reconciliation report; M10 evidence |
| W09-L2-032 | Allocate Activity Fee | Fee collection completed (W03) | Pool allocated | Student activity fee component from M04; L1 decides allocation across clubs/fests/sports/NCC/NSS |

### 3.5 M09.5 PORT -- Portfolio & Development Profile (5 sub-workflows)

| ID | Name | Trigger | Resolution | Key Logic |
|----|------|---------|------------|-----------|
| W09-L2-033 | Auto-Assemble Portfolio | Any M09 activity | Portfolio entries created | AI creates entry from source; auto-generate title/description; skill tag extraction; section categorisation; completeness scoring |
| W09-L2-034 | Student Curates Portfolio | Student views portfolio | Entries customised | Feature/hide/reorder/edit entries; manual entry with evidence upload; evidence-based verification for manual external entries |
| W09-L2-035 | Publish Portfolio | Student ready | Portfolio published | AI completeness score and gap analysis; M07 TPO visibility; M10 stats; student can unpublish/update |
| W09-L2-036 | AI Nudge for Portfolio Gaps | Gap detected | Nudge delivered via Juvi | Peer comparison ("80% placed students had club leadership"); placement-aware recommendations; dismissal frequency tracking |
| W09-L2-037 | Finalise Portfolio at Exit | W10 exit trigger | Portfolio archived | Immutable snapshot; linked to alumni record; final curation window; auto-snapshot if student does not curate |

### 3.6 Cross-Module Sub-Workflows (8 sub-workflows)

| ID | Name | Module | Direction | Key Logic |
|----|------|--------|-----------|-----------|
| W09-L2-038 | Request Facility Booking | M08.6 | M09 -> M08 | Auto-generate from event data; specify venue type/dates/capacity/setup; conflict detection |
| W09-L2-039 | Release Facility After Event | M08.6 | M09 -> M08 | Auto-release on event close; damage assessment; equipment return |
| W09-L2-040 | Feed Portfolio to Career Profile | M07.3 | M09 -> M07 | Published portfolio + verified achievements -> career profile; TPO visibility; placement enrichment |
| W09-L2-041 | Feed Activity Evidence to Compliance | M10.3 | M09 -> M10 | Map to NAAC Criteria III and V; aggregate metrics; AI evidence packaging |
| W09-L2-042 | Link to Student Record | M02.1 | Bidirectional | Achievements, memberships, certificates linked to student identity; evidence in M02 vault |
| W09-L2-043 | Process Financial Transactions | M04 | Bidirectional | Fund reservation, expense recording, sponsorship receipts, refunds; audit trail |
| W09-L2-044 | Deliver Communications | M12.4 | M09 -> M12 | Channel selection by urgency; AI personalisation; delivery tracking |
| W09-L2-045 | Manage Juvi Surfaces | Juvi | Bidirectional | Channel lifecycle, event cards, registration buttons, QR check-in, results, portfolio view |

---

## 4. Entity Gap Analysis

### 4.1 Entities Required by W09 (from Entity Coverage sheet)

| Entity | Sub-Domain | Exists? | Model File | Gap Description |
|--------|-----------|---------|------------|-----------------|
| Club | ORG | YES | `Club.ts` | Needs lifecycle status (proposed/approved/dormant/dissolved), scope, objectives, foundingMembers[], proposalScore, dormancySince, approvedBy, rejectedReason |
| Membership | ORG | YES (as ClubMembership) | `ClubMembership.ts` | Needs `alumni` status, exitReason, lastActiveDate, applicationDate |
| Position | ORG | PARTIAL (as LeadershipRole) | `LeadershipRole.ts` | Needs clubId ref, status (vacant/nominated/filled/ended), filledBy (election/appointment), electionId, termStart, termEnd |
| Organisation | ORG | NO | -- | Thin reference entity for parent org structure; may be folded into Club with a `parentOrgId` field |
| Fest | EVT | NO | -- | **NEW MODEL**: name, type, academicYearId, dates, status lifecycle (proposed/approved/planning/active/completed/closed), budget, orgCommittee[], sponsorTargets |
| Competition | EVT | NO | -- | **NEW MODEL**: name, eventId/festId, type, rounds[], results[], status lifecycle, maxParticipants, teamSize, prizes |
| Workshop | EVT | NO | -- | **NEW MODEL**: name, eventId/festId, topic, instructor, duration, maxCapacity, status lifecycle, completionCriteria |
| Programme | EVT | NO | -- | **NEW MODEL**: NCC/NSS programme entity; type (ncc/nss), academicYearId, officerId, activities[], capacity, enrolledCount, status |
| Event Participation | EVT | YES (as EventRegistration) | `EventRegistration.ts` | Needs checkInTimestamp, checkInMethod (qr/manual), roundResults[], feedback, waitlistPosition |
| Achievement | ACH | YES | `Achievement.ts` | Needs verificationStatus (claimed/under_review/verified/rejected/auto_verified), source, sourceReference, evidenceFiles[], skillTags[], implausibilityScore, eventId link |
| Award | ACH | NO | -- | **NEW MODEL**: Reference entity; name, category (academic/sports/cultural/service/leadership), level (dept/institution), criteria |
| AwardInstance | ACH | NO | -- | **NEW MODEL**: awardId, studentId, academicYearId, nominatedBy, status (nominated/approved/conferred), conferredDate, certificateId |
| Certificate | ACH | NO | -- | **NEW MODEL**: type (participation/achievement/ncc_rank/award), studentId, templateId, generatedData, signedBy, issuedDate, fileUrl, status (draft/issued) |
| Activity Budget | BUD | NO | -- | **NEW MODEL**: entityType (club/event/fest), entityId, academicYearId, requestedAmount, approvedAmount, utilisedAmount, status (requested/approved/active/reconciled/rejected), approvedBy, approvalThreshold, lineItems[] |
| Budget Line Item | BUD | NO | -- | **NEW MODEL**: budgetId, category, description, estimatedAmount, actualAmount, status (estimated/approved/spent/reconciled), transactionRefs[] |
| Sponsorship | BUD | NO | -- | **NEW MODEL**: festId/eventId, sponsorContactId, type (cash/in_kind), committedAmount, receivedAmount, deliverables[], status (prospective/committed/received/fulfilled/withdrawn) |
| Sponsor Contact | BUD | NO | -- | **NEW MODEL**: name, company, email, phone, pastSponsorships[], relationship notes |
| Portfolio | PORT | NO | -- | **NEW MODEL**: studentId, status (draft/published/archived), completenessScore, lastCuratedDate, snapshotDate, sections[] |
| Portfolio Entry | PORT | NO | -- | **NEW MODEL**: portfolioId, sourceType (club/event/achievement/project/certification/manual), sourceId, section, title, description, skillTags[], isFeatured, isHidden, displayOrder |
| Portfolio Section | PORT | NO | -- | **NEW MODEL**: Enum/config defining sections: clubs, events, achievements, projects, certifications, leadership, community_service |

### 4.2 Summary: Model Changes Required

| Action | Count | Details |
|--------|-------|---------|
| **New models** | 13 | Fest, Competition, Workshop, Programme, Award, AwardInstance, Certificate, ActivityBudget, BudgetLineItem, Sponsorship, SponsorContact, Portfolio, PortfolioEntry |
| **Major model updates** | 5 | Club (lifecycle status), ClubMembership (alumni status), Achievement (verification pipeline), EventRegistration (check-in/waitlist), LeadershipRole (position tracking) |
| **Minor model updates** | 2 | NSSParticipant (cumulative hours), SkillCertification (verification status) |
| **Unchanged** | 7 | Mentoring, SportsTeam, SportsTeamMember, NSSActivity, StudentProject, CommunityProject, Event (event stays as generic container; specific types become separate models) |

### 4.3 New Model Schemas

#### 4.3.1 Fest (`backend/src/models/student-dev/Fest.ts`)

```typescript
interface IFest {
  collegeId: ObjectId;
  name: string;
  type: 'technical' | 'cultural' | 'sports' | 'literary' | 'multi';
  academicYearId: ObjectId;
  startDate: Date;
  endDate: Date;
  status: 'proposed' | 'approved' | 'planning' | 'active' | 'completed' | 'closed' | 'cancelled';
  proposedBy: ObjectId;       // Person ref
  approvedBy?: ObjectId;
  approvalDate?: Date;
  rejectedReason?: string;
  proposalScore?: number;     // AI-generated 0-100
  orgCommittee: { personId: ObjectId; role: string }[];
  description?: string;
  estimatedBudget?: number;
  estimatedAttendance?: number;
  actualAttendance?: number;
  feedbackSummary?: string;   // AI-generated post-event
  venueBookingIds: ObjectId[]; // M08 FacilityBooking refs
}
```

#### 4.3.2 Competition (`backend/src/models/student-dev/Competition.ts`)

```typescript
interface ICompetition {
  collegeId: ObjectId;
  name: string;
  type: 'hackathon' | 'coding' | 'quiz' | 'debate' | 'sports_match' | 'cultural_performance' | 'other';
  parentType: 'fest' | 'standalone' | 'inter_college';
  parentId?: ObjectId;        // Fest ref if part of fest
  clubId?: ObjectId;
  departmentId?: ObjectId;
  status: 'proposed' | 'approved' | 'registration_open' | 'ongoing' | 'results_declared' | 'closed' | 'cancelled';
  startDate: Date;
  endDate: Date;
  venue?: string;
  maxParticipants?: number;
  teamSize?: { min: number; max: number };
  rounds: { name: string; date: Date; type: string }[];
  results: { rank: number; participantId: ObjectId; teamName?: string; score?: number }[];
  prizes?: { rank: number; description: string; amount?: number }[];
  judges: ObjectId[];
  coordinatorId?: ObjectId;
  eligibilityCriteria?: string;
  registrationDeadline?: Date;
}
```

#### 4.3.3 Workshop (`backend/src/models/student-dev/Workshop.ts`)

```typescript
interface IWorkshop {
  collegeId: ObjectId;
  name: string;
  topic: string;
  parentType: 'fest' | 'standalone' | 'programme';
  parentId?: ObjectId;
  clubId?: ObjectId;
  departmentId?: ObjectId;
  instructorId?: ObjectId;
  externalInstructor?: { name: string; affiliation: string; bio?: string };
  status: 'proposed' | 'approved' | 'registration_open' | 'ongoing' | 'completed' | 'closed' | 'cancelled';
  date: Date;
  duration: number;           // hours
  maxCapacity?: number;
  completionCriteria?: string;
  venue?: string;
  materials?: string[];
}
```

#### 4.3.4 Programme (`backend/src/models/student-dev/Programme.ts`)

```typescript
interface IProgramme {
  collegeId: ObjectId;
  type: 'ncc' | 'nss' | 'nso' | 'yrc' | 'other';
  name: string;
  academicYearId: ObjectId;
  officerId: ObjectId;        // designated faculty
  capacity?: number;
  enrolledCount: number;
  status: 'enrollment_open' | 'active' | 'completed';
  activities: ObjectId[];     // NSSActivity or NCC activity refs
  startDate: Date;
  endDate: Date;
  description?: string;
}
```

#### 4.3.5 Award (`backend/src/models/student-dev/Award.ts`)

```typescript
interface IAward {
  collegeId: ObjectId;
  name: string;
  category: 'academic' | 'sports' | 'cultural' | 'service' | 'leadership' | 'innovation';
  level: 'department' | 'institution';
  description?: string;
  criteria?: string;
  isActive: boolean;
}
```

#### 4.3.6 AwardInstance (`backend/src/models/student-dev/AwardInstance.ts`)

```typescript
interface IAwardInstance {
  collegeId: ObjectId;
  awardId: ObjectId;
  studentId: ObjectId;
  academicYearId: ObjectId;
  nominatedBy: ObjectId;      // Faculty ref
  status: 'nominated' | 'shortlisted' | 'approved' | 'conferred' | 'declined';
  conferredDate?: Date;
  certificateId?: ObjectId;
  justification?: string;
  approvedBy?: ObjectId;
}
```

#### 4.3.7 Certificate (`backend/src/models/student-dev/Certificate.ts`)

```typescript
interface ICertificate {
  collegeId: ObjectId;
  type: 'participation' | 'achievement' | 'ncc_rank' | 'nss_completion' | 'award' | 'workshop_completion';
  studentId: ObjectId;
  sourceType: 'achievement' | 'event' | 'award' | 'programme';
  sourceId: ObjectId;
  templateId?: string;
  generatedData: Record<string, string>; // template field values
  signedBy?: ObjectId;
  signatureDate?: Date;
  fileUrl?: string;
  status: 'draft' | 'issued' | 'revoked';
  issuedDate?: Date;
  vaultFileId?: ObjectId;    // M02 document vault ref
}
```

#### 4.3.8 ActivityBudget (`backend/src/models/student-dev/ActivityBudget.ts`)

```typescript
interface IActivityBudget {
  collegeId: ObjectId;
  entityType: 'club' | 'event' | 'fest' | 'programme' | 'pool';
  entityId?: ObjectId;
  academicYearId: ObjectId;
  requestedBy: ObjectId;
  requestedAmount: number;
  approvedAmount?: number;
  utilisedAmount: number;
  status: 'requested' | 'approved' | 'active' | 'reconciled' | 'rejected';
  approvalThreshold: 'f1' | 'f2' | 'l1'; // determined by amount
  approvedBy?: ObjectId;
  approvalDate?: Date;
  rejectedReason?: string;
  reasonablenessScore?: number; // AI 0-100
  justification?: string;
  reconciliationReport?: string; // AI-generated
  varianceNotes?: string;
  m04ReservationId?: string;  // M04 fund reservation ref
}
```

#### 4.3.9 BudgetLineItem (`backend/src/models/student-dev/BudgetLineItem.ts`)

```typescript
interface IBudgetLineItem {
  collegeId: ObjectId;
  budgetId: ObjectId;
  category: string;
  description: string;
  estimatedAmount: number;
  approvedAmount?: number;
  actualAmount: number;
  status: 'estimated' | 'approved' | 'spent' | 'reconciled';
  transactionRefs: string[];  // M04 transaction IDs
}
```

#### 4.3.10 Sponsorship (`backend/src/models/student-dev/Sponsorship.ts`)

```typescript
interface ISponsorship {
  collegeId: ObjectId;
  eventType: 'fest' | 'event' | 'competition';
  eventId: ObjectId;
  sponsorContactId: ObjectId;
  type: 'cash' | 'in_kind' | 'mixed';
  committedAmount?: number;
  receivedAmount?: number;
  deliverables: { description: string; status: 'pending' | 'delivered' | 'partial' }[];
  status: 'prospective' | 'approached' | 'committed' | 'received' | 'fulfilled' | 'withdrawn';
  agreementUrl?: string;
  acknowledgmentDone: boolean;
}
```

#### 4.3.11 SponsorContact (`backend/src/models/student-dev/SponsorContact.ts`)

```typescript
interface ISponsorContact {
  collegeId: ObjectId;
  name: string;
  company: string;
  designation?: string;
  email?: string;
  phone?: string;
  pastSponsorships: { eventId: ObjectId; year: number; amount: number }[];
  notes?: string;
}
```

#### 4.3.12 Portfolio (`backend/src/models/student-dev/Portfolio.ts`)

```typescript
interface IPortfolio {
  collegeId: ObjectId;
  studentId: ObjectId;
  status: 'draft' | 'published' | 'archived';
  completenessScore: number;  // AI-computed 0-100
  lastCuratedDate?: Date;
  publishedDate?: Date;
  snapshotDate?: Date;
  snapshotData?: Record<string, unknown>; // immutable copy at exit
  sections: {
    key: string;              // 'clubs' | 'events' | 'achievements' | 'projects' | 'certifications' | 'leadership' | 'community'
    displayOrder: number;
    isVisible: boolean;
  }[];
  gapAnalysis?: {             // AI-generated
    missingAreas: string[];
    recommendations: string[];
    peerComparison?: string;
  };
}
```

#### 4.3.13 PortfolioEntry (`backend/src/models/student-dev/PortfolioEntry.ts`)

```typescript
interface IPortfolioEntry {
  collegeId: ObjectId;
  portfolioId: ObjectId;
  sourceType: 'club_membership' | 'event_participation' | 'achievement' | 'project' | 'certification' | 'leadership' | 'community' | 'manual';
  sourceId?: ObjectId;        // null for manual entries
  section: string;
  title: string;
  description?: string;       // AI-generated or student-edited
  skillTags: string[];        // AI-extracted
  date?: Date;
  isFeatured: boolean;
  isHidden: boolean;
  displayOrder: number;
  evidenceUrls: string[];
  verificationStatus?: 'unverified' | 'verified'; // for manual entries
  signalStrength: 'high' | 'medium' | 'low'; // AI-assessed
}
```

---

## 5. API Endpoint Gap Analysis

### 5.1 Existing Endpoints (70 routes)

All 14 entities have standard CRUD: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`. No workflow endpoints exist.

### 5.2 New Workflow Endpoints Required

#### M09.1 ORG -- Club Lifecycle

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/clubs/propose` | W09-L2-001 | Submit club proposal with founding members |
| POST | `/clubs/:id/approve` | W09-L2-002 | Approve club (assign advisor, create positions) |
| POST | `/clubs/:id/reject` | W09-L2-002 | Reject club with reason |
| POST | `/clubs/registration-window` | W09-L2-003 | Open/close annual registration window |
| GET | `/clubs/recommendations/:studentId` | W09-L2-003 | AI-generated club recommendations |
| POST | `/club-memberships/apply` | W09-L2-004 | Student applies to join club |
| POST | `/clubs/:id/elections` | W09-L2-005 | Open position nominations/election |
| POST | `/clubs/:id/elections/:electionId/vote` | W09-L2-005 | Cast vote in election |
| POST | `/clubs/:id/appoint` | W09-L2-005 | Appoint position holder |
| PATCH | `/club-memberships/:id/status` | W09-L2-006 | Transition membership status |
| GET | `/clubs/:id/health-report` | W09-L2-007 | AI-generated club health report |
| POST | `/clubs/:id/review` | W09-L2-007 | Submit annual review |
| POST | `/clubs/:id/dissolve` | W09-L2-008 | Dissolve club (with reconciliation) |

#### M09.2 EVT -- Event Lifecycle

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/competitions/propose` | W09-L2-009 | Propose club-level competition/workshop |
| POST | `/workshops/propose` | W09-L2-009 | Propose club-level workshop |
| POST | `/fests/propose` | W09-L2-010 | Propose institution-level fest |
| POST | `/fests/:id/approve` | W09-L2-011 | Approve fest |
| POST | `/competitions/:id/approve` | W09-L2-011 | Approve competition |
| POST | `/workshops/:id/approve` | W09-L2-011 | Approve workshop |
| POST | `/fests/:id/reject` | W09-L2-011 | Reject fest with reason |
| PUT | `/fests/:id/logistics` | W09-L2-012 | Update logistics (schedule, venue, registration config) |
| PUT | `/competitions/:id/logistics` | W09-L2-012 | Update logistics |
| POST | `/competitions/:id/register` | W09-L2-013 | Register for competition |
| POST | `/workshops/:id/register` | W09-L2-013 | Register for workshop |
| POST | `/competitions/:id/check-in` | W09-L2-014 | QR/manual check-in |
| POST | `/workshops/:id/check-in` | W09-L2-014 | QR/manual check-in |
| POST | `/competitions/:id/results` | W09-L2-014 | Declare competition results |
| POST | `/workshops/:id/complete` | W09-L2-014 | Mark workshop completed |
| POST | `/fests/:id/close` | W09-L2-015 | Close fest |
| POST | `/competitions/:id/close` | W09-L2-015 | Close competition |
| POST | `/fests/:id/cancel` | W09-L2-018 | Cancel fest |
| POST | `/fests/:id/postpone` | W09-L2-018 | Postpone fest with new dates |
| POST | `/programmes` | W09-L2-016 | Create NCC/NSS programme |
| POST | `/programmes/:id/enroll` | W09-L2-016 | Enroll student in programme |
| POST | `/programmes/:id/log-hours` | W09-L2-016 | Log activity hours |
| GET | `/events/calendar` | W09-L2-009 | Event calendar with conflict detection |

#### M09.3 ACH -- Achievement Verification

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/achievements/auto-capture` | W09-L2-021 | Auto-create from internal event results |
| POST | `/achievements/claim` | W09-L2-022 | Student claims external achievement |
| POST | `/achievements/:id/verify` | W09-L2-023 | Faculty verifies achievement |
| POST | `/achievements/:id/reject` | W09-L2-023 | Faculty rejects achievement |
| POST | `/awards` | W09-L2-024 | Create award definition |
| POST | `/award-instances/nominate` | W09-L2-024 | Nominate student for award |
| POST | `/award-instances/:id/confer` | W09-L2-024 | Confer award |
| POST | `/achievements/sync-external` | W09-L2-025 | Trigger external source sync |
| POST | `/certificates/generate` | W09-L2-026 | Generate certificate |
| GET | `/certificates/:id/download` | W09-L2-026 | Download certificate |

#### M09.4 BUD -- Activity Budgets

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/budgets/request` | W09-L2-027 | Submit budget request with line items |
| POST | `/budgets/:id/approve` | W09-L2-028 | Approve budget (full or partial) |
| POST | `/budgets/:id/reject` | W09-L2-028 | Reject budget |
| GET | `/budgets/:id/utilisation` | W09-L2-029 | Budget utilisation dashboard |
| POST | `/budgets/:id/expense` | W09-L2-029 | Record expense against budget |
| POST | `/sponsorships` | W09-L2-030 | Create sponsorship record |
| PATCH | `/sponsorships/:id/status` | W09-L2-030 | Update sponsorship status |
| POST | `/budgets/:id/reconcile` | W09-L2-031 | Reconcile budget |
| POST | `/budgets/allocate-pool` | W09-L2-032 | Allocate activity fee pool |

#### M09.5 PORT -- Portfolio

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| GET | `/portfolios/my` | W09-L2-033 | Get current student's portfolio |
| GET | `/portfolios/:studentId` | W09-L2-033 | Get student portfolio (for TPO/faculty) |
| POST | `/portfolios/assemble` | W09-L2-033 | Trigger portfolio assembly for student |
| PUT | `/portfolio-entries/:id` | W09-L2-034 | Update entry (feature/hide/reorder/edit) |
| POST | `/portfolio-entries/manual` | W09-L2-034 | Add manual portfolio entry |
| POST | `/portfolios/publish` | W09-L2-035 | Publish portfolio |
| POST | `/portfolios/unpublish` | W09-L2-035 | Unpublish portfolio |
| GET | `/portfolios/:studentId/completeness` | W09-L2-036 | Completeness score and gap analysis |
| POST | `/portfolios/:studentId/finalise` | W09-L2-037 | Finalise portfolio at exit |

### 5.3 Endpoint Summary

| Category | Existing | New | Total |
|----------|----------|-----|-------|
| CRUD (existing entities) | 70 | 0 | 70 |
| CRUD (new entities) | 0 | ~65 | ~65 |
| Workflow actions | 0 | ~55 | ~55 |
| **Total** | **70** | **~120** | **~190** |

---

## 6. State Machine Definitions

### 6.1 Club Lifecycle

```
                    +-----------+
  Student proposes  |  proposed |
  ----------------->|           |
                    +-----+-----+
                          |
              +-----------+-----------+
              |                       |
        F2/L1 approves          F2/L1 rejects
              |                       |
              v                       v
        +-----------+          +-----------+
        | approved  |          | rejected  |
        |           |          |           |
        +-----+-----+          +-----+-----+
              |                       |
        (normal ops)           Student may revise
              |                  and re-propose
              v
        +-----------+
        |  active   |  <-- annual review confirms
        |           |
        +-----+-----+
              |
     AI flags 6+ months
       no activity
              |
              v
        +-----------+
        |  dormant  |
        |           |
        +-----+-----+
              |
    +---------+---------+
    |                   |
  Revived         Dissolution
  (new proposal)   approved
    |                   |
    v                   v
  active          +-----------+
                  | dissolved |
                  |           |
                  +-----------+
```

**States**: `proposed` | `approved` | `active` | `dormant` | `dissolved` | `rejected`

**Transition Guards**:
- `proposed -> approved`: requires F2 (dept-scope) or L1 (institution-scope) approval + faculty advisor assigned
- `proposed -> rejected`: requires F2/L1 with reason
- `approved -> active`: auto on first annual review if active
- `active -> dormant`: AI flags; confirmed by F2/L1 annual review
- `dormant -> active`: new proposal approved (revival)
- `dormant -> dissolved`: F2/L1 approval; budget reconciled; all memberships wound down
- AI CANNOT: auto-dissolve, approve proposals, or assign advisors

### 6.2 Event Lifecycle (Fest / Competition / Workshop share same machine)

```
  proposed --> approved --> planning --> registration_open --> ongoing --> results_declared --> completed --> closed
     |            |                          |                   |
     v            v                          v                   v
  rejected    cancelled                   cancelled           cancelled
                                          postponed           postponed
```

**States**: `proposed` | `approved` | `planning` | `registration_open` | `ongoing` | `results_declared` | `completed` | `closed` | `cancelled` | `postponed`

**Transition Guards**:
- `proposed -> approved`: F1 (club-level), F2 (dept-level), L1 (fest) approval
- `proposed -> rejected`: requires reason
- `approved -> planning`: auto on approval; triggers M08 booking
- `planning -> registration_open`: logistics finalised; venue confirmed
- `registration_open -> ongoing`: event start date reached
- `ongoing -> results_declared`: competition results submitted (competitions only)
- `ongoing -> completed`: event end date passed + attendance captured (workshops)
- `completed -> closed`: budget reconciled; report generated
- Any active state -> `cancelled`: F1/F2/L1 only; triggers refund + venue release
- Any active state -> `postponed`: F1/F2/L1 only; new dates required
- AI CANNOT: approve, cancel, or postpone events

### 6.3 Achievement Verification

```
  claimed --> under_review --> verified
     |             |              |
     |             v              v
     |          rejected     (portfolio auto-add)
     |
     +--> auto_verified  (integrated source or internal event)
               |
               v
          (portfolio auto-add)
```

**States**: `claimed` | `under_review` | `verified` | `rejected` | `auto_verified`

**Transition Guards**:
- `claimed -> auto_verified`: source is in integrated source list (SIH, NCC, university sports, KAVACH) OR internal event result
- `claimed -> under_review`: unknown source; routed to F1
- `under_review -> verified`: F1 approves with evidence review
- `under_review -> rejected`: F1 rejects with reason
- AI CAN: auto-verify from trusted integrated sources, flag implausible claims, extract skill tags
- AI CANNOT: verify unknown sources

**Timeout Rule**: Reminder to F1 after 7 days of `under_review` with no action.

### 6.4 Budget Approval

```
  requested --> approved --> active --> reconciled
     |             |
     v             v
  rejected    partially_approved --> active
```

**States**: `requested` | `approved` | `partially_approved` | `active` | `reconciled` | `rejected`

**Transition Guards**:
- `requested -> approved/rejected`: based on threshold:
  - Amount < 10,000 INR: F1 approves
  - Amount 10,000 - 1,00,000 INR: F2 approves
  - Amount > 1,00,000 INR: L1 approves
- `approved -> active`: M04 fund reservation confirmed
- `active -> reconciled`: event/year closed; planned vs actual documented
- AI CAN: score reasonableness, detect unusual spending, generate reconciliation report
- AI CANNOT: approve budgets

**Utilisation Alerts**:
- 80% utilised: warning notification to budget holder and F1
- 100% utilised: alert to F1; further expenses blocked until exception approval
- >100% (overspend): escalate to next approval tier

### 6.5 Portfolio Lifecycle

```
  (auto-created) --> draft --> published --> archived
                       ^           |
                       |           v
                       +--- unpublished
```

**States**: `draft` | `published` | `archived`

**Transition Guards**:
- `draft -> published`: student action only; AI shows completeness score but cannot block
- `published -> draft` (unpublish): student action; M07 career profile flagged as stale
- `published -> archived` / `draft -> archived`: W10 exit trigger; immutable snapshot taken
- AI CANNOT: publish or unpublish without student action

---

## 7. Business Logic Requirements

### 7.1 Club Proposal Scoring (AI)

**Input**: Club proposal (name, type, objectives, founding members)

**Scoring Dimensions** (each 0-100, weighted):
1. **Need Gap** (30%): Does a similar club already exist? Are the objectives unique?
2. **Student Interest** (25%): How many students have expressed interest in this area (from onboarding interests, W01)?
3. **Founding Team** (20%): Quality of founding members -- academic standing, prior leadership, diversity
4. **Institutional Alignment** (15%): Does the club align with institutional priorities?
5. **Feasibility** (10%): Is a faculty advisor available? Resource requirements reasonable?

**Duplicate Detection**: Cosine similarity on club name + objectives against existing active/dormant clubs. Threshold > 0.7 -> flag as potential duplicate with merge suggestion.

**Output**: Score (0-100), duplicate alerts, AI recommendation (proceed/merge/reconsider), justification text.

### 7.2 Event Venue Booking (M08 Integration)

**Flow**:
1. Event approved -> service emits `event.approved` event
2. Event bus handler calls M08 facility booking API
3. Request includes: venue type, dates, capacity, setup requirements
4. M08 returns: confirmed (booking ID), alternative suggestions, or unavailable
5. If confirmed: link booking ID to event record
6. If unavailable: notify event coordinator with alternatives
7. On event close/cancel: emit `event.closed`/`event.cancelled` -> M08 releases booking

**Guard**: Event cannot transition to `registration_open` until venue is confirmed.

### 7.3 Achievement Verification Pipeline

**Source Classification**:
| Source Type | Verification Method | Example |
|-------------|-------------------|---------|
| Internal event | Auto-verify | Club hackathon winner |
| Integrated external | Auto-verify via API | SIH, KAVACH, NCC, JNTU Sports |
| Semi-integrated | Evidence cross-reference | HackerEarth, Devfolio (URL verification) |
| Unknown external | Manual F1 verification | Local college fest, company contest |

**Implausibility Detection**:
- More than 5 national-level wins in one semester -> flag
- Achievement date outside student enrollment period -> flag
- Multiple wins at events happening simultaneously -> flag
- Achievement at institution where student has no participation record -> flag

**Skill Tag Extraction**:
Map event type / achievement category to skill tags:
- Hackathon -> `problem-solving`, `teamwork`, `technical`
- Debate -> `communication`, `critical-thinking`, `leadership`
- Sports captain -> `leadership`, `teamwork`, `discipline`
- NSS camp -> `community-service`, `empathy`, `teamwork`

### 7.4 Budget Tracking and Reconciliation

**Threshold-Based Routing**:
```typescript
function determineApprovalThreshold(amount: number): 'f1' | 'f2' | 'l1' {
  if (amount < 10000) return 'f1';
  if (amount <= 100000) return 'f2';
  return 'l1';
}
```

**Reasonableness Scoring**:
- Compare requested amount to historical budgets for same entity type and similar scale
- Flag if > 2x historical average with explanation requirement
- Factor in: inflation, enrollment changes, event complexity

**Reconciliation Report** (AI-generated):
- Planned vs actual per line item
- Variance percentage and explanation
- Sponsorship utilisation
- Recommendations for future budgets
- Compliance-ready format for M10

### 7.5 Portfolio Generation and Completeness Scoring

**Auto-Assembly Triggers**:
Any of these events triggers a portfolio entry creation:
- Club membership created -> "Member, [Club Name]"
- Leadership position filled -> "President/Secretary, [Club Name]" (high-signal)
- Event participation (attended) -> "[Event Name] Participant"
- Competition winner -> "[Competition] - [Rank]" (high-signal)
- Achievement verified -> "[Achievement Title]" (signal depends on level)
- Certification completed -> "[Certification Name] by [Provider]"
- Project completed -> "[Project Title]"

**Signal Strength Classification**:
- **High**: Competition wins (university+), leadership positions, institutional awards, NCC C certificate
- **Medium**: Event participation, club membership, workshop completion, project completion
- **Low**: Basic club membership with no activity, participation certificates

**Completeness Scoring** (0-100):
| Section | Weight | Scoring |
|---------|--------|---------|
| Leadership | 25% | 100 if any leadership role; 50 if active club member; 0 if none |
| Achievements | 25% | 100 if 3+ verified achievements; 50 if 1-2; 0 if none |
| Technical Skills | 20% | Based on certifications + technical event participation |
| Community Service | 15% | NSS/NCC hours, community project participation |
| Events & Activities | 15% | Event participation count + variety score |

**Gap Detection Nudges** (via Juvi):
- "80% of students placed last year had leadership experience" (if no leadership)
- "Consider joining a club that builds [skill] -- here are recommendations" (skill gap)
- "Your portfolio completeness is 45% -- adding 2 more entries would reach 65%"

---

## 8. Cross-Module Integration Points

### 8.1 Event Bus Architecture

All cross-module communication uses an internal event bus (BullMQ queues on Redis).

**Events Published by M09**:

| Event | Payload | Consumers |
|-------|---------|-----------|
| `club.approved` | { clubId, name, foundingMembers[], advisorId } | Juvi (channel creation), M05 (advisor workload) |
| `club.dissolved` | { clubId, memberIds[] } | Juvi (channel archive), M04 (budget reconciliation) |
| `event.approved` | { eventId, eventType, venueNeeds, dates } | M08 (facility booking) |
| `event.completed` | { eventId, results[], attendanceCount } | M10 (evidence), M04 (budget reconciliation trigger) |
| `event.cancelled` | { eventId, registeredParticipantIds[] } | M08 (venue release), M04 (refund), M12 (notification) |
| `achievement.verified` | { achievementId, studentId, level, category, skillTags[] } | M07 (career profile), M02 (student record), M10 (evidence) |
| `achievement.auto_verified` | { achievementId, studentId, source } | Same as above |
| `award.conferred` | { awardInstanceId, studentId, awardName } | M02 (student record), M12 (announcement) |
| `certificate.issued` | { certificateId, studentId, fileUrl } | M02 (document vault) |
| `portfolio.published` | { portfolioId, studentId } | M07 (career profile feed) |
| `portfolio.unpublished` | { portfolioId, studentId } | M07 (flag stale) |
| `budget.approved` | { budgetId, amount, entityType, entityId } | M04 (fund reservation) |
| `budget.reconciled` | { budgetId, variance } | M04 (close reservation), M10 (evidence) |
| `membership.created` | { membershipId, studentId, clubId } | Portfolio (auto-entry), M02 (student record) |
| `position.filled` | { positionId, studentId, role, clubId } | Portfolio (high-signal entry), M02 (student record) |
| `registration.window.opened` | { academicYearId, windowDates } | M12 (blast notification), Juvi (discovery cards) |
| `sponsorship.received` | { sponsorshipId, amount } | M04 (receipt recording) |

**Events Consumed by M09**:

| Event | Source | M09 Action |
|-------|--------|------------|
| `facility.booking.confirmed` | M08 | Update event with booking ID; unblock registration_open transition |
| `facility.booking.rejected` | M08 | Notify event coordinator; suggest alternatives |
| `transaction.recorded` | M04 | Update budget line item actualAmount |
| `fee.activity_pool.allocated` | M04 | Create pool-level ActivityBudget |
| `student.exit.initiated` | W10 | Trigger portfolio finalisation (W09-L2-037) |
| `student.onboarding.interests` | W01 | Seed club recommendation engine |
| `academic.calendar.published` | M03 | Update event conflict detection dataset |

### 8.2 M08 Campus Operations Integration

**Booking Request Flow**:
```
M09 (event approved) 
  -> publish event.approved 
  -> M08 queue consumer 
  -> M08 checks availability 
  -> M08 publishes facility.booking.confirmed/rejected 
  -> M09 queue consumer 
  -> M09 updates event record
```

**Release Flow**:
```
M09 (event closed/cancelled) 
  -> publish event.completed/event.cancelled 
  -> M08 queue consumer 
  -> M08 releases booking 
  -> damage assessment if applicable
```

### 8.3 M07 Placement Integration

**Career Profile Feed** (W09-L2-040):
- Triggered by: `portfolio.published` or `achievement.verified` (high-signal)
- M07 pulls from M09:
  - Club leadership positions
  - Hackathon/competition wins
  - Sports achievements
  - NCC/NSS certifications
  - Skill tags aggregated from all activities
- M09 is **source of truth** for co-curricular data
- Stale detection: if portfolio unpublished, M07 career profile shows warning

### 8.4 M10 Compliance Integration

**NAAC Evidence Feed** (W09-L2-041):
- Criterion III (Research, Innovations and Extension): events, hackathons, publications, community projects
- Criterion V (Student Support and Progression): club participation rates, mentoring, NCC/NSS, achievements
- AI packages evidence into compliance-ready format with metrics:
  - Total students participating in co-curricular activities
  - Achievement counts by level
  - Events conducted with attendance
  - NCC/NSS enrollment and completion rates

### 8.5 M02 People Integration

**Student Record Linking** (W09-L2-042):
- Every verified achievement, active membership, issued certificate, conferred award linked to student identity
- Evidence files stored in M02 document vault (certificates, achievement proofs)
- Available for: transcript generation, character certificate, transfer certificate

### 8.6 M04 Finance Integration

**Financial Flows** (W09-L2-043):
- Budget approved -> M04 creates fund reservation
- Expense incurred -> M04 records transaction against reservation
- Sponsorship cash received -> M04 records receipt
- Event cancelled -> M04 processes refunds
- Year-end -> M04 provides transaction summary for M09 reconciliation
- Activity fee from W03 -> M04 allocates pool to M09

### 8.7 M12 Platform Integration

**Notification Triggers** (W09-L2-044):
| Trigger | Channels | Urgency |
|---------|----------|---------|
| Event announcement | Juvi push + email | Normal |
| Registration reminder | Juvi push + WhatsApp | Normal |
| Achievement verification | Juvi push | Low |
| Event cancellation | All channels (push + WhatsApp + email + SMS) | High |
| Registration window open | Juvi push + email | Normal |
| Award conferred | Juvi push | Normal |
| Budget approval/rejection | Juvi push | Normal |

---

## 9. AI Agent Scope

### 9.1 AI Autonomous Actions (no human approval needed)

| Action | Sub-Workflow | Input | Output |
|--------|-------------|-------|--------|
| Club duplicate detection | W09-L2-001 | Club proposal | Similarity scores, merge suggestions |
| Club proposal scoring | W09-L2-001 | Proposal data + historical | Score 0-100 with breakdown |
| Club recommendation | W09-L2-003 | Student interests + skill gaps | Ranked club list |
| Open club auto-approve | W09-L2-004 | Membership application | Membership created (active) |
| Inactivity detection | W09-L2-006 | Membership activity history | Flag members inactive 3+ months |
| Club health scoring | W09-L2-007 | Club stats over year | Health score, dormancy flag |
| Calendar conflict detection | W09-L2-009 | Proposed dates + academic calendar | Conflict list |
| Event turnout prediction | W09-L2-009/012 | Historical data + registration count | Predicted attendance |
| Event proposal scoring | W09-L2-009/010 | Proposal data + historical | Score 0-100 |
| Check-in processing | W09-L2-014 | QR scan | Attendance recorded |
| Post-event sentiment analysis | W09-L2-014 | Feedback text | Sentiment score, themes |
| Event report generation | W09-L2-015 | Event data + feedback | Summary report |
| Achievement auto-verify (internal) | W09-L2-021 | Internal event results | Achievement created (auto_verified) |
| Achievement auto-verify (integrated) | W09-L2-025 | External API data | Achievement created (auto_verified) |
| Implausibility flagging | W09-L2-022 | Achievement claims history | Flag suspicious claims |
| Skill tag extraction | W09-L2-021/022 | Event/achievement data | Skill tag array |
| Certificate generation | W09-L2-026 | Template + data | Certificate PDF |
| Budget reasonableness scoring | W09-L2-027 | Request + historical | Score 0-100 |
| Utilisation alerts | W09-L2-029 | Budget utilisation rate | Alert at 80%/100% thresholds |
| Reconciliation report | W09-L2-031 | Planned vs actual data | Formatted report |
| Portfolio auto-assembly | W09-L2-033 | M09 activity events | Portfolio entries |
| Completeness scoring | W09-L2-033/036 | Portfolio contents | Score 0-100, gap analysis |
| Description generation | W09-L2-033 | Activity data | Display title + description |
| Gap detection nudges | W09-L2-036 | Portfolio + peer data | Personalised nudge messages |
| Evidence packaging for M10 | W09-L2-041 | Aggregated M09 data | NAAC-formatted evidence |

### 9.2 AI Assists (human makes final decision)

| Action | Sub-Workflow | AI Provides | Human Decides |
|--------|-------------|-------------|---------------|
| Proposal scoring shown to approver | W09-L2-001/002 | Score + breakdown | Approve/reject |
| Advisor matching suggestion | W09-L2-002 | Ranked faculty list | Advisor assignment |
| Marketing copy draft | W09-L2-012 | Event description, poster text | Final copy |
| Speaker suggestions | W09-L2-012 | Ranked speaker list | Invitation |
| Evidence pre-screening | W09-L2-023 | Verification recommendation | Verify/reject |
| Nomination reminders | W09-L2-024 | "Consider nominating [student]" | Nomination |
| Sponsor matching | W09-L2-030 | Past sponsors, industry alignment | Outreach decision |
| Spending pattern analysis | W09-L2-029 | Pattern report | Exception handling |
| Portfolio feature suggestions | W09-L2-034 | Recommended entries to feature | Curation |

### 9.3 Hard Constraints (AI must never)

- Approve or reject club proposals
- Assign faculty advisors
- Dissolve clubs
- Approve or cancel events
- Approve budgets
- Negotiate with sponsors
- Verify achievements from unknown sources
- Publish portfolio without student action
- Auto-dissolve clubs

---

## 10. Implementation Phases

### Phase 1: Entity Foundation + Club Lifecycle (Weeks 1-3)

**Goal**: New entity models + Club state machine + basic club workflows

**Models** (create/update):
- Update `Club.ts` with lifecycle status, scope, proposal fields
- Update `ClubMembership.ts` with `alumni` status, exit tracking
- Update `LeadershipRole.ts` with position tracking fields (rename conceptually to Position)
- Create `Programme.ts`

**Service Functions**:
- `proposeClub()` -- create with status=proposed, validate 5+ founders, AI duplicate check
- `approveClub()` -- transition proposed->approved, assign advisor, create founding memberships
- `rejectClub()` -- transition proposed->rejected with reason
- `applyForMembership()` -- auto-approve for open clubs, selection for structured
- `transitionMembershipStatus()` -- with guards (active->inactive->alumni)
- `openRegistrationWindow()` -- set dates, trigger notification
- `conductAnnualReview()` -- AI health report, dormancy detection
- `dissolveClub()` -- bulk status updates, budget reconciliation trigger
- `openElection()`, `castVote()`, `appointPosition()`

**Routes**: All ORG workflow endpoints from Section 5.2

**Validation**: State transition guards, founding member minimum, approval authority checks

**Tests**: Club lifecycle state machine transitions, membership flows, election/appointment flows

### Phase 2: Event Lifecycle + Fest/Competition/Workshop (Weeks 3-5)

**Goal**: Differentiated event types, approval workflows, registration, execution

**Models** (create):
- `Fest.ts`
- `Competition.ts`
- `Workshop.ts`
- Update `EventRegistration.ts` with check-in, waitlist, team fields

**Service Functions**:
- `proposeFest()`, `proposeCompetition()`, `proposeWorkshop()`
- `approveEvent()` -- scope-based routing, trigger M08 booking
- `planLogistics()` -- schedule, registration config
- `processRegistration()` -- eligibility check, capacity management, waitlist
- `checkIn()` -- QR/manual attendance
- `declareResults()` -- competition results, auto-trigger achievement creation
- `closeEvent()` -- tally, reconciliation trigger, report generation
- `cancelEvent()`, `postponeEvent()` -- with cascade effects
- `manageProgrammeCycle()` -- NCC/NSS enrollment, hours tracking
- `manageSportsSeason()` -- trials, fixtures, results

**Event Bus**: Implement `event.approved`, `event.completed`, `event.cancelled` publishers

**M08 Integration**: Facility booking request/confirmation flow

**Tests**: Event state machine transitions, registration capacity, cross-module booking

### Phase 3: Achievement Verification + Certificates (Weeks 5-7)

**Goal**: Verification pipeline, auto-capture, certificate generation

**Models** (create/update):
- Update `Achievement.ts` with verification pipeline fields
- Create `Award.ts`, `AwardInstance.ts`, `Certificate.ts`
- Update `SkillCertification.ts` with verification status

**Service Functions**:
- `autoCaptureAchievement()` -- from internal event results
- `claimExternalAchievement()` -- evidence upload, source classification
- `verifyAchievement()` -- manual F1 verification with evidence review
- `rejectAchievement()` -- with reason
- `autoVerifyFromIntegratedSource()` -- SIH, NCC, university sports sync
- `detectImplausibility()` -- AI flagging
- `extractSkillTags()` -- AI tag extraction
- `nominateForAward()`, `conferAward()`
- `generateCertificate()` -- template selection, population, signature

**Event Bus**: `achievement.verified`, `achievement.auto_verified`, `award.conferred`, `certificate.issued`

**M02 Integration**: Evidence file storage in document vault, student record linking

**Tests**: Verification state machine, auto-capture from events, implausibility detection, certificate generation

### Phase 4: Activity Budgets + Sponsorship (Weeks 7-9)

**Goal**: Budget request/approval workflow, utilisation tracking, sponsorship management

**Models** (create):
- `ActivityBudget.ts`, `BudgetLineItem.ts`
- `Sponsorship.ts`, `SponsorContact.ts`

**Service Functions**:
- `requestBudget()` -- with line items, AI reasonableness score, threshold routing
- `approveBudget()` -- full/partial, M04 fund reservation trigger
- `rejectBudget()` -- with reason
- `trackUtilisation()` -- read M04 transactions, threshold alerts
- `recordExpense()` -- against budget line item
- `reconcileBudget()` -- planned vs actual, AI report
- `createSponsorship()`, `updateSponsorshipStatus()`
- `allocateActivityFeePool()` -- institutional allocation

**Event Bus**: `budget.approved`, `budget.reconciled`, `sponsorship.received`

**M04 Integration**: Fund reservation, transaction reading, receipt recording, refunds

**Tests**: Budget approval thresholds, utilisation alerts, reconciliation, sponsorship lifecycle

### Phase 5: Portfolio + Cross-Module Integration (Weeks 9-12)

**Goal**: Portfolio auto-assembly, curation, publishing, all cross-module feeds

**Models** (create):
- `Portfolio.ts`, `PortfolioEntry.ts`

**Service Functions**:
- `autoAssemblePortfolio()` -- triggered by M09 activity events
- `scoreCompleteness()` -- AI section-weighted scoring
- `generateDescription()` -- AI display text for entries
- `extractSkillTags()` -- AI from activity data
- `curatePortfolio()` -- feature/hide/reorder/edit entries
- `addManualEntry()` -- with evidence verification routing
- `publishPortfolio()`, `unpublishPortfolio()`
- `detectGaps()` -- AI gap analysis with peer comparison
- `generateNudge()` -- personalised Juvi notification
- `finalisePortfolio()` -- immutable snapshot, archive

**Event Bus Consumers**:
- Listen for all M09 activity events -> auto-create portfolio entries
- Listen for `student.exit.initiated` -> trigger finalisation

**M07 Integration**: Career profile feed on publish/unpublish

**M10 Integration**: Activity evidence aggregation, NAAC formatting

**M12 Integration**: All notification triggers

**Juvi Integration**: Channel lifecycle, event cards, recommendation engine, portfolio view

**Tests**: Portfolio assembly from various sources, completeness scoring, publish/unpublish flow, cross-module data flow

### Phase 6: AI Enhancement + Polish (Weeks 12-14)

**Goal**: AI scoring models, recommendation engines, analytics

**AI Features**:
- Club proposal scoring model (train on historical data)
- Event turnout prediction model
- Achievement implausibility detection rules engine
- Budget reasonableness scoring (historical comparison)
- Portfolio gap detection with peer benchmarking
- Club recommendation engine (interest + skill gap matching)
- Post-event sentiment analysis pipeline
- Sponsor matching suggestion engine
- NAAC evidence auto-packaging

**Dashboard Enhancements**:
- Club health overview (active/dormant/dissolved counts, trends)
- Event calendar with conflict visualisation
- Achievement verification pipeline status
- Budget utilisation heat map
- Portfolio completeness distribution across student body
- NAAC readiness dashboard (criteria coverage %)

---

## Appendix A: Persona-to-Workflow Mapping

| Persona | Code | Workflows Where Acting |
|---------|------|----------------------|
| Student (S1-S4) | Student | W09-L2-001 (propose), 003 (browse), 004 (apply), 005 (vote), 006 (exit), 009 (propose event), 013 (register), 014 (participate), 019 (external), 020 (initiative), 022 (claim achievement), 027 (request budget), 030 (sponsorship), 034 (curate portfolio), 035 (publish) |
| Faculty Advisor (F1) | F1 | W09-L2-002 (approve club/dept), 004 (structured selection), 005 (election/appointment), 006 (review inactivity), 007 (annual review), 009 (propose/review event), 011 (approve club event), 014 (execute), 015 (close), 016 (NCC/NSS), 017 (sports), 023 (verify achievement), 024 (nominate), 027 (approve <10K budget), 029 (utilisation review) |
| HOD/Dean (F2) | F2 | W09-L2-002 (approve dept-scope), 007 (review dormancy), 008 (dissolve), 011 (approve dept event), 018 (cancel), 028 (approve 10K-1L budget), 030 (sponsorship negotiation approval) |
| Principal (L1) | L1 | W09-L2-002 (approve institution-scope), 007 (review dormancy), 008 (dissolve), 010 (approve fest), 011 (approve fest), 018 (cancel fest), 024 (confer institutional award), 028 (approve >1L budget), 032 (allocate pool) |
| Admin Staff (ST7) | Admin | W09-L2-003 (registration window), 032 (fee allocation) |
| Finance Staff (ST2) | Finance | W09-L2-029 (utilisation), 031 (reconciliation), 043 (transactions) |
| Campus Ops (ST6) | Campus | W09-L2-038 (booking approval), 039 (release) |
| TPO (ST4) | Placement | W09-L2-040 (career profile consumer) |
| AI Agent | System | W09-L2-003 (recommendations), 006 (inactivity), 007 (health report), 021 (auto-capture), 025 (auto-verify), 026 (certificate), 033 (portfolio assembly), 036 (nudges), 041 (compliance feed) |

## Appendix B: Workflow Boundary Summary

| Adjacent Workflow | Boundary Type | M09 Sub-Workflows | Data Direction |
|-------------------|--------------|-------------------|----------------|
| W01 (Intake) | Seeding | W09-L2-003, 033 | W01 -> M09 (student interests) |
| W02 (Academic Year) | Constraint | W09-L2-004, 009, 012 | M03 -> M09 (calendar, academic standing) |
| W03 (Fee Lifecycle) | Financial feed | W09-L2-032 | M04 -> M09 (activity fee pool) |
| W04 (Placement) | Primary pipeline | W09-L2-035, 040 | M09 -> M07 (portfolios, achievements) |
| W05 (Employee) | Workload link | W09-L2-002 | M09 -> M05 (advisor assignment) |
| W06 (Welfare) | Deferred | -- | M09 -> M06 (disengagement signals; future scope) |
| W07 (Compliance) | Primary pipeline | W09-L2-041 | M09 -> M10 (NAAC evidence Criteria III, V) |
| W08 (Campus Ops) | Facility consumer | W09-L2-038, 039 | M09 <-> M08 (booking requests/confirmations) |
| W10 (Exit) | Exit handoff | W09-L2-006, 037 | W10 triggers M09 finalisation |

## Appendix C: AI Constraint Summary

| Rule | Scope |
|------|-------|
| AI never auto-dissolves clubs | W09-L2-008 |
| AI never assigns faculty advisors | W09-L2-002 |
| AI never approves/rejects club proposals | W09-L2-002 |
| AI never approves/cancels events | W09-L2-011, 018 |
| AI never approves budgets | W09-L2-028 |
| AI never negotiates with sponsors | W09-L2-030 |
| AI cannot verify achievements from unknown sources | W09-L2-023 |
| AI cannot publish portfolio without student action | W09-L2-035 |
| AI verification only for trusted integrated sources | W09-L2-025 |
