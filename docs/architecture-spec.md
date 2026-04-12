# Juvion v2 – Architecture Specification

> **Status**: DRAFT | Last updated: April 2026

## 1. Overview

Juvion v2 is a comprehensive **Indian College ERP** built as a MERN + TypeScript monorepo. It covers the full lifecycle of engineering college operations — from admissions and academics to placements, compliance, and AI-assisted decision-making via the Juvi assistant.

- **Target**: Indian engineering colleges (AICTE-approved, JNTU/university-affiliated)
- **Stack**: MongoDB, Express, React 19, Node.js, TypeScript (strict)
- **State**: Zustand (client), React Query (server state)
- **Styling**: Tailwind CSS
- **Queue**: BullMQ + Redis (async jobs, events)
- **AI**: Juvi — persona-based AI assistant (M13)
- **Multi-tenancy**: `collegeId` on every entity

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Admin Portal  │  │  Juvi App    │  │  Mobile App  │              │
│  │ React 19      │  │  (planned)   │  │  (planned)   │              │
│  │ :5173         │  │              │  │              │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼─────────────────────┘
          │ HTTPS            │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPRESS API (:3003)                               │
│                                                                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ Helmet  │  │  CORS    │  │ Morgan   │  │  authenticate    │    │
│  │ (sec)   │→ │ (origins)│→ │ (logging)│→ │  (JWT + collegeId)│    │
│  └─────────┘  └──────────┘  └──────────┘  └────────┬─────────┘    │
│                                                      │              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    MODULE ROUTERS                             │  │
│  │                                                              │  │
│  │  /api/auth        /api/colleges     /api/admissions (M01)   │  │
│  │  /api/people (M02)  /api/academics (M03)  /api/finance (M04)│  │
│  │  /api/hr (M05)      /api/welfare (M06)    /api/placement(M07)│  │
│  │  /api/campus (M08)  /api/student-dev(M09) /api/compliance(M10)│ │
│  │  /api/governance(M11) /api/platform (M12) /api/juvi (M13)   │  │
│  │                                                              │  │
│  │  Each: routes.ts → controller.ts → service.ts → Model       │  │
│  │        + validate(zodSchema) middleware                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          │                    │                      │
└──────────────────────────┼────────────────────┼─────────────────────┘
                           │                    │
          ┌────────────────┼────────────────────┼─────────────────┐
          │                ▼                    ▼                  │
          │  ┌──────────────────┐  ┌──────────────────────┐      │
          │  │    MongoDB 7     │  │      Redis 7          │      │
          │  │                  │  │                        │      │
          │  │  205 Models      │  │  ┌──────────┐        │      │
          │  │  16 Entity Groups│  │  │ BullMQ   │        │      │
          │  │  collegeId on    │  │  │ Job Queue│        │      │
          │  │  every document  │  │  └──────────┘        │      │
          │  │                  │  │  ┌──────────┐        │      │
          │  │  ┌────────────┐ │  │  │ Cache    │        │      │
          │  │  │ AuditLog   │ │  │  │ (sessions)│        │      │
          │  │  │ (all CUD)  │ │  │  └──────────┘        │      │
          │  │  └────────────┘ │  │                        │      │
          │  └──────────────────┘  └──────────────────────┘      │
          │                DATA LAYER                              │
          └───────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    EVENT BUS (EventEmitter → BullMQ)                 │
│                                                                      │
│  admissions:applicant:enrolled  ──→  M02, M04, M06                  │
│  finance:payment:received       ──→  M04 (account), M14 (SMS)       │
│  academics:attendance:low       ──→  M06 (counselor), M14 (parent)  │
│  placement:offer:accepted       ──→  M02 (student status)           │
│  welfare:crisis:detected        ──→  M14 (emergency), M11 (alert)   │
│                                                                      │
│  Pattern: module:entity:action                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS (planned)                    │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Razorpay │  │ WhatsApp │  │ EAMCET   │  │ DigiLocker       │  │
│  │ CCAvenue │  │ Business │  │ ECET     │  │ (doc verify)     │  │
│  │(payments)│  │  (notif) │  │ (import) │  │                  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Modules (M01–M12 + Juvi)

| Code | Module | Route Prefix | Sub-domains |
|------|--------|-------------|-------------|
| M01 | Admissions | `/api/admissions` | Inquiries, Applications, Entrance Exams, Counseling, Offers, Documents, Enrollments |
| M02 | People | `/api/people` | Person, Student, Faculty, Staff, Parent, External, Organization |
| M03 | Academics | `/api/academics` | Regulations, Programmes, Branches, Departments, Batches, Sections, Academic Years, Semesters, Courses, Curriculum, Offerings, Enrollment, Timetable, Attendance, Assessments, Exams, Results, Electives, CO/PO, Lesson Plans, Feedback, Calendar |
| M04 | Finance | `/api/finance` | Fee Structure, Student Accounts, Line Items, Payments, Scholarships, Concessions, Refunds, Ledger, Budget, Expenses, Invoices, Fines, Payment Gateway, Reminders, Reports |
| M05 | HR | `/api/hr` | Employees, Leave Types/Balances/Applications, Attendance, Payroll, Pay Structure, Appraisals, Training, Promotions, Qualifications, Publications, Research, Recruitment, Job Applications, Grievances, Exit, On-Duty |
| M06 | Welfare | `/api/welfare` | Hostel (Blocks/Rooms/Allocation/Visitors), Mess (Menu/Feedback), Transport (Routes/Allocation), Health (Records/Visits), Crisis Alerts, Counseling, Anti-Ragging, Grievances, Insurance, Parent Meetings |
| M07 | Placement | `/api/placement` | Seasons, Companies, Job Postings, Registration, Rounds, Results, Offers, Internships, Training, Higher Studies, Entrepreneurship, Alumni, Events, Reports, Mock Interviews |
| M08 | Campus Ops | `/api/campus` | Buildings, Rooms, Labs, Bookings, Vehicles, Parking, Gate Pass, Visitors, Security, CCTV, Power, Water, Green Initiatives, Emergency Contacts |
| M09 | Student Dev | `/api/student-dev` | Clubs, Memberships, Events, Registration, Achievements, Mentoring, Sports Teams, NSS, Community Projects, Certifications, Student Projects, Leadership |
| M10 | Compliance | `/api/compliance` | Accreditation (NAAC/NBA), AICTE Approval, Affiliation, Regulatory Filings, Audit Findings, IQAC, RTI, Legal Cases, Criteria Evidence |
| M11 | Governance | `/api/governance` | Committees, Meetings, Policies, Governing Body, Strategic Goals |
| M12 | Platform | `/api/platform` | Settings, Users, Roles, Audit Logs, Integrations |
| M13 | Juvi AI | `/api/juvi` | Conversations, Messages, Actions, Knowledge Base, Insights, Persona Config, Feedback, Usage Metrics |
| — | Auth | `/api/auth` | Login, token management |
| — | Colleges | `/api/colleges` | College CRUD, tenant management |

> **Note**: EG09 (Facilities, 14 models), EG10 (Library, 9 models), and EG14 (Communication, 8 models) do not have their own backend modules — their APIs are served through **M08 Campus Ops** under `/api/campus`.

---

## 3. Entity Groups (EG00–EG15) — 205 Models

> **Note**: Model count includes 15 Admissions models, 2 root-level models (College, User), and 2 Workflow models not assigned to an entity group.

> **EG↔Module numbering**: Entity Groups (EG) and Modules (M) use independent numbering because entity groups are organised by data domain while modules are organised by business function. The mapping is:
>
> | EG | Entity Group | Served By |
> |----|-------------|-----------|
> | EG00 | Admissions | M01 |
> | EG01 | People | M02 |
> | EG02 | Academic Structure | M03 |
> | EG03 | Academic Ops | M03 |
> | EG04 | Finance | M04 |
> | EG05 | HR | M05 |
> | EG06 | Placement | M07 |
> | EG07 | Welfare | M06 |
> | EG08 | Campus | M08 |
> | EG09 | Facilities | M08 |
> | EG10 | Library | M08 |
> | EG11 | Student Dev | M09 |
> | EG12 | Governance | M11 |
> | EG13 | Compliance | M10 |
> | EG14 | Communication | M08 (notifications) / M12 (platform) |
> | EG15 | Juvi AI | Juvi (M13) |

### EG00: Admissions (15 models)
| Model | Key Fields | Indexes |
|-------|-----------|---------|
| Inquiry | name, phone, source, programmeInterest, status, leadScore, leadGrade, tags, workflowInstanceId | collegeId+status |
| Applicant | inquiryId→Inquiry, academicYearId, applicationNumber, name, phone, email, gender, dateOfBirth, tenthPercentage, interPercentage | collegeId+applicationNumber (unique) |
| EntranceExamScore | applicantId→Applicant, examType (EAMCET/JEE/ECET), rank, score, year | collegeId+applicantId+examType |
| CounselingAllotment | applicantId→Applicant, allotmentOrder, collegeCode, branchCode, round, status | collegeId+applicantId |
| AdmissionOffer | applicantId→Applicant, programmeId, branchId, feeQuoted, validityDate, status, negotiatedFee, waiverAmount | collegeId+applicantId |
| DocumentChecklist | applicantId→Applicant, documents[], status, ocrJobId, ocrStatus, fraudFlagged | collegeId+applicantId |
| Admission | applicantId→Applicant, studentId→Student, academicYearId, admissionDate, admissionType, workflowInstanceId, provisioningStatus | collegeId+applicantId (unique) |
| AdmissionCancellation | admissionId→Admission, applicantId, studentId, cancellationType, reason, reversals[], refundAmount, seatReleased, waitlistPromotionTriggered | collegeId+admissionId |
| AllotmentRound | academicYearId, roundNumber, name, type, status, criteria, applicationDeadline, publishDate | collegeId+academicYearId+roundNumber |
| AllotmentResult | allotmentRoundId→AllotmentRound, applicantId, meritRank, meritScore, allottedProgrammeId, allottedBranchId, status | collegeId+allotmentRoundId+applicantId |
| FeeNegotiation | applicantId, offerId→AdmissionOffer, originalFee, requestedWaiver, aiRecommendedWaiver, aiConfidence, approvedWaiver, finalFee, status | collegeId+offerId |
| LeadImportBatch | academicYearId, source (eamcet/ecet/manual_csv/website), fileName, status, totalRecords, successCount, failedCount | collegeId+academicYearId |
| LeadInteraction | inquiryId→Inquiry, type (phone_call/whatsapp/sms/email/walk_in/ai_conversation), direction, summary, outcome | collegeId+inquiryId |
| SeatInventory | academicYearId, programmeId, branchId, sanctionedIntake, convenerSeats, managementSeats, nriSeats, totalFilled, fillPercentage | collegeId+academicYearId+programmeId+branchId |
| Waitlist | academicYearId, applicantId, programmeId, branchId, allotmentRoundId, waitlistPosition, meritScore, quota, status | collegeId+academicYearId+applicantId |

### EG01: People (7 models)
| Model | Key Fields |
|-------|-----------|
| Person | firstName, lastName, email, phone, aadhaarNumber, dateOfBirth, gender, address, roles[], profilePictureUrl |
| Student | personId→Person, admissionYear, category, quota (convener/management/nri), regulationId, programmeId, branchId, batchId, rollNumber, status |
| Faculty | personId→Person, employeeId, departmentId→Department, designation, specialization, experience, qualifications, isMentor |
| Staff | personId→Person, employeeId, departmentId, designation, staffType, joiningDate, status |
| Parent | personId→Person, studentIds→Student[], relationship, occupation, income |
| ExternalPerson | personId→Person, organizationId→Organization, designation, purpose, validFrom/To |
| Organization | name, type, contactPerson, email, phone, address, website, isActive |

### EG02: Academic Structure (8 models)
| Model | Key Fields |
|-------|-----------|
| Regulation | code, name, effectiveFromYear, effectiveToYear, totalCredits, maxYears, isActive |
| Programme | code, name, level (UG/PG/Diploma/PhD), durationYears, regulationId |
| Branch | code, name, programmeId, departmentId, intake |
| Department | code, name, hodId→Faculty |
| Batch | code, name, admissionYear, programmeId, regulationId |
| Section | name, branchId, batchId, year, semester, capacity, classAdvisorId |
| AcademicYear | code, label, startDate, endDate, isCurrent |
| Semester | academicYearId, number, year, startDate, endDate, status |

### EG03: Academic Operations (21 models)
- Course, CurriculumMap, CourseOffering, Enrollment
- Timetable, TimetableSlot
- AttendanceSession, AttendanceRecord
- InternalAssessment, InternalMark
- ExamRegistration, ExamSchedule, ExternalMark
- GradeCard, SemesterResult
- ElectiveAllocation, CourseOutcome, ProgramOutcome
- LessonPlan, CourseFeedback, AcademicCalendar

### EG04: Finance (16 models)
- FeeStructure, StudentFeeAccount, FeeLineItem, Payment
- Scholarship, ScholarshipAllocation, Concession, Refund
- FinancialLedger, Budget, Expense, Invoice
- FinePenalty, PaymentGatewayLog, FeeReminder, FinancialReport

### EG05: HR (19 models)
- Employee, LeaveType, LeaveBalance, LeaveApplication
- EmployeeAttendance, Payroll, PayStructure, Appraisal
- Training, TrainingParticipant, Promotion, Qualification
- Publication, ResearchProject, Recruitment, JobApplication
- Grievance, ExitProcess, OnDuty

### EG06: Placement (17 models)
- PlacementSeason, Company, JobPosting, PlacementRegistration
- PlacementRound, RoundResult, PlacementOffer
- InternshipPosting, InternshipApplication
- PlacementTraining, TrainingAttendance
- HigherStudiesApplication, EntrepreneurProfile
- AlumniProfile, AlumniEvent, PlacementReport, MockInterview

### EG07: Welfare (16 models)
- HostelBlock, HostelRoom, HostelAllocation, HostelVisitorLog
- MessMenu, MessFeedback
- TransportRoute, TransportAllocation
- HealthRecord, MedicalVisit
- CrisisAlert, CounselingSession
- AntiRaggingComplaint, StudentGrievance
- InsuranceClaim, ParentMeeting

### EG08: Campus (14 models)
- Building, Room, Lab, RoomBooking
- Vehicle, ParkingSlot, GatePass, VisitorEntry
- SecurityIncident, CCTV, PowerBackup, WaterSupply
- GreenInitiative, EmergencyContact

### EG09: Facilities (14 models)
- Asset, AssetAllocation
- MaintenanceRequest, MaintenanceSchedule
- Vendor, PurchaseOrder
- StockItem, StockTransaction
- WasteManagement, EnergyConsumption
- ConstructionProject, Insurance
- ITAsset, NetworkInfra

### EG10: Library (9 models)
- Book, BookIssue, BookReservation, LibraryMember
- EResource, EResourceAccess
- LibraryFine, LibraryGateEntry, PeriodicalSubscription

### EG11: Student Dev (14 models)
- Club, ClubMembership, Event, EventRegistration
- Achievement, Mentoring, SportsTeam, SportsTeamMember
- NSSActivity, NSSParticipant, CommunityProject
- SkillCertification, StudentProject, LeadershipRole

### EG12: Governance (5 models)
- Committee, CommitteeMeeting, Policy
- GoverningBodyMember, StrategicGoal

### EG13: Compliance (10 models)
- AccreditationBody, AccreditationCycle, ComplianceCriteria
- RegulatoryFiling, AICTEApproval, AffiliationStatus
- AuditFinding, IQACReport, RTIRequest, LegalCase

### EG14: Communication (8 models)
- Notification, Circular, Announcement
- SMSLog, EmailLog, WhatsAppLog
- FeedbackSurvey, SurveyResponse

### EG15: Juvi AI (8 models)
- JuviConversation, JuviMessage, JuviAction
- JuviKnowledgeBase, JuviInsight
- JuviPersonaConfig, JuviFeedback, JuviUsageMetric

### Root-Level Models (2 models)
- College — multi-tenant college entity (name, code, address, subscription, settings, status)
- User — platform login and RBAC (collegeId, email, password, role, personaType, personId)

### Workflow Models (2 models)
- WorkflowInstance — tracks state of a cross-module workflow (workflowId, entityType, entityId, currentPhase, currentStep, status, history[])
- WorkflowTask — individual task within a workflow instance (workflowInstanceId, stepName, assigneeRole, aiAutonomy, status, result)

---

## 4. Personas (28 roles)

| # | Persona | Primary Modules | Description |
|---|---------|----------------|-------------|
| 1 | Super Admin | All | Full system access, multi-college management |
| 2 | Principal | All (read), M11/M12 | Strategic oversight, approvals |
| 3 | Vice Principal | M03, M05, M06, M09 | Academic & student affairs oversight |
| 4 | Dean Academics | M03 | Academic regulations, curriculum approval |
| 5 | Dean Student Affairs | M06, M09 | Student welfare & development |
| 6 | HOD | M03, M05 (dept scope) | Department-level academic & HR management |
| 7 | Faculty | M03 (own courses) | Attendance, marks entry, lesson plans |
| 8 | Class Advisor | M03, M06 (section scope) | Section-level student monitoring |
| 9 | Mentor | M09 (assigned mentees) | Student mentoring & counseling |
| 10 | Lab In-Charge | M03, M08 (lab scope) | Lab equipment & scheduling |
| 11 | Exam Controller | M03 (exams) | Exam scheduling, results processing |
| 12 | Admission Officer | M01 | Full admissions workflow |
| 13 | Finance Officer | M04 | Fee collection, budgets, reports |
| 14 | Scholarship Coordinator | M04 (scholarships) | Scholarship allocation & disbursement |
| 15 | HR Manager | M05 | Employee lifecycle, payroll |
| 16 | Placement Officer | M07 | Company relations, placement drives |
| 17 | TPO (Training & Placement) | M07 | Training programs, placement coordination |
| 18 | Hostel Warden | M06 (hostel) | Hostel operations, discipline |
| 19 | Transport Manager | M06 (transport) | Routes, vehicle management |
| 20 | Librarian | Library (M08 scope) | Book management, memberships |
| 21 | IT Admin | M12 | System configuration, user management |
| 22 | Estate Officer | M08, M09 (facilities) | Infrastructure & maintenance |
| 23 | Security Officer | M08 (security) | Gate management, CCTV, incidents |
| 24 | IQAC Coordinator | M10 | Quality assurance, accreditation |
| 25 | NSS Coordinator | M09 (NSS) | NSS activities & participation |
| 26 | Student | M03 (own), M06, M07, M09 | View grades, attendance, apply for placement |
| 27 | Parent | M03 (child), M04 (child) | View child's academic & fee status |
| 28 | Alumni | M07 (alumni) | Alumni network, mentoring |

---

## 5. Cross-Module Workflows (10)

### WF01: Admission-to-Enrollment
```
Inquiry → Applicant → EntranceExamScore → CounselingAllotment → AdmissionOffer
  → DocumentChecklist → Admission → Person + Student + FeeLineItem + HostelAllocation
```
**Modules**: M01 → M02 → M04 → M06

### WF02: Semester Lifecycle
```
AcademicYear → Semester → CourseOffering → Enrollment → Timetable
  → AttendanceSession → InternalAssessment → ExamRegistration
  → ExternalMark → GradeCard → SemesterResult
```
**Modules**: M03

### WF03: Fee Collection
```
FeeStructure → FeeLineItem → Payment (gateway/counter) → Receipt
  → StudentFeeAccount update → FeeReminder (if overdue)
```
**Modules**: M04
**Events**: `finance:payment:received` → updates StudentFeeAccount

### WF04: Scholarship Disbursement
```
Scholarship → ScholarshipAllocation (apply) → Verify eligibility
  → Approve → Disburse → Adjust FeeLineItem
```
**Modules**: M04
**Events**: `finance:scholarship:disbursed` → adjusts fee balance

### WF05: Leave Management
```
LeaveApplication → Check LeaveBalance → Approval chain
  → Update LeaveBalance → Update EmployeeAttendance
```
**Modules**: M05

### WF06: Payroll Processing
```
PayStructure + EmployeeAttendance + LeaveBalance → Calculate
  → Payroll (draft) → Review → Process → Pay
```
**Modules**: M05

### WF07: Placement Drive
```
PlacementSeason → Company + JobPosting → PlacementRegistration
  → PlacementRound → RoundResult → PlacementOffer → Accept/Decline
```
**Modules**: M07
**Events**: `placement:offer:accepted` → updates Student status

### WF08: Hostel Allocation
```
Student applies → Check availability → HostelAllocation
  → Room occupancy update → Mess registration → Transport (optional)
```
**Modules**: M06

### WF09: Accreditation Preparation
```
AccreditationBody → AccreditationCycle → ComplianceCriteria
  → Evidence collection → Self-assessment → Peer review → Visit
```
**Modules**: M10

### WF10: Crisis Response
```
CrisisAlert (reported) → Triage (severity) → Assign handler
  → CounselingSession (if needed) → Resolution → Follow-up
```
**Modules**: M06
**Events**: `welfare:crisis:detected` → notifies Dean, Warden, Counselor

---

## 6. Event Bus

Cross-module communication uses an EventEmitter (migrating to BullMQ for durability).

**Naming convention**: `module:entity:action`

| Event | Producer | Consumers |
|-------|----------|-----------|
| `admissions:applicant:enrolled` | M01 | M02 (create Person+Student), M04 (generate fees), M06 (hostel) |
| `finance:payment:received` | M04 | M04 (update account), M14 (send receipt SMS) |
| `finance:scholarship:disbursed` | M04 | M04 (adjust line items) |
| `academics:attendance:low` | M03 | M06 (alert counselor), M14 (notify parent) |
| `academics:result:published` | M03 | M14 (notify students/parents) |
| `welfare:crisis:detected` | M06 | M14 (emergency notifications), M11 (committee alert) |
| `placement:offer:accepted` | M07 | M02 (update student status) |
| `hr:leave:approved` | M05 | M03 (timetable adjustment) |

---

## 7. Tech Stack Details

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express 4.x |
| Language | TypeScript 5.6 (strict) |
| Database | MongoDB 7.x (Mongoose 8.x) |
| Cache/Queue | Redis 7.x (ioredis + BullMQ) |
| Auth | JWT (jsonwebtoken) |
| Validation | Zod |
| File Upload | multer + S3/local |
| API Docs | OpenAPI 3.0 (planned) |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build | Vite 6 |
| Language | TypeScript 5.6 |
| Routing | React Router 7 |
| State (server) | TanStack React Query 5 |
| State (client) | Zustand 5 |
| Styling | Tailwind CSS 3.4 |
| Icons | Lucide React |
| HTTP | Axios |
| Dates | date-fns |

### Infrastructure
| Layer | Technology |
|-------|-----------|
| Containerization | Docker + Docker Compose |
| Monorepo | npm workspaces |
| CI/CD | GitHub Actions (planned) |
| Hosting | AWS/GCP (planned) |

---

## 8. Project Structure

```
juvion_v2/
├── package.json              # npm workspaces root
├── tsconfig.base.json        # Shared TS config (strict, ES2022)
├── docker-compose.yml        # MongoDB, Redis, backend, frontend
├── .env.example
├── .gitignore
├── docs/
│   └── architecture-spec.md  # This file
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts            # Express app, mounts /api router
│       ├── config/
│       │   ├── db.ts         # MongoDB connection
│       │   └── redis.ts      # Redis connection (ioredis)
│       ├── middleware/
│       │   ├── authenticate.ts  # JWT auth, extracts collegeId
│       │   ├── authorize.ts     # RBAC "module:action" permission check
│       │   ├── validate.ts      # Zod schema validation factory
│       │   └── errorHandler.ts  # AppError class + error handler
│       ├── shared/
│       │   ├── types.ts      # AuthRequest, PaginatedResult, AuditEntry
│       │   ├── pagination.ts # Generic paginate() helper
│       │   ├── audit.ts      # AuditLog model + createAuditLog()
│       │   └── events.ts     # EventEmitter bus (→ BullMQ)
│       ├── routes/
│       │   └── index.ts      # Mounts all 13 module routers
│       ├── modules/
│       │   ├── admissions/   # routes.ts, controller.ts, service.ts, index.ts
│       │   ├── people/
│       │   ├── academics/
│       │   ├── finance/
│       │   ├── hr/
│       │   ├── welfare/
│       │   ├── placement/
│       │   ├── campus-ops/
│       │   ├── student-dev/
│       │   ├── compliance/
│       │   ├── governance/
│       │   ├── platform/
│       │   └── juvi/
│       └── models/
│           ├── index.ts      # Barrel export (193 models)
│           ├── admissions/   # 7 models
│           ├── people/       # 7 models
│           ├── academic-structure/  # 8 models
│           ├── academic-ops/       # 21 models
│           ├── finance/      # 16 models
│           ├── hr/           # 19 models
│           ├── placement/    # 17 models
│           ├── welfare/      # 16 models
│           ├── campus/       # 14 models
│           ├── facilities/   # 14 models
│           ├── library/      # 9 models
│           ├── student-dev/  # 14 models
│           ├── governance/   # 5 models
│           ├── compliance/   # 10 models
│           ├── communication/ # 8 models
│           └── juvi/         # 8 models
└── admin-portal/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── index.css
        ├── App.tsx           # Route definitions for all modules
        ├── layouts/
        │   └── DashboardLayout.tsx  # Sidebar + header + outlet
        ├── pages/
        │   ├── Dashboard.tsx
        │   ├── Admissions.tsx
        │   ├── People.tsx
        │   ├── Academics.tsx
        │   ├── Finance.tsx
        │   ├── HR.tsx
        │   ├── Welfare.tsx
        │   ├── Placement.tsx
        │   ├── CampusOps.tsx
        │   ├── StudentDev.tsx
        │   ├── Compliance.tsx
        │   ├── Governance.tsx
        │   ├── Platform.tsx
        │   └── Juvi.tsx
        ├── components/ui/
        │   ├── Badge.tsx
        │   ├── DataTable.tsx
        │   ├── Modal.tsx
        │   ├── StatCard.tsx
        │   └── SubDomainCard.tsx
        ├── services/
        │   └── api.ts        # Axios instance with auth interceptor
        └── stores/
            └── authStore.ts  # Zustand auth state
```

---

## 9. Multi-Tenancy Strategy

Every entity includes a `collegeId` field (required, indexed). This enables:

1. **Data isolation** — all queries filter by `collegeId`
2. **Future multi-college** — single database, logical separation
3. **Middleware injection** — `authenticate.ts` extracts `collegeId` from `x-college-id` header and attaches to `req.collegeId`

---

## 10. RBAC Design

Permissions follow the pattern `module:action`:

```
admissions:read    admissions:write    admissions:delete
finance:read       finance:write       finance:approve
academics:read     academics:write     academics:grade
hr:read            hr:write            hr:payroll
```

Roles are stacked (a person can hold multiple roles, e.g., Faculty + HOD + Mentor), and each role grants a set of permissions. The `authorize('module:action')` middleware checks if the authenticated user's combined permissions include the required permission.

---

## 11. Indian College Domain Concepts

| Concept | Description |
|---------|-------------|
| **Regulation** | Academic rule set (e.g., R20, R23) defining credit structure, grading scheme |
| **Programme** | Degree type — B.Tech, M.Tech, MBA, MCA, Diploma, PhD |
| **Branch** | Specialization — CSE, ECE, ME, CE, EEE, IT, etc. |
| **Quota** | Admission category — Convener (govt seat), Management, NRI |
| **Category** | Social category — OC, BC, SC, ST, EBC, Minority |
| **EAMCET/JEE/ECET** | Entrance exams for UG/PG admissions in Telangana/AP |
| **SGPA/CGPA** | Semester/Cumulative Grade Point Average (10-point scale) |
| **Backlog** | Failed subject requiring re-examination |
| **Year Back** | Student repeating an entire year |
| **AICTE** | All India Council for Technical Education (approval body) |
| **NAAC** | National Assessment and Accreditation Council |
| **NBA** | National Board of Accreditation (programme-level) |
| **NIRF** | National Institutional Ranking Framework |
| **IQAC** | Internal Quality Assurance Cell |
| **NSS** | National Service Scheme |
| **FDP** | Faculty Development Programme |
| **CO/PO** | Course Outcomes / Programme Outcomes mapping |
| **EOA** | Extension of Approval (annual AICTE renewal) |

---

## 12. API Conventions

- **Base URL**: `/api/{module}/{resource}`
- **List**: `GET /api/finance/payments?page=1&limit=20&status=pending`
- **Detail**: `GET /api/finance/payments/:id`
- **Create**: `POST /api/finance/payments`
- **Update**: `PUT /api/finance/payments/:id`
- **Delete**: `DELETE /api/finance/payments/:id`
- **Pagination**: `{ items: T[], total: number, page: number, pages: number }`
- **Errors**: `{ error: string, statusCode: number, details?: any }`
- **Auth**: Bearer token in `Authorization` header, `x-college-id` header
- **Validation**: Zod schemas in `validate(schema)` middleware

---

## 13. Audit Trail

Every CUD operation creates an `AuditLog` entry:

```typescript
{
  collegeId, entityType, entityId, entityName,
  action: 'create' | 'update' | 'delete',
  changes: [{ field, displayName, oldValue, newValue }],
  performedBy, timestamp, studentId?
}
```

Indexed by `entityType + entityId + timestamp` for fast entity history lookups.

---

## 14. Security

### Authentication Flow

1. **Login** (`POST /api/auth/login`) — accepts email + password (+ optional `collegeId`). Returns a JWT valid for 7 days.
2. **Token payload** — `{ id, name, email, role, personaType, collegeId? }`. Super-admins have no `collegeId` in the token.
3. **Request auth** — every protected route passes through `authenticate` middleware which verifies the JWT via `jsonwebtoken` (HS256, secret from `JWT_SECRET` env var).
4. **College scoping** — `collegeId` is extracted from the `x-college-id` header (takes precedence) or from the JWT payload. Super-admins use the header to scope into any college.
5. **Dev bypass** — when `NODE_ENV=development` and no `Authorization` header, the middleware injects a synthetic `super_admin` user with the default `DEV_COLLEGE_ID`. **Must be disabled in production.**

### Password Handling

- bcryptjs with 10 salt rounds.
- No password-reset or email-verification flow exists yet (planned).

### RBAC

- Permission strings follow `module:action` format (e.g., `finance:create`, `academics:grade`).
- `authorize(...permissions)` middleware exists but **is currently a pass-through** — all authenticated users are allowed. Hardcoded bypass for `L-PRIN` and `L-TRUST` persona types.
- **Status**: RBAC enforcement is not yet implemented. All authorization currently depends on authentication + `collegeId` scoping only.

### Multi-Tenancy Isolation

- Every query filters by `collegeId` — a user cannot access another college's data even by guessing an ObjectId (returns 404).
- Super-admins can scope into any college via the `x-college-id` header.

### Headers & Middleware

- **Helmet** — enabled with defaults (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
- **CORS** — dynamic origin whitelist from `ALLOWED_ORIGINS` env var; allows credentials.
- **Body limit** — 10 MB JSON (needed for bulk imports; consider reducing for standard routes).
- **Rate limiting** — not yet implemented. Login endpoint is unprotected against brute force.

### Known Security Gaps

| Gap | Severity | Plan |
|-----|----------|------|
| RBAC not enforced | High | Implement role-permission matrix lookup in `authorize.ts` |
| No rate limiting | High | Add `express-rate-limit` on `/api/auth/login` and globally |
| Header `x-college-id` can override JWT for non-superadmins | High | Restrict header override to `super_admin` role only |
| No token refresh | Medium | Add refresh token rotation |
| No password reset | Medium | Add email-based reset flow |
| JWT secret defaults to `'dev-secret'` | Medium | Fail startup if `JWT_SECRET` not set in production |
| No token revocation/logout | Low | Stateless JWT — acceptable if refresh tokens are added |

---

## 15. Scalability & Performance

### Current Design

- **Single MongoDB database** with logical multi-tenancy via `collegeId`. All 205 models share one database.
- **Indexes** — every model has `collegeId` indexed. Key query paths have compound indexes (e.g., `collegeId + applicationNumber`).
- **Redis** — used for BullMQ job queues and cache. Single Redis instance.

### Known Limits

| Dimension | Current Capacity | Bottleneck |
|-----------|-----------------|------------|
| Colleges | ~10-20 | Single DB; index size grows linearly |
| Concurrent users | ~500 | Single Node.js process; no clustering |
| Model count | 205 | Mongoose connection pool; startup model registration |
| Bulk imports | ~10K rows | 10 MB body limit; synchronous processing |

### Scaling Path

1. **Short-term** — Node.js clustering (`cluster` module or PM2) for multi-core utilisation.
2. **Medium-term** — MongoDB read replicas for report/analytics queries; Redis Sentinel for cache HA.
3. **Long-term** — Database-per-college sharding if college count exceeds ~50; consider migrating heavy analytics to a read-optimised store.

### Performance Considerations

- `paginate()` helper limits all list queries; no unbounded result sets.
- Mongoose `lean()` should be used on read-only queries to skip hydration overhead.
- BullMQ handles async work (notifications, report generation) to keep API response times low.

---

## 16. Monitoring & Observability

### Current State

| Capability | Status |
|-----------|--------|
| Request logging | Morgan (`dev` / `combined` by format) |
| Audit trail | `AuditLog` model captures all CUD operations |
| Error handling | Centralised `errorHandler` middleware; `AppError` class |
| Health check | Not implemented |
| Metrics | Not implemented |
| Alerting | Not implemented |

### Planned

1. **Health endpoint** — `GET /api/health` returning DB, Redis, and queue connectivity.
2. **Structured logging** — migrate from Morgan to pino/winston with JSON output for log aggregation.
3. **APM** — application performance monitoring (Datadog, New Relic, or OpenTelemetry) for request tracing.
4. **Dashboards** — queue depth, error rates, response latency, active users per college.

---

## 17. Deployment & Environments

### Current State

| Environment | Status |
|-------------|--------|
| Local dev | Docker Compose (MongoDB 7, Redis 7) + `ts-node-dev` |
| Staging | Not configured |
| Production | Manual deployment (planned: containerised) |
| CI/CD | Not configured (planned: GitHub Actions) |

### Docker Compose

The `docker-compose.yml` runs MongoDB, Redis, backend, and admin-portal. Backend builds from a Dockerfile; frontend is served via Vite dev server locally and a static build in production.

### Deployment Plan

1. **Container images** — backend and admin-portal built as Docker images.
2. **CI/CD** — GitHub Actions: lint → typecheck → test → build → deploy.
3. **Hosting** — AWS (ECS or EKS) or GCP (Cloud Run). MongoDB Atlas for managed database. ElastiCache for Redis.
4. **Rollback** — container image tags pinned to git SHA; rollback = redeploy previous tag.

### Backup & Disaster Recovery

| Item | Strategy |
|------|----------|
| Database | MongoDB Atlas automated backups (daily, 7-day retention) or `mongodump` cron for self-hosted |
| File uploads | S3 with versioning enabled |
| Redis | Ephemeral (cache + queues); no backup needed — jobs are retried on restart |
| RTO target | < 1 hour (re-deploy from latest image + restore DB backup) |
| RPO target | < 24 hours (daily backup cadence) |

---

## 18. Trade-offs & Architectural Decisions

| Decision | Alternatives Considered | Rationale |
|----------|------------------------|-----------|
| **MongoDB** over PostgreSQL | PostgreSQL with relational schemas | ERP has deeply nested, variable-shape documents (e.g., DocumentChecklist items, curriculum structures). MongoDB's flexible schema accelerates iteration. Trade-off: no foreign key constraints — referential integrity enforced in application code. |
| **Monorepo** over microservices | Separate repos per module; microservice per module | 12 modules with heavy cross-module references (e.g., admissions→people→finance). Microservices would require an API gateway and distributed transactions for workflows like enrolment. Monorepo keeps deployment simple and cross-module calls are in-process. |
| **Single database** over DB-per-tenant | Dedicated MongoDB database per college | Simplicity at current scale (< 20 colleges). `collegeId` filtering is sufficient. DB-per-tenant adds operational overhead for backups, migrations, and connection management. Migration path exists if needed. |
| **BullMQ** over RabbitMQ/Kafka | RabbitMQ for durable messaging; Kafka for event streaming | BullMQ runs on Redis (already in stack), requires no additional infrastructure. Sufficient for job queues and event processing at current scale. Trade-off: no built-in dead-letter exchanges or consumer groups. |
| **Zustand** over Redux | Redux Toolkit; React Context | Zustand is minimal and requires less boilerplate. Only client-side state is auth + UI preferences — no need for Redux's middleware ecosystem. Server state handled entirely by React Query. |
| **EventEmitter** (migrating to BullMQ) | Direct service-to-service calls | Loose coupling between modules. Trade-off: EventEmitter is in-process and non-durable — events lost on crash. BullMQ migration adds durability. |
| **Tailwind CSS** over component libraries | Material UI, Ant Design, Chakra | Full design control needed for the Indian college domain (custom forms, dense data tables). Component libraries impose opinionated styling that would fight the design. |

---

## 19. Future Roadmap

1. **BullMQ migration** — Replace EventEmitter with durable job queues
2. **OpenAPI docs** — Auto-generate from Zod schemas
3. **Mobile app** — React Native for student/parent/faculty personas
4. **Payment gateway integration** — Razorpay/CCAvenue for online fee payment
5. **WhatsApp Business API** — Automated notifications
6. **AI enhancements** — Predictive analytics, dropout risk, attendance anomaly detection
7. **LDAP/SSO** — University single sign-on integration
8. **Offline support** — PWA with background sync for attendance marking
