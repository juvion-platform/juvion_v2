# Juvion v2 – Architecture Specification

## 1. Overview

Juvion v2 is a comprehensive **Indian College ERP** built as a MERN + TypeScript monorepo. It covers the full lifecycle of engineering college operations — from admissions and academics to placements, compliance, and AI-assisted decision-making via the Juvi assistant.

- **Target**: Indian engineering colleges (AICTE-approved, JNTU/university-affiliated)
- **Stack**: MongoDB, Express, React 19, Node.js, TypeScript (strict)
- **State**: Zustand (client), React Query (server state)
- **Styling**: Tailwind CSS
- **Queue**: BullMQ + Redis (async jobs, events)
- **AI**: Juvi — persona-based AI assistant (M13)
- **Multi-tenancy**: `collegeId` on every entity

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

---

## 3. Entity Groups (EG00–EG15) — 193 Models

### EG00: Admissions (7 models)
| Model | Key Fields | Indexes |
|-------|-----------|---------|
| Inquiry | name, phone, source, programmeInterest, status, leadScore | collegeId+status |
| Applicant | personId→Person, programmeId→Programme, applicationNumber, academicYear, status | collegeId+applicationNumber (unique) |
| EntranceExamScore | applicantId→Applicant, examName (EAMCET/JEE/ECET), rank, score, category | collegeId+applicantId+examName |
| CounselingAllotment | applicantId→Applicant, allotmentRound, seatType, branchId→Branch, status | collegeId+applicantId |
| AdmissionOffer | applicantId→Applicant, programmeId, branchId, feeQuoted, validUntil, status | collegeId+applicantId |
| DocumentChecklist | applicantId→Applicant, documents[{name, required, submitted, verified}], overallStatus | collegeId+applicantId |
| Admission | applicantId→Applicant, studentId→Student, admittedDate, admissionType, status | collegeId+applicantId (unique) |

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

## 14. Future Roadmap

1. **BullMQ migration** — Replace EventEmitter with durable job queues
2. **OpenAPI docs** — Auto-generate from Zod schemas
3. **Mobile app** — React Native for student/parent/faculty personas
4. **Payment gateway integration** — Razorpay/CCAvenue for online fee payment
5. **WhatsApp Business API** — Automated notifications
6. **AI enhancements** — Predictive analytics, dropout risk, attendance anomaly detection
7. **LDAP/SSO** — University single sign-on integration
8. **Offline support** — PWA with background sync for attendance marking
