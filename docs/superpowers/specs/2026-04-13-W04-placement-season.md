# W04 -- Placement Season Execution: Implementation Specification

> **Status**: DRAFT | Date: 2026-04-13
> **Scope**: 80 sub-workflows across M07 Placement (7 sub-domains), M06 Welfare, M11 Governance, M12 Platform, M02 People, M03 Academics, M09 Student Dev, Juvi AI
> **Primary Module**: M07 Placement (`/api/placement`)
> **Seasonal Lifecycle**: Pre-Season (Apr--Jul) -> Season Open (Aug) -> Active Season (Aug--Feb) -> Wind-Down (Mar--Apr) -> Off-Season (Apr--Jul)

---

## 1. Executive Summary

W04 describes the complete placement season lifecycle for Indian colleges -- from company relationship management through drive execution, offer handling, dream policy enforcement, and alumni career tracking. The workflow spans **80 sub-workflows** grouped across 14 module/sub-domain boundaries.

**Current state**: M07 has 17 Mongoose models and 71 service functions, all pure CRUD with no workflow logic. There are no state machines, no eligibility checking, no dream policy enforcement, no AI scoring, no cross-module data reads, and no event-driven triggers.

**Gap summary**:
- **13 new entities** required (CareerProfile, CompanyEngagementLog, CompanyProgrammeAffinity, PlacementDrive, DriveApplication, InterviewSchedule, RecruiterAccount, RecruiterActivityLog, PlacementReadinessScore, SkillRecord, PlacementBar, OptOutRecord, AlumniCareerRecord)
- **6 existing models** need schema expansion (PlacementSeason, Company, JobPosting, PlacementOffer, PlacementTraining, AlumniProfile)
- **4 state machines** to implement (PlacementSeason lifecycle, PlacementDrive lifecycle, Offer lifecycle, Dream Policy enforcement)
- **~55 new service functions** for workflow logic beyond CRUD
- **~40 new API endpoints** for workflow actions, eligibility checks, scoring, and dashboards
- **3 AI agents** (AG-04a Pipeline Scoring, AG-04b Readiness Scoring, AG-04c Dream Policy Enforcement)
- **Cross-module reads** from M02 (identity), M03 (academics), M06 (welfare referrals), M09 (achievements), M11 (dashboards), M12 (notifications, matching, integration)

---

## 2. Current Codebase State

### 2.1 Existing Models (17)

| Model | File | Key Fields | Status Enum | Gaps |
|-------|------|-----------|-------------|------|
| PlacementSeason | `PlacementSeason.ts` | academicYearId, name, startDate, endDate, status | planning/active/completed | Missing: eligibleBatches, dreamThreshold, minCgpaDefault, seasonTargets, eligibleProgrammes |
| Company | `Company.ts` | name, industry, contactPerson, contactEmail, tier, isActive | (boolean isActive) | Missing: relationship_status, blacklist_flag, mou_expiry, relationship_health_score, hq, size, glassdoor_url, mca_registration |
| JobPosting | `JobPosting.ts` | placementSeasonId, companyId, role, packageLpa, eligibilityCriteria, status | draft/open/closed/filled | Missing: skills_required, eligible_programmes, bond_terms, min_cgpa, no_active_backlogs, location |
| PlacementRegistration | `PlacementRegistration.ts` | jobPostingId, studentId, resumeUrl, status | registered/shortlisted/placed/not_placed | Needs renaming to DriveApplication; missing: match_score, consent_timestamp, withdrawal_reason |
| PlacementRound | `PlacementRound.ts` | jobPostingId, roundNumber, name, type, date, venue, status | scheduled/ongoing/completed | Adequate for current needs |
| RoundResult | `RoundResult.ts` | roundId, studentId, result, score, remarks | pass/fail/absent | Adequate |
| PlacementOffer | `PlacementOffer.ts` | jobPostingId, studentId, companyId, packageLpa, offerDate, status | offered/accepted/declined/revoked | Missing: source (campus/off_campus/ppo), response_deadline, role, location, bond_terms, reneged status, released status, dream_override_reason |
| InternshipPosting | `InternshipPosting.ts` | companyId, title, stipend, durationWeeks, status | open/closed | Adequate for W04 scope |
| InternshipApplication | `InternshipApplication.ts` | internshipId, studentId, status | applied/shortlisted/selected/rejected/completed | Adequate |
| PlacementTraining | `PlacementTraining.ts` | title, type, trainer, startDate, endDate, status | planned/ongoing/completed | Missing: target_batch, target_programmes, mode (in_house/vendor/hybrid), session structure |
| TrainingAttendance | `TrainingAttendance.ts` | trainingId, studentId, attended | (boolean) | Missing: session-level granularity, excused status |
| MockInterview | `MockInterview.ts` | studentId, interviewerId, date, type, rating, feedback | -- | Missing: structured_feedback fields, readiness_score_contribution |
| HigherStudiesApplication | `HigherStudiesApplication.ts` | studentId, examType, examScore, status | preparing/applied/admitted/rejected | Adequate |
| EntrepreneurProfile | `EntrepreneurProfile.ts` | studentId, ventureIdea, stage, mentorId | ideation/prototype/launched/scaled | Adequate |
| AlumniProfile | `AlumniProfile.ts` | personId, graduationYear, currentCompany, willingToMentor | -- | Missing: current_role, ctc_range, industry, last_updated, update_source |
| AlumniEvent | `AlumniEvent.ts` | title, eventType, date, venue, organizerId | planned/ongoing/completed | Adequate |
| PlacementReport | `PlacementReport.ts` | placementSeasonId, reportType, data | -- | Adequate as generic report container |

### 2.2 Existing Service Functions (71)

All 71 functions follow the same CRUD pattern: `list*`, `get*`, `create*`, `update*`, `delete*` for each of the 17 models. Zero business logic, zero cross-model operations, zero validation beyond Zod schemas.

### 2.3 Existing Routes (35 endpoints)

All under `/api/placement`, grouped as:
- `/stats` (1 GET -- dashboard counters)
- `/seasons` (5 CRUD)
- `/companies` (5 CRUD)
- `/job-postings` (5 CRUD)
- `/registrations` (4 CRUD, no GET by id)
- `/rounds` (4 CRUD)
- `/round-results` (4 CRUD)
- `/offers` (4 CRUD)
- `/internships` (4 CRUD)
- `/internship-applications` (4 CRUD)
- `/trainings` (4 CRUD)
- `/training-attendance` (4 CRUD)
- `/mock-interviews` (4 CRUD)
- `/higher-studies` (4 CRUD)
- `/entrepreneurs` (4 CRUD)
- `/alumni-profiles` (4 CRUD)
- `/alumni-events` (4 CRUD)
- `/reports` (3 -- list, create, delete)

---

## 3. Sub-Workflow Catalog

### 3.1 M07.1 CRM -- Company Relationship Management (10 sub-workflows)

| ID | Name | Phase | AI Scope | Key Entities |
|----|------|-------|----------|-------------|
| W04-L2-001 | Score Company Pipeline for Season | Pre-Season | AG-04a RECOMMENDS | Company (R), CompanyEngagementLog (R), CompanyProgrammeAffinity (C/U) |
| W04-L2-002 | Outreach to Returning Company | Pre-Season | None | Company (R/U), CompanyEngagementLog (C) |
| W04-L2-003 | Onboard New Recruiting Company | Pre-Season | None | Company (C), CompanyEngagementLog (C), CompanyProgrammeAffinity (C) |
| W04-L2-004 | Renew or Renegotiate MoU | Pre-Season | None | Company (R/U), CompanyEngagementLog (C) |
| W04-L2-005 | Log Company Engagement Interaction | All Phases | AG-04a auto-recomputes health | CompanyEngagementLog (C), Company (U) |
| W04-L2-006 | Blacklist or Suspend Company | Active Season | None | Company (U), CompanyEngagementLog (C) |
| W04-L2-007 | Activate Alumni-as-Recruiter Link | Pre-Season | None | AlumniAsRecruiterLink (C), Company (R/U), CompanyEngagementLog (C) |
| W04-L2-008 | Generate Season-End Company Analytics | Wind-Down | AG-04a COMPUTES | Company (U), CompanyProgrammeAffinity (U) |
| W04-L2-009 | Collect Post-Drive Company Feedback | Active Season | None | CompanyEngagementLog (C), Company (U) |
| W04-L2-010 | Maintain Off-Season Company Relationships | Off-Season | AG-04a flags at-risk | Company (R/U), CompanyEngagementLog (C) |

### 3.2 M07.2 PROFILE -- Career Profile & Skill Registry (8 sub-workflows)

| ID | Name | Phase | AI Scope | Key Entities |
|----|------|-------|----------|-------------|
| W04-L2-011 | Initialize Career Profile for Graduating Batch | Pre-Season | Autonomous batch init | CareerProfile (C), SkillRecord (R) |
| W04-L2-012 | Student Completes Career Profile | Pre-Season | AG-04b recalculates readiness | CareerProfile (U), ProjectRecord (C), CertificationRecord (C), SkillRecord (C/U) |
| W04-L2-013 | Faculty Validates Projects & Certifications | Pre-Season | None | ProjectRecord (U), CertificationRecord (U) |
| W04-L2-014 | Ingest External Assessment Scores | Pre-Season | AG-04b COMPUTES readiness | SkillRecord (C), CareerProfile (U), PlacementReadinessScore (U) |
| W04-L2-015 | Compute Placement Readiness Score | Pre-Season | AG-04b COMPUTES (autonomous) | PlacementReadinessScore (C/U), CareerProfile (U) |
| W04-L2-016 | Student Views Career Profile in Juvi | Pre-Season | Juvi.3 companion tips | CareerProfile (R), PlacementReadinessScore (R), SkillRecord (R) |
| W04-L2-017 | Refresh Academic Data for Eligibility | Active Season | Autonomous data pull | CareerProfile (U) |
| W04-L2-018 | Feed Co-Curricular Portfolio into Career Profile | Pre-Season | Autonomous cross-module pull | CareerProfile (U) |

### 3.3 M07.5 TRAIN -- Training & Readiness (6 sub-workflows)

| ID | Name | Phase | AI Scope | Key Entities |
|----|------|-------|----------|-------------|
| W04-L2-019 | Plan Placement Training Programmes | Pre-Season | None | TrainingProgramme (C), TrainingSession (C) |
| W04-L2-020 | Conduct Training Session | Pre-Season | None | TrainingSession (U), TrainingAttendance (C) |
| W04-L2-021 | Assess Students Post-Training | Pre-Season | AG-04b COMPUTES readiness | TrainingAssessment (C), SkillRecord (C/U), PlacementReadinessScore (U) |
| W04-L2-022 | Conduct Mock Interview | Pre-Season | AG-04b COMPUTES readiness | TrainingAssessment (C: type=mock_interview), PlacementReadinessScore (U) |
| W04-L2-023 | Track Training Programme Completion | Pre-Season | Autonomous analytics | TrainingProgramme (U), TrainingAttendance (R) |
| W04-L2-024 | Juvi Companion Interview Prep Tips | Pre-Season | Juvi.3 COMPANION | CareerProfile (R), JD (R) |

### 3.4 M07.6 PORTAL -- Recruiter Portal & Consent (5 sub-workflows)

| ID | Name | Phase | AI Scope | Key Entities |
|----|------|-------|----------|-------------|
| W04-L2-025 | Register Recruiter Account | Pre-Season | None | RecruiterAccount (C), ExternalPerson in M02 (C) |
| W04-L2-026 | Verify Recruiter Account | Pre-Season | None | RecruiterAccount (U), RecruiterActivityLog (C) |
| W04-L2-027 | Recruiter Posts JD via Portal | Active Season | None | JD (C via M07.3), PlacementDrive (C), RecruiterActivityLog (C) |
| W04-L2-028 | Recruiter Browses Consent-Gated Profiles | Active Season | None | StudentConsent (R), CareerProfile (R), RecruiterActivityLog (C) |
| W04-L2-029 | Deactivate Recruiter Account | Off-Season | None | RecruiterAccount (U), RecruiterActivityLog (C) |

### 3.5 M07.3 DRIVES -- Drive Operations (14 sub-workflows)

| ID | Name | Phase | AI Scope | Key Entities |
|----|------|-------|----------|-------------|
| W04-L2-030 | Open Placement Season | Season Open | None | PlacementSeason (U) |
| W04-L2-031 | Review and Approve JD | Active Season | None | JD (U), PlacementDrive (U) |
| W04-L2-032 | Open Drive Applications | Active Season | AG-04 COMPUTES match scores | DriveApplication (C), StudentConsent (C), PlacementDrive (U) |
| W04-L2-033 | Check Student Eligibility for Drive | Active Season | AG-04c ENFORCES dream policy | CareerProfile (R), JD (R), PlacementBar (R), Offer (R) |
| W04-L2-034 | Generate AI-Ranked Shortlist | Active Season | AG-04 RECOMMENDS | DriveApplication (U) |
| W04-L2-035 | Release Shortlist to Students | Active Season | Autonomous notification | DriveApplication (U), PlacementDrive (U) |
| W04-L2-036 | Schedule Interviews | Active Season | AG-04 OPTIMIZES slot allocation | InterviewSchedule (C), PlacementDrive (U) |
| W04-L2-037 | Execute On-Campus Drive | Active Season | None | InterviewSchedule (U), DriveApplication (U) |
| W04-L2-038 | Execute Virtual Drive | Active Season | None | InterviewSchedule (U), DriveApplication (U) |
| W04-L2-039 | Execute Pool Campus Drive | Active Season | None | PlacementDrive (C: type=pool), DriveApplication (C/U) |
| W04-L2-040 | Track Off-Campus Placement | Active Season | None | PlacementDrive (C: type=off_campus), Offer (C: source=off_campus) |
| W04-L2-041 | Handle Pre-Placement Offer (PPO) | Season Open | AG-04c ENFORCES dream policy | Offer (C: source=ppo) |
| W04-L2-042 | Record Drive Outcome and Close | Active Season | Autonomous analytics | DriveApplication (U), PlacementDrive (U) |
| W04-L2-043 | Announce Drive via Juvi | Active Season | Autonomous notification | JuviNoticeCard (C) |

### 3.6 M07.4 OFFERS -- Offer & Outcome Management (12 sub-workflows)

| ID | Name | Phase | AI Scope | Key Entities |
|----|------|-------|----------|-------------|
| W04-L2-044 | Create Offer from Drive Selection | Active Season | Autonomous creation + notification | Offer (C: status=Extended), RecruiterActivityLog (C) |
| W04-L2-045 | Student Accepts Offer | Active Season | AG-04c activates dream threshold | Offer (U: Extended->Accepted) |
| W04-L2-046 | Student Rejects Offer | Active Season | None | Offer (U: Extended->Rejected) |
| W04-L2-047 | Enforce Dream Offer Policy | Active Season | AG-04c ENFORCES | Offer (R), DriveApplication (C if allowed), JD (R) |
| W04-L2-048 | Handle Offer Reneging by Company | Active Season | None | Offer (U: Accepted->Reneged), Company (U: flag) |
| W04-L2-049 | Handle Offer Lapse | Active Season | Autonomous deadline monitoring | Offer (U: Extended->Lapsed) |
| W04-L2-050 | Apply Placement Bar | Active Season | None | PlacementBar (C) |
| W04-L2-051 | Record Opt-Out Declaration | Active Season | None | OptOutRecord (C) |
| W04-L2-052 | Resolve Multiple-Offer Conflict | Active Season | None | Offer (U: multiple) |
| W04-L2-053 | Salary Negotiation Support | Active Season | None | Offer (U) |
| W04-L2-054 | Compute Season Placement Statistics | Wind-Down | AG-04d trajectory comparison | Offer (R), OptOutRecord (R), PlacementDrive (R) |
| W04-L2-055 | Notify Offer Status via Juvi | Active Season | Autonomous notification | JuviNoticeCard (C) |

### 3.7 M06 -- Student Welfare & Support (4 sub-workflows)

| ID | Name | Phase | Trigger | Resolution |
|----|------|-------|---------|------------|
| W04-L2-056 | Refer Unplaced Student for Career Counselling | Wind-Down | Unplaced + At Risk readiness | M06.6 referral created |
| W04-L2-057 | Mental Health Support During Placement Stress | Active Season | Self-report or faculty referral | M06.7 counsellor assigned |
| W04-L2-058 | Detect Placement Stress Signals via Juvi | Active Season | Distress pattern in conversations | Compassionate response + referral |
| W04-L2-059 | Career Counselling for 3+ Rejections | Active Season | 3+ Not Selected outcomes | M06.6 auto-flag |

### 3.8 M11 -- Governance & Institutional Intelligence (3 sub-workflows)

| ID | Name | Phase | AI Scope |
|----|------|-------|----------|
| W04-L2-060 | Populate Placement Dashboards | Active Season | Autonomous real-time dashboards |
| W04-L2-061 | Trigger Placement Trajectory Early Warning | Active Season | AG-04d ALERTS |
| W04-L2-062 | Export Placement Data for Accreditation | Wind-Down | Formatted export for NAAC/NBA |

### 3.9 M12, M07.7, M02, M03, M09, Juvi (18 sub-workflows)

| ID | Name | Module | Phase |
|----|------|--------|-------|
| W04-L2-063 | Student-JD Semantic Matching | M12.3 AI | Active Season |
| W04-L2-064 | Multi-Channel Placement Notifications | M12.2 COMMS | All Phases |
| W04-L2-065 | External Assessment Vendor Integration | M12.4 INTG | Pre-Season |
| W04-L2-066 | Initialize Alumni Career Record at Graduation | M07.7 ALUMNI | Wind-Down |
| W04-L2-067 | Collect Annual Alumni Career Update | M07.7 ALUMNI | Off-Season |
| W04-L2-068 | Activate Alumnus as Recruiter | M07.7 ALUMNI | Off-Season |
| W04-L2-069 | Push Alumni Career Analytics to Dashboards | M07.7 ALUMNI | Off-Season |
| W04-L2-070 | Read Student Identity for Career Profile | M02.2 STUID | Pre-Season |
| W04-L2-071 | Read Document Vault for Portfolio | M02.5 VAULT | Pre-Season |
| W04-L2-072 | Create External Person for Recruiter | M02.1 PCORE | Pre-Season |
| W04-L2-073 | Read CGPA & Backlog for Eligibility | M03.5 EXAM | Active Season |
| W04-L2-074 | Read Mark Sheets for Company Requirements | M03.5 EXAM | Active Season |
| W04-L2-075 | Sync Result Publication to Trigger Refresh | M03.5 EXAM | Active Season |
| W04-L2-076 | Read Achievement Records for Career Profile | M09.3 ACH | Pre-Season |
| W04-L2-077 | Read Published Portfolio for Recruiter View | M09.5 PORT | Pre-Season |
| W04-L2-078 | Display Company Info Card in Juvi | Juvi.2 HOME | Active Season |
| W04-L2-079 | View Interview Schedule in Juvi | Juvi.2 HOME | Active Season |
| W04-L2-080 | Placement Summary Widget in Juvi Home | Juvi.2 HOME | Active Season |

---

## 4. Entity Gap Analysis

### 4.1 New Entities Required (13)

#### 4.1.1 CareerProfile

**File**: `backend/src/models/placement/CareerProfile.ts`

```typescript
interface ICareerProfile {
  collegeId: ObjectId;
  studentId: ObjectId;              // ref: Student
  placementSeasonId: ObjectId;      // ref: PlacementSeason
  status: 'draft' | 'incomplete' | 'complete' | 'validated';
  academicSummary: {
    cgpa: number;
    activeBaklogs: number;
    programme: string;
    branch: string;
    regulation: string;
    lastResultSemester: number;
  };
  careerPreferences: {
    targetRoles: string[];
    preferredLocations: string[];
    expectedCtcLpa: number;
    willingToRelocate: boolean;
  };
  cocurricularHighlights: Array<{
    type: 'technical' | 'sports' | 'cultural' | 'service' | 'leadership';
    title: string;
    description: string;
    rank?: string;
    year: number;
  }>;
  profileCompletenessScore: number;  // 0-100
  photoUrl?: string;
}
```
**Sub-workflows**: W04-L2-011 through W04-L2-018

#### 4.1.2 CompanyEngagementLog

**File**: `backend/src/models/placement/CompanyEngagementLog.ts`

```typescript
interface ICompanyEngagementLog {
  collegeId: ObjectId;
  companyId: ObjectId;              // ref: Company
  placementSeasonId?: ObjectId;     // ref: PlacementSeason (null for off-season)
  type: 'outreach' | 'mou_signed' | 'mou_lapsed' | 'onboarding' | 'feedback'
      | 'blacklist' | 'suspension' | 'alumni_referral' | 'drive_completed'
      | 'general' | 'touchpoint';
  outcome?: 'interested' | 'maybe' | 'declined' | 'positive' | 'negative' | 'neutral';
  notes: string;
  actorId: ObjectId;               // ref: Person (who logged it)
  timestamp: Date;
}
```
**Sub-workflows**: W04-L2-001 through W04-L2-010

#### 4.1.3 CompanyProgrammeAffinity

**File**: `backend/src/models/placement/CompanyProgrammeAffinity.ts`

```typescript
interface ICompanyProgrammeAffinity {
  collegeId: ObjectId;
  companyId: ObjectId;              // ref: Company
  programmeId: ObjectId;            // ref: Programme
  placementSeasonId?: ObjectId;
  historicalHires: number;
  avgCtcLpa: number;
  conversionRate: number;           // applications to offers
  programmeFitScore: number;        // 0-100, computed by AG-04a
  lastUpdated: Date;
}
```
**Sub-workflows**: W04-L2-001, W04-L2-003, W04-L2-008

#### 4.1.4 PlacementDrive

**File**: `backend/src/models/placement/PlacementDrive.ts`

```typescript
interface IPlacementDrive {
  collegeId: ObjectId;
  placementSeasonId: ObjectId;      // ref: PlacementSeason
  companyId: ObjectId;              // ref: Company
  jobPostingId: ObjectId;           // ref: JobPosting (the JD)
  type: 'on_campus' | 'virtual' | 'pool' | 'off_campus';
  status: 'scheduled' | 'jd_published' | 'applications_open'
        | 'applications_closed' | 'shortlist_released'
        | 'interviews_in_progress' | 'offers_released' | 'closed' | 'cancelled';
  applicationWindow: {
    openDate: Date;
    closeDate: Date;
  };
  driveDate?: Date;
  venue?: string;
  virtualLink?: string;
  applicationCount: number;
  shortlistedCount: number;
  offeredCount: number;
  analytics?: {
    conversionRate: number;
    avgMatchScore: number;
  };
}
```
**Sub-workflows**: W04-L2-027, W04-L2-030 through W04-L2-042

#### 4.1.5 DriveApplication

**File**: `backend/src/models/placement/DriveApplication.ts`

Replaces/extends the current `PlacementRegistration` model.

```typescript
interface IDriveApplication {
  collegeId: ObjectId;
  driveId: ObjectId;                // ref: PlacementDrive
  jobPostingId: ObjectId;           // ref: JobPosting
  studentId: ObjectId;              // ref: Student
  status: 'applied' | 'shortlisted' | 'not_selected' | 'offered'
        | 'withdrawn' | 'no_show';
  matchScore?: number;              // computed by AG-04/M12.3
  matchConfidence?: 'high' | 'medium' | 'low';
  resumeUrl?: string;
  consentTimestamp: Date;           // application = consent
  withdrawalReason?: string;
  appliedAt: Date;
}
```
**Sub-workflows**: W04-L2-032 through W04-L2-042

#### 4.1.6 InterviewSchedule

**File**: `backend/src/models/placement/InterviewSchedule.ts`

```typescript
interface IInterviewSchedule {
  collegeId: ObjectId;
  driveId: ObjectId;                // ref: PlacementDrive
  studentId: ObjectId;              // ref: Student
  slotStart: Date;
  slotEnd: Date;
  venue?: string;
  virtualLink?: string;
  panelInfo?: string;
  status: 'scheduled' | 'confirmed' | 'rescheduled'
        | 'completed' | 'no_show' | 'cancelled';
  outcome?: 'selected' | 'not_selected' | 'pending';
}
```
**Sub-workflows**: W04-L2-036 through W04-L2-039

#### 4.1.7 RecruiterAccount

**File**: `backend/src/models/placement/RecruiterAccount.ts`

```typescript
interface IRecruiterAccount {
  collegeId: ObjectId;
  personId: ObjectId;               // ref: Person (M02)
  companyId: ObjectId;              // ref: Company
  designation: string;
  email: string;
  phone?: string;
  status: 'registered' | 'verified' | 'active' | 'deactivated';
  verifiedBy?: ObjectId;            // ref: Person (ST4)
  verifiedAt?: Date;
  deactivationReason?: string;
  lastLoginAt?: Date;
}
```
**Sub-workflows**: W04-L2-025 through W04-L2-029

#### 4.1.8 RecruiterActivityLog

**File**: `backend/src/models/placement/RecruiterActivityLog.ts`

```typescript
interface IRecruiterActivityLog {
  collegeId: ObjectId;
  recruiterAccountId: ObjectId;     // ref: RecruiterAccount
  action: 'registration' | 'verification' | 'jd_post' | 'profile_view'
        | 'shortlist_review' | 'offer_submit' | 'deactivation' | 'login';
  targetEntityType?: string;
  targetEntityId?: ObjectId;
  metadata?: Record<string, any>;
  timestamp: Date;
}
```
**Sub-workflows**: W04-L2-025 through W04-L2-029, W04-L2-042, W04-L2-044

#### 4.1.9 PlacementReadinessScore

**File**: `backend/src/models/placement/PlacementReadinessScore.ts`

```typescript
interface IPlacementReadinessScore {
  collegeId: ObjectId;
  studentId: ObjectId;              // ref: Student
  placementSeasonId: ObjectId;      // ref: PlacementSeason
  overall: number;                  // 0-100
  components: {
    aptitude: number;               // 0-100
    technical: number;              // 0-100
    softSkills: number;             // 0-100
    profileCompleteness: number;    // 0-100
    mockInterview?: number;         // 0-100, optional
  };
  weights: {
    aptitude: number;               // default 0.30
    technical: number;              // default 0.30
    softSkills: number;             // default 0.20
    profileCompleteness: number;    // default 0.20
  };
  category: 'ready' | 'needs_improvement' | 'at_risk';
  lastComputedAt: Date;
}
```
**Sub-workflows**: W04-L2-015, W04-L2-021, W04-L2-022

#### 4.1.10 SkillRecord

**File**: `backend/src/models/placement/SkillRecord.ts`

```typescript
interface ISkillRecord {
  collegeId: ObjectId;
  studentId: ObjectId;              // ref: Student
  skillName: string;
  category: 'aptitude' | 'technical' | 'soft_skills' | 'domain';
  source: 'assessment' | 'training_assessment' | 'self_reported'
        | 'certification' | 'mock_interview';
  score?: number;
  percentile?: number;
  vendor?: string;                  // e.g., 'AMCAT', 'HackerRank'
  assessedAt?: Date;
  verificationStatus: 'unverified' | 'verified' | 'rejected';
}
```
**Sub-workflows**: W04-L2-012, W04-L2-014, W04-L2-021

#### 4.1.11 PlacementBar

**File**: `backend/src/models/placement/PlacementBar.ts`

```typescript
interface IPlacementBar {
  collegeId: ObjectId;
  studentId: ObjectId;              // ref: Student
  reason: string;
  barType: 'disciplinary' | 'academic_fraud' | 'fee_default' | 'other';
  status: 'active' | 'lifted';
  appliedBy: ObjectId;              // ref: Person (ST4)
  appliedAt: Date;
  liftedBy?: ObjectId;
  liftedAt?: Date;
  liftConditions?: string;
}
```
**Sub-workflows**: W04-L2-050, W04-L2-033

#### 4.1.12 OptOutRecord

**File**: `backend/src/models/placement/OptOutRecord.ts`

```typescript
interface IOptOutRecord {
  collegeId: ObjectId;
  studentId: ObjectId;              // ref: Student
  placementSeasonId: ObjectId;      // ref: PlacementSeason
  reason: 'higher_education' | 'entrepreneurship' | 'family_business'
        | 'personal' | 'other';
  reasonDetail?: string;
  evidenceUrl?: string;
  status: 'active' | 'voided';
  recordedBy: ObjectId;             // ref: Person (ST4)
  recordedAt: Date;
  voidedAt?: Date;
  voidReason?: string;
}
```
**Sub-workflows**: W04-L2-051

#### 4.1.13 AlumniCareerRecord

**File**: `backend/src/models/placement/AlumniCareerRecord.ts`

```typescript
interface IAlumniCareerRecord {
  collegeId: ObjectId;
  personId: ObjectId;               // ref: Person (alumnus)
  alumniProfileId: ObjectId;        // ref: AlumniProfile
  currentEmployer?: string;
  currentRole?: string;
  ctcRange?: string;                // e.g., '10-15 LPA'
  industry?: string;
  location?: string;
  careerStatus: 'employed' | 'seeking' | 'higher_education'
              | 'entrepreneur' | 'unknown';
  updateSource: 'system_seeded' | 'self_report' | 'tpo_entry' | 'survey';
  lastUpdated: Date;
  isStale: boolean;                 // >2 years since update
}
```
**Sub-workflows**: W04-L2-066 through W04-L2-069

### 4.2 Existing Models Requiring Schema Expansion (6)

#### 4.2.1 PlacementSeason -- Add Fields

```typescript
// Add to existing schema:
eligibleBatches: [{ type: Number }],             // e.g., [2024, 2025]
eligibleProgrammeIds: [{ type: ObjectId, ref: 'Programme' }],
dreamThreshold: { type: Number, default: 1.5 },  // 1.5x multiplier
minCgpaDefault: { type: Number, default: 6.0 },
seasonTargets: {
  placementRateTarget: Number,                    // e.g., 85
  avgCtcTarget: Number,
  companyCountTarget: Number,
},
// Expand status enum: 'planning' | 'pre_season' | 'open' | 'active' | 'wind_down' | 'closed'
```

#### 4.2.2 Company -- Add Fields

```typescript
// Add to existing schema:
relationshipStatus: { type: String, enum: ['active', 'dormant', 'blacklisted', 'new'], default: 'new' },
blacklistFlag: { type: Boolean, default: false },
blacklistReason: String,
mouExpiry: Date,
relationshipHealthScore: { type: Number, min: 0, max: 100 },
size: { type: String, enum: ['startup', 'small', 'medium', 'large', 'mnc'] },
hq: String,
pipelineTier: { type: String, enum: ['tier_1', 'tier_2', 'tier_3'] },  // separate from offer-tier
conversionRate: Number,
lastEngagementDate: Date,
```

#### 4.2.3 JobPosting -- Add Fields

```typescript
// Add to existing schema:
skillsRequired: [String],
eligibleProgrammeIds: [{ type: ObjectId, ref: 'Programme' }],
minCgpa: Number,
noActiveBacklogs: { type: Boolean, default: true },
bondTerms: String,
location: String,
ctcBreakdown: {
  fixedLpa: Number,
  variableLpa: Number,
  totalCtcLpa: Number,
},
// Expand status: 'drafted' | 'published' | 'closed'
```

#### 4.2.4 PlacementOffer -- Add Fields

```typescript
// Add to existing schema:
source: { type: String, enum: ['campus', 'off_campus', 'ppo'], default: 'campus' },
driveId: { type: ObjectId, ref: 'PlacementDrive' },
role: String,
location: String,
bondTerms: String,
responseDeadline: Date,
dreamOverrideReason: String,        // if ST4 granted exception
previousOfferId: { type: ObjectId, ref: 'PlacementOffer' },  // for dream offer chain
// Expand status: 'extended' | 'accepted' | 'rejected' | 'revoked' | 'reneged' | 'lapsed' | 'released'
```

#### 4.2.5 PlacementTraining -- Add Fields

```typescript
// Add to existing schema:
targetBatch: [Number],
targetProgrammeIds: [{ type: ObjectId, ref: 'Programme' }],
mode: { type: String, enum: ['in_house', 'vendor', 'hybrid'], default: 'in_house' },
placementSeasonId: { type: ObjectId, ref: 'PlacementSeason' },
sessions: [{
  sessionNumber: Number,
  date: Date,
  startTime: String,
  endTime: String,
  venue: String,
  status: { type: String, enum: ['scheduled', 'conducted', 'cancelled'] },
}],
```

#### 4.2.6 AlumniProfile -- Add Fields

```typescript
// Add to existing schema:
currentRole: String,
ctcRange: String,
industry: String,
lastUpdated: Date,
updateSource: { type: String, enum: ['system', 'self_report', 'tpo_entry'] },
```

---

## 5. API Endpoint Gap Analysis

### 5.1 Existing Endpoints (35) -- Retain As-Is

All existing CRUD endpoints remain. No breaking changes.

### 5.2 New Endpoints Required (~40)

#### M07.1 CRM Endpoints

| Method | Path | Sub-WF | Description |
|--------|------|--------|-------------|
| POST | `/api/placement/companies/:id/score-pipeline` | W04-L2-001 | Trigger AG-04a pipeline scoring for a season |
| GET | `/api/placement/companies/:id/pipeline-dashboard` | W04-L2-001 | Get scored company pipeline for TPO dashboard |
| POST | `/api/placement/companies/:id/engagement-logs` | W04-L2-005 | Create engagement log entry |
| GET | `/api/placement/companies/:id/engagement-logs` | W04-L2-005 | List engagement history for company |
| PUT | `/api/placement/companies/:id/blacklist` | W04-L2-006 | Blacklist/suspend company |
| PUT | `/api/placement/companies/:id/reinstate` | W04-L2-006 | Reinstate blacklisted company |
| GET | `/api/placement/companies/:id/programme-affinity` | W04-L2-001 | Get programme affinity scores |
| POST | `/api/placement/seasons/:id/company-analytics` | W04-L2-008 | Generate season-end company analytics |

#### M07.2 PROFILE Endpoints

| Method | Path | Sub-WF | Description |
|--------|------|--------|-------------|
| POST | `/api/placement/seasons/:id/init-career-profiles` | W04-L2-011 | Batch initialize career profiles for graduating batch |
| GET | `/api/placement/career-profiles` | W04-L2-016 | List career profiles (filtered by season, student) |
| GET | `/api/placement/career-profiles/:id` | W04-L2-016 | Get single career profile |
| PUT | `/api/placement/career-profiles/:id` | W04-L2-012 | Student updates career profile |
| POST | `/api/placement/career-profiles/:id/validate-item` | W04-L2-013 | Faculty validates project/certification |
| POST | `/api/placement/career-profiles/:id/refresh-academic` | W04-L2-017 | Refresh academic data from M03 |
| GET | `/api/placement/readiness-scores` | W04-L2-015 | List readiness scores (batch view) |
| GET | `/api/placement/readiness-scores/:studentId` | W04-L2-015 | Get readiness score for student |
| POST | `/api/placement/readiness-scores/compute-batch` | W04-L2-015 | Trigger batch readiness computation |

#### M07.3 DRIVES Endpoints

| Method | Path | Sub-WF | Description |
|--------|------|--------|-------------|
| POST | `/api/placement/drives` | W04-L2-027 | Create placement drive (linked to JD) |
| GET | `/api/placement/drives` | W04-L2-030 | List drives for a season |
| GET | `/api/placement/drives/:id` | W04-L2-030 | Get drive details |
| PUT | `/api/placement/drives/:id/status` | W04-L2-030-042 | Transition drive status |
| POST | `/api/placement/drives/:id/applications` | W04-L2-032 | Student applies to drive |
| GET | `/api/placement/drives/:id/applications` | W04-L2-032 | List applications for drive |
| POST | `/api/placement/drives/:id/check-eligibility` | W04-L2-033 | Check eligibility for a student |
| POST | `/api/placement/drives/:id/generate-shortlist` | W04-L2-034 | Trigger AI shortlist generation |
| PUT | `/api/placement/drives/:id/release-shortlist` | W04-L2-035 | Release shortlist to students |
| POST | `/api/placement/drives/:id/schedule-interviews` | W04-L2-036 | Create/optimize interview schedule |
| GET | `/api/placement/drives/:id/interview-schedules` | W04-L2-036 | List interview schedule for drive |
| PUT | `/api/placement/drives/:id/close` | W04-L2-042 | Close drive with outcomes |

#### M07.4 OFFERS Endpoints

| Method | Path | Sub-WF | Description |
|--------|------|--------|-------------|
| POST | `/api/placement/offers/:id/accept` | W04-L2-045 | Student accepts offer |
| POST | `/api/placement/offers/:id/reject` | W04-L2-046 | Student rejects offer |
| POST | `/api/placement/offers/:id/renege` | W04-L2-048 | Record company reneging |
| POST | `/api/placement/offers/check-dream-policy` | W04-L2-047 | Check dream policy for student + drive |
| POST | `/api/placement/placement-bars` | W04-L2-050 | Apply placement bar |
| PUT | `/api/placement/placement-bars/:id/lift` | W04-L2-050 | Lift placement bar |
| GET | `/api/placement/placement-bars` | W04-L2-050 | List bars (filtered by student, status) |
| POST | `/api/placement/opt-outs` | W04-L2-051 | Record opt-out declaration |
| PUT | `/api/placement/opt-outs/:id/void` | W04-L2-051 | Void opt-out |
| GET | `/api/placement/opt-outs` | W04-L2-051 | List opt-outs for season |
| GET | `/api/placement/seasons/:id/statistics` | W04-L2-054 | Get season placement statistics |

#### M07.6 PORTAL Endpoints

| Method | Path | Sub-WF | Description |
|--------|------|--------|-------------|
| POST | `/api/placement/recruiter-accounts` | W04-L2-025 | Register recruiter account |
| PUT | `/api/placement/recruiter-accounts/:id/verify` | W04-L2-026 | Verify recruiter account |
| PUT | `/api/placement/recruiter-accounts/:id/deactivate` | W04-L2-029 | Deactivate recruiter account |
| GET | `/api/placement/recruiter-accounts/:id/activity-log` | W04-L2-025 | Get recruiter activity log |

#### M07.7 ALUMNI Endpoints

| Method | Path | Sub-WF | Description |
|--------|------|--------|-------------|
| POST | `/api/placement/alumni-career-records` | W04-L2-066 | Initialize alumni career record |
| PUT | `/api/placement/alumni-career-records/:id` | W04-L2-067 | Update alumni career record |
| GET | `/api/placement/alumni-career-records` | W04-L2-067 | List alumni career records |
| GET | `/api/placement/alumni-analytics` | W04-L2-069 | Get alumni career analytics |

---

## 6. State Machine Definitions

### 6.1 Placement Season Lifecycle

```
planning ──[ST4 confirms pre-season]──> pre_season
pre_season ──[ST4 opens season]──> open
open ──[first drive starts]──> active
active ──[ST4 initiates wind-down]──> wind_down
wind_down ──[all drives closed + stats finalized]──> closed
```

**Allowed transitions**:
- `planning -> pre_season` (ST4 action)
- `pre_season -> open` (ST4 action, requires: eligibleBatches set, dreamThreshold configured)
- `open -> active` (automatic on first drive start)
- `active -> wind_down` (ST4 action)
- `wind_down -> closed` (ST4 action, requires: all drives closed, statistics computed)

**Guards**:
- Cannot open season without eligible batches defined
- Cannot close season while drives are in progress
- Dream threshold cannot be changed retroactively once season is open (applies prospectively)

### 6.2 Placement Drive Lifecycle

```
scheduled ──[JD approved by ST4]──> jd_published
jd_published ──[application window opened]──> applications_open
applications_open ──[deadline reached or ST4 closes]──> applications_closed
applications_closed ──[shortlist generated and released]──> shortlist_released
shortlist_released ──[interview dates set]──> interviews_in_progress
interviews_in_progress ──[E1 submits selections]──> offers_released
offers_released ──[all offers resolved]──> closed
(any state) ──[ST4 cancels]──> cancelled
```

**Allowed transitions** (strict ordering):
```typescript
const DRIVE_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['jd_published', 'cancelled'],
  jd_published: ['applications_open', 'cancelled'],
  applications_open: ['applications_closed', 'cancelled'],
  applications_closed: ['shortlist_released', 'cancelled'],
  shortlist_released: ['interviews_in_progress', 'cancelled'],
  interviews_in_progress: ['offers_released', 'cancelled'],
  offers_released: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};
```

**Side effects on transition**:
- `applications_open`: triggers Juvi notification (W04-L2-043), AG-04 match scoring starts
- `applications_closed`: triggers AG-04 shortlist generation (W04-L2-034)
- `shortlist_released`: notifies students (W04-L2-035), triggers interview scheduling
- `offers_released`: creates Offer entities (W04-L2-044), notifies students
- `closed`: triggers company feedback request (W04-L2-009), analytics push to M11
- `cancelled`: notifies all affected students and E1

### 6.3 Offer Lifecycle

```
extended ──[student accepts]──> accepted
extended ──[student rejects]──> rejected
extended ──[deadline passes]──> lapsed
extended ──[company withdraws before acceptance]──> revoked
accepted ──[company reneges]──> reneged
accepted ──[dream offer accepted, previous released]──> released
```

**Allowed transitions**:
```typescript
const OFFER_TRANSITIONS: Record<string, string[]> = {
  extended: ['accepted', 'rejected', 'lapsed', 'revoked'],
  accepted: ['reneged', 'released'],
  rejected: [],
  lapsed: [],
  revoked: [],
  reneged: [],
  released: [],
};
```

**Side effects**:
- `extended -> accepted`: set student placement_status = Placed; activate dream threshold; notify E1 + parent; update M11 stats
- `extended -> rejected`: notify E1; if rejection count high, trigger mass-rejection investigation
- `extended -> lapsed`: nudge 48h before deadline; notify E1 after lapse; ST4 follow-up
- `accepted -> reneged`: return student to pool; trigger M06.6 counselling; flag company for blacklist review; notify parent
- `accepted -> released`: occurs only when dream offer is accepted; chain to previous offer

### 6.4 Dream Policy State Machine

```
[Student applies to drive]
    |
    v
Check: Does student have an accepted offer?
    |
    +--> NO: Allow application (standard eligibility check)
    |
    +--> YES: Read current_offer_ctc, new_drive_ctc, dream_threshold
         |
         +--> new_drive_ctc >= threshold * current_offer_ctc
         |    ALLOW (dream drive)
         |
         +--> new_drive_ctc < threshold * current_offer_ctc
              |
              +--> ST4 grants exception? (dreamOverrideReason logged)
              |    ALLOW (with logged exception)
              |
              +--> No exception
                   BLOCK (show reason: 'Current: X LPA, This drive: Y LPA, Threshold: 1.5x')
```

**Dream threshold rules**:
1. Default threshold: 1.5x (configurable per season by ST4)
2. PPO holders subject to same threshold (PPO CTC treated as current offer)
3. Threshold changes apply prospectively only (existing applications not retroactively affected)
4. When dream offer accepted: previous offer status -> Released (mandatory, no override)
5. Per-case exceptions logged with reason and ST4 identity

---

## 7. Business Logic Requirements

### 7.1 Company Pipeline Scoring (AG-04a)

**Triggered by**: W04-L2-001 (season pipeline scoring), W04-L2-005 (engagement health recompute), W04-L2-008 (season-end analytics)

**Scoring algorithm**:
```typescript
function computeCompanyPriorityScore(company: ICompany, engagementLogs: ICompanyEngagementLog[]): number {
  const conversionRate = getConversionRate(company);         // offers/applications over last 3 seasons
  const programmeFit = getProgrammeFitScore(company);        // match between company roles and programmes
  const packageTrend = getPackageTrend(company);             // CTC trend direction
  const relationshipRecency = getRecencyScore(engagementLogs); // days since last engagement

  return (conversionRate * 0.3) + (programmeFit * 0.25) + (packageTrend * 0.25) + (relationshipRecency * 0.2);
}
```

**Tier assignment**:
- Score >= 70: Tier-1 (auto-outreach)
- Score 40-69: Tier-2 (selective outreach)
- Score < 40: Tier-3 (on-request only)
- ST4 can manually override tier assignment

**Relationship health score**:
- Recomputed on every engagement log entry
- Factors: engagement frequency, outcome distribution, recency, feedback sentiment
- Score 0-100; < 30 triggers at-risk flag for off-season maintenance (W04-L2-010)

### 7.2 Eligibility Checking (W04-L2-033)

**Invoked at**: drive application time, and re-checked when M03 publishes new results

**Check pipeline** (all must pass):
```typescript
async function checkEligibility(
  collegeId: string, studentId: string, jobPostingId: string
): Promise<{ eligible: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  // 1. Academic eligibility (reads M03)
  const academic = await getAcademicData(studentId);  // CGPA, backlog count
  const jd = await getJobPosting(collegeId, jobPostingId);

  if (jd.minCgpa && academic.cgpa < jd.minCgpa) {
    reasons.push(`CGPA ${academic.cgpa} below minimum ${jd.minCgpa}`);
  }
  if (jd.noActiveBacklogs && academic.activeBacklogs > 0) {
    reasons.push(`${academic.activeBacklogs} active backlog(s)`);
  }

  // 2. Programme eligibility
  if (jd.eligibleProgrammeIds?.length) {
    const student = await getStudentWithProgramme(studentId);
    if (!jd.eligibleProgrammeIds.includes(student.programmeId)) {
      reasons.push('Programme not eligible for this drive');
    }
  }

  // 3. Placement bar check
  const bar = await PlacementBar.findOne({ collegeId, studentId, status: 'active' });
  if (bar) {
    reasons.push(`Active placement bar: ${bar.reason}`);
  }

  // 4. Dream policy check (AG-04c)
  const acceptedOffer = await PlacementOffer.findOne({
    collegeId, studentId, status: 'accepted'
  });
  if (acceptedOffer) {
    const season = await getPlacementSeason(collegeId, jd.placementSeasonId);
    const threshold = season.dreamThreshold || 1.5;
    if (jd.packageLpa < threshold * acceptedOffer.packageLpa) {
      reasons.push(
        `Dream policy: Current offer ${acceptedOffer.packageLpa} LPA; ` +
        `This drive ${jd.packageLpa} LPA; Threshold ${threshold}x`
      );
    }
  }

  // 5. Opt-out check
  const optOut = await OptOutRecord.findOne({
    collegeId, studentId, placementSeasonId: jd.placementSeasonId, status: 'active'
  });
  if (optOut) {
    reasons.push('Student has opted out of placements');
  }

  return { eligible: reasons.length === 0, reasons };
}
```

**Edge cases**:
- CGPA borderline (within 0.1): strict enforcement, no rounding
- Backlog cleared but M03 not updated: ST4 manual override via `/check-eligibility` with `override: true`
- Application deadline passed: rejected unless ST4 grants exception

### 7.3 Dream Policy Enforcement (AG-04c)

**Configuration**: Per-season `dreamThreshold` stored on PlacementSeason entity. Default 1.5.

**Rules** (from W04-L2-047):

| Rule | Implementation |
|------|---------------|
| Placed student blocked from drives with CTC <= current offer | Auto-block at application time |
| Placed student allowed for drives with CTC >= threshold * current offer | Auto-allow; threshold configurable |
| Dream offer accepted -> previous offer must be released | System enforces: previous offer status -> Released (no override) |
| PPO holders subject to same policy | PPO CTC treated as accepted offer CTC |
| Threshold change applies prospectively only | New threshold does not affect existing applications |
| ST4 can grant exceptions | Logged with reason and ST4 identity in `dreamOverrideReason` |

**Implementation**: Dream enforcement is embedded within the eligibility check service (section 7.2, step 4). It is also invoked as a standalone check via `POST /api/placement/offers/check-dream-policy`.

### 7.4 Placement Readiness Score (AG-04b)

**Triggered by**: W04-L2-014 (assessment ingestion), W04-L2-015 (explicit compute), W04-L2-021 (post-training), W04-L2-022 (mock interview)

**Computation**:
```typescript
function computeReadinessScore(components: ReadinessComponents, weights: ReadinessWeights): number {
  const { aptitude, technical, softSkills, profileCompleteness, mockInterview } = components;
  const w = weights;

  // If mock interview score exists, it replaces part of profile weight
  if (mockInterview !== undefined) {
    return (
      aptitude * w.aptitude +
      technical * w.technical +
      softSkills * w.softSkills +
      profileCompleteness * (w.profileCompleteness * 0.5) +
      mockInterview * (w.profileCompleteness * 0.5)
    );
  }

  return (
    aptitude * w.aptitude +
    technical * w.technical +
    softSkills * w.softSkills +
    profileCompleteness * w.profileCompleteness
  );
}
```

**Categorization**:
- Score >= 70: Ready
- Score 40-69: Needs Improvement
- Score < 40: At Risk

**Side effects**:
- At Risk triggers M06.6 career counselling referral (W04-L2-056)
- Batch-level readiness pushed to M11 dashboards (W04-L2-060)
- If all students At Risk: alert ST4/Principal via M11

### 7.5 Semantic Job Matching (M12.3 AI, W04-L2-063)

**Invoked by**: W04-L2-032 (application match scoring), W04-L2-034 (shortlist generation)

**Algorithm**:
```
1. Embed student Career Profile as vector (skills, CGPA, projects, certifications)
2. Embed JD as vector (required skills, role description, industry)
3. Compute cosine similarity
4. Adjust with hard factors: CGPA vs minimum, backlog status, programme match
5. Output: match_score (0-100), confidence ('high'|'medium'|'low')
```

**Ranking for shortlist** (W04-L2-034):
- Primary: match_score (descending)
- Secondary: readiness_score (descending)
- Tertiary: CGPA (descending)
- Flag edge cases: score near threshold, missing profile data

**ST4 override**: ST4 can add/remove candidates from AI-generated shortlist. All overrides are logged.

### 7.6 Drive Scheduling Optimization (W04-L2-036)

**Problem**: Minimize student interview conflicts when multiple drives overlap.

**Algorithm**:
```
1. Collect all shortlisted students for the drive
2. For each student: retrieve existing interview schedule (other drives)
3. Allocate slots to minimize conflicts
4. If conflict unavoidable: flag for ST4 resolution
5. Output: InterviewSchedule entities with optimized slots
```

**Constraints**:
- Minimum 30-minute gap between interviews
- Virtual interviews need separate link generation
- E1-specified date ranges are hard constraints
- Student capacity per slot configurable

---

## 8. Cross-Module Integration Points

### 8.1 M02 People -- Data Reads

| Integration | Direction | Data Flow | Sub-WF |
|-------------|-----------|-----------|--------|
| Student Identity | M07 reads M02 | name, photo, programme, branch, batch, roll number | W04-L2-070 |
| Document Vault | M07 reads M02 | verified certificates, transcripts (references only) | W04-L2-071 |
| Recruiter Person Creation | M07 writes M02 | create Person + External RoleAttachment | W04-L2-072 |

**Implementation**: Internal service-to-service calls (not HTTP). M07 service imports M02 service functions directly.

```typescript
// In M07 service:
import { getStudentIdentity } from '../people/service';
import { getVerifiedDocuments } from '../people/service';
import { createExternalPerson } from '../people/service';
```

### 8.2 M03 Academics -- Data Reads

| Integration | Direction | Data Flow | Sub-WF |
|-------------|-----------|-----------|--------|
| CGPA + Backlog | M07 reads M03 | latest CGPA, active backlog count | W04-L2-073 |
| Mark Sheets | M07 reads M03 | semester-wise marks, grades | W04-L2-074 |
| Result Publication Event | M03 -> M07 | event triggers career profile refresh | W04-L2-075 |

**Result sync implementation**: Event-driven via BullMQ job queue.

```typescript
// M03 publishes event after result publication:
await resultPublishedQueue.add('result-published', {
  collegeId, semesterId, programmeIds, batchYear
});

// M07 consumer triggers:
resultPublishedQueue.process(async (job) => {
  await refreshAcademicDataForBatch(job.data);
});
```

### 8.3 M06 Welfare -- Referrals

| Integration | Direction | Data Flow | Sub-WF |
|-------------|-----------|-----------|--------|
| Career Counselling Referral | M07 -> M06 | student_id, referral_reason, readiness_data | W04-L2-056, W04-L2-059 |
| Mental Health Referral | M07 -> M06 | student_id, referral_trigger | W04-L2-057 |

**Trigger conditions**:
- Unplaced + At Risk readiness (auto-flag for W04-L2-056)
- 3+ consecutive Not Selected outcomes (auto-flag for W04-L2-059)
- Juvi stress signal detection (W04-L2-058)

### 8.4 M09 Student Development -- Data Reads

| Integration | Direction | Data Flow | Sub-WF |
|-------------|-----------|-----------|--------|
| Achievements | M07 reads M09 | verified achievements (hackathons, sports, NCC/NSS) | W04-L2-076 |
| Portfolio | M07 reads M09 | published portfolio entries | W04-L2-077 |

### 8.5 M11 Governance -- Dashboard Feeds

| Integration | Direction | Data Flow | Sub-WF |
|-------------|-----------|-----------|--------|
| Real-time Dashboards | M07 -> M11 | placement counts, CTC stats, conversion rates | W04-L2-060 |
| Trajectory Warning | M07 + M11 | predicted vs. target placement rate | W04-L2-061 |
| Accreditation Export | M07 -> M11 -> M10 | formatted stats for NAAC/NBA | W04-L2-062 |

**Dashboard metrics computed on each placement event**:
- Placed count, placement rate, avg/median/max CTC
- Programme-wise breakdown, department-wise breakdown
- Company count, drive conversion rate
- Gender-wise distribution
- Target vs actual tracking

### 8.6 M12 Platform -- Notifications, AI, Integration

| Integration | Direction | Data Flow | Sub-WF |
|-------------|-----------|-----------|--------|
| Multi-Channel Notifications | M07 -> M12.2 | drive announcements, shortlist, offers, reminders | W04-L2-064 |
| Semantic Matching Engine | M07 -> M12.3 | student profiles + JD for matching | W04-L2-063 |
| Vendor Integration | M12.4 -> M07 | assessment scores from AMCAT, HackerRank | W04-L2-065 |

**Notification channels by audience**:
- Students: Juvi push + email
- Parents (P5): WhatsApp
- Recruiters (E1): email + Portal notification
- Sensitive notifications (reneging): reviewed by ST4 before dispatch

---

## 9. AI Agent Scope

### 9.1 AG-04a -- Company Pipeline & Relationship Agent

**Autonomy**: RECOMMENDS (AI suggests, ST4 decides) for pipeline scoring; COMPUTES (autonomous) for analytics

| Capability | Autonomy | Human Override |
|------------|----------|----------------|
| Score company pipeline | RECOMMENDS | ST4 adjusts tiers |
| Rank companies by priority | RECOMMENDS | ST4 reviews rankings |
| Compute relationship health | COMPUTES | None needed |
| Generate season-end analytics | COMPUTES | ST4 reviews |
| Flag at-risk relationships | ALERTS | ST4 decides action |

**Data inputs**: Company records, CompanyEngagementLog, CompanyProgrammeAffinity, PlacementOffer (historical), PlacementDrive (historical)

**Data outputs**: Pipeline tier assignments, relationship health scores, programme affinity scores, season analytics

### 9.2 AG-04b -- Student Readiness & Matching Agent

**Autonomy**: COMPUTES (autonomous) for readiness scoring; RECOMMENDS for shortlisting

| Capability | Autonomy | Human Override |
|------------|----------|----------------|
| Compute readiness score | COMPUTES | ST4 configures weights |
| Compute profile completeness | COMPUTES | None needed |
| Generate match scores | COMPUTES | None needed |
| Rank shortlist | RECOMMENDS | ST4 curates final list |
| Suggest improvement tips (Juvi) | RECOMMENDS | Student decides |
| Flag At Risk students | ALERTS | ST4/counsellor acts |

**Data inputs**: CareerProfile, SkillRecord, PlacementReadinessScore, academic data (M03), achievements (M09), JD

**Data outputs**: Readiness scores, match scores, ranked shortlists, improvement suggestions

### 9.3 AG-04c -- Dream Policy Enforcement Agent

**Autonomy**: ENFORCES (auto-blocks, ST4 can override with logged reason)

| Capability | Autonomy | Human Override |
|------------|----------|----------------|
| Block ineligible dream application | ENFORCES | ST4 exception with reason |
| Allow eligible dream application | ENFORCES | N/A |
| Release previous offer on dream accept | ENFORCES | No override (structural) |
| Apply dream threshold to PPO | ENFORCES | ST4 exception with reason |

**Data inputs**: Current offer (CTC), new drive JD (CTC), season dream threshold, ST4 override flag

**Data outputs**: Allow/block decision with explanation string

### 9.4 AI Autonomy Summary (from W04 AI vs Human sheet)

| Category | Count | Description |
|----------|-------|-------------|
| COMPUTES (fully autonomous) | 23 | Pipeline scoring, readiness, match scores, analytics, dashboards, notifications, profile init, batch tracking, alumni analytics, integration, identity/document reads, CGPA reads |
| RECOMMENDS (AI suggests, human decides) | 4 | Company outreach priority, shortlist ranking, improvement tips, career suggestions |
| ENFORCES (AI auto-blocks, human can override) | 3 | Dream policy, eligibility checks, consent-gated profile access |
| ALERTS (AI flags, human acts) | 3 | Trajectory early warning, stress detection, rejection pattern detection |
| Human Decision Required | 47 | Company onboarding/blacklisting, JD review, shortlist approval, interview logistics, offer counselling, negotiation, bars, opt-outs, counselling |

---

## 10. Implementation Phases

### Phase 1: Foundation -- New Entities & Schema Expansion (Est. 3 days)

**Goal**: Create all missing models and expand existing schemas. No service logic yet.

**Tasks**:
1. Create 13 new model files in `backend/src/models/placement/`
2. Expand 6 existing model schemas with new fields
3. Add new Zod validation schemas in `validation.ts`
4. Run `npm run typecheck` to verify zero errors
5. Update seed data if needed

**Models created** (order matters for FK references):
1. CompanyEngagementLog
2. CompanyProgrammeAffinity
3. PlacementDrive
4. DriveApplication
5. InterviewSchedule
6. RecruiterAccount
7. RecruiterActivityLog
8. CareerProfile
9. PlacementReadinessScore
10. SkillRecord
11. PlacementBar
12. OptOutRecord
13. AlumniCareerRecord

**Models expanded**: PlacementSeason, Company, JobPosting, PlacementOffer, PlacementTraining, AlumniProfile

### Phase 2: State Machines & Core Workflow Logic (Est. 4 days)

**Goal**: Implement state machine transitions with guards and side effects.

**Tasks**:
1. Implement `PlacementSeasonStateMachine` (section 6.1)
2. Implement `PlacementDriveStateMachine` (section 6.2)
3. Implement `OfferStateMachine` (section 6.3)
4. Implement Dream Policy enforcement service (section 6.4, 7.3)
5. Implement eligibility checking service (section 7.2)
6. Add new API endpoints for state transitions
7. Wire up side effects (notifications, status updates)

**Service functions added** (~30):
- Season lifecycle: `openSeason`, `activateSeason`, `windDownSeason`, `closeSeason`
- Drive lifecycle: `createDrive`, `publishJd`, `openApplications`, `closeApplications`, `releaseShortlist`, `startInterviews`, `releaseOffers`, `closeDrive`, `cancelDrive`
- Offer lifecycle: `acceptOffer`, `rejectOffer`, `handleRenege`, `handleLapse`, `releaseOffer`
- Eligibility: `checkEligibility`, `checkDreamPolicy`, `grantDreamException`
- Bars/Opt-outs: `applyBar`, `liftBar`, `recordOptOut`, `voidOptOut`

### Phase 3: CRM & Company Management (Est. 2 days)

**Goal**: Implement company relationship management sub-workflows.

**Tasks**:
1. CRUD for CompanyEngagementLog
2. CRUD for CompanyProgrammeAffinity
3. Company blacklisting/reinstatement service
4. Pipeline scoring algorithm (AG-04a seed)
5. Relationship health score computation
6. Season-end company analytics

### Phase 4: Career Profile & Readiness (Est. 3 days)

**Goal**: Implement career profile management and readiness scoring.

**Tasks**:
1. Batch career profile initialization service (reads M02, M03, M09)
2. Student profile update flows
3. Faculty validation workflow for projects/certifications
4. CRUD for SkillRecord
5. Readiness score computation (AG-04b seed)
6. Academic data refresh on M03 events (BullMQ consumer)

### Phase 5: Drive Operations (Est. 3 days)

**Goal**: Implement the drive execution pipeline.

**Tasks**:
1. PlacementDrive CRUD with state machine
2. DriveApplication with eligibility checking at creation
3. Match score computation (AG-04b) on application
4. Shortlist generation and release
5. Interview schedule creation and optimization
6. Drive closure with analytics computation

### Phase 6: Recruiter Portal & Consent (Est. 2 days)

**Goal**: Implement recruiter account management and consent-gated access.

**Tasks**:
1. RecruiterAccount CRUD with verification workflow
2. RecruiterActivityLog on all Portal actions
3. Consent-gated profile browsing (application = consent)
4. JD submission from Portal linking to PlacementDrive

### Phase 7: Training & Readiness Programs (Est. 2 days)

**Goal**: Expand training model to support session-level tracking and assessments.

**Tasks**:
1. Expand PlacementTraining with sessions, target batch/programmes
2. Session-level attendance tracking
3. Training assessment entity
4. Post-training readiness recomputation
5. Training completion tracking and analytics

### Phase 8: Alumni Career Tracking (Est. 1 day)

**Goal**: Implement alumni career record lifecycle.

**Tasks**:
1. AlumniCareerRecord CRUD
2. Graduation-triggered record initialization
3. Annual update workflow
4. Alumni-as-Recruiter link
5. Alumni analytics computation

### Phase 9: Cross-Module Integration (Est. 3 days)

**Goal**: Wire up all cross-module data flows.

**Tasks**:
1. M02 reads (student identity, document vault, recruiter person creation)
2. M03 reads (CGPA, backlogs, mark sheets) + result publication event consumer
3. M06 referral triggers (counselling for unplaced, stress, rejection patterns)
4. M09 reads (achievements, portfolio)
5. M11 dashboard feed (real-time placement metrics, trajectory warning)
6. M12.2 notification dispatch (multi-channel templates)
7. M12.4 vendor integration (assessment score ingestion)

### Phase 10: AI Agent Integration (Est. 3 days)

**Goal**: Implement AI agents AG-04a, AG-04b, AG-04c.

**Tasks**:
1. AG-04a: Pipeline scoring, relationship health, season analytics
2. AG-04b: Readiness scoring, match scoring, shortlist ranking
3. AG-04c: Dream policy enforcement, eligibility enforcement
4. Juvi companion prep tips (W04-L2-024)
5. Stress signal detection (W04-L2-058)
6. Trajectory early warning (W04-L2-061)

### Phase 11: Juvi Student App Touchpoints (Est. 2 days)

**Goal**: Implement Juvi-facing read APIs for student app.

**Tasks**:
1. Company info card endpoint (W04-L2-078)
2. Personal interview schedule endpoint (W04-L2-079)
3. Placement summary widget endpoint (W04-L2-080)
4. Career profile display endpoint (W04-L2-016)
5. Drive announcement Juvi notice cards (W04-L2-043)
6. Offer status notification cards (W04-L2-055)

### Phase 12: Statistics, Reporting & Accreditation (Est. 2 days)

**Goal**: Implement season statistics, dashboards, and export.

**Tasks**:
1. Season placement statistics computation (W04-L2-054)
2. Programme-wise, company-wise, gender-wise breakdowns
3. Placement rate calculation (placed / (eligible - opted_out))
4. NAAC/NBA formatted export (W04-L2-062)
5. Placement brochure data generation for M01 admissions

---

## Appendix A: Dream Policy & Key Exception Paths

### Dream Policy Rules (from Excel)

| Rule | Enforcement | Override |
|------|-------------|---------|
| Placed student blocked from drives with CTC <= current offer | AG-04c auto-blocks at application time | ST4 can grant exception with logged reason |
| Placed student allowed for drives with CTC >= 1.5x current offer | AG-04c auto-allows; threshold configurable by ST4 | Threshold adjustable institution-wide or per-case |
| Dream offer accepted -> previous offer released | System enforces (structural) | No override |
| PPO holders subject to same policy | AG-04c treats PPO as accepted offer | Same override as regular offers |
| Threshold change applies prospectively only | Design decision | N/A |

### Key Exception Paths

| Exception | Trigger | Resolution | Sub-WF |
|-----------|---------|------------|--------|
| Company no-show | E1 does not appear for scheduled drive | Cancel drive, log, consider blacklisting | W04-L2-037, W04-L2-006 |
| Offer reneging | Company withdraws accepted offer | Student returned to pool, counselling triggered, company flagged | W04-L2-048 |
| Fake project/certification | Faculty validation detects fraud | Reject item, flag to ST4, may trigger Placement Bar | W04-L2-013, W04-L2-050 |
| Backlog cleared mid-season | M03 updates after results | Profile refreshed, student eligible for future drives (not retroactive) | W04-L2-017, W04-L2-033 |
| Mass reneging | Company withdraws multiple offers | Principal escalation, legal review, bulk counselling | W04-L2-048 |
| Company demands exclusivity | E1 wants no other companies same day | ST4 negotiates; decision based on company value | W04-L2-002 |
| Student in crisis | Severe distress / self-harm risk | Emergency protocol per M06.7, placement paused | W04-L2-057, W04-L2-058 |
| Bond company disclosure | Company has service bond | Flag prominently in JD; ensure student awareness | W04-L2-031 |

---

## Appendix B: Phase Distribution Summary

| Phase | Timing | Sub-WF Count | Primary Sub-Domains |
|-------|--------|-------------|---------------------|
| Pre-Season | April--July | 20 | CRM, PROFILE, TRAIN, PORTAL |
| Season Open | August | 2 | DRIVES |
| Active Season | Aug--Feb | 32 | DRIVES, OFFERS, M06, M11, M12 |
| Wind-Down | March--April | 5 | CRM, OFFERS, ALUMNI, M11 |
| Off-Season | April--July | 4 | CRM, ALUMNI |
| All Phases | Continuous | 2 | CRM (engagement logging), M12.2 (notifications) |

---

## Appendix C: Persona Matrix

| Persona | Role | Key Actions in W04 |
|---------|------|-------------------|
| ST4 | Training & Placement Officer (TPO) | Season management, company relationship, JD review, shortlist approval, bar/opt-out, counselling referral |
| S1-S4 | Students (graduating batch) | Profile completion, drive application, offer accept/reject, training attendance |
| E1 | External Recruiter | Portal registration, JD posting, profile browsing, interview conduct, selection submission |
| F1 | Faculty | Project validation, training delivery, mock interview panel |
| P5 | Parent/Guardian | Receive offer notifications (WhatsApp) |
| Principal | Institutional Head | Season targets, escalations, blacklisting review, accreditation |
| AG-04a | AI Pipeline Agent | Company scoring, analytics |
| AG-04b | AI Readiness Agent | Readiness scoring, matching, shortlisting |
| AG-04c | AI Dream Policy Agent | Dream policy enforcement, eligibility |
| Juvi.3 | AI Companion | Interview prep, stress detection, improvement tips |
