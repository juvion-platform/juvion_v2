# W07 -- Accreditation & Compliance Readiness: Implementation Specification

> **Status**: DRAFT | Date: 2026-04-13
> **Scope**: Dual-mode workflow -- continuous background evidence collection + event-driven accreditation cycles
> **Primary Module**: M10 Compliance | **Evidence Sources**: M01--M09
> **AI Agents**: AG-06 (Compliance Monitor), AG-07 (Report Generator)
> **Regulatory Bodies**: NAAC, NBA, AICTE, AISHE, University (JNTU)

---

## 1. Executive Summary

W07 is the most architecturally distinct workflow in Juvion v2. Unlike W01--W06, which follow a linear entity lifecycle (applicant -> student, employee -> payroll), W07 operates in **dual mode**:

1. **Continuous Background Mode** -- The evidence registry (M10.1 EVID) and readiness engine (M10.3 READY) run perpetually, collecting evidence from nine source modules (M01--M09) via event subscriptions and periodic syncs, scoring evidence quality, computing readiness scores, and surfacing gaps. This mode has no start or end; it runs as long as the college exists.

2. **Event-Driven Cycle Mode** -- Accreditation cycles (M10.4 REPORT, M10.5 REMED, M10.6 VISIT) are triggered by regulatory deadlines. NAAC SSR preparation, NBA SAR per programme, AICTE annual returns, AISHE statistical submissions, and university affiliation packages each follow a distinct lifecycle with human authorship, AI auto-generation, approval workflows, and visit management.

The current M10 codebase provides 10 models and 51 service functions -- all pure CRUD with no evidence tracking, no automated collection, no readiness scoring, no report generation, and no remediation tracking. W07 requires 13 new models, approximately 65 new service functions, 3 state machines, 2 BullMQ queues, event bus subscriptions from 9 modules, and 2 AI agent integration points.

**Scale context**: A typical Indian engineering college undergoing NAAC accreditation will have approximately 7 criteria x 30+ key indicators = 200+ evidence items, an SSR of 200+ pages, and a peer team visit lasting 2--3 days. NBA adds per-programme SARs (potentially 10+ programmes). AICTE and AISHE are annual mandatory returns. This is the highest-complexity workflow in the system.

---

## 2. Current Codebase State

### 2.1 Existing Models (`backend/src/models/compliance/`)

| Model | Fields (key) | W07 Role | Gap |
|-------|-------------|----------|-----|
| `AccreditationBody` | name, acronym, type (enum: naac/nba/nirf/abet/aicte/ugc/other), website | **Reuse** -- represents NAAC, NBA, AICTE, etc. | Missing: frameworkVersion, cycleType, cycleDuration, scope, submissionPortalUrl, contactDetails |
| `AccreditationCycle` | bodyId, cycle (number), applicationDate, visitDate, grade, validFrom, validTo, status (preparing/applied/visit_scheduled/visited/accredited/expired) | **Reuse with extension** -- tracks cycle lifecycle | Missing: programmeId (for NBA), assessmentPeriod, targetGrade, baselineSnapshotId, reportId |
| `ComplianceCriteria` | accreditationCycleId, criterionNumber, title, maxScore, selfScore, peerScore, evidence (array of {description, fileUrl}), status | **Reuse with major extension** -- needs hierarchy, versioning, framework linkage | Missing: parentCriterionId (hierarchy), bodyId (framework-level vs cycle-level), keyIndicators, weightage, assessmentRubric, version, interpretationNotes |
| `RegulatoryFiling` | body, filingType, dueDate, filedDate, referenceNumber, documentUrl, status | **Reuse** -- maps to M10.6 VISIT deadline tracking | Missing: escalationLadder, responsiblePersonId, linkedReportId |
| `AICTEApproval` | academicYearId, applicationId, approvedIntake[], eoa, status | **Reuse** -- AICTE-specific compliance | Adequate for current scope |
| `AffiliationStatus` | universityName, affiliationNumber, validFrom, validTo, programmes[], status | **Reuse** -- University affiliation tracking | Missing: inspectionDate, documentPackageUrl |
| `AuditFinding` | auditType, auditorName, auditDate, finding, severity, correctionAction, correctionDeadline, status | **Reuse** -- maps to post-visit findings | Missing: criterionId linkage, remediationPlanId, assessorFeedbackFlag |
| `IQACReport` | academicYearId, reportType (aqar/ssr/annual_report/best_practices/feedback_analysis), data (Mixed), submittedDate, status | **Reuse** -- generic report tracking | Insufficient for structured SSR/SAR generation; will be supplemented by AccreditationReport |
| `RTIRequest` | applicantName, applicationDate, subject, description, feeReceived, assignedTo, responseDate, response, appealFiled, status | **Orthogonal** -- not part of W07 accreditation flow | No gap for W07 |
| `LegalCase` | caseNumber, courtName, caseType, filedDate, opposingParty, status, outcome | **Orthogonal** -- not part of W07 accreditation flow | No gap for W07 |

### 2.2 Existing Service Functions (`backend/src/modules/compliance/service.ts`)

51 functions total: `getStats` + 5 CRUD functions x 10 models. All follow the standard pattern:
- `list*(collegeId, page, limit, ...filters, authScope)` with `paginate()`
- `get*(collegeId, id)` with 404 throw
- `create*(collegeId, data, who)` with `createAuditLog()`
- `update*(collegeId, id, data, who)` with `findOneAndUpdate` + audit
- `delete*(collegeId, id, who)` with `findOneAndDelete` + audit

**No business logic exists**: no evidence collection, no score computation, no report generation, no state machine transitions, no cross-module queries, no event subscriptions.

### 2.3 Existing Routes (`backend/src/modules/compliance/routes.ts`)

50 routes across 10 resources, all mounted under `/api/compliance`. Standard CRUD: GET list, GET by id, POST create, PUT update, DELETE. All use `authenticate` + `authorize('compliance', action)` + `validate(schema)`.

### 2.4 Shared Infrastructure Available

| Component | Location | W07 Usage |
|-----------|----------|-----------|
| Event Bus | `backend/src/shared/events.ts` | Subscribe to M01--M09 events for evidence collection |
| Workflow Engine | `backend/src/shared/workflow/WorkflowEngine.ts` | Drives accreditation cycle state machines |
| BullMQ Queues | `backend/src/shared/queue/QueueManager.ts` | Scheduled evidence sync, deadline escalation, report generation |
| Audit Logger | `backend/src/shared/audit.ts` | All CUD operations |
| Pagination | `backend/src/shared/pagination.ts` | List endpoints |
| RBAC | `backend/src/shared/rbac/` | Scope evidence to department for HODs |

---

## 3. Sub-Workflow Catalog

W07 decomposes into 39 sub-workflows across 6 sub-domains plus 3 cross-module interactions.

### 3.1 M10.2 CRIT -- Criteria & Framework Management (Prerequisite Configuration)

| ID | Name | Mode | AI/Human | Key Entities |
|----|------|------|----------|-------------|
| W07-L2-001 | Load Regulatory Framework | Event-Driven | AI: framework parsing, criterion creation, version tracking. Human: ambiguous criteria interpretation | RegulatoryBody (C/U), ComplianceCriterion (C), AssessmentRubric (C) |
| W07-L2-002 | Map Evidence to Criteria | Event-Driven | AI: NLP-based mapping suggestions. Human: accept/reject/modify, set weights | CriterionEvidenceMapping (C/U), ComplianceCriterion (R) |
| W07-L2-003 | Update Framework Version | Event-Driven | AI: diff analysis, impact assessment, grade re-prediction. Human: adoption timing | ComplianceCriterion (C new/U old), AssessmentRubric (C/U), CriterionEvidenceMapping (C/U) |
| W07-L2-004 | Interpret Ambiguous Criterion | Event-Driven | AI: flag ambiguous language. Human: all interpretation decisions | ComplianceCriterion (U), CriterionEvidenceMapping (U) |

### 3.2 M10.1 EVID -- Evidence Registry: Continuous Collection & Quality Scoring

| ID | Name | Mode | Source Module | Trigger | NAAC Criteria |
|----|------|------|--------------|---------|---------------|
| W07-L2-005 | Collect Academic Evidence | Continuous | M03 Academics | Result declared, CO-PO computed, curriculum updated | I, II |
| W07-L2-006 | Collect Faculty, Registry & HR Evidence | Continuous | M02 Registry, M05 HR | Profile updated, FDP completed, faculty hired | I, II, III, VI |
| W07-L2-007 | Collect Admissions Evidence | Continuous | M01 Admissions | Admission confirmed, cycle closed | II, V |
| W07-L2-008 | Collect Financial Evidence | Continuous | M04 Finance | FY close, scholarship disbursed, audit completed | VI |
| W07-L2-009 | Collect Welfare & Statutory Evidence | Continuous | M06 Welfare | Grievance resolved, committee meeting held | V, VII |
| W07-L2-010 | Collect Placement & Alumni Evidence | Continuous | M07 Placement | Placement confirmed, feedback received | V |
| W07-L2-011 | Collect Infrastructure Evidence | Continuous | M08 Campus Ops | Periodic sync (scheduled, not event-driven) | IV |
| W07-L2-012 | Collect Student Development Evidence | Continuous | M09 Student Dev | Achievement recorded, event completed | III, V, VII |
| W07-L2-013 | Manual Evidence Upload | Event-Driven | -- (IQAC manual) | IQAC uploads non-auto-collectable evidence | All |

### 3.3 M10.3 READY -- Readiness & Gap Analysis: Continuous Scoring

| ID | Name | Mode | AI/Human |
|----|------|------|----------|
| W07-L2-014 | Compute Readiness Scores | Continuous | AI: all computation, trend detection, alerting. Human: consumption only |
| W07-L2-015 | Identify and Classify Gaps | Continuous | AI: detection, classification, severity/difficulty estimation, recommendations. Human: severity override |
| W07-L2-016 | Predict Accreditation Grade | Continuous | AI: grade prediction, scenario modeling, confidence. Human: target grade setting |
| W07-L2-017 | Prioritize Gap Remediation | Event-Driven | AI: ranking, effort estimation. Human: final priority, owner assignment, resource allocation |
| W07-L2-018 | Generate Readiness Dashboard | Continuous | AI: all computation and rendering. Human: consumption |

### 3.4 M10.6 VISIT -- Deadline & Visit Management

| ID | Name | Mode | AI/Human |
|----|------|------|----------|
| W07-L2-019 | Register Regulatory Deadline | Event-Driven | AI: escalation ladder setup. Human: deadline registration |
| W07-L2-020 | Execute Deadline Escalation | Continuous | AI: threshold detection, alert dispatch. Human: acknowledgment |
| W07-L2-021 | Schedule Assessment Visit | Event-Driven | AI: checklist generation. Human: visit date negotiation |
| W07-L2-022 | Prepare for Assessment Visit | Event-Driven | AI: checklist monitoring, reminders. Human: briefing content, mock walkthrough |
| W07-L2-023 | Conduct Assessment Visit | Event-Driven | AI: none during visit. Human: entirely human interaction |
| W07-L2-024 | Process Assessment Outcome | Event-Driven | AI: next cycle deadline creation, gap creation from feedback. Human: result interpretation |

### 3.5 M10.4 REPORT -- Report Generation & Submission

| ID | Name | Mode | Bodies | AI/Human |
|----|------|------|--------|----------|
| W07-L2-025 | Initiate NAAC SSR Cycle | Event-Driven | NAAC | AI: template loading, section creation. Human: cycle initiation, assignments |
| W07-L2-026 | Initiate NBA SAR Cycle | Event-Driven | NBA | AI: template loading, CO-PO verification. Human: programme selection |
| W07-L2-027 | Initiate AICTE Annual Return | Event-Driven | AICTE | AI: data population. Human: validation, manual fields |
| W07-L2-028 | Initiate AISHE Return | Event-Driven | AISHE | AI: data extraction and population. Human: validation, portal upload |
| W07-L2-029 | Initiate University Affiliation Package | Event-Driven | University | AI: evidence assembly. Human: narrative, submission logistics |
| W07-L2-030 | Auto-Generate Report Sections | Event-Driven | All | AI: data formatting, table generation, completeness check. Human: review |
| W07-L2-031 | Author Narrative Sections | Event-Driven | NAAC, NBA, University | AI: data support. Human: all authorship, review, approval |
| W07-L2-032 | Assemble and Submit Report | Event-Driven | All | AI: validation, assembly, artifact generation. Human: final approval, portal upload |

### 3.6 M10.5 REMED -- Remediation Tracking

| ID | Name | Mode | AI/Human |
|----|------|------|----------|
| W07-L2-033 | Create Remediation Plan | Event-Driven | AI: effort estimation. Human: plan creation, task assignment |
| W07-L2-034 | Track Remediation Progress | Continuous | AI: progress tracking, auto-verification, escalation. Human: critical gap sign-off |
| W07-L2-035 | Verify Gap Closure | Event-Driven | AI: auto-verify non-critical. Human: critical gap verification |
| W07-L2-036 | Close Remediation Cycle | Event-Driven | AI: statistics. Human: lessons learned, strategic review |

### 3.7 Cross-Module Interactions

| ID | Name | Module | Direction |
|----|------|--------|-----------|
| W07-L2-037 | Contextualize Metrics for Narratives | M11 Governance | M10 reads from M11 |
| W07-L2-038 | Dispatch Compliance Notifications | M12 Platform | M10 writes to M12 |
| W07-L2-039 | Coordinate Visit Logistics | M08 Campus Ops | M10 writes to M08 |

---

## 4. Entity Gap Analysis

### 4.1 New Models Required (13)

#### 4.1.1 EvidenceType (`backend/src/models/compliance/EvidenceType.ts`)

Defines the types of evidence the system can collect. Configured once, referenced by collection rules and evidence records.

```typescript
interface IEvidenceType {
  collegeId: ObjectId;
  name: string;                    // e.g. "CO-PO Attainment Report", "Faculty PhD Count"
  code: string;                    // e.g. "ACAD-COPO", "FAC-PHD"
  sourceModule: string;            // 'M01' | 'M02' | ... | 'M09' | 'manual'
  category: string;                // 'academic' | 'faculty' | 'financial' | 'infrastructure' | 'welfare' | 'placement' | 'student_dev' | 'admissions' | 'governance'
  description?: string;
  collectionMethod: string;        // 'event_driven' | 'periodic_sync' | 'manual'
  requiredComponents: string[];    // e.g. ["attainment_matrix", "course_outcomes", "programme_outcomes"]
  applicableBodies: string[];      // ['naac', 'nba', 'aicte', 'aishe', 'university']
  isActive: boolean;
}
// Index: { collegeId: 1, code: 1 } (unique)
// Index: { collegeId: 1, sourceModule: 1 }
```

#### 4.1.2 EvidenceCollectionRule (`backend/src/models/compliance/EvidenceCollectionRule.ts`)

Configures how evidence is collected -- which events to listen to, which fields to extract, quality thresholds.

```typescript
interface IEvidenceCollectionRule {
  collegeId: ObjectId;
  evidenceTypeId: ObjectId;        // ref: EvidenceType
  triggerEvent?: string;           // event bus event name, e.g. "academics:result:declared"
  syncSchedule?: string;           // cron expression for periodic sync, e.g. "0 2 * * 0" (weekly)
  sourceQuery: Record<string, any>; // MongoDB query to run against source module
  extractionMapping: Record<string, string>; // field mapping: { "evidenceField": "source.path.to.field" }
  qualityThresholds: {
    presence: number;              // 0-100: does evidence exist?
    completeness: number;          // 0-100: all required components present?
    recency: number;               // max age in days before score degrades
    qualityMinimum: number;        // 0-100: minimum quality score before flagging
  };
  isActive: boolean;
}
// Index: { collegeId: 1, evidenceTypeId: 1 }
// Index: { collegeId: 1, triggerEvent: 1 }
```

#### 4.1.3 EvidenceRecord (`backend/src/models/compliance/EvidenceRecord.ts`)

Individual evidence items collected from source modules or uploaded manually. Core entity of M10.1 EVID.

```typescript
interface IEvidenceRecord {
  collegeId: ObjectId;
  evidenceTypeId: ObjectId;        // ref: EvidenceType
  sourceModule: string;            // 'M01' | ... | 'M09' | 'manual'
  sourceEntityType?: string;       // e.g. "ExamResult", "FacultyProfile"
  sourceEntityId?: ObjectId;       // ref to source entity
  academicYearId?: ObjectId;       // ref: AcademicYear
  programmeId?: ObjectId;          // ref: Programme (for programme-level evidence)
  departmentId?: ObjectId;         // ref: Department
  title: string;
  data: Record<string, any>;       // structured evidence data
  attachments: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    uploadedAt: Date;
  }[];
  collectionMethod: string;        // 'event_driven' | 'periodic_sync' | 'manual'
  collectedAt: Date;
  collectedBy: string;             // 'AG-06' | userId
  scores: {
    presence: number;              // 0-100
    completeness: number;          // 0-100
    recency: number;               // 0-100
    quality: number;               // 0-100
    composite: number;             // weighted average
  };
  qualityOverride?: {
    score: number;
    overriddenBy: string;
    reason: string;
    overriddenAt: Date;
  };
  status: string;                  // 'draft' | 'collected' | 'flagged' | 'verified' | 'superseded' | 'archived'
  flagReason?: string;
  version: number;                 // increments on re-collection
  previousVersionId?: ObjectId;    // ref: EvidenceRecord (self-ref for version chain)
}
// Index: { collegeId: 1, evidenceTypeId: 1, status: 1 }
// Index: { collegeId: 1, sourceModule: 1, collectedAt: -1 }
// Index: { collegeId: 1, programmeId: 1 }
// Index: { collegeId: 1, status: 1, 'scores.composite': 1 }
```

#### 4.1.4 CriterionEvidenceMapping (`backend/src/models/compliance/CriterionEvidenceMapping.ts`)

Links evidence types to compliance criteria with contribution weights. Core configuration for readiness scoring.

```typescript
interface ICriterionEvidenceMapping {
  collegeId: ObjectId;
  criterionId: ObjectId;           // ref: ComplianceCriteria
  evidenceTypeId: ObjectId;        // ref: EvidenceType
  contributionWeight: number;      // 0.0-1.0 (how much this evidence contributes to criterion satisfaction)
  isMandatory: boolean;            // non-negotiable evidence requirement
  notes?: string;
  suggestedByAI: boolean;          // true if AG-06 suggested, false if human-created
  confirmedByHuman: boolean;       // true after IQAC review
}
// Index: { collegeId: 1, criterionId: 1, evidenceTypeId: 1 } (unique)
// Index: { collegeId: 1, criterionId: 1 }
```

#### 4.1.5 AssessmentRubric (`backend/src/models/compliance/AssessmentRubric.ts`)

Grade descriptors and scoring thresholds per criterion per regulatory body.

```typescript
interface IAssessmentRubric {
  collegeId: ObjectId;
  criterionId: ObjectId;           // ref: ComplianceCriteria
  bodyId: ObjectId;                // ref: AccreditationBody
  gradeDescriptors: {
    grade: string;                 // e.g. "A++", "Accredited (Tier I)"
    minimumScore: number;          // 0-100
    description: string;
  }[];
  scoringMethod: string;           // 'weighted_evidence' | 'rubric_based' | 'binary_compliance'
  maxScore: number;
  weightageInOverall: number;      // this criterion's weight in overall body-level score
  version: number;
  isActive: boolean;
}
// Index: { collegeId: 1, criterionId: 1, bodyId: 1, isActive: 1 }
```

#### 4.1.6 ReadinessScore (`backend/src/models/compliance/ReadinessScore.ts`)

Computed readiness scores at body, criterion, and programme level. Recalculated on evidence changes.

```typescript
interface IReadinessScore {
  collegeId: ObjectId;
  bodyId: ObjectId;                // ref: AccreditationBody
  criterionId?: ObjectId;          // ref: ComplianceCriteria (null for body-level aggregate)
  programmeId?: ObjectId;          // ref: Programme (for NBA per-programme scores)
  score: number;                   // 0-100
  maxPossibleScore: number;
  evidenceCount: number;
  evidenceWithGaps: number;
  trend: string;                   // 'improving' | 'stable' | 'declining'
  previousScore?: number;
  computedAt: Date;
  status: string;                  // 'current' | 'historical'
}
// Index: { collegeId: 1, bodyId: 1, status: 1 }
// Index: { collegeId: 1, bodyId: 1, criterionId: 1, status: 1 }
// Index: { collegeId: 1, bodyId: 1, programmeId: 1, status: 1 }
```

#### 4.1.7 ReadinessSnapshot (`backend/src/models/compliance/ReadinessSnapshot.ts`)

Point-in-time snapshots of readiness state. Used as baselines for report cycles and trend analysis.

```typescript
interface IReadinessSnapshot {
  collegeId: ObjectId;
  bodyId: ObjectId;                // ref: AccreditationBody
  programmeId?: ObjectId;          // ref: Programme
  snapshotDate: Date;
  trigger: string;                 // 'report_initiation' | 'post_remediation' | 'scheduled' | 'manual'
  overallScore: number;
  criterionScores: {
    criterionId: ObjectId;
    score: number;
    gapCount: number;
  }[];
  predictedGrade?: string;
  confidence?: number;             // 0-100
  createdBy: string;
}
// Index: { collegeId: 1, bodyId: 1, snapshotDate: -1 }
```

#### 4.1.8 GapRecord (`backend/src/models/compliance/GapRecord.ts`)

Identified gaps between current evidence state and accreditation requirements. Feeds remediation.

```typescript
interface IGapRecord {
  collegeId: ObjectId;
  bodyId: ObjectId;                // ref: AccreditationBody
  criterionId: ObjectId;           // ref: ComplianceCriteria
  programmeId?: ObjectId;          // ref: Programme
  evidenceTypeId?: ObjectId;       // ref: EvidenceType (specific evidence gap)
  gapType: string;                 // 'missing_evidence' | 'incomplete_evidence' | 'low_quality' | 'stale_expired'
  severity: string;                // 'critical' | 'major' | 'minor'
  difficulty: string;              // 'easy' | 'medium' | 'hard'
  description: string;
  recommendedAction: string;       // AI-generated recommendation
  deadlineUrgency: string;         // 'immediate' | 'this_month' | 'this_quarter' | 'this_year'
  assignedTo?: ObjectId;           // ref: Person (gap owner)
  priority?: number;               // set after prioritization (W07-L2-017)
  impactOnGrade?: string;          // e.g. "Blocks A+, limits to A"
  status: string;                  // 'identified' | 'remediation_planned' | 'in_progress' | 'resolved' | 'verified' | 'deferred' | 'carried_forward'
  resolvedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
}
// Index: { collegeId: 1, bodyId: 1, status: 1 }
// Index: { collegeId: 1, severity: 1, status: 1 }
// Index: { collegeId: 1, criterionId: 1 }
```

#### 4.1.9 AccreditationReport (`backend/src/models/compliance/AccreditationReport.ts`)

Tracks an entire report cycle (SSR, SAR, Annual Return, etc.) from initiation to submission.

```typescript
interface IAccreditationReport {
  collegeId: ObjectId;
  bodyId: ObjectId;                // ref: AccreditationBody
  accreditationCycleId: ObjectId;  // ref: AccreditationCycle
  programmeId?: ObjectId;          // ref: Programme (for NBA SAR, University affiliation)
  reportType: string;              // 'SSR' | 'SAR' | 'Annual_Return' | 'AISHE_Return' | 'Affiliation'
  templateId?: ObjectId;           // ref: ReportTemplate
  assessmentPeriod: {
    from: Date;
    to: Date;
  };
  baselineSnapshotId?: ObjectId;   // ref: ReadinessSnapshot
  sections: ObjectId[];            // ref: ReportSection[]
  completionPercentage: number;    // 0-100
  internalMilestones: {
    milestone: string;             // e.g. "Section Drafts Complete", "Review Round 1"
    dueDate: Date;
    completedDate?: Date;
    status: string;
  }[];
  submissionArtifactId?: ObjectId; // ref: SubmissionArtifact
  submissionReference?: string;    // portal confirmation number
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  status: string;                  // 'draft' | 'in_progress' | 'review' | 'approved' | 'submitted' | 'archived'
}
// Index: { collegeId: 1, bodyId: 1, status: 1 }
// Index: { collegeId: 1, accreditationCycleId: 1 }
```

#### 4.1.10 ReportSection (`backend/src/models/compliance/ReportSection.ts`)

Individual sections within an accreditation report. May be auto-generated (quantitative) or human-authored (narrative).

```typescript
interface IReportSection {
  collegeId: ObjectId;
  reportId: ObjectId;              // ref: AccreditationReport
  criterionId?: ObjectId;          // ref: ComplianceCriteria
  sectionNumber: string;           // e.g. "1", "2.1", "Annexure-A"
  title: string;
  sectionType: string;             // 'quantitative' | 'narrative' | 'mixed' | 'annexure' | 'executive_summary'
  content: string;                 // rich text / markdown
  tables: Record<string, any>[];   // structured table data
  evidenceRecordIds: ObjectId[];   // ref: EvidenceRecord[] (evidence backing this section)
  generationMethod: string;        // 'ai_auto' | 'human_authored' | 'ai_assisted'
  assignedTo?: ObjectId;           // ref: Person (for narrative sections)
  reviewedBy?: string;
  reviewNotes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  version: number;
  status: string;                  // 'pending' | 'draft' | 'ai_generated' | 'review' | 'revision_requested' | 'approved'
}
// Index: { collegeId: 1, reportId: 1, sectionNumber: 1 }
```

#### 4.1.11 ReportTemplate (`backend/src/models/compliance/ReportTemplate.ts`)

Templates defining the structure of reports for each body and report type.

```typescript
interface IReportTemplate {
  collegeId: ObjectId;
  bodyId: ObjectId;                // ref: AccreditationBody
  reportType: string;              // 'SSR' | 'SAR' | 'Annual_Return' | 'AISHE_Return' | 'Affiliation'
  version: string;                 // e.g. "2024", "NBA-OBE-v3"
  sections: {
    sectionNumber: string;
    title: string;
    sectionType: string;           // 'quantitative' | 'narrative' | 'mixed' | 'annexure'
    criterionId?: ObjectId;
    description: string;
    requiredFields?: string[];
    formatInstructions?: string;
  }[];
  isActive: boolean;
}
// Index: { collegeId: 1, bodyId: 1, reportType: 1, isActive: 1 }
```

#### 4.1.12 SubmissionArtifact (`backend/src/models/compliance/SubmissionArtifact.ts`)

Generated artifacts (PDF, Excel, ZIP packages) ready for submission.

```typescript
interface ISubmissionArtifact {
  collegeId: ObjectId;
  reportId: ObjectId;              // ref: AccreditationReport
  artifactType: string;            // 'pdf' | 'excel' | 'zip' | 'data_file'
  fileName: string;
  fileUrl: string;
  fileSize: number;
  checksum: string;
  generatedAt: Date;
  generatedBy: string;             // 'AG-07' | userId
  status: string;                  // 'generating' | 'ready' | 'submitted' | 'archived'
}
// Index: { collegeId: 1, reportId: 1 }
```

#### 4.1.13 RemediationPlan (`backend/src/models/compliance/RemediationPlan.ts`)

Plan for closing gaps identified during readiness analysis or assessment feedback.

```typescript
interface IRemediationPlan {
  collegeId: ObjectId;
  bodyId: ObjectId;                // ref: AccreditationBody
  accreditationCycleId?: ObjectId; // ref: AccreditationCycle
  title: string;
  targetCompletionDate: Date;
  tasks: {
    gapRecordId: ObjectId;         // ref: GapRecord
    description: string;
    assignedTo: ObjectId;          // ref: Person
    dueDate: Date;
    priority: number;
    milestones: {
      description: string;
      dueDate: Date;
      completedDate?: Date;
      status: string;
    }[];
    estimatedEffort: string;       // 'hours' | 'days' | 'weeks' | 'months'
    estimatedEffortValue: number;
    progress: number;              // 0-100
    status: string;                // 'pending' | 'in_progress' | 'completed' | 'verified' | 'stalled' | 'cancelled'
    stalledSince?: Date;
    verifiedBy?: string;
    verifiedAt?: Date;
  }[];
  overallProgress: number;         // 0-100
  effectiveness?: number;          // post-closure: readiness score improvement
  lessonsLearned?: string;
  status: string;                  // 'draft' | 'active' | 'completed' | 'archived'
  createdBy: string;
}
// Index: { collegeId: 1, bodyId: 1, status: 1 }
// Index: { collegeId: 1, 'tasks.assignedTo': 1, 'tasks.status': 1 }
```

### 4.2 Models Requiring Extension

#### 4.2.1 AccreditationBody -- Add fields

```typescript
// Add to existing schema:
frameworkVersion?: string;        // e.g. "NAAC Revised 2024", "NBA OBE v3"
cycleType: string;                // 'accreditation' | 'compliance' | 'reporting' | 'affiliation'
cycleDurationMonths?: number;     // typical cycle: NAAC=60, NBA=36-60, AICTE=12
scope: string;                    // 'institutional' | 'programme'
submissionPortalUrl?: string;
contactDetails?: {
  email?: string;
  phone?: string;
  address?: string;
};
```

#### 4.2.2 AccreditationCycle -- Add fields

```typescript
// Add to existing schema:
programmeId?: ObjectId;           // ref: Programme (for NBA, University programme-level cycles)
assessmentPeriod?: {
  from: Date;
  to: Date;
};
targetGrade?: string;             // institution's target: "A+", "Accredited Tier I"
predictedGrade?: string;          // AI-computed prediction
predictionConfidence?: number;    // 0-100
baselineSnapshotId?: ObjectId;    // ref: ReadinessSnapshot
reportId?: ObjectId;              // ref: AccreditationReport
outcome?: {
  grade: string;
  validityPeriod: number;         // months
  observations: string[];
  assessorRecommendations: string[];
};
// Add to status enum: 'draft' | 'evidence_collection' | 'report_drafting' | 'report_review' | 'submitted' | 'visit_preparation' | 'visit_in_progress'
```

#### 4.2.3 ComplianceCriteria -- Add fields

```typescript
// Add to existing schema:
bodyId: ObjectId;                 // ref: AccreditationBody (framework-level, not cycle-level)
parentCriterionId?: ObjectId;     // self-ref for hierarchy (criterion -> sub-criterion -> key indicator)
level: string;                    // 'criterion' | 'sub_criterion' | 'key_indicator'
keyIndicators?: string[];         // for criterion-level: list of KI descriptions
weightage?: number;               // 0-100, this criterion's weight in overall scoring
version?: string;                 // framework version this criterion belongs to
interpretationNotes?: string;     // IQAC's institutional interpretation
isAmbiguous?: boolean;            // flagged by AG-06
supersededById?: ObjectId;        // ref: ComplianceCriteria (when framework version changes)
```

#### 4.2.4 RegulatoryFiling -- Add fields

```typescript
// Add to existing schema:
responsiblePersonId?: ObjectId;   // ref: Person
linkedReportId?: ObjectId;        // ref: AccreditationReport
escalationConfig: {
  levels: {
    monthsBefore: number;         // e.g. 6, 3, 1, 0.5, 0.25
    alertLevel: string;           // 'early_warning' | 'planning' | 'urgent' | 'critical' | 'imminent'
    recipients: string[];         // role-based: ['iqac_coordinator', 'principal', 'hods']
    frequency: string;            // 'once' | 'weekly' | 'daily'
  }[];
};
acknowledgments: {
  personId: ObjectId;
  acknowledgedAt: Date;
  alertLevel: string;
}[];
```

#### 4.2.5 AuditFinding -- Add fields

```typescript
// Add to existing schema:
criterionId?: ObjectId;           // ref: ComplianceCriteria
remediationPlanId?: ObjectId;     // ref: RemediationPlan
isAssessorFeedback: boolean;      // true if from NAAC/NBA visit
assessmentVisitId?: ObjectId;     // ref: AccreditationCycle
```

---

## 5. API Endpoint Gap Analysis

### 5.1 Existing Endpoints (retain)

All 50 existing CRUD routes under `/api/compliance/` are retained. No breaking changes.

### 5.2 New Endpoints Required

#### 5.2.1 Evidence Registry (M10.1 EVID)

| Method | Path | Purpose | Sub-Workflow |
|--------|------|---------|-------------|
| GET | `/api/compliance/evidence-types` | List evidence types with filters (sourceModule, category, body) | Config |
| POST | `/api/compliance/evidence-types` | Create evidence type | Config |
| PUT | `/api/compliance/evidence-types/:id` | Update evidence type | Config |
| GET | `/api/compliance/evidence-collection-rules` | List collection rules | Config |
| POST | `/api/compliance/evidence-collection-rules` | Create collection rule | Config |
| PUT | `/api/compliance/evidence-collection-rules/:id` | Update collection rule | Config |
| GET | `/api/compliance/evidence-records` | List evidence records (filters: type, module, programme, status, minScore) | W07-L2-005--013 |
| GET | `/api/compliance/evidence-records/:id` | Get evidence record detail | W07-L2-005--013 |
| POST | `/api/compliance/evidence-records/upload` | Manual evidence upload (multipart) | W07-L2-013 |
| PUT | `/api/compliance/evidence-records/:id/quality-override` | Override quality score | W07-L2-013 |
| POST | `/api/compliance/evidence-records/:id/verify` | Mark evidence as verified | W07-L2-005--013 |
| POST | `/api/compliance/evidence/sync/:sourceModule` | Trigger manual sync from source module | W07-L2-011 |
| GET | `/api/compliance/evidence/stats` | Evidence collection statistics (by module, body, quality tier) | W07-L2-018 |

#### 5.2.2 Criteria & Framework (M10.2 CRIT)

| Method | Path | Purpose | Sub-Workflow |
|--------|------|---------|-------------|
| POST | `/api/compliance/frameworks/load` | Load/reload regulatory framework | W07-L2-001 |
| GET | `/api/compliance/frameworks/:bodyId/diff` | Get framework version diff | W07-L2-003 |
| POST | `/api/compliance/frameworks/:bodyId/adopt` | Adopt new framework version | W07-L2-003 |
| GET | `/api/compliance/criterion-evidence-mappings` | List mappings (filter by criterionId, bodyId) | W07-L2-002 |
| POST | `/api/compliance/criterion-evidence-mappings` | Create mapping | W07-L2-002 |
| PUT | `/api/compliance/criterion-evidence-mappings/:id` | Update mapping (weight, mandatory flag) | W07-L2-002 |
| POST | `/api/compliance/criterion-evidence-mappings/suggest` | AI-suggest mappings for a criterion | W07-L2-002 |
| PUT | `/api/compliance/compliance-criteria/:id/interpret` | Add interpretation notes | W07-L2-004 |
| GET | `/api/compliance/assessment-rubrics` | List rubrics (filter by bodyId, criterionId) | Config |
| POST | `/api/compliance/assessment-rubrics` | Create rubric | Config |
| PUT | `/api/compliance/assessment-rubrics/:id` | Update rubric | Config |

#### 5.2.3 Readiness & Gaps (M10.3 READY)

| Method | Path | Purpose | Sub-Workflow |
|--------|------|---------|-------------|
| GET | `/api/compliance/readiness/scores` | Get readiness scores (filter by bodyId, criterionId, programmeId) | W07-L2-014 |
| POST | `/api/compliance/readiness/compute` | Trigger manual readiness recomputation | W07-L2-014 |
| GET | `/api/compliance/readiness/snapshots` | List readiness snapshots (filter by bodyId, trigger) | W07-L2-016 |
| POST | `/api/compliance/readiness/snapshots` | Take manual snapshot | W07-L2-016 |
| GET | `/api/compliance/readiness/predict/:bodyId` | Get grade prediction with scenarios | W07-L2-016 |
| GET | `/api/compliance/readiness/dashboard/:bodyId` | Full readiness dashboard data | W07-L2-018 |
| GET | `/api/compliance/gaps` | List gap records (filters: bodyId, severity, status, assignedTo) | W07-L2-015 |
| GET | `/api/compliance/gaps/:id` | Get gap record detail | W07-L2-015 |
| PUT | `/api/compliance/gaps/:id/assign` | Assign gap owner | W07-L2-017 |
| PUT | `/api/compliance/gaps/:id/priority` | Set gap priority | W07-L2-017 |
| POST | `/api/compliance/gaps/prioritize` | AI-prioritize all open gaps for a body | W07-L2-017 |
| GET | `/api/compliance/gaps/stats` | Gap statistics (by body, severity, trend) | W07-L2-018 |

#### 5.2.4 Report Generation (M10.4 REPORT)

| Method | Path | Purpose | Sub-Workflow |
|--------|------|---------|-------------|
| GET | `/api/compliance/reports` | List accreditation reports (filter by bodyId, type, status) | W07-L2-025--029 |
| GET | `/api/compliance/reports/:id` | Get report with sections | W07-L2-025--029 |
| POST | `/api/compliance/reports/initiate` | Initiate report cycle (body, type, programme) | W07-L2-025--029 |
| POST | `/api/compliance/reports/:id/sections/:sectionId/generate` | AI auto-generate section | W07-L2-030 |
| PUT | `/api/compliance/reports/:id/sections/:sectionId` | Update section content (narrative authoring) | W07-L2-031 |
| POST | `/api/compliance/reports/:id/sections/:sectionId/review` | Submit section for review | W07-L2-031 |
| POST | `/api/compliance/reports/:id/sections/:sectionId/approve` | Approve section | W07-L2-031 |
| POST | `/api/compliance/reports/:id/sections/:sectionId/revision` | Request revision with notes | W07-L2-031 |
| POST | `/api/compliance/reports/:id/assemble` | Assemble final artifact | W07-L2-032 |
| POST | `/api/compliance/reports/:id/approve` | Final report approval | W07-L2-032 |
| POST | `/api/compliance/reports/:id/submit` | Record submission (portal ref) | W07-L2-032 |
| GET | `/api/compliance/report-templates` | List report templates | Config |
| POST | `/api/compliance/report-templates` | Create/update report template | Config |
| GET | `/api/compliance/submission-artifacts` | List artifacts (filter by reportId) | W07-L2-032 |
| GET | `/api/compliance/submission-artifacts/:id/download` | Download artifact file | W07-L2-032 |

#### 5.2.5 Visit Management (M10.6 VISIT)

| Method | Path | Purpose | Sub-Workflow |
|--------|------|---------|-------------|
| GET | `/api/compliance/deadlines` | List regulatory deadlines (filter by bodyId, status) | W07-L2-019 |
| POST | `/api/compliance/deadlines` | Register regulatory deadline | W07-L2-019 |
| PUT | `/api/compliance/deadlines/:id` | Update deadline (date change, extension) | W07-L2-019 |
| GET | `/api/compliance/deadlines/:id/alerts` | Get alerts history for a deadline | W07-L2-020 |
| POST | `/api/compliance/deadlines/:id/acknowledge` | Acknowledge alert | W07-L2-020 |
| POST | `/api/compliance/visits` | Schedule assessment visit | W07-L2-021 |
| GET | `/api/compliance/visits` | List assessment visits | W07-L2-021 |
| GET | `/api/compliance/visits/:id` | Get visit detail with checklist | W07-L2-021--023 |
| PUT | `/api/compliance/visits/:id` | Update visit (dates, assessor info) | W07-L2-021 |
| GET | `/api/compliance/visits/:id/checklist` | Get visit preparation checklist | W07-L2-022 |
| PUT | `/api/compliance/visits/:id/checklist/:itemId` | Update checklist item status | W07-L2-022 |
| POST | `/api/compliance/visits/:id/outcome` | Record assessment outcome | W07-L2-024 |

#### 5.2.6 Remediation (M10.5 REMED)

| Method | Path | Purpose | Sub-Workflow |
|--------|------|---------|-------------|
| GET | `/api/compliance/remediation-plans` | List plans (filter by bodyId, status) | W07-L2-033 |
| GET | `/api/compliance/remediation-plans/:id` | Get plan with tasks | W07-L2-033 |
| POST | `/api/compliance/remediation-plans` | Create remediation plan | W07-L2-033 |
| PUT | `/api/compliance/remediation-plans/:id` | Update plan | W07-L2-033 |
| PUT | `/api/compliance/remediation-plans/:id/tasks/:taskIdx` | Update task status/progress | W07-L2-034 |
| POST | `/api/compliance/remediation-plans/:id/tasks/:taskIdx/verify` | Verify task closure | W07-L2-035 |
| POST | `/api/compliance/remediation-plans/:id/close` | Close remediation cycle | W07-L2-036 |
| GET | `/api/compliance/remediation-plans/:id/progress` | Get progress dashboard data | W07-L2-034 |

**Total new endpoints: ~65**

---

## 6. State Machine Definitions

### 6.1 Accreditation Cycle State Machine

This state machine governs the lifecycle of an accreditation cycle from preparation through outcome processing. It applies to NAAC, NBA, and University cycles (AICTE and AISHE use a simplified linear flow).

```
                                 +-----------+
                     +---------> | preparing | <-- initial state
                     |           +-----------+
                     |                 |
                     |                 | [report initiated]
                     |                 v
                     |         +------------------+
                     |         | evidence_collection |
                     |         +------------------+
                     |                 |
                     |                 | [report drafting begins]
                     |                 v
                     |         +------------------+
                     |         | report_drafting  |
                     |         +------------------+
                     |                 |
                     |                 | [all sections ready]
                     |                 v
                     |         +------------------+
                     |         | report_review    |
                     |         +------------------+
                     |                 |
                     |                 | [principal approves]
                     |                 v
                     |           +-----------+
                     |           |  applied  |
                     |           +-----------+
                     |                 |
                     |                 | [visit confirmed]
                     |                 v
                     |        +-----------------+
                     |        | visit_scheduled |
                     |        +-----------------+
                     |                 |
                     |                 | [visit date]
                     |                 v
                     |      +--------------------+
                     |      | visit_in_progress  |
                     |      +--------------------+
                     |                 |
                     |                 | [visit ends]
                     |                 v
                     |           +-----------+
                     |           |  visited  |
                     |           +-----------+
                     |                 |
                     |                 | [outcome published]
                     |           +-----+------+
                     |           |            |
                     |           v            v
                     |   +-------------+  +-----------+
                     |   | accredited  |  |  expired  |
                     |   +-------------+  +-----------+
                     |         |
                     |         | [validity expires]
                     |         v
                     |   +-----------+
                     +-- |  expired  |  --> triggers new cycle
                         +-----------+
```

**Transitions**:

| From | To | Trigger | Guard | Side Effects |
|------|----|---------|-------|-------------|
| preparing | evidence_collection | Report initiated | reportId exists | Take baseline snapshot |
| evidence_collection | report_drafting | Report drafting begins | completionPercentage > 0 | -- |
| report_drafting | report_review | All sections submitted | All sections status = review or approved | Notify Principal |
| report_review | applied | Principal approves report | approvedBy exists | Generate submission artifact |
| applied | visit_scheduled | Visit dates confirmed | visitDate exists | Create visit prep checklist, notify M08 |
| visit_scheduled | visit_in_progress | Visit date reached | today >= visitDate | Notify all stakeholders |
| visit_in_progress | visited | Visit completed | -- | Create post-visit action items |
| visited | accredited | Positive outcome | outcome.grade exists | Set validFrom/validTo, create next cycle deadline |
| visited | expired | Negative outcome / rejection | -- | Create remediation plan, escalate |
| accredited | expired | Validity period ends | today > validTo | Trigger new cycle preparation |

### 6.2 Evidence Record Lifecycle

```
  +--------+      collection/upload      +-----------+
  | (none) | ----------------------->  | collected |
  +--------+                            +-----------+
                                              |
                              +---------------+---------------+
                              |                               |
                     [quality >= threshold]           [quality < threshold]
                              |                               |
                              v                               v
                       +-----------+                    +---------+
                       | collected |                    | flagged |
                       +-----------+                    +---------+
                              |                               |
                              |                        [IQAC reviews]
                              |                               |
                              |                    +----------+----------+
                              |                    |                     |
                              |             [override score]    [reject / re-collect]
                              |                    |                     |
                              |                    v                     v
                              |             +-----------+          +--------+
                              |             | collected |          | (none) |
                              |             +-----------+          +--------+
                              |
                       [IQAC verifies]
                              |
                              v
                       +----------+
                       | verified |
                       +----------+
                              |
                     [new version collected]
                              |
                              v
                     +-------------+
                     | superseded  |
                     +-------------+
                              |
                    [cycle ends / cleanup]
                              |
                              v
                     +----------+
                     | archived |
                     +----------+
```

**Statuses**: `draft`, `collected`, `flagged`, `verified`, `superseded`, `archived`

### 6.3 Remediation Task Lifecycle

```
  +---------+      plan created      +----------+
  | pending | -------------------->  | pending  |
  +---------+                        +----------+
                                          |
                                   [work begins]
                                          |
                                          v
                                   +--------------+
                                   | in_progress  |
                                   +--------------+
                                     |          |
                          [evidence improves]   [no progress > N days]
                                     |          |
                                     v          v
                              +------------+  +---------+
                              | completed  |  | stalled |
                              +------------+  +---------+
                                     |              |
                              [verification]   [escalation resolves]
                                     |              |
                                +----+----+         v
                                |         |   +--------------+
                         [non-critical] [critical] | in_progress |
                                |         |   +--------------+
                         [auto-verify]  [human verify]
                                |         |
                                v         v
                           +----------+
                           | verified |
                           +----------+

                           +-----------+
                           | cancelled |  <-- plan cancelled or gap deferred
                           +-----------+
```

**Statuses**: `pending`, `in_progress`, `completed`, `verified`, `stalled`, `cancelled`

**Escalation thresholds**:
- Stalled > 14 days: reminder to task owner
- Stalled > 30 days: escalate to IQAC Coordinator
- Critical task stalled > 30 days: escalate to Principal

---

## 7. Business Logic Requirements

### 7.1 Framework Parsing (W07-L2-001)

**Input**: Regulatory body identifier + framework version (or URL/document).
**Output**: Hierarchical ComplianceCriteria tree + AssessmentRubrics.

Logic:
1. For NAAC: Parse 7 criteria, each with sub-criteria and key indicators (approximately 30 KIs total). Create ComplianceCriteria at three levels: criterion -> sub_criterion -> key_indicator.
2. For NBA: Parse outcome-based criteria (PO attainment, CO-PO mapping, curriculum, faculty, infrastructure, student performance). Structure varies by programme type (UG engineering, PG, MBA, etc.).
3. For AICTE: Parse structured compliance norms (faculty ratios, infrastructure minimums, intake ceilings). These are binary compliance checks, not scored criteria.
4. For AISHE: Parse statistical field definitions. Minimal criteria structure; mostly data extraction.
5. For University: Parse affiliation requirements per university. Typically structured as documentation checklist.

**Implementation approach**: Seed initial framework definitions as JSON files in `backend/src/seeds/compliance-frameworks/`. AG-06 enhancement (Phase 3) will add ability to parse published PDF manuals.

### 7.2 Evidence Mapping (W07-L2-002)

**Algorithm**:
1. For each ComplianceCriterion, retrieve its title + description + key indicators.
2. Match against EvidenceType catalog using keyword overlap and semantic similarity (Phase 3: embeddings via AG-06).
3. Generate candidate CriterionEvidenceMappings with confidence scores.
4. Present to IQAC as suggestions: high-confidence auto-accepted, low-confidence flagged for review.
5. IQAC sets contributionWeight (0.0--1.0) and isMandatory flag.

**Phase 1 implementation**: Rule-based mapping using a predefined mapping table stored in seed data. Example: NAAC Criterion I (Curricular Aspects) maps to EvidenceTypes with sourceModule='M03' and category='academic'.

### 7.3 Evidence Quality Scoring (W07-L2-005--013)

Each EvidenceRecord receives four component scores, each 0--100:

| Component | Computation |
|-----------|------------|
| **Presence** | 100 if data exists and has non-empty content; 0 otherwise |
| **Completeness** | `(components_present / required_components) * 100` using EvidenceCollectionRule.requiredComponents |
| **Recency** | 100 if within current academic year; degrades linearly. `max(0, 100 - ((days_since_collection / max_age_days) * 100))` where max_age_days comes from qualityThresholds.recency |
| **Quality** | Heuristic per evidence type. Examples: CO-PO attainment quality = % of COs mapped to POs. Faculty data quality = % of profiles with verified documents. Financial quality = audit status (audited=100, unaudited=50) |
| **Composite** | Weighted average: `presence*0.25 + completeness*0.30 + recency*0.20 + quality*0.25` |

**Flagging rule**: If composite < qualityThresholds.qualityMinimum (from EvidenceCollectionRule), set status='flagged' and create notification for IQAC.

### 7.4 Readiness Score Computation (W07-L2-014)

**Per-criterion score**:
```
criterion_score = SUM(
  for each CriterionEvidenceMapping m where m.criterionId = criterion:
    best_evidence_score(m.evidenceTypeId) * m.contributionWeight
) / SUM(m.contributionWeight)
```

Where `best_evidence_score(evidenceTypeId)` = highest composite score among EvidenceRecords matching that type with status in ('collected', 'verified').

**Per-body score**:
```
body_score = SUM(
  for each criterion c in body's framework:
    criterion_score(c) * AssessmentRubric(c).weightageInOverall
) / SUM(weightageInOverall)
```

**Per-programme score** (NBA):
```
Same as per-body but filtered by programmeId on EvidenceRecords.
```

**Trend computation**: Compare current score with previous ReadinessScore (status='historical'). If delta > +5 = 'improving', delta < -5 = 'declining', else 'stable'.

### 7.5 Gap Detection (W07-L2-015)

**Trigger**: After readiness score computation, for each criterion where score < threshold.

**Gap classification**:

| Gap Type | Detection Rule |
|----------|---------------|
| missing_evidence | Criterion has mandatory CriterionEvidenceMapping but zero EvidenceRecords for that type |
| incomplete_evidence | EvidenceRecord exists but completeness < 70% |
| low_quality | EvidenceRecord exists but quality < 60% |
| stale_expired | EvidenceRecord recency < 30% (older than max_age) |

**Severity classification**:

| Severity | Rule |
|----------|------|
| critical | Gap in mandatory evidence AND criterion weightage >= 15% AND next deadline < 6 months |
| major | Gap reduces predicted grade by one level OR criterion score < 40% |
| minor | Gap exists but criterion score > 60% AND evidence available with formatting effort |

**Difficulty estimation**:

| Difficulty | Rule |
|-----------|------|
| easy | Evidence exists in source module but not yet collected (run sync) OR needs formatting only |
| medium | Requires action (e.g., conduct FDP, complete faculty profiles) achievable in 1--3 months |
| hard | Requires structural change (e.g., hire PhD faculty, build new lab, establish committee) |

### 7.6 Grade Prediction (W07-L2-016)

**NAAC grade mapping** (based on NAAC Revised Assessment Manual):

| Grade | CGPA Range | Score Equivalent |
|-------|-----------|-----------------|
| A++ | 3.76--4.00 | 94--100 |
| A+ | 3.51--3.75 | 88--93 |
| A | 3.26--3.50 | 82--87 |
| B++ | 3.01--3.25 | 75--81 |
| B+ | 2.76--3.00 | 69--74 |
| B | 2.51--2.75 | 63--68 |
| C | 1.51--2.50 | 38--62 |

**Confidence computation**: `min(evidence_coverage_%, score_stability_%) ` where:
- evidence_coverage_% = (criteria with >= 1 evidence) / (total criteria) * 100
- score_stability_% = 100 - (standard_deviation_of_recent_score_changes * 10)

**Scenario modeling**: For top 3 open gaps by impact, compute: "If gap X is resolved, score improves by Y, predicted grade changes from Z to W."

### 7.7 Report Auto-Generation (W07-L2-030)

**Quantitative sections** (AI-generated):
1. Read ReportTemplate section definition (required fields, format instructions).
2. Query EvidenceRecords mapped to the section's criterion.
3. Format into required tables:
   - NAAC: criterion-wise metrics tables (e.g., faculty qualification table, programme-wise results table)
   - NBA: CO-PO attainment matrix, rubric-based assessment tables
   - AICTE: structured data fields (key-value pairs)
   - AISHE: statistical tables (enrolment by category, faculty by qualification)
4. Compute derived metrics (percentages, ratios, trends).
5. Set section status to 'ai_generated'.

**Narrative sections** (human-authored with AI support):
1. AG-07 provides data support: readiness scores, evidence highlights, trend data.
2. Human author writes narrative in rich text editor.
3. AG-07 runs consistency check: does narrative match quantitative data?
4. Section goes through review -> approval flow.

### 7.8 Deadline Escalation Engine (W07-L2-020)

Implemented as a BullMQ repeatable job running daily at 06:00 IST.

**Algorithm**:
```
for each RegulatoryDeadline where status = 'active':
  daysToDeadline = deadline.dueDate - today
  for each level in deadline.escalationConfig.levels (sorted by monthsBefore DESC):
    if daysToDeadline <= level.monthsBefore * 30:
      if shouldSendAlert(deadline, level):
        createDeadlineAlert(deadline, level)
        dispatchNotification(level.recipients, level.alertLevel, deadline)
        break  // only fire the most urgent applicable level
```

**shouldSendAlert logic**: Check last alert for this deadline+level. If frequency='once' and already sent, skip. If frequency='weekly', check if 7+ days since last. If frequency='daily', check if 1+ days since last.

---

## 8. Cross-Module Integration Points

### 8.1 Event Subscriptions (M10 Listens)

W07 subscribes to events from M01--M09 via the shared event bus (`backend/src/shared/events.ts`). Each subscription triggers evidence collection in M10.1 EVID.

| Source Module | Event Name | Data Expected | Evidence Type(s) Created | Sub-Workflow |
|---------------|-----------|---------------|------------------------|-------------|
| M01 Admissions | `admissions:admission:confirmed` | { collegeId, applicantId, programmeId, category } | Intake statistics, fill rates | W07-L2-007 |
| M01 Admissions | `admissions:cycle:closed` | { collegeId, academicYearId, stats } | Demand ratio, process documentation | W07-L2-007 |
| M02 Registry | `people:faculty:profile-updated` | { collegeId, personId, qualifications } | Faculty PhD/NET/SET qualifications | W07-L2-006 |
| M02 Registry | `people:student:demographics-updated` | { collegeId, batch stats } | Student demographics | W07-L2-006 |
| M03 Academics | `academics:result:declared` | { collegeId, examId, programmeId, batchId } | Pass rates, result analysis | W07-L2-005 |
| M03 Academics | `academics:copo:computed` | { collegeId, programmeId, attainmentData } | CO-PO attainment report | W07-L2-005 |
| M03 Academics | `academics:curriculum:updated` | { collegeId, programmeId, curriculumId } | Curriculum structure | W07-L2-005 |
| M04 Finance | `finance:fy:closed` | { collegeId, academicYearId, financialSummary } | Financial statements | W07-L2-008 |
| M04 Finance | `finance:scholarship:disbursed` | { collegeId, scholarshipId, stats } | Scholarship disbursement records | W07-L2-008 |
| M05 HR | `hr:fdp:completed` | { collegeId, personId, fdpDetails } | FDP hours | W07-L2-006 |
| M05 HR | `hr:faculty:hired` | { collegeId, personId, department } | Recruitment records, faculty ratio | W07-L2-006 |
| M05 HR | `hr:workload:updated` | { collegeId, departmentId, workloadData } | Workload distribution | W07-L2-006 |
| M06 Welfare | `welfare:grievance:resolved` | { collegeId, grievanceId, type, stats } | Grievance statistics | W07-L2-009 |
| M06 Welfare | `welfare:committee:meeting-held` | { collegeId, committeeType, minutes } | Statutory committee minutes | W07-L2-009 |
| M07 Placement | `placement:offer:confirmed` | { collegeId, studentId, companyId, salary } | Placement statistics | W07-L2-010 |
| M07 Placement | `placement:feedback:received` | { collegeId, companyId, feedback } | Employer feedback | W07-L2-010 |
| M09 Student Dev | `student-dev:achievement:recorded` | { collegeId, studentId, achievement } | Achievement records | W07-L2-012 |
| M09 Student Dev | `student-dev:event:completed` | { collegeId, eventId, participationStats } | Activity participation | W07-L2-012 |

### 8.2 Periodic Sync (M10 Pulls)

M08 Campus Ops does not emit granular events. Instead, M10 runs a scheduled sync.

| Source | Schedule | Data Pulled | Evidence Types | Sub-Workflow |
|--------|----------|------------|---------------|-------------|
| M08 Campus Ops | Weekly (Sunday 02:00 IST) | Lab inventory, library holdings, hostel capacity, maintenance records, sports facilities | Infrastructure evidence | W07-L2-011 |

**Implementation**: BullMQ repeatable job `compliance:infrastructure-sync` that queries M08 models directly (same database, cross-model import).

### 8.3 Outbound Interactions (M10 Writes)

| Target Module | Interaction | Trigger | Data Sent |
|---------------|------------|---------|-----------|
| M08 Campus Ops | Visit logistics coordination | Assessment visit scheduled (W07-L2-021) | Visit dates, assessor count, room requirements, AV needs |
| M11 Governance | Readiness scores for institutional dashboard | Score update (W07-L2-014) | Body-level scores, gap summary, trend |
| M12 Platform (notifications) | Deadline alerts, task reminders, escalations | Multiple triggers | Notification payload (recipient, channel, content) |

### 8.4 Event Registration Pattern

New file: `backend/src/modules/compliance/evidence.listeners.ts`

```typescript
import { eventBus } from '../../shared/events';
import * as evidenceService from './evidence.service';

export function registerEvidenceListeners(): void {
  // M03 Academic Evidence
  eventBus.on('academics:result:declared', async (data) => {
    await evidenceService.collectAcademicEvidence(data.collegeId, 'result_declared', data);
  });

  eventBus.on('academics:copo:computed', async (data) => {
    await evidenceService.collectAcademicEvidence(data.collegeId, 'copo_computed', data);
  });

  // ... (all 18 event subscriptions)
}
```

Called from `backend/src/modules/compliance/index.ts` during module initialization.

---

## 9. AI Agent Scope

### 9.1 AG-06: Compliance Monitor

**Role**: Continuous background agent responsible for evidence collection, quality scoring, readiness computation, gap detection, and deadline monitoring.

**Capabilities** (Phase 1 -- rule-based):
- Event-driven evidence collection from M01--M09 events
- Quality scoring using configurable thresholds
- Readiness score computation using weighted aggregation
- Gap detection using threshold comparison
- Deadline escalation using configured ladder
- Framework diff analysis (structural comparison of criteria trees)

**Capabilities** (Phase 3 -- AI-enhanced):
- NLP-based evidence-to-criteria mapping suggestions
- Quality scoring using document analysis (parsing uploaded PDFs for content quality)
- Grade prediction with confidence intervals
- Scenario modeling: "what-if" analysis for gap resolution impact
- Framework parsing from regulatory body publications
- Ambiguity detection in criteria language

**Integration point**: AG-06 runs as BullMQ worker jobs, not as a persistent process. Each capability is a job type:
- `compliance:evidence-collect` -- triggered by event bus
- `compliance:score-compute` -- triggered by evidence change or schedule
- `compliance:gap-detect` -- triggered by score computation
- `compliance:deadline-check` -- daily scheduled job
- `compliance:infrastructure-sync` -- weekly scheduled job

### 9.2 AG-07: Report Generator

**Role**: Event-driven agent that auto-generates quantitative report sections and assembles submission artifacts.

**Capabilities** (Phase 1):
- Template-based section generation (fill tables from evidence data)
- Completeness validation (all required fields populated)
- Consistency checks (cross-reference data across sections)
- PDF/Excel artifact generation using template engines

**Capabilities** (Phase 3):
- Narrative draft assistance (provide structured talking points from evidence data)
- Cross-section consistency analysis using NLP
- Format compliance checking against regulatory templates

**Integration point**: AG-07 runs as BullMQ jobs:
- `compliance:report-generate-section` -- triggered by section generation request
- `compliance:report-assemble` -- triggered by assembly request
- `compliance:report-validate` -- triggered before submission

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1--3)

**Goal**: Models, evidence registry, manual evidence management, basic readiness scoring.

**Week 1: Models and CRUD**
- Create 13 new models (EvidenceType, EvidenceCollectionRule, EvidenceRecord, CriterionEvidenceMapping, AssessmentRubric, ReadinessScore, ReadinessSnapshot, GapRecord, AccreditationReport, ReportSection, ReportTemplate, SubmissionArtifact, RemediationPlan)
- Extend 5 existing models (AccreditationBody, AccreditationCycle, ComplianceCriteria, RegulatoryFiling, AuditFinding)
- Add Zod validation schemas for all new entities
- Add CRUD service functions for all new entities (~50 functions)
- Add routes and controllers (~40 new endpoints)

**Week 2: Evidence Configuration and Manual Collection**
- Seed EvidenceType catalog (approximately 30 types across 9 source modules)
- Seed NAAC/NBA/AICTE framework criteria (ComplianceCriteria hierarchy)
- Seed CriterionEvidenceMapping defaults
- Implement manual evidence upload (W07-L2-013): multipart file upload, quality scoring
- Implement evidence quality scoring engine (presence, completeness, recency, quality)
- Implement evidence listing with filters and quality stats

**Week 3: Readiness Scoring and Gaps**
- Implement readiness score computation (W07-L2-014)
- Implement gap detection and classification (W07-L2-015)
- Implement readiness dashboard endpoint (W07-L2-018)
- Implement grade prediction (W07-L2-016) -- rule-based NAAC grade mapping
- Implement gap prioritization endpoint (W07-L2-017)

### Phase 2: Event-Driven Evidence Collection (Weeks 4--5)

**Goal**: Automatic evidence collection from M01--M09, deadline management.

**Week 4: Event Listeners and Sync Jobs**
- Register event bus listeners for all 18 events (evidence.listeners.ts)
- Implement per-module evidence collectors:
  - `collectAcademicEvidence()` -- M03 events
  - `collectFacultyEvidence()` -- M02 + M05 events
  - `collectAdmissionsEvidence()` -- M01 events
  - `collectFinancialEvidence()` -- M04 events
  - `collectWelfareEvidence()` -- M06 events
  - `collectPlacementEvidence()` -- M07 events
  - `collectStudentDevEvidence()` -- M09 events
- Implement M08 infrastructure periodic sync (BullMQ repeatable job)
- Add BullMQ queue: `compliance:evidence-collect`
- Re-score readiness on evidence change (cascading computation)

**Week 5: Deadline and Visit Management**
- Implement deadline registration with escalation ladder (W07-L2-019)
- Implement escalation engine as daily BullMQ job (W07-L2-020)
- Add BullMQ queue: `compliance:deadline-check`
- Implement assessment visit scheduling (W07-L2-021)
- Implement visit preparation checklist (W07-L2-022)
- Implement outcome processing (W07-L2-024)
- M12 notification dispatch integration

### Phase 3: Report Generation and Remediation (Weeks 6--8)

**Goal**: Full report lifecycle, remediation tracking, AI agent integration.

**Week 6: Report Lifecycle**
- Implement report initiation for all 5 body types (W07-L2-025--029)
- Implement ReportTemplate seeding (NAAC SSR, NBA SAR, AICTE, AISHE, University)
- Implement section auto-generation (W07-L2-030) -- template-based data formatting
- Add BullMQ queue: `compliance:report-generate`
- Implement section authoring workflow (W07-L2-031): draft -> review -> approve

**Week 7: Assembly and Submission**
- Implement report assembly (W07-L2-032): completeness validation, consistency check
- Implement artifact generation (PDF assembly, Excel tables, ZIP packaging)
- Implement submission recording (portal reference, status update)
- Implement report approval workflow (section-level and report-level)

**Week 8: Remediation and Closure**
- Implement remediation plan creation (W07-L2-033)
- Implement progress tracking with evidence linkage (W07-L2-034)
- Implement gap closure verification (W07-L2-035) -- auto for non-critical, manual for critical
- Implement remediation cycle closure (W07-L2-036)
- Stalled task detection and escalation

### Phase 4: AI Enhancement and Polish (Weeks 9--10)

**Goal**: AG-06 and AG-07 advanced capabilities, framework management.

**Week 9: Framework Management**
- Implement framework loading from seed data (W07-L2-001)
- Implement framework version diff analysis (W07-L2-003)
- Implement criterion interpretation workflow (W07-L2-004)
- Implement AI-suggested evidence-to-criteria mapping (W07-L2-002) -- NLP-based
- M11 Governance integration (readiness scores feed to institutional dashboard)

**Week 10: AI Agent Refinement**
- Enhance AG-06 quality scoring with document analysis
- Enhance AG-07 section generation with richer formatting
- Implement scenario modeling for grade prediction
- Add cross-section consistency checking
- Performance optimization: readiness score caching, evidence query indexing
- End-to-end testing of full NAAC SSR cycle

### Dependency Chain

```
Phase 1 (Models + Manual CRUD)
    |
    v
Phase 2 (Event Listeners + Deadlines)  <-- requires M01-M09 events emitting
    |
    v
Phase 3 (Reports + Remediation)        <-- requires Phase 1 + 2
    |
    v
Phase 4 (AI Enhancement)               <-- requires Phase 3
```

### BullMQ Queue Summary

| Queue Name | Type | Schedule | Purpose |
|-----------|------|----------|---------|
| `compliance:evidence-collect` | On-demand | Event-triggered | Process evidence collection from module events |
| `compliance:score-compute` | On-demand + Scheduled | Daily 04:00 IST | Recompute readiness scores |
| `compliance:gap-detect` | On-demand | After score computation | Detect and classify gaps |
| `compliance:deadline-check` | Scheduled | Daily 06:00 IST | Run escalation ladder for all active deadlines |
| `compliance:infrastructure-sync` | Scheduled | Weekly Sunday 02:00 IST | Sync infrastructure evidence from M08 |
| `compliance:report-generate` | On-demand | Section generation request | Auto-generate report sections |
| `compliance:report-assemble` | On-demand | Assembly request | Assemble and validate final artifacts |

### Seed Data Requirements

| Seed File | Contents | Approximate Count |
|----------|----------|-------------------|
| `evidence-types.seed.ts` | Evidence type catalog | ~30 types |
| `naac-framework.seed.ts` | NAAC 7 criteria + sub-criteria + key indicators | ~100 criteria records |
| `nba-framework.seed.ts` | NBA OBE criteria per programme type | ~50 criteria records |
| `aicte-norms.seed.ts` | AICTE compliance norms (faculty ratios, infrastructure) | ~30 criteria records |
| `aishe-fields.seed.ts` | AISHE statistical field definitions | ~80 field records |
| `university-requirements.seed.ts` | University affiliation checklist | ~40 criteria records |
| `criterion-evidence-mappings.seed.ts` | Default mappings between criteria and evidence types | ~200 mapping records |
| `report-templates.seed.ts` | Report templates (NAAC SSR sections, NBA SAR sections, AICTE fields, AISHE fields) | ~5 templates with ~50 sections total |
| `assessment-rubrics.seed.ts` | Grade descriptors and scoring thresholds | ~30 rubric records |

---

## Appendix A: Regulatory Body Cycle Summary

| Body | Cycle Type | Duration | Report Type | Key Evidence | Automation Level |
|------|-----------|----------|------------|-------------|-----------------|
| NAAC | Institutional accreditation | 5-year cycle, 6--12 months prep | SSR (200+ pages) | All 7 criteria, all modules | Medium: quantitative auto-gen, narrative human |
| NBA | Programme accreditation | 3--5 year cycle, 3--6 months per programme | SAR (per programme) | CO-PO attainment (PRIMARY from M03) | Medium: CO-PO auto-gen, narrative human |
| AICTE | Annual compliance | Annual, 1--2 months | Annual Return (structured data) | Faculty norms, intake, infrastructure | High: near-full automation |
| AISHE | Annual reporting | Annual, 1 month | AISHE Return (statistical) | Enrolment, faculty, results, finance | Highest: statistical extraction |
| University (JNTU) | Programme affiliation | 3--5 year cycle, 3--6 months | Affiliation Package (physical) | Faculty, infrastructure, curriculum | Medium: assembly auto, physical submission manual |

## Appendix B: NAAC Criteria to Module Mapping

| NAAC Criterion | Description | Primary Source Modules | Evidence Types |
|---------------|-------------|----------------------|---------------|
| I | Curricular Aspects | M03 Academics | Curriculum structure, CO-PO mapping, feedback |
| II | Teaching-Learning & Evaluation | M03 Academics, M02 Registry, M05 HR | Pass rates, faculty qualifications, student-faculty ratio |
| III | Research, Innovations & Extension | M09 Student Dev, M05 HR | Research publications, FDP, extension activities |
| IV | Infrastructure & Learning Resources | M08 Campus Ops | Lab inventory, library, IT infrastructure, classrooms |
| V | Student Support & Progression | M01 Admissions, M06 Welfare, M07 Placement, M09 Student Dev | Admissions, grievances, placements, activities |
| VI | Governance, Leadership & Management | M04 Finance, M05 HR, M11 Governance | Financial management, faculty welfare, institutional planning |
| VII | Institutional Values & Best Practices | M06 Welfare, M09 Student Dev | Statutory committees, best practices, social responsibility |

## Appendix C: Escalation Ladder Configuration

| Time to Deadline | Alert Level | Recipients | Frequency | Content |
|-----------------|-------------|-----------|-----------|---------|
| 6 months | Early Warning | IQAC Coordinator | Once | Deadline details, current readiness score, major gaps count |
| 3 months | Planning | IQAC + Principal | Weekly | Readiness score, gap summary, report completion %, grade prediction |
| 1 month | Urgent | IQAC + Principal + HODs | Weekly | All above + stalled remediation tasks, incomplete report sections |
| 2 weeks | Critical | All stakeholders | Daily | All above + visit preparation checklist status |
| 1 week | Imminent | All stakeholders | Daily | All above + final readiness assessment, blocking items |
| Day-of | Final | All stakeholders | Daily | Submission confirmation or visit day briefing |
| Missed | Post-Due | Principal + IQAC + HODs | Immediate | Missed deadline documentation, next steps, consequence assessment |
