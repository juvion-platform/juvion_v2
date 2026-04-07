# Juvion v2 — Workflow Specification

> Derived from `Juvion_Architecture.xlsx` → "L1 Workflows" + "L1 Workflow × Module Matrix" + L2 sheets.
> Status: DRAFT | April 2026

---

## Overview

Juvion v2 defines **10 cross-module workflows** (W01–W10) that orchestrate the entire student lifecycle from enquiry to alumni. Each workflow has:

- **Primary Module** (owner) — drives the workflow
- **Modules Crossed** — secondary modules that participate
- **Personas** — roles involved (staff, faculty, students, parents, leadership, AI agents)
- **AI-Native Role** — what AI handles autonomously vs. flags for human review

---

## W01: Student Intake & Onboarding

| Field | Value |
|-------|-------|
| **Trigger** | Enquiry received / EAMCET list published |
| **Resolution** | Student academically active with roll number, section, timetable, hostel, Juvi, first fee paid |
| **Primary Module** | M01 Admissions |
| **Modules Crossed** | M01 → M02 → M04 → M08 → M03 → M12 → Juvi |
| **Personas** | Student, Parent, Staff, Leadership, External |
| **AI Role** | Lead scoring, eligibility auto-check, document OCR, fee negotiation within threshold, conversion prediction |

### Phases (76 L2 Sub-Workflows)

#### M01.1 LEAD — Lead Capture & Enquiry (9 sub-workflows)
- **W01-L2-001** Capture Walk-in Enquiry — ST1 opens form, AI scores lead (Hot/Warm/Cold), dedup check, nurture initiated
- **W01-L2-002** Capture Web Form Enquiry — Form ingested via M12.4, AI scores, auto-ack sent, hot leads queued for callback
- **W01-L2-003** Capture WhatsApp Enquiry — AI conversation extracts info, language detection, creates records or escalates
- **W01-L2-004** Import EAMCET Allotment List — Bulk import from EAMCET portal, auto-creates Applications (status=Allotted), document checklists, SMS/WhatsApp notification
- **W01-L2-005** Import ECET Allotment List — Lateral entry import, creates Applications at Year 2
- **W01-L2-006** Qualify and Score Lead — AI scoring model (programme demand, location, engagement), classifies Hot/Warm/Cold
- **W01-L2-007** Nurture Lead via AI Conversation — AI sends periodic WhatsApp messages (Day 1,3,7,14), escalates or marks Dormant
- **W01-L2-008** Deduplicate and Merge Leads — Match confidence ≥80%: auto-merge; <80%: ST1 review
- **W01-L2-009** Convert Lead to Application — Creates Application, updates Lead status=Converted, determines admission pathway

#### M01.2 APP — Application Processing (14 sub-workflows)
- **W01-L2-010** Submit Management Quota Application — Portal access, pre-populate from Lead, pay app fee, generate Doc Checklist
- **W01-L2-011** Record Convener Student Reporting — Physical identity verification, mark Allotment as Reported
- **W01-L2-012** Upload Documents (Self-Service) — AI quality check (blur, completeness), queue for OCR
- **W01-L2-013** Collect Physical Documents — Original verification, scan, queue for OCR
- **W01-L2-014** Verify Documents via AI OCR — Extract structured data, confidence ≥90%: auto-verify; <90%: flag ST1
- **W01-L2-015** Review Flagged Documents — ST1 resolves: Verify/Correct/Deficient/Reject
- **W01-L2-016** Handle Document Deficiency — Notify with deadline, status=Incomplete, reminders
- **W01-L2-017** Flag Suspected Document Fraud — Escalate to Leadership, contact issuing authority
- **W01-L2-018** Verify Eligibility (Standard Cases) — AI evaluates rules (marks, subjects, age, category), Eligible/Ineligible
- **W01-L2-019** Review Eligibility Edge Cases — ST1/Leadership makes final determination on flagged cases
- **W01-L2-020** Grant Conditional Eligibility — Pending item (e.g., marksheet), deadline set, proceed flagged
- **W01-L2-021** Verify Lateral Entry Eligibility — Diploma aggregate, branch mapping, ECET rank, credit mapping flag
- **W01-L2-022** Verify NRI/International Eligibility — Passport/visa, academic equivalence, NRI fee tier
- **W01-L2-023** Verify TS-EPass Scholarship Eligibility — Category (SC/ST/BC/EBC), income cert, caste cert, flags for M04

#### M01.3 SEAT — Seat Inventory & Allotment (6 sub-workflows)
- **W01-L2-024** Configure Seat Inventory — AICTE sanctioned intake, convener/management/NRI splits, lateral seats
- **W01-L2-025** Receive Convener Allotment — Update inventory, calculate fill rate, dashboard update
- **W01-L2-026** Track Convener Reporting and Slides — Reminders (48h, 24h, 6h), non-reporters lapse, seats slide
- **W01-L2-027** Generate Management Merit List — Rank by criteria, publish, notify applicants
- **W01-L2-028** Execute Management Allotment Round — Process in merit order, match preferences, allot or waitlist
- **W01-L2-029** Manage Waitlist and Auto-Promotion — Seat release detected, auto-promote top candidate

#### M01.4 OFFER — Offer & Fee Negotiation (6 sub-workflows)
- **W01-L2-030** Generate Admission Offer — Fee structure from M04, generate offer letter PDF, deliver multi-channel
- **W01-L2-031** Conduct Fee Negotiation — AI can offer ≤₹50K waiver autonomously; >₹50K escalates to Leadership
- **W01-L2-032** Escalate Fee Negotiation to Leadership — Case packet prepared, Leadership approves/counters/rejects
- **W01-L2-033** Record Offer Rejection — Seat released, waitlist triggered, rejection reason logged
- **W01-L2-034** Handle Offer Expiry — Monitor deadlines, reminders, auto-expire, waitlist promotion
- **W01-L2-035** Accept Offer and Confirm Payment — Payment via gateway, Offer status=Accepted, triggers enrolment

#### M01.5 ENROL — Enrolment & Handoff (5 sub-workflows)
- **W01-L2-036** Execute Enrolment Transaction — Parallel provisioning: M02 (Person/Student), M04 (Invoice), M08 (Hostel/Transport/Library), M03 (Section/Courses/Timetable), M12 (Account/RBAC), Juvi (Account/Channels)
- **W01-L2-037** Handle Late Admission — Post-deadline cases, ST1 or Leadership approval, fast-track
- **W01-L2-038** Allocate Hostel Room — AI room allocation, mess subscription, waitlist if full
- **W01-L2-039** Assign Transport Route — Match location to routes, nearest stop, capacity check
- **W01-L2-040** Complete Juvi Onboarding — App download, welcome, channel subscription, AI companion intro

#### M01.6 CANCEL — Cancellation & Recovery (4 sub-workflows)
- **W01-L2-041** Process Enrolment Cancellation — Reversals across M02/M04/M08/M12/Juvi, refund, seat release
- **W01-L2-042** Process Pre-Enrolment Cancellation — Simpler: offer cancelled, full refund, seat released
- **W01-L2-043** Execute Spot Admission Round — Leadership-approved, walk-in/online, same-day processing
- **W01-L2-044** Handle Convener Seat Surrender — Surrender to state counselling system, compliance record

#### M02 — People & Identity Registry (7 sub-workflows)
- **W01-L2-045** Create Person Record for Student — Aadhaar-based dedup, UUID, status=Active
- **W01-L2-046** Create Student Identity Record — Link to Person, lifecycle=Onboarding, generate student_id
- **W01-L2-047** Generate Roll Number — Scheme from Tenant Config (e.g., 23A51A0501), uniqueness validated
- **W01-L2-048** Transition Student Lifecycle to Active — Validate all prerequisites met, Onboarding → Active
- **W01-L2-049** Create Parent Record — Phone-based dedup (sibling scenario), create Person+Parent
- **W01-L2-050** Establish Parent-Student Linkage — ParentStudentLink with notification preferences
- **W01-L2-051** Receive and Vault Verified Documents — Store in M02 vault, DigiLocker pull if consented

#### M03 — Academics (4 sub-workflows)
- **W01-L2-052** Assign Section to New Student — AI balances section sizes, lateral → Year 2 section
- **W01-L2-053** Register Courses for New Student — Curriculum lookup, lab batches, bridge courses for lateral
- **W01-L2-054** Map Timetable to Student — Theory from section timetable, labs from lab batch, push to Juvi
- **W01-L2-055** Apply Lateral Entry Credit Mapping — Sem 1-2 credits by equivalence, identify bridge courses

#### M04 — Finance & Fees (5 sub-workflows)
- **W01-L2-056** Read Fee Structure for Offer — Component rules: tuition, hostel, transport, lab, library, exam
- **W01-L2-057** Create First Semester Invoice — Line items, scholarship allocation, concession, net payable
- **W01-L2-058** Create Fee Agreement for Negotiated Fees — Waiver terms, payment plan, approval authority
- **W01-L2-059** Verify and Initialize Scholarship Eligibility — TS-EPass/SC/ST/OBC/Merit, allocate to invoice
- **W01-L2-060** Record First Payment Transaction — Gateway confirmation, receipt, invoice update

#### M08 — Campus Operations (3 sub-workflows)
- **W01-L2-061** Activate Mess Subscription — Monthly or coupon, dietary preference, mess fee to M04
- **W01-L2-062** Create Library Membership — Borrow limit, digital access, Koha/SOUL sync if needed
- **W01-L2-063** Provision Lab Access — Per-lab access records, electronic access control

#### M10/M11 — Compliance & Governance (2 sub-workflows)
- **W01-L2-064** Feed Intake Data as Compliance Evidence — Category-wise distribution, fill rate as NAAC/AICTE evidence
- **W01-L2-065** Update Fill Rate and Conversion Dashboards — Real-time funnel metrics, AI demand signals

#### M12 — Juvion Platform (6 sub-workflows)
- **W01-L2-066** Provision Student User Account — Roll number as username, OTP first login
- **W01-L2-067** Assign Student RBAC Role — Base Student role + attribute-based variants (hosteler, transport)
- **W01-L2-068** Execute Admission Notification Sequence — Stage-based (offer/accepted/enrolled), multi-channel, language preference
- **W01-L2-069** Orchestrate EAMCET Integration Pull — Portal API, retry/circuit-breaker, transform to M01 format
- **W01-L2-070** Orchestrate Payment Gateway Integration — Razorpay/CCAvenue, webhook validation
- **W01-L2-071** Execute AG-01 Admissions Agent Functions — Lead scoring, eligibility check, OCR, fee negotiation, yield prediction

#### Juvi — Student App (5 sub-workflows)
- **W01-L2-072** Provision Juvi Account — Profile, onboarding checklist, app download link
- **W01-L2-073** Auto-Subscribe Student to Channels — Mandatory channels: college, department, batch, section, hosteler
- **W01-L2-074** Configure First-Launch Home Experience — Welcome hero, tour, schedule, checklist widget
- **W01-L2-075** Execute AI Companion Introduction — Capabilities overview, first briefing, interactive prompts
- **W01-L2-076** Push Onboarding Notices — Code of conduct (ack required), profile completion, orientation schedule

---

## W02: Academic Year Delivery

| Field | Value |
|-------|-------|
| **Trigger** | Academic calendar declared |
| **Resolution** | Annual results finalised, promotions/detentions decided, CO-PO computed |
| **Primary Module** | M03 Academics |
| **Modules Crossed** | M03 → M02 → M05 → M10 → M11 → M04 |
| **Personas** | Faculty, Student, Staff, Leadership, Parent |
| **AI Role** | Timetable optimisation, attendance alerts, mark anomaly detection, grade auto-calc, CO-PO mapping |

### Phases (54 L2 Sub-Workflows)

#### M03.1 CURR — Curriculum Instantiation (1)
- **W02-L2-001** Instantiate Semester Curriculum — Activate courses for programme/regulation/semester, verify prerequisites

#### M03.2 SCHED — Academic Calendar & Scheduling (6)
- **W02-L2-002** Declare & Adopt Academic Calendar — JNTU calendar → institutional calendar, Dean drafts, Principal approves
- **W02-L2-003** Generate Semester Timetable — AI generates clash-free draft, HOD reviews, Dean approves, rooms allocated
- **W02-L2-004** Assign Faculty to Courses — HOD drafts, confirmed, M05 workload updated
- **W02-L2-005** Form Sections and Lab Batches — Student list from M02, section formation, lab batches (20-25)
- **W02-L2-006** Handle Mid-Semester Timetable Change — Faculty leave or room unavailable, substitution arranged
- **W02-L2-007** Select Elective Courses — Students select, AI optimizes allocation, registration created

#### M03.3 ATT — Attendance Management (5)
- **W02-L2-008** Capture Daily Attendance — Faculty marks P/A/OD/Medical per slot, summary updated
- **W02-L2-009** Monitor Attendance Threshold — AI forecasts %, classifies Safe/Warning/At-Risk, multi-channel alerts
- **W02-L2-010** Route Attendance Risk to Welfare — Compound risk score (academic + financial + hostel), routes to M06
- **W02-L2-011** Process Attendance Condonation — Student submits request, routed by type, linked to hall ticket eligibility
- **W02-L2-012** Notify Parent of Attendance — Alert triggers rule, WhatsApp dispatch, delivery tracked

#### M03.4 TEACH — Teaching & Course Delivery (5)
- **W02-L2-013** Instantiate Course for Semester — Course Instance + Roster + Juvi channel, CO mappings inherited
- **W02-L2-014** Deliver Course Content — Materials uploaded, syllabus progress tracked, published to Juvi
- *(W02-L2-015 through W02-L2-017 — Internal Assessments, Assignment Grading, Question Papers)*

#### M03.5 EXAM — Examination Management (8+)
- Exam scheduling, hall ticket generation, seating arrangement
- Mark entry, moderation, result computation
- Grade card generation, backlog management

#### M03.6 OBE — Outcome-Based Education (4+)
- CO-PO mapping, attainment computation
- Programme outcome analysis

#### Cross-module interactions
- **M02**: Student state updated (promoted/detained/graduated), academic history appended
- **M04**: Exam fees collected per semester
- **M05**: Faculty workload allocated, substitution managed
- **M10**: CO-PO attainment, pass rates, faculty ratios as NAAC/NBA evidence
- **M11**: Programme health dashboards, academic performance trends

---

## W03: Fee Lifecycle & Revenue Assurance

| Field | Value |
|-------|-------|
| **Trigger** | Fee structure approved |
| **Resolution** | All fees collected/waived/escalated, revenue reconciled |
| **Primary Module** | M04 Finance |
| **Modules Crossed** | M04 → M02 → M01 → M06 → M11 → M12 → Juvi |
| **Personas** | Staff (accounts), Student, Parent, Leadership, External |
| **AI Role** | Default prediction, escalating reminders, duplicate detection, scholarship auto-processing |

### Key Interactions
- **M01**: Fee negotiation data for management quota carried forward
- **M02**: Student demographics & scholarship eligibility read
- **M06**: Financial hardship signal — welfare check before punitive action
- **M11**: Revenue velocity dashboards, defaulter trends, collection analytics
- **M12**: Payment gateway, automated reminder sequences (SMS → WhatsApp → staff)
- **Juvi**: Fee reminders, payment confirmations, scholarship credit notifications

---

## W04: Placement Season Execution

| Field | Value |
|-------|-------|
| **Trigger** | Season opens (Aug), TPO outreach begins |
| **Resolution** | All eligible students placed/opted out/off-campus. Stats finalised. |
| **Primary Module** | M07 Placement |
| **Modules Crossed** | M07 → M03 → M02 → M09 → M06 → M11 → Juvi |
| **Personas** | Staff (TPO), Student, Faculty, Leadership, External (recruiters), Parent |
| **AI Role** | Company scoring, student-JD semantic matching, readiness prediction, interview prep |

### Key Interactions
- **M02**: Student profiles & documents for eligibility and portfolio
- **M03**: CGPA, backlog status, transcripts for company eligibility filters
- **M06**: Career counselling for unplaced, mental health support during placement pressure
- **M09**: Co-curricular portfolios fed into career profiles
- **M11**: Placement rate dashboards, salary trends
- **Juvi**: Announcements, interview schedules, offer notifications, career profile view

---

## W05: Employee Lifecycle Management

| Field | Value |
|-------|-------|
| **Trigger** | Hiring requisition approved |
| **Resolution** | Employee exited, settlement processed, access revoked |
| **Primary Module** | M05 HR |
| **Modules Crossed** | M05 → M02 → M03 → M10 → M09 → M12 |
| **Personas** | Faculty, Staff (HR), Leadership |
| **AI Role** | App screening, workload optimisation, leave auto-approval, appraisal summaries, attrition prediction |

### Key Interactions
- **M02**: Employee identity created, qualifications stored, lifecycle state managed
- **M03**: Faculty course assignments & teaching workload
- **M09**: Faculty-specific club advisor roles linked
- **M10**: Faculty qualifications, FDP hours, student-faculty ratios as evidence
- **M12**: Account provisioned/deprovisioned, AI routine leave auto-approval

---

## W06: Student Welfare & Crisis Response

| Field | Value |
|-------|-------|
| **Trigger** | Grievance filed / AI detects risk signal |
| **Resolution** | Concern resolved, documented, pattern logged |
| **Primary Module** | M06 Welfare |
| **Modules Crossed** | M06 → M03 → M04 → M02 → M08 → M10 → M11 → Juvi |
| **Personas** | Student, Faculty, Staff, Leadership, Parent (crisis) |
| **AI Role** | Sentiment analysis, cross-signal correlation, auto-triage, SLA monitoring. AI flags, humans decide. |

### Key Interactions
- **M02**: Student profile & prior concern history for triage context
- **M03**: Academic distress signals — attendance drops, failing marks, backlogs
- **M04**: Financial distress signals — fee defaults as welfare indicator
- **M08**: Hostel welfare — room conflicts, warden escalations, residential safety
- **M10**: Statutory committee records, grievance stats as NAAC evidence
- **M11**: Welfare pattern dashboards — dept-wise grievance rates, repeat cases, crisis trends
- **Juvi**: Grievance filing, anonymous reporting, mentor matching, crisis resources

---

## W07: Accreditation & Compliance Readiness

| Field | Value |
|-------|-------|
| **Trigger** | Continuous + deadline/assessment trigger |
| **Resolution** | Submission made or assessment completed, grade received |
| **Primary Module** | M10 Compliance |
| **Modules Crossed** | M10 → all operational → M11 → M12 |
| **Personas** | Leadership, Staff (IQAC), Faculty, External (assessors) |
| **AI Role** | Continuous evidence collection, auto-report generation, gap detection, deadline alerts |

### Key Interactions
- **M01**: Category-wise admissions, fill rates, process documentation
- **M02**: Faculty qualifications, student demographics, document records
- **M03**: CO-PO attainment, pass rates, curriculum structure
- **M04**: Financial statements, scholarship disbursement, fee transparency
- **M05**: FDP hours, student-faculty ratios, recruitment records
- **M06**: Grievance resolution stats, statutory committee proceedings
- **M07**: Placement statistics, employer feedback, alumni career data
- **M08**: Infrastructure — lab equipment, library holdings, hostel capacity
- **M09**: Student activity evidence — participation, fests, sports, NCC/NSS
- **M11**: Institutional metrics contextualised for compliance narratives
- **M12**: AI auto-generates reports, identifies gaps, formats into templates

---

## W08: Campus Life Operations

| Field | Value |
|-------|-------|
| **Trigger** | Enrolment (initial) + ongoing events |
| **Resolution** | Facilities managed, de-allocated at exit |
| **Primary Module** | M08 Campus Ops |
| **Modules Crossed** | M08 → M02 → M04 → M09 → M06 → M11 → M12 |
| **Personas** | Student, Staff (wardens, maintenance), Faculty, Leadership |
| **AI Role** | Room optimisation, transport prediction, preventive maintenance, utilisation analytics |

### Key Interactions
- **M02**: Student/faculty identity for allocation eligibility
- **M04**: Hostel/transport fees, facility charges
- **M06**: Hostel welfare — warden escalations for student distress
- **M09**: Facility bookings for events/clubs
- **M11**: Infrastructure utilisation dashboards, maintenance costs, capacity planning
- **M12**: AI room allocation, transport demand prediction, preventive maintenance scheduling

---

## W09: Student Enrichment & Development

| Field | Value |
|-------|-------|
| **Trigger** | Year start / event initiated / student joins |
| **Resolution** | Portfolios built, events executed, evidence documented |
| **Primary Module** | M09 Student Dev |
| **Modules Crossed** | M09 → M08 → M07 → M10 → M02 → M04 → Juvi |
| **Personas** | Student, Faculty (advisors), Staff, Leadership |
| **AI Role** | Activity recommendations, participation tracking, auto-portfolio, event proposal generation |

### Key Interactions
- **M02**: Student achievements & participation linked to identity
- **M04**: Event budgets, sponsorship tracking, club fund management
- **M07**: Co-curricular portfolios fed as placement differentiators
- **M08**: Facility booking, logistics for fests, venue allocation
- **M10**: Activity evidence — participation rates, achievements as NAAC criteria
- **Juvi**: Club channels, event posts, sign-ups, achievement sharing, AI activity recommendations

---

## W10: Student Exit & Transition

| Field | Value |
|-------|-------|
| **Trigger** | Graduation / dropout / transfer triggered |
| **Resolution** | Clean exit: dues cleared, docs issued, alumni onboarded or archived |
| **Primary Module** | M02 People |
| **Modules Crossed** | M02 → M04 → M08 → M03 → M07 → M06 → Juvi |
| **Personas** | Student, Staff (registrar, accounts), Faculty, Leadership, Parent |
| **AI Role** | Parallel clearance orchestration, dropout warning, auto-doc generation, alumni onboarding |

### Key Interactions
- **M02**: Lifecycle → Graduated/Exited/Alumni, records sealed, documents issued (degree, TC, transcripts)
- **M03**: Final academic records consolidated, transcript, degree eligibility verified
- **M04**: Financial clearance — pending dues, refunds, no-dues confirmed
- **M06**: Dropouts — exit interview, welfare follow-up. Discipline — expulsion closure
- **M07**: Graduates — alumni career tracking, alumni network onboarding
- **M08**: Hostel de-allocated, transport removed, library clearance, lab returns, ID deactivated
- **M11**: Attrition dashboards, dropout analysis, graduation rate trends
- **M12/Juvi**: Account transition to alumni channel (graduates) or deactivated

---

## Module Reference

| Code | Module | Description |
|------|--------|-------------|
| M01 | Admissions & Enrolment | Lead capture, application processing, seat allotment, offers, enrolment |
| M02 | People & Identity Registry | Person/Student/Faculty/Staff/Parent identity, documents, lifecycle |
| M03 | Academics | Curriculum, scheduling, attendance, teaching, exams, OBE |
| M04 | Finance & Fees | Fee structures, billing, collection, scholarships, reconciliation |
| M05 | People Ops (HR) | Recruitment, leave, payroll, appraisals, FDP, separation |
| M06 | Student Welfare & Support | Grievances, counselling, statutory committees, crisis response |
| M07 | Placement & Career Services | Companies, drives, matching, offers, alumni tracking |
| M08 | Campus Operations | Hostel, transport, library, labs, facilities, maintenance |
| M09 | Student Dev & Engagement | Clubs, events, sports, NCC/NSS, portfolios |
| M10 | Compliance & Accreditation | NAAC, NBA, AICTE, evidence collection, report generation |
| M11 | Governance & Inst. Intelligence | Dashboards, analytics, institutional metrics |
| M12 | Juvion Platform | Auth, RBAC, notifications, integrations, AI engine |
| Juvi | Student & Faculty App | Mobile app — spaces, home, companion, notices, academics |

---

## AI Autonomy Levels

Across all workflows, AI operates at these levels:

1. **Autonomous** — AI acts without human approval (e.g., lead scoring, attendance alerts, dedup ≥80%, fee waiver ≤₹50K)
2. **Flags for Review** — AI performs analysis and flags edge cases for human decision (e.g., dedup <80%, document OCR <90% confidence, eligibility borderline)
3. **Assists** — AI prepares data/recommendations, human executes (e.g., merit list review, fee negotiation >₹50K, fraud investigation)
4. **N/A** — Pure human judgment required (e.g., physical document verification, Leadership approval, disciplinary decisions)

---

## Persona Reference

| Code | Persona | Description |
|------|---------|-------------|
| S1-S4 | Student | Freshmen through final year |
| S5 | Hosteler Student | Student with hostel allocation |
| P5 | Parent | Parent/Guardian with notification preferences |
| F1 | Faculty | Teaching faculty |
| F2 | HOD | Head of Department |
| F3 | Dean | Dean of academics |
| F4 | Lab Instructor | Lab teaching staff |
| ST1 | Admissions Staff | Admissions office staff |
| ST2 | Accounts Staff | Finance/accounts staff |
| ST5 | Welfare Officer | Student welfare staff |
| ST6 | Warden/Transport | Hostel warden, transport coordinator |
| ST7 | Admin | System administrator |
| ST8 | Registrar | Academic registrar |
| P4 | Principal | Institutional head |
| P4-a | Vice Principal | Deputy head |
| AG-01 | AI Admissions Agent | AI agent for M01 functions |
| AG-05 | AI Welfare Agent | AI agent for M06 functions |
| AG-08 | AI Companion | Juvi AI companion for students |
| E3 | External (EAMCET/ECET) | State counselling systems |
| E5 | External (Payment Gateway) | Razorpay, CCAvenue |
