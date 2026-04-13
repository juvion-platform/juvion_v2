# W02 -- Academic Year Delivery: Implementation Spec

## 1. Executive Summary

W02 covers the entire lifecycle of academic delivery from the moment a semester begins until results are published, backlogs are tracked, and outcomes are assessed. It spans **54 sub-workflows** organized across 8 modules plus Juvi:

| Domain | Module | Sub-workflows | Focus |
|--------|--------|---------------|-------|
| M03.1 CURR | Academics | 1 | Curriculum instantiation |
| M03.2 SCHED | Academics | 6 | Calendar, timetable, sections, faculty assignment, electives |
| M03.3 ATT | Academics | 5 | Attendance capture, monitoring, condonation, parent notification |
| M03.4 TEACH | Academics | 5 | Course delivery, assignments, quizzes, progress tracking |
| M03.5 EXAM | Academics | 12 | CIE, exams, hall tickets, results, backlogs, supplementary, promotion |
| M03.6 OBE | Academics | 3 | CO/PO attainment, programme health metrics |
| M05 | HR | 3 | Faculty workload, leave/substitution, invigilation |
| M04 | Finance | 3 | Exam fees, clearance, scholarship credit |
| M02 | People | 3 | Student lifecycle state, academic history, transcripts |
| M10 | Compliance | 3 | OBE/pass-rate/faculty evidence for NAAC/NBA |
| M11 | Governance | 3 | Academic dashboards, analytics, risk alerts |
| M12 | Platform | 3 | Notifications, JNTU integration, AI agent orchestration |
| Juvi | Student App | 4 | Home widgets, companion queries, study recommendations, notices |

**AI autonomy profile:** 19 fully autonomous, 12 autonomous with human flags, 23 requiring human decision.

**Frequency profile:** 4 annual, 25 per-semester, 15 continuous, 10 on-demand.

**Current state:** M03 is the most complete module with 29 Mongoose models and 131 service functions, but all are CRUD operations. No workflow orchestration, no business logic computations (CIE, SGPA/CGPA, hall ticket eligibility), no state machines, no cross-module integration, and no AI agent hooks exist yet.

---

## 2. Current Codebase State

### 2.1 Academic Structure Models (8) -- `backend/src/models/academic-structure/`

| Model | Fields | Indexes | Notes |
|-------|--------|---------|-------|
| Regulation | code, name, effectiveFromYear, effectiveToYear, totalCredits, maxYears, isActive | (collegeId, code) unique | Missing: grading scale config, CIE formula, passing criteria |
| Programme | code, name, level, durationYears, regulationId, isActive | - | Missing: accreditation body ref |
| Department | code, name, hodId, isActive | - | Complete for W02 |
| Branch | code, name, programmeId, departmentId, intake, isActive | - | Complete for W02 |
| Batch | code, name, admissionYear, programmeId, regulationId, isActive | - | Complete for W02 |
| Section | name, branchId, batchId, year, semester, capacity, classAdvisorId | (collegeId, branchId, batchId, name) unique | Missing: labBatchCount, studentIds array |
| AcademicYear | code, label, startDate, endDate, isCurrent | (collegeId, code) unique | Missing: status enum (planning/active/completed) |
| Semester | academicYearId, number, year, startDate, endDate, status | (collegeId, academicYearId, number) unique | Status: upcoming/active/completed -- adequate |

### 2.2 Academic Ops Models (21) -- `backend/src/models/academic-ops/`

| Model | Fields | Indexes | Notes |
|-------|--------|---------|-------|
| Course | code, name, regulationId, departmentId, credits, L/T/P hrs, type, isElective | (collegeId, code, regulationId) unique | Missing: prerequisites array |
| CurriculumMap | regulationId, programmeId, branchId, semester, courseId, isElective, electiveGroup | (collegeId, regulationId, branchId, semester) | Complete for W02 |
| CourseOffering | courseId, semesterId, sectionId, facultyId, maxEnrollment, enrolledCount | (collegeId, semesterId, sectionId) | Missing: status, coFacultyIds |
| Enrollment | studentId, courseOfferingId, semesterId, status, enrolledAt | (collegeId, courseOfferingId, studentId) unique | Complete for W02 |
| AcademicCalendar | academicYearId, title, eventType, startDate, endDate, description, isHoliday | (collegeId, academicYearId, startDate) | Missing: status (draft/published), approvedBy |
| Timetable | semesterId, sectionId, version, status, effectiveFrom | (collegeId, semesterId, sectionId) | Missing: approvedBy, effectiveTo |
| TimetableSlot | timetableId, day, period, startTime, endTime, courseOfferingId, roomId, slotType | (collegeId, timetableId, day, period) | Missing: substituteFacultyId, isSubstitution |
| AttendanceSession | courseOfferingId, date, period, facultyId, topicCovered, status | (collegeId, courseOfferingId, date) | Complete for W02 |
| AttendanceRecord | sessionId, studentId, status, markedBy, remarks | (collegeId, sessionId, studentId) unique | Status: present/absent/late/od/leave -- adequate |
| InternalAssessment | courseOfferingId, name, type, maxMarks, weightage, date, status | (collegeId, courseOfferingId, type) | Missing: coMappings array |
| InternalMark | assessmentId, studentId, marksObtained, remarks | (collegeId, assessmentId, studentId) unique | Complete for W02 |
| ExamSchedule | semesterId, courseId, examType, date, startTime, endTime, venue, status | (collegeId, semesterId, date) | Missing: seatingPlanId, invigilationRosterId |
| ExamRegistration | studentId, courseOfferingId, semesterId, examType, isEligible, status | (collegeId, studentId, semesterId) | Missing: hallTicketNumber, feeClearance |
| ExternalMark | studentId, courseId, semesterId, examType, maxMarks, marksObtained, result | (collegeId, studentId, courseId, semesterId, examType) | Missing: enteredBy, validatedBy, anomalyFlag |
| GradeCard | studentId, semesterId, courseId, internalMarks, externalMarks, totalMarks, grade, gradePoints, credits, result | (collegeId, studentId, semesterId) | Complete for W02 |
| SemesterResult | studentId, semesterId, sgpa, cgpa, totalCreditsEarned, totalCreditsRegistered, backlogs, result | (collegeId, studentId, semesterId) unique | Missing: promotionStatus, boardDecision |
| CourseOutcome | courseId, code, description, bloomLevel, poMappings[] | (collegeId, courseId, code) unique | Complete for W02 |
| ProgramOutcome | programmeId, code, description | (collegeId, programmeId, code) unique | Complete for W02 |
| ElectiveAllocation | studentId, semesterId, electiveGroup, courseId, preference, status | (collegeId, studentId, semesterId, electiveGroup) | Complete for W02 |
| LessonPlan | courseOfferingId, weekNumber, topic, cosCovered[], teachingMethod, plannedDate, completedDate, status | (collegeId, courseOfferingId, weekNumber) | Complete for W02 |
| CourseFeedback | courseOfferingId, studentId, ratings[], overallRating, comments, submittedAt | (collegeId, courseOfferingId, studentId) unique | Complete for W02 |

### 2.3 Service Layer (131 functions, all CRUD)

Every entity has list/create/update/delete functions. Some have bulk operations (bulkCreateAttendanceRecords, bulkCreateInternalMarks). No business logic functions exist:

- **No** `computeCIE()`, `computeSGPA()`, `computeCGPA()`
- **No** `checkHallTicketEligibility()`
- **No** `computeCOAttainment()`, `aggregatePOAttainment()`
- **No** `generateTimetableDraft()`
- **No** `checkAttendanceThreshold()`
- **No** `instantiateSemesterCurriculum()`
- **No** state transition functions for Semester, Timetable, or ExamSchedule

### 2.4 Cross-Module Models Available

| Module | Relevant Models | Service Functions |
|--------|----------------|-------------------|
| M05 HR | LeaveApplication, Employee | CRUD only; no workload model, no invigilation duty tracking |
| M04 Finance | Invoice, Payment, FeeLineItem, Scholarship, ScholarshipAllocation | CRUD only; no fee clearance check, no exam fee generation |
| M02 People | Student (status enum: prospective/active/year_back/detained/graduated/exited/alumni), Faculty | Student has lifecycle states but no transition logic |
| M10 Compliance | AccreditationCycle, ComplianceCriteria, AuditFinding | No evidence record model |
| M11 Governance | StrategicGoal, Committee | No dashboard widget or risk alert model |
| M12 Platform | Notification (in communication/), WhatsAppLog, SMSLog, EmailLog | No integration log, no inference log |
| Juvi | JuviConversation, JuviMessage, JuviAction, JuviInsight | No home widget config, no notice card, no study recommendation model |
| Workflow | WorkflowInstance, WorkflowTask | Generic engine exists (used by W01), can be reused for W02 |

---

## 3. Sub-Workflow Catalog

### 3.1 M03.1 CURR -- Curriculum Instantiation

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-001 | Instantiate Semester Curriculum | Academic calendar active; semester approaching | Curriculum structure instantiated; courses activated | CurriculumMap (R), Course (U), CourseOffering (C) | None | Per-semester | **MISSING** -- No `instantiateSemesterCurriculum()` function exists. CurriculumMap and CourseOffering are CRUD-only. Need: auto-read curriculum structure for regulation/programme/branch/semester, create CourseOfferings, verify prerequisites, configure elective pools. |

**Exception paths:** E1: Regulation mismatch -> flag. E2: Prerequisite broken -> HOD review.

### 3.2 M03.2 SCHED -- Academic Calendar & Scheduling

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-002 | Declare & Adopt Academic Calendar | JNTU calendar published (May/June) | Institutional calendar active | AcademicCalendar (C) | None | Annual | **PARTIAL** -- AcademicCalendar model exists with CRUD. Missing: status field (draft/published), approval workflow, M12.5 sync. |
| W02-L2-003 | Generate Semester Timetable | Calendar active + faculty/room available | Clash-free timetable; rooms allocated | Timetable (C), TimetableSlot (C), RoomAllocation (C) | M03-AI-01: GENERATES draft | Per-semester | **PARTIAL** -- Timetable/TimetableSlot models exist with CRUD. Missing: AI timetable generator, clash detection, room allocation entity, approval flow. |
| W02-L2-004 | Assign Faculty to Courses | Curriculum finalized + workload known | Faculty-Course Assignment | CourseOffering (C), FacultyWorkload (C) | None | Per-semester | **PARTIAL** -- CourseOffering has facultyId. Missing: dedicated assignment approval flow, M05 workload record creation, notification. |
| W02-L2-005 | Form Sections and Lab Batches | W01 complete OR semester transition | Students in sections/lab batches | Section (C/U), LabBatch (C/U) | None (rule-based) | Per-semester | **PARTIAL** -- Section model exists. Missing: LabBatch model, student-to-section assignment logic, formation rules. |
| W02-L2-006 | Handle Mid-Semester Timetable Change | Faculty leave (M05.1) OR room unavailable | Timetable updated; substitution | TimetableSlot (U) | None | On-demand | **MISSING** -- No substitution fields on TimetableSlot, no M05 integration, no change tracking. |
| W02-L2-007 | Select Elective Courses | Elective window opens per calendar | Students allocated; Registration created | ElectiveAllocation (C), Enrollment (C) | AI optimizes | Per-semester | **PARTIAL** -- ElectiveAllocation exists with preferences. Missing: window management, AI optimization, automatic Enrollment creation, over/under-subscription handling. |

### 3.3 M03.3 ATT -- Attendance Management

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-008 | Capture Daily Attendance | Each timetable slot execution | AttendanceRecord; Summary updated | AttendanceRecord (C), AttendanceSummary (U) | None | Continuous | **PARTIAL** -- AttendanceRecord CRUD + bulk create exist. Missing: AttendanceSummary model (aggregated per student-course-semester), auto-summary update after marking. |
| W02-L2-009 | Monitor Attendance Threshold | AttendanceSummary updated | At-risk flagged; alerts generated | AttendanceAlert (C) | M03-AI-02: FLAGS | Continuous | **MISSING** -- No AttendanceAlert model, no threshold monitoring logic, no AI forecasting. |
| W02-L2-010 | Route Attendance Risk to Welfare | Attendance breach OR compound risk | Welfare case created | CompoundRiskSignal (C) | M03-AI-06: scores | On-demand | **MISSING** -- No CompoundRiskSignal model, no M06 integration, no risk scoring. |
| W02-L2-011 | Process Attendance Condonation | Student submits request | Approved/rejected; linked to eligibility | CondonationRequest (C) | None | On-demand | **MISSING** -- No CondonationRequest model, no approval workflow, no eligibility linkage. |
| W02-L2-012 | Notify Parent of Attendance | Attendance alert generated | Parent notified via WhatsApp | Notification (C) | Autonomous dispatch | On-demand | **MISSING** -- Notification model exists but no trigger from attendance, no parent contact lookup, no template system. |

### 3.4 M03.4 TEACH -- Teaching & Course Delivery

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-013 | Instantiate Course for Semester | Faculty-Course Assignment confirmed | CourseInstance + Roster + Juvi channel | CourseInstance (C), ClassRoster (C), Channel (C) | Autonomous provisioning | Per-semester | **MISSING** -- CourseOffering acts as a quasi-CourseInstance but lacks roster, Juvi channel, CO inheritance. No auto-provisioning logic. |
| W02-L2-014 | Deliver Course Content | Semester active (continuous) | Materials uploaded; syllabus tracked | CourseMaterial (C), QAThread (C/U) | Companion deadlines | Continuous | **MISSING** -- No CourseMaterial model, no QAThread model, no syllabus progress tracking. LessonPlan is the closest entity. |
| W02-L2-015 | Create & Collect Assignments | Faculty creates assignment | Graded; marks to CIE | Assignment (C), Submission (C) | Basic plagiarism detection | On-demand | **MISSING** -- No Assignment or Submission model. InternalAssessment covers the assessment definition but not the assignment/submission workflow. |
| W02-L2-016 | Conduct Online Quizzes | Faculty creates quiz | Auto-graded; marks to CIE | Quiz (C), QuizAttempt (C) | Rule-based auto-grading | On-demand | **MISSING** -- No Quiz or QuizAttempt model. InternalAssessment type includes 'quiz' but no question bank or attempt tracking. |
| W02-L2-017 | Track Course Delivery Progress | Semester in progress | Syllabus coverage tracked | CourseOffering (U) | None | Continuous | **PARTIAL** -- LessonPlan tracks planned/completed topics. Missing: aggregated progress percentage on CourseOffering, HOD dashboard, flagging below-expected coverage. |

### 3.5 M03.5 EXAM -- Examinations & Assessment

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-018 | Compute Internal Assessment (CIE) | Components graded | CIE computed per regulation | InternalAssessment (C/U) | M03-AI-04: computation | Per-semester | **MISSING** -- No CIE computation logic. InternalAssessment has weightage but no formula engine for regulation-specific computation. |
| W02-L2-019 | Verify Hall Ticket Eligibility | Exam schedule published | Eligible/Ineligible classified | HallTicketEligibility (derived) | None (rule-based) | Per-semester | **MISSING** -- No eligibility check function. Requires attendance >= 75% OR condonation, plus fee clearance from M04. |
| W02-L2-020 | Schedule End-Semester Exams | JNTU dates OR calendar finalized | Schedule + seating + invigilation | ExamSchedule (C), SeatingPlan (C), InvigilationRoster (C) | AI-07/08: GENERATE seating/roster | Per-semester | **PARTIAL** -- ExamSchedule exists with CRUD. Missing: SeatingPlan model, InvigilationRoster model, AI generators. |
| W02-L2-021 | Generate & Issue Hall Tickets | Eligibility verified; schedule published | Hall tickets issued | HallTicket (C) | None (rule-based) | Per-semester | **MISSING** -- No HallTicket model, no generation logic, no PDF rendering. |
| W02-L2-022 | Conduct Examinations | Exam schedule reached | Conducted; scripts collected | InvigilationDuty (U) | None | Per-exam | **MISSING** -- No InvigilationDuty model, no conduct tracking. |
| W02-L2-023 | Enter & Validate Marks | Evaluation complete | Entered; anomalies flagged; validated | ExternalMark (C) | AI-03: FLAGS anomalies | Per-assessment | **PARTIAL** -- ExternalMark CRUD exists. Missing: enteredBy/validatedBy fields, anomaly detection, bulk entry, validation workflow. |
| W02-L2-024 | Compute Grades & Results | All marks validated | Grades + SGPA/CGPA; Backlog created | GradeCard (C), SemesterResult (C), Backlog (C) | AI-04: COMPUTES | Per-semester | **PARTIAL** -- GradeCard and SemesterResult have CRUD. Missing: grade computation logic, SGPA/CGPA calculation, Backlog model, auto-fail-to-backlog. |
| W02-L2-025 | Publish Results | Results computed; Board approves | Visible; M02 transitions; M10 fed | SemesterResult (U) | None | Per-semester | **MISSING** -- No publication workflow, no Board approval, no M02 state transition, no M10 evidence feed. |
| W02-L2-026 | Process Revaluation Requests | Student submits post-results | To JNTU; outcome updates | RevaluationRequest (C) | None | On-demand | **MISSING** -- No RevaluationRequest model, no JNTU submission flow. |
| W02-L2-027 | Schedule Supplementary Exams | Annual results; backlogs identified | Supplementary scheduled | SupplementaryExam (C) | None | Annual | **MISSING** -- ExamSchedule supports 'supplementary' type but no dedicated scheduling logic, no backlog-based registration. |
| W02-L2-028 | Conduct Supplementary & Clear Backlogs | Supplementary schedule reached | Backlog cleared or persists | Backlog (U) | Seating/invigilation AI | Annual | **MISSING** -- No Backlog model, no clearance logic. |
| W02-L2-029 | Determine Annual Promotion/Detention | All semester results for year | Promoted/detained/year-back/graduated | SemesterResult (U), Student (U via M02) | None | Annual | **MISSING** -- No promotion logic, no Board decision record, no M02 integration. |

### 3.6 M03.6 OBE -- Outcome Assessment

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-030 | Compute CO Attainment | Semester assessments graded | CO Attainment per course | COAttainmentRecord (C), AttainmentRun (C) | AI-05: COMPUTES | Per-semester | **MISSING** -- CourseOutcome has PO mappings but no attainment computation, no run tracking, no threshold logic. |
| W02-L2-031 | Aggregate PO Attainment | CO attainment computed | PO Attainment aggregated; to M10 | POAttainmentRecord (C) | AI-05: COMPUTES | Per-semester | **MISSING** -- ProgramOutcome exists but no PO attainment aggregation, no CO-PO matrix application. |
| W02-L2-032 | Generate Programme Health Metrics | Results + attainment computed | Programme health for dashboards | ProgrammeHealthMetrics (C), QualityReport (C) | Automated computation | Per-semester | **MISSING** -- No programme health model, no metrics computation, no M11 feed. |

### 3.7 M05 -- People Operations (HR)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-033 | Record Faculty Workload from Assignments | Faculty-Course Assignment confirmed | Workload recorded; compliance visible | FacultyWorkload (C/U) | None | Per-semester | **MISSING** -- No FacultyWorkload model. Employee model exists but lacks teaching-specific workload fields. No AICTE compliance check. |
| W02-L2-034 | Process Leave and Trigger Substitution | Faculty submits leave during semester | Leave approved; substitution cascade | LeaveApplication (C), TimetableSlot (U) | None | On-demand | **PARTIAL** -- LeaveApplication CRUD exists. Missing: academic-day detection, substitution cascade to W02-L2-006, timetable slot update. |
| W02-L2-035 | Track Invigilation as Duty Workload | Invigilation roster generated | Invigilation logged as duty | InvigilationDuty (R), DutyLog (C) | None | Per-exam | **MISSING** -- No InvigilationDuty model, no DutyLog model, no appraisal feed. |

### 3.8 M04 -- Finance & Fees

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-036 | Generate Exam Fee Invoice | Exam schedule published | Invoice created; payment tracked | Invoice (C), Payment (C) | None | Per-semester | **PARTIAL** -- Invoice and Payment CRUD exist. Missing: auto-generation from exam schedule, exam fee type, supplementary fee handling. |
| W02-L2-037 | Check Fee Clearance for Eligibility | Hall ticket check (W02-L2-019) | Clearance status; affects eligibility | FeeClearanceStatus (derived) | None (rule-based) | Per-semester | **MISSING** -- No `checkFeeClearance()` API. Need: check tuition + exam fee status, return cleared/outstanding. |
| W02-L2-038 | Process Semester Scholarship Credit | Semester starts; eligible students | Scholarship credited; net reduced | ScholarshipAllocation (C), Invoice (U) | None | Per-semester | **PARTIAL** -- ScholarshipAllocation CRUD exists. Missing: auto-allocation from eligibility, invoice net reduction, TS-EPass claim via M12.4. |

### 3.9 M02 -- People & Identity Registry

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-039 | Update Student Lifecycle State | Results published; Board decision | State transitioned per outcome | Student (U) | None (state machine) | Per-semester | **PARTIAL** -- Student model has status enum (prospective/active/year_back/detained/graduated/exited/alumni). Missing: state transition logic, Board decision record, validation rules. |
| W02-L2-040 | Append Academic History | Result published | Semester results appended | AcademicHistory (C) | None | Per-semester | **MISSING** -- No AcademicHistory model. SemesterResult + GradeCard hold data but no consolidated history record per student. |
| W02-L2-041 | Generate Semester Transcript | Results published; auto or request | Transcript in VAULT | Transcript (C) | None (auto) | Per-semester | **MISSING** -- No Transcript model, no PDF generation, no DigiLocker integration. |

### 3.10 M10 -- Compliance & Accreditation

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-042 | Feed CO-PO Attainment as Evidence | CO/PO computed (W02-L2-030/031) | Evidence mapped to NAAC/NBA | EvidenceRecord (C) | AG-07: quality scoring | Per-semester | **MISSING** -- No EvidenceRecord model. AccreditationCycle and ComplianceCriteria exist but no evidence-to-criteria mapping. |
| W02-L2-043 | Feed Pass Rates & Performance Evidence | Results published | Pass rates as compliance evidence | EvidenceRecord (C) | Autonomous collection | Per-semester | **MISSING** -- Same as above. |
| W02-L2-044 | Feed Faculty Quality Metrics | Semester closes; data available | Faculty metrics as AICTE/NAAC evidence | EvidenceRecord (C) | AG-07: gap detection | Per-semester | **MISSING** -- Same as above. |

### 3.11 M11 -- Governance & Intelligence

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-045 | Update Academic Performance Dashboard | Results published OR continuous | Leadership sees KPIs | DashboardWidget (U) | Autonomous refresh | Continuous | **MISSING** -- No DashboardWidget model, no KPI computation, no widget refresh logic. |
| W02-L2-046 | Update Attendance Analytics Dashboard | Attendance data (continuous) | Attendance trends visible | DashboardWidget (U) | Autonomous | Continuous | **MISSING** -- Same as above. |
| W02-L2-047 | Generate Academic Risk Alerts | Risk threshold breached | Risk alert to leadership | RiskAlert (C) | M11.3 + AG-02: PREDICT | Continuous | **MISSING** -- No RiskAlert model, no risk prediction engine. |

### 3.12 M12 -- Platform & Infrastructure

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-048 | Dispatch Academic Notifications | Academic events trigger | Multi-channel notifications sent | Notification (C), DeliveryStatus (C) | Autonomous routing/dispatch | Continuous | **PARTIAL** -- Notification, WhatsAppLog, SMSLog, EmailLog models exist. Missing: event-based trigger system, template engine, channel routing logic, delivery tracking. |
| W02-L2-049 | Orchestrate JNTU Integration | JNTU calendar/results needed | Data exchanged with university | IntegrationLog (C) | Autonomous retry/transform | Per-semester | **MISSING** -- No IntegrationLog model, no JNTU API connector, no circuit breaker. |
| W02-L2-050 | Execute Academic AI Agent Functions | AI inference needed for W02 | Predictions/recommendations | InferenceLog (C) | AI agents 01-06 | Continuous | **MISSING** -- No InferenceLog model, no agent framework integration. |

### 3.13 Juvi -- Student App

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Freq | Status |
|----|------|---------|------------|--------------|----------|------|--------|
| W02-L2-051 | Surface Academic Experience in Home | Student logs into Juvi | Academic widgets: schedule, attendance, deadlines | HomeWidget (R) | Autonomous composition | Continuous | **MISSING** -- JuviInsight exists but no academic widget composition, no home API. |
| W02-L2-052 | Handle Academic Queries via Companion | Student asks academic question | AI answers read-only queries | JuviConversation (C) | AG-08: read-only queries | Continuous | **PARTIAL** -- JuviConversation and JuviMessage models exist. Missing: AG-08 integration, M03 read-only query handlers. |
| W02-L2-053 | Surface AI Study Recommendations | Student academic data available | Personalized study recommendations | StudyRecommendation (C), HomeWidget (U) | AG-08: GENERATES | Continuous | **MISSING** -- No StudyRecommendation model, no AG-08 analysis pipeline. |
| W02-L2-054 | Push Academic Notices & Track Ack | Results, exam schedule, attendance breach | Notice delivered; ack tracked | JuviNoticeCard (C), AckRecord (C) | Autonomous notice/reminder | On-demand | **MISSING** -- No JuviNoticeCard model, no acknowledgment tracking. |

---

## 4. Entity Gap Analysis

### 4.1 New Models Required

| Entity | Module | Location | Purpose | Sub-workflow Refs |
|--------|--------|----------|---------|-------------------|
| AttendanceSummary | M03 | academic-ops/ | Aggregated attendance per student-course-semester | W02-L2-008, 009, 019 |
| AttendanceAlert | M03 | academic-ops/ | Threshold breach records | W02-L2-009, 012 |
| CondonationRequest | M03 | academic-ops/ | Student attendance condonation requests | W02-L2-011, 019 |
| CourseMaterial | M03 | academic-ops/ | Uploaded course content | W02-L2-014 |
| Assignment | M03 | academic-ops/ | Faculty-created assignments with CO mapping | W02-L2-015 |
| Submission | M03 | academic-ops/ | Student assignment submissions | W02-L2-015 |
| Quiz | M03 | academic-ops/ | Online quiz definition with question bank | W02-L2-016 |
| QuizAttempt | M03 | academic-ops/ | Student quiz attempts and auto-grading | W02-L2-016 |
| SeatingPlan | M03 | academic-ops/ | Exam seating arrangement | W02-L2-020 |
| InvigilationRoster | M03 | academic-ops/ | Exam invigilation duty assignments | W02-L2-020, 022, 035 |
| HallTicket | M03 | academic-ops/ | Issued hall tickets per student-semester | W02-L2-021 |
| Backlog | M03 | academic-ops/ | Per-student-course backlog tracking | W02-L2-024, 027, 028, 029 |
| RevaluationRequest | M03 | academic-ops/ | Post-result revaluation requests | W02-L2-026 |
| PromotionDecision | M03 | academic-ops/ | Board promotion/detention decisions | W02-L2-029 |
| COAttainmentRecord | M03 | academic-ops/ | CO attainment per course per semester | W02-L2-030 |
| AttainmentRun | M03 | academic-ops/ | OBE computation run log | W02-L2-030, 031 |
| POAttainmentRecord | M03 | academic-ops/ | PO attainment aggregated from CO | W02-L2-031 |
| ProgrammeHealthMetrics | M03 | academic-ops/ | Computed programme health snapshot | W02-L2-032 |
| LabBatch | M03 | academic-structure/ | Lab sub-divisions within sections | W02-L2-005 |
| FacultyWorkload | M05 | hr/ | Teaching workload per faculty per semester | W02-L2-033 |
| DutyLog | M05 | hr/ | Non-teaching duty records (invigilation) | W02-L2-035 |
| AcademicHistory | M02 | people/ | Consolidated academic history per student | W02-L2-040 |
| Transcript | M02 | people/ | Generated transcript documents | W02-L2-041 |
| EvidenceRecord | M10 | compliance/ | Compliance evidence mapped to NAAC/NBA criteria | W02-L2-042, 043, 044 |
| DashboardWidget | M11 | governance/ | Configurable dashboard widgets | W02-L2-045, 046 |
| RiskAlert | M11 | governance/ | AI-generated risk alerts | W02-L2-047 |
| IntegrationLog | M12 | platform/ | External integration request/response log | W02-L2-049 |
| InferenceLog | M12 | platform/ | AI agent inference request/response log | W02-L2-050 |
| StudyRecommendation | Juvi | juvi/ | AI study recommendations per student | W02-L2-053 |
| JuviNoticeCard | Juvi | juvi/ | Academic notice cards for Juvi | W02-L2-054 |
| AckRecord | Juvi | juvi/ | Notice acknowledgment tracking | W02-L2-054 |

### 4.2 Existing Models Requiring New Fields

| Model | New Fields | Purpose | Sub-workflow Refs |
|-------|-----------|---------|-------------------|
| Regulation | gradingScale: { grade, minMarks, maxMarks, gradePoints }[], cieFormula: { components, weights }, passingCriteria: { internalMin, externalMin, totalMin } | CIE/grade computation config | W02-L2-018, 024 |
| Course | prerequisites: ObjectId[] | Prerequisite validation | W02-L2-001 |
| CourseOffering | status: enum, coFacultyIds: ObjectId[], syllabusProgress: number | Delivery tracking | W02-L2-004, 013, 017 |
| AcademicCalendar | status: enum (draft/published), approvedBy: ObjectId | Approval workflow | W02-L2-002 |
| Timetable | approvedBy: ObjectId, effectiveTo: Date | Approval tracking | W02-L2-003 |
| TimetableSlot | substituteFacultyId: ObjectId, isSubstitution: boolean, originalFacultyId: ObjectId | Substitution tracking | W02-L2-006 |
| InternalAssessment | coMappings: { coCode, weight }[] | OBE mapping | W02-L2-018, 030 |
| ExamSchedule | seatingPlanId: ObjectId, invigilationRosterId: ObjectId | Link to seating/invigilation | W02-L2-020 |
| ExamRegistration | hallTicketNumber: string, feeClearanceStatus: string, attendanceClearance: boolean | Eligibility tracking | W02-L2-019, 021 |
| ExternalMark | enteredBy: ObjectId, validatedBy: ObjectId, validatedAt: Date, anomalyFlags: string[] | Entry/validation workflow | W02-L2-023 |
| SemesterResult | promotionStatus: enum, boardDecision: string, publishedAt: Date, status: enum (draft/approved/published) | Publication workflow | W02-L2-025, 029 |
| Section | labBatchCount: number, studentIds: ObjectId[] | Section formation | W02-L2-005 |
| AcademicYear | status: enum (planning/active/completed) | Lifecycle tracking | W02-L2-002 |
| Invoice | examType: string, semesterId: ObjectId | Link to exam fees | W02-L2-036 |

---

## 5. API Endpoint Gap Analysis

### 5.1 M03 -- Academics (`/api/academics`)

| Method | Path | Description | Exists? | Sub-workflow |
|--------|------|-------------|---------|-------------|
| POST | /curriculum/instantiate | Instantiate semester curriculum from regulation | No | W02-L2-001 |
| POST | /academic-calendar/:id/publish | Publish calendar (draft -> published) | No | W02-L2-002 |
| POST | /timetables/generate | AI-generate timetable draft | No | W02-L2-003 |
| POST | /timetables/:id/approve | Approve timetable | No | W02-L2-003 |
| GET | /timetables/:id/conflicts | Check timetable for conflicts | No | W02-L2-003 |
| POST | /offerings/:id/assign-faculty | Assign faculty with workload push to M05 | No | W02-L2-004 |
| POST | /sections/form | Auto-form sections for batch/semester | No | W02-L2-005 |
| POST | /sections/:id/lab-batches | Create lab batches within section | No | W02-L2-005 |
| PUT | /timetable-slots/:id/substitute | Apply substitution to slot | No | W02-L2-006 |
| POST | /elective-allocations/optimize | AI-optimize elective allocation | No | W02-L2-007 |
| POST | /elective-allocations/finalize | Finalize and create enrollments | No | W02-L2-007 |
| POST | /attendance-sessions/:id/mark-bulk | Bulk mark attendance for session | Partial | W02-L2-008 |
| GET | /attendance-summary | Get attendance summary for student(s) | No | W02-L2-008, 009 |
| GET | /attendance-alerts | List attendance alerts | No | W02-L2-009 |
| POST | /condonation-requests | Submit condonation request | No | W02-L2-011 |
| PUT | /condonation-requests/:id/approve | Approve/reject condonation | No | W02-L2-011 |
| GET | /condonation-requests | List condonation requests | No | W02-L2-011 |
| POST | /course-materials | Upload course material | No | W02-L2-014 |
| GET | /course-materials | List course materials | No | W02-L2-014 |
| POST | /assignments | Create assignment | No | W02-L2-015 |
| POST | /assignments/:id/submissions | Submit assignment | No | W02-L2-015 |
| GET | /assignments/:id/submissions | List submissions | No | W02-L2-015 |
| POST | /quizzes | Create quiz | No | W02-L2-016 |
| POST | /quizzes/:id/attempt | Submit quiz attempt | No | W02-L2-016 |
| GET | /offerings/:id/progress | Get course delivery progress | No | W02-L2-017 |
| POST | /internal-assessments/compute-cie | Compute CIE for offering(s) | No | W02-L2-018 |
| POST | /exam-registrations/check-eligibility | Check hall ticket eligibility for student(s) | No | W02-L2-019 |
| POST | /exam-schedules/:id/seating-plan | Generate seating plan | No | W02-L2-020 |
| POST | /exam-schedules/:id/invigilation-roster | Generate invigilation roster | No | W02-L2-020 |
| POST | /hall-tickets/generate | Generate hall tickets for semester | No | W02-L2-021 |
| GET | /hall-tickets/:studentId | Download hall ticket | No | W02-L2-021 |
| POST | /external-marks/bulk | Bulk enter external marks | No | W02-L2-023 |
| POST | /external-marks/validate | Validate marks (anomaly check) | No | W02-L2-023 |
| POST | /results/compute | Compute grades + SGPA/CGPA | No | W02-L2-024 |
| POST | /results/publish | Publish results (requires Board approval) | No | W02-L2-025 |
| POST | /revaluation-requests | Submit revaluation request | No | W02-L2-026 |
| POST | /exam-schedules/supplementary | Schedule supplementary exams | No | W02-L2-027 |
| POST | /backlogs/clear | Clear backlog on pass | No | W02-L2-028 |
| POST | /results/promote | Execute promotion/detention decisions | No | W02-L2-029 |
| POST | /obe/compute-co-attainment | Compute CO attainment | No | W02-L2-030 |
| POST | /obe/aggregate-po-attainment | Aggregate PO attainment | No | W02-L2-031 |
| POST | /obe/programme-health | Compute programme health metrics | No | W02-L2-032 |
| GET | /stats | Dashboard stats | Yes | -- |
| CRUD | /regulations, /programmes, etc. | All entity CRUD | Yes | -- |

### 5.2 Cross-Module Endpoints

| Method | Path | Module | Description | Exists? | Sub-workflow |
|--------|------|--------|-------------|---------|-------------|
| POST | /api/hr/faculty-workload | M05 | Record workload from assignment | No | W02-L2-033 |
| POST | /api/hr/invigilation-duty | M05 | Log invigilation duty | No | W02-L2-035 |
| GET | /api/finance/fee-clearance/:studentId | M04 | Check fee clearance status | No | W02-L2-037 |
| POST | /api/finance/invoices/exam-fees | M04 | Auto-generate exam fee invoices | No | W02-L2-036 |
| POST | /api/finance/scholarships/apply-semester | M04 | Apply semester scholarship credits | No | W02-L2-038 |
| PUT | /api/people/students/:id/lifecycle-state | M02 | Transition student state | No | W02-L2-039 |
| POST | /api/people/students/:id/academic-history | M02 | Append academic history record | No | W02-L2-040 |
| POST | /api/people/students/:id/transcript | M02 | Generate transcript | No | W02-L2-041 |
| POST | /api/compliance/evidence | M10 | Create evidence record | No | W02-L2-042, 043, 044 |
| POST | /api/governance/dashboard/refresh | M11 | Refresh dashboard widgets | No | W02-L2-045, 046 |
| POST | /api/governance/risk-alerts | M11 | Generate risk alert | No | W02-L2-047 |
| POST | /api/platform/notifications/dispatch | M12 | Dispatch academic notification | No | W02-L2-048 |
| POST | /api/platform/integrations/jntu | M12 | JNTU integration call | No | W02-L2-049 |
| POST | /api/platform/ai/inference | M12 | Execute AI agent inference | No | W02-L2-050 |
| GET | /api/juvi/home/academic-widgets | Juvi | Academic widgets for home | No | W02-L2-051 |
| POST | /api/juvi/companion/academic-query | Juvi | Handle academic query | No | W02-L2-052 |
| GET | /api/juvi/study-recommendations | Juvi | Get study recommendations | No | W02-L2-053 |
| POST | /api/juvi/notices/academic | Juvi | Push academic notice | No | W02-L2-054 |
| POST | /api/juvi/notices/:id/ack | Juvi | Acknowledge notice | No | W02-L2-054 |

---

## 6. State Machine Definitions

### 6.1 Semester Lifecycle

```
                             activate()
  upcoming ──────────────────────────────────► active
                                                 │
                                                 │ complete()
                                                 ▼
                                            completed
```

**Transitions:**
- `upcoming -> active`: When semester start date reached OR manual activation. Triggers: curriculum instantiation (W02-L2-001), section formation (W02-L2-005), timetable generation (W02-L2-003).
- `active -> completed`: When all results published and promotion decisions made. Triggers: M10 evidence feed (W02-L2-042-044), M11 dashboard refresh (W02-L2-045-046).

**Guards:**
- `upcoming -> active`: Academic calendar must be published. At least one section must exist.
- `active -> completed`: All semester results must be in `published` status.

### 6.2 Academic Calendar Lifecycle

```
  draft ───────► published
                    │
                    │ (immutable once published;
                    │  new version for changes)
                    ▼
                 archived
```

### 6.3 Timetable Lifecycle

```
  draft ───────► published ───────► archived
    │                │
    │ (edit allowed)  │ (revision creates new draft)
    ▼                ▼
  draft v2       published v2
```

**Transitions:**
- `draft -> published`: HOD review + Dean approval (W02-L2-003 steps 2-3).
- `published -> archived`: When new version published OR semester completed.

### 6.4 Exam Cycle

```
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  schedule_published ──► registration_open ──► registration_closed
  │                                                     │
  │                                    eligibility_verified
  │                                            │
  │                                    hall_tickets_issued
  │                                            │
  │                                      conducting
  │                                            │
  │                                    marks_entry
  │                                            │
  │                                    marks_validated
  │                                            │
  │                                    results_computed
  │                                            │
  │                                    results_approved
  │                                            │
  │                                    results_published
  │                                            │
  │                               ┌────────────┴────────────┐
  │                               │                         │
  │                      revaluation_window          promotion_decided
  │                               │                         │
  │                          revaluation_closed         completed
  └─────────────────────────────────────────────────────────┘
```

### 6.5 Result Publication

```
  draft ───► computed ───► board_review ───► approved ───► published
                                  │
                                  ▼
                              revision_requested (back to computed)
```

### 6.6 Backlog Tracking

```
  created ───► registered_for_supplementary ───► appeared ───┬──► cleared
       │                                                     │
       │                                                     └──► persists
       │                                                              │
       │                                                    (next attempt)
       └──────────────────────────────────────────────────────────────┘
```

**Fields:** studentId, courseId, semesterId, originalExamType, attempts (count), currentStatus, clearedInSemesterId, clearedGrade.

### 6.7 Condonation Request

```
  submitted ───► under_review ───┬──► approved ──► linked_to_eligibility
                                 │
                                 └──► rejected
```

**Routing rules:**
- Medical/OD reasons: Routed to HOD
- Other reasons: Routed to Dean
- Exceeds per-semester limit: Auto-reject or escalate to Dean

---

## 7. Business Logic Requirements

### 7.1 CIE (Continuous Internal Evaluation) Computation

**Reference:** W02-L2-018

CIE formula is regulation-specific. Common JNTU R20 pattern:

```
CIE = best_of(mid1, mid2) * weight_mid +
      avg(assignments) * weight_assignment +
      quiz_avg * weight_quiz +
      lab_internal * weight_lab
```

**Implementation:**
```typescript
interface CIEConfig {
  regulationId: ObjectId;
  components: {
    type: 'mid1' | 'mid2' | 'assignment' | 'quiz' | 'seminar' | 'lab_internal';
    maxMarks: number;
    weight: number;
    aggregation: 'best_of' | 'average' | 'sum' | 'latest';
    groupWith?: string; // e.g., mid1 groups with mid2 for best_of
  }[];
  totalCIEMarks: number; // typically 30 or 40
}

function computeCIE(
  collegeId: string,
  courseOfferingId: string,
  studentId: string,
  config: CIEConfig
): Promise<{ cieMarks: number; components: ComponentBreakdown[] }>
```

**Key rules:**
- Missing components: Mark as "incomplete", do not compute partial CIE
- CO mapping preserved: Each component's marks must trace to COs for OBE (W02-L2-030)
- Faculty reviews before finalization

### 7.2 Grade Calculation

**Reference:** W02-L2-024

JNTU-style 10-point grading (configurable per Regulation):

| Grade | Range | Points |
|-------|-------|--------|
| O | >= 90 | 10 |
| A+ | 80-89 | 9 |
| A | 70-79 | 8 |
| B+ | 60-69 | 7 |
| B | 50-59 | 6 |
| C | 40-49 | 5 |
| F | < 40 | 0 |
| Ab | Absent | 0 |

**Passing criteria (JNTU R20):**
- Internal minimum: 40% of internal max marks
- External minimum: 40% of external max marks
- Total minimum: 40% of total max marks (internal + external)

```typescript
function computeGrade(
  totalMarks: number,
  maxMarks: number,
  internalMarks: number,
  internalMax: number,
  externalMarks: number,
  externalMax: number,
  gradingScale: GradingScale[]
): { grade: string; gradePoints: number; result: 'pass' | 'fail' }
```

### 7.3 SGPA/CGPA Computation

**Reference:** W02-L2-024

```
SGPA = sum(gradePoints[i] * credits[i]) / sum(credits[i])
       for all courses in current semester

CGPA = sum(gradePoints[i] * credits[i]) / sum(credits[i])
       for all courses across all semesters (latest attempt for each course)
```

**Key rules:**
- Failed courses: Include in SGPA with gradePoints = 0
- CGPA: Use latest attempt grade for courses with backlogs (not all attempts)
- Audit courses: Excluded from SGPA/CGPA
- Credit transfer: Include with assigned grade

```typescript
function computeSGPA(gradeCards: GradeCard[]): number;
function computeCGPA(allGradeCards: GradeCard[], studentId: string): number;
```

### 7.4 Hall Ticket Eligibility

**Reference:** W02-L2-019

```typescript
interface EligibilityResult {
  studentId: string;
  courseId: string;
  isEligible: boolean;
  reasons: string[];
  attendancePercent: number;
  hasCondonation: boolean;
  feeClearance: 'cleared' | 'outstanding';
}

function checkHallTicketEligibility(
  collegeId: string,
  studentId: string,
  semesterId: string
): Promise<EligibilityResult[]>
```

**Rules:**
1. Attendance >= 75% across all sessions for the course, OR
2. Approved condonation request exists for the attendance shortfall
3. Fee clearance: tuition fees + exam fees must be cleared (API call to M04)
4. No disciplinary suspension active

### 7.5 CO-PO Attainment

**Reference:** W02-L2-030, 031

**CO Attainment computation:**
```
For each CO:
  1. Collect marks from assessments mapped to this CO
  2. Compute: attainment_level = (students_above_threshold / total_students) * 100
  3. Apply direct + indirect weights:
     direct = weighted_avg(assessment_attainment)
     indirect = course_feedback CO-related scores
     co_attainment = 0.8 * direct + 0.2 * indirect
```

**PO Attainment aggregation:**
```
For each PO:
  1. Get all COs mapped to this PO (from CO.poMappings)
  2. Apply CO-PO mapping levels (1=slight, 2=moderate, 3=substantial)
  3. po_attainment = weighted_avg(co_attainment * mapping_level / 3)
```

**Threshold levels (configurable):**
- Level 3: >= 70% students above target
- Level 2: >= 60% students above target
- Level 1: >= 50% students above target
- Not attained: < 50%

### 7.6 Programme Health Metrics

**Reference:** W02-L2-032

```typescript
interface ProgrammeHealthMetrics {
  programmeId: string;
  semesterId: string;
  passRate: number;           // % students passing all courses
  avgCGPA: number;
  backlogRatio: number;       // students_with_backlogs / total
  attendanceAvg: number;      // avg attendance % across courses
  coAttainmentAvg: number;    // avg CO attainment across courses
  poAttainmentAvg: number;    // avg PO attainment
  syllabusCompletion: number; // avg lesson plan completion %
  feedbackAvg: number;        // avg course feedback rating
}
```

### 7.7 Timetable Conflict Detection

**Reference:** W02-L2-003

Conflict types:
1. **Faculty conflict:** Same faculty assigned to two slots at the same time
2. **Room conflict:** Same room assigned to two slots at the same time
3. **Section conflict:** Same section has two different courses at the same time
4. **Consecutive lab constraint:** Lab slots must be consecutive (2-3 periods)
5. **Daily load balance:** No more than N periods per day per faculty
6. **Weekly load balance:** Hours per week must match course L/T/P requirement

```typescript
interface ConflictResult {
  type: 'faculty' | 'room' | 'section' | 'lab_consecutive' | 'load_balance';
  severity: 'error' | 'warning';
  slotA: { day, period, courseOffering };
  slotB?: { day, period, courseOffering };
  message: string;
}

function detectTimetableConflicts(
  collegeId: string,
  timetableId: string
): Promise<ConflictResult[]>
```

### 7.8 Attendance Threshold Monitoring

**Reference:** W02-L2-009

```typescript
interface AttendanceStatus {
  studentId: string;
  courseOfferingId: string;
  totalClasses: number;
  attended: number;
  percentage: number;
  category: 'safe' | 'warning' | 'at_risk' | 'detained';
  projectedFinal: number; // AI-02 forecast
}
```

**Thresholds:**
- Safe: >= 85%
- Warning: 75-84%
- At-risk: 65-74%
- Detained: < 65% (if no condonation possible)

**Trigger:** Every attendance record creation should recompute summary and check thresholds.

---

## 8. Cross-Module Integration Points

### 8.1 M05 HR -- Faculty Workload & Leave

| Integration | Direction | Trigger | Data Flow |
|------------|-----------|---------|-----------|
| Faculty workload | M03 -> M05 | CourseOffering assigned (W02-L2-004) | Send: facultyId, courseId, credits, L/T/P hrs, semesterId |
| Leave triggers substitution | M05 -> M03 | LeaveApplication approved (W02-L2-034) | Receive: employeeId, fromDate, toDate; M03 identifies affected slots, triggers W02-L2-006 |
| Invigilation duty | M03 -> M05 | InvigilationRoster generated (W02-L2-020) | Send: facultyId, examDate, dutyHours; M05 creates DutyLog |
| Invigilation completion | M05 -> M03 | Exam conducted (W02-L2-022) | M05 marks duty as completed; feeds appraisal |

### 8.2 M04 Finance -- Fees & Clearance

| Integration | Direction | Trigger | Data Flow |
|------------|-----------|---------|-----------|
| Exam fee invoice | M03 -> M04 | ExamSchedule published (W02-L2-036) | Send: studentIds, semesterId, examType; M04 creates invoices |
| Fee clearance check | M03 -> M04 | Hall ticket eligibility (W02-L2-019, 037) | Request: studentId; Response: { tuitionCleared, examFeeCleared, outstanding } |
| Scholarship credit | M04 -> M03 | Semester start (W02-L2-038) | M04 applies scholarship, adjusts invoice; M03 reads clearance status |

### 8.3 M02 People -- Student State

| Integration | Direction | Trigger | Data Flow |
|------------|-----------|---------|-----------|
| Student lifecycle | M03 -> M02 | Results published + Board decision (W02-L2-039) | Send: studentId, newStatus (active/year_back/detained/graduated) |
| Academic history | M03 -> M02 | Results published (W02-L2-040) | Send: studentId, semesterResult, gradeCards[] |
| Transcript | M03 -> M02 | Auto or request (W02-L2-041) | M02 pulls data from M03 (all semesters); generates PDF |
| Section enrollment | M02 -> M03 | Section formation (W02-L2-005) | M03 reads student list from M02 for batch/branch |

### 8.4 M10 Compliance -- Evidence

| Integration | Direction | Trigger | Data Flow |
|------------|-----------|---------|-----------|
| CO/PO attainment | M03 -> M10 | Attainment computed (W02-L2-042) | Push: attainment data, map to NAAC 2.6, NBA SAR criteria |
| Pass rates | M03 -> M10 | Results published (W02-L2-043) | Push: pass_rate, avg_cgpa, backlog_stats by programme/branch |
| Faculty metrics | M05 -> M10 | Semester close (W02-L2-044) | Push: workload data, feedback scores, FDP participation |

### 8.5 M11 Governance -- Dashboards

| Integration | Direction | Trigger | Data Flow |
|------------|-----------|---------|-----------|
| Performance dashboard | M03 -> M11 | Results published / continuous (W02-L2-045) | Push: KPIs (pass_rate, cgpa, backlog_ratio) per programme/dept |
| Attendance dashboard | M03 -> M11 | Attendance data (W02-L2-046) | Push: attendance stats, at-risk counts, heatmaps |
| Risk alerts | M11 -> leadership | Threshold breach (W02-L2-047) | Generate: RiskAlert with severity, affected entity, recommended action |

### 8.6 M12 Platform -- Notifications & Integration

| Integration | Direction | Trigger | Data Flow |
|------------|-----------|---------|-----------|
| Notifications | M03 -> M12 | Various events (W02-L2-048) | Send: event_type, recipients, template_id, data; M12 dispatches via SMS/WhatsApp/email/push |
| JNTU | M12 <-> external | Calendar/results exchange (W02-L2-049) | M12 manages API calls, retry, circuit-breaker; transforms external data to internal format |
| AI agents | M12 -> M03 | AI inference needed (W02-L2-050) | Route to appropriate agent (AI-01 to AI-06); return prediction + confidence |

### 8.7 Juvi -- Student App

| Integration | Direction | Trigger | Data Flow |
|------------|-----------|---------|-----------|
| Home widgets | M03 -> Juvi | Student login (W02-L2-051) | Pull: today's schedule, attendance %, upcoming deadlines, exam info |
| Academic queries | Juvi -> M03 | Student asks question (W02-L2-052) | Read-only: grades, schedule, attendance, exam dates |
| Study recommendations | Juvi -> M03 | Data available (W02-L2-053) | Pull: attendance, marks, schedule; AG-08 generates recommendations |
| Notices | M03 -> Juvi | Academic events (W02-L2-054) | Push: result published, exam scheduled, attendance breach |

---

## 9. AI Agent Scope

### 9.1 M03-AI-01: Timetable Generator

**Sub-workflow:** W02-L2-003

**Input:**
- Course offerings for semester (courseId, section, faculty, L/T/P hrs)
- Room inventory from M08 (capacity, room type: lecture/lab)
- Faculty availability (from M05 leave data)
- Constraint config (max periods/day, lunch break, lab consecutiveness)

**Output:**
- Draft timetable with slot assignments (day, period, room, faculty, course)
- Conflict report (zero conflicts expected)
- Utilization metrics (room %, faculty load balance)

**Autonomy:** GENERATES draft; F2 (HOD) reviews; F3 (Dean) approves.

**Fallback:** If AI unavailable, manual slot-by-slot assignment with conflict detection.

### 9.2 M03-AI-02: Attendance Forecaster

**Sub-workflow:** W02-L2-009

**Input:**
- Student attendance history (current semester + previous semesters)
- Course schedule remaining in semester
- Historical patterns (day-of-week, pre/post-holiday)

**Output:**
- Projected final attendance % per student per course
- Risk classification: safe / warning / at_risk / detained
- Recommended intervention timing

**Autonomy:** FLAGS autonomously; alerts dispatched without human approval.

**Fallback:** Simple linear projection based on current rate.

### 9.3 M03-AI-03: Mark Anomaly Detector

**Sub-workflow:** W02-L2-023

**Input:**
- Marks entered for a course-semester
- Historical mark distributions for the same course
- Student performance profile (previous semesters)

**Output:**
- Anomaly flags: { studentId, reason: 'sudden_drop' | 'statistical_outlier' | 'bulk_same_marks' | 'zero_cluster' }
- Confidence score per flag

**Autonomy:** FLAGS; F1 (faculty) confirms or dismisses; F2 (HOD) validates.

**Fallback:** Z-score threshold detection (marks > 2 sigma from mean).

### 9.4 M03-AI-04: Grade Computation Engine

**Sub-workflow:** W02-L2-018, 024

**Input:**
- Internal marks (all components)
- External marks
- Regulation config (grading scale, CIE formula, passing criteria)

**Output:**
- CIE marks per student per course
- Grade, grade points per course
- SGPA, CGPA
- Backlog identification

**Autonomy:** COMPUTES autonomously; results go to Board for approval before publication.

**Fallback:** Direct formula application (no ML needed -- this is deterministic computation).

### 9.5 M03-AI-05: OBE Attainment Calculator

**Sub-workflow:** W02-L2-030, 031

**Input:**
- Assessment marks mapped to COs
- CO-PO mapping matrix (from CourseOutcome.poMappings)
- Course feedback (indirect attainment)
- Attainment thresholds (configurable)

**Output:**
- CO attainment per course (direct + indirect)
- PO attainment per programme (aggregated)
- Gap analysis: POs below target with contributing COs

**Autonomy:** COMPUTES; F2 approves CO level; F2+F3 approve PO level.

**Fallback:** Standard attainment formula (no ML -- deterministic computation).

### 9.6 M03-AI-06: Compound Risk Scorer

**Sub-workflow:** W02-L2-010, 047

**Input:**
- Attendance data (from M03.3)
- Academic performance (from M03.5)
- Fee status (from M04)
- Disciplinary records (from M06/M08)
- Historical dropout patterns

**Output:**
- Compound risk score per student (0-100)
- Risk factors breakdown
- Recommended interventions

**Autonomy:** Scores autonomously; high-risk (> 70) -> RiskAlert to M11 -> leadership. Routing to M06 welfare requires human decision.

**Fallback:** Weighted average of individual risk signals.

### 9.7 AI-07/AI-08: Seating Plan & Invigilation Roster Generators

**Sub-workflow:** W02-L2-020

**Seating plan input:** Exam schedule, student registrations, room inventory, seating rules (no same-branch adjacent).

**Invigilation roster input:** Faculty availability, exam schedule, load balancing, exemptions.

**Autonomy:** GENERATE; ST3/F2 approve.

### 9.8 AG-08: Juvi Academic Companion

**Sub-workflow:** W02-L2-052, 053

**Capabilities:**
- Answer read-only queries: "What's my attendance?", "When is the DS exam?", "What grade did I get in M1?"
- Generate study recommendations based on performance gaps
- Cannot modify any data (read-only access to M03)
- Escalate complex queries to human

---

## 10. Implementation Phases

### Phase 1: Core Delivery (Weeks 1-4)

**Scope:** Curriculum instantiation, scheduling, attendance, CIE
**Sub-workflows:** W02-L2-001 to 018

**Week 1: Schema Evolution + Curriculum**
- Add new fields to existing models (Regulation grading config, Course prerequisites, CourseOffering status, AcademicCalendar status, Timetable approval, TimetableSlot substitution, InternalAssessment CO mappings, ExternalMark audit fields, SemesterResult publication status)
- Create new models: AttendanceSummary, AttendanceAlert, CondonationRequest, LabBatch
- Implement `instantiateSemesterCurriculum()` service (W02-L2-001)
- Implement calendar publish workflow (W02-L2-002)

**Week 2: Scheduling**
- Implement section formation logic (W02-L2-005)
- Implement faculty assignment with M05 workload push (W02-L2-004)
- Implement timetable conflict detection (W02-L2-003)
- Implement substitution handling (W02-L2-006)
- Implement elective selection + finalization (W02-L2-007)
- Stub AI timetable generator (deterministic first pass) (W02-L2-003)

**Week 3: Attendance**
- Implement AttendanceSummary auto-update on record creation (W02-L2-008)
- Implement attendance threshold monitoring + alerts (W02-L2-009)
- Implement condonation request workflow (W02-L2-011)
- Implement parent notification trigger (W02-L2-012)
- Implement welfare routing stub (W02-L2-010)

**Week 4: CIE + Teaching**
- Implement CIE computation engine per regulation config (W02-L2-018)
- Implement course delivery progress tracking (W02-L2-017)
- Create Assignment, Submission models; implement CRUD + CO mapping (W02-L2-015)
- Create Quiz, QuizAttempt models; implement CRUD + auto-grade (W02-L2-016)
- Stub CourseMaterial upload (W02-L2-014)

### Phase 2: Examinations (Weeks 5-8)

**Scope:** Exam scheduling, hall tickets, marks, results, backlogs, promotion
**Sub-workflows:** W02-L2-019 to 029, 033-038

**Week 5: Exam Setup**
- Create SeatingPlan, InvigilationRoster, HallTicket models (W02-L2-020, 021)
- Implement hall ticket eligibility check with M04 fee clearance (W02-L2-019, 037)
- Implement exam fee invoice generation (W02-L2-036)
- Implement exam scheduling with seating + invigilation stubs (W02-L2-020)

**Week 6: Hall Tickets + Conduct**
- Implement hall ticket generation (PDF) (W02-L2-021)
- Implement exam conduct tracking (W02-L2-022)
- Implement bulk mark entry with anomaly detection (W02-L2-023)
- Implement M05 invigilation duty logging (W02-L2-035)

**Week 7: Results**
- Implement grade computation (internal + external -> grade -> gradePoints) (W02-L2-024)
- Implement SGPA/CGPA computation (W02-L2-024)
- Create Backlog model; implement auto-backlog on fail (W02-L2-024)
- Implement result publication workflow with Board approval (W02-L2-025)
- Implement M02 student state transition (W02-L2-039)
- Implement academic history append (W02-L2-040)

**Week 8: Supplementary + Promotion**
- Implement revaluation request flow (W02-L2-026)
- Implement supplementary exam scheduling (W02-L2-027)
- Implement backlog clearance logic (W02-L2-028)
- Implement promotion/detention decision recording (W02-L2-029)
- Create PromotionDecision model
- Implement semester scholarship credit (W02-L2-038)
- Implement faculty workload recording from M03 (W02-L2-033)
- Implement leave -> substitution cascade (W02-L2-034)

### Phase 3: OBE + Analytics + Platform (Weeks 9-12)

**Scope:** OBE, compliance, dashboards, notifications, Juvi, transcripts
**Sub-workflows:** W02-L2-030 to 032, 039-054

**Week 9: OBE**
- Create COAttainmentRecord, AttainmentRun, POAttainmentRecord models (W02-L2-030, 031)
- Implement CO attainment computation (direct + indirect) (W02-L2-030)
- Implement PO attainment aggregation via CO-PO matrix (W02-L2-031)
- Create ProgrammeHealthMetrics model; implement computation (W02-L2-032)
- Create QualityReport model

**Week 10: Compliance + Governance**
- Create EvidenceRecord model; implement M10 evidence feed (W02-L2-042, 043, 044)
- Implement CO/PO, pass rate, faculty metrics push to M10
- Create DashboardWidget, RiskAlert models (W02-L2-045, 046, 047)
- Implement academic performance dashboard data API (W02-L2-045)
- Implement attendance analytics dashboard data API (W02-L2-046)
- Implement risk alert generation (W02-L2-047)

**Week 11: Platform**
- Implement event-based notification dispatch (W02-L2-048)
- Implement JNTU integration framework with retry/circuit-breaker (W02-L2-049)
- Create IntegrationLog, InferenceLog models
- Implement AI agent orchestration layer (W02-L2-050)
- Implement transcript generation (PDF) and DigiLocker stub (W02-L2-041)

**Week 12: Juvi**
- Implement academic home widgets API (W02-L2-051)
- Implement companion academic query handler (W02-L2-052)
- Create StudyRecommendation model; implement recommendation engine (W02-L2-053)
- Create JuviNoticeCard, AckRecord models; implement notice push + ack (W02-L2-054)
- End-to-end integration testing across all 54 sub-workflows

### Implementation Priority Matrix

| Phase | Sub-workflows | New Models | New Service Functions | APIs | Risk |
|-------|--------------|------------|----------------------|------|------|
| Phase 1 | 18 (001-018) | 4 | ~25 | ~20 | Medium: CIE formula complexity |
| Phase 2 | 16 (019-029, 033-038) | 6 | ~20 | ~18 | High: Grade computation, cross-module integration |
| Phase 3 | 20 (030-032, 039-054) | 12 | ~30 | ~25 | Medium: OBE computation, Juvi integration |

### Dependencies

```
Phase 1 prerequisites:
  - M05 HR must have LeaveApplication CRUD (exists)
  - M08 Campus must have Room model (check needed)

Phase 2 prerequisites:
  - Phase 1 complete (CIE feeds into results)
  - M04 Finance Invoice/Payment CRUD (exists)
  - M02 People Student model (exists)

Phase 3 prerequisites:
  - Phase 2 complete (results feed OBE + dashboards)
  - M10, M11 base models created
  - Juvi base infrastructure available
```

### Testing Strategy

Each phase should include:
1. **Unit tests** for all business logic functions (CIE, SGPA/CGPA, eligibility, attainment)
2. **Integration tests** for cross-module API calls (M03 -> M04, M03 -> M05, M03 -> M02)
3. **E2E workflow tests** following the pattern established in W01 (see `backend/tests/e2e/workflows/`)
4. **State machine tests** for every transition guard and side effect

### Key Risks

1. **Regulation complexity:** Different JNTU regulations (R20, R22) have different grading scales, CIE formulas, and passing criteria. The Regulation model must be flexible enough to encode arbitrary formulas.
2. **Cross-module transaction boundaries:** Operations like "publish results + update student state + feed M10 + notify" span multiple services. Need saga pattern or at minimum idempotent retry.
3. **AI agent latency:** Timetable generation, attainment computation for large programmes may be slow. Queue via BullMQ, return job ID, poll for result.
4. **JNTU integration fragility:** External API may be unreliable. Need circuit breaker, exponential backoff, manual override capability.
5. **Data volume:** Attendance records grow fast (students x courses x days). Need proper indexing and summary caching (AttendanceSummary).
