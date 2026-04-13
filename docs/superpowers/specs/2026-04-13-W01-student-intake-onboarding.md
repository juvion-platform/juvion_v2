# W01 -- Student Intake & Onboarding: Implementation Spec

**Status**: DRAFT | April 2026
**Workflow**: W01 -- Student Intake & Onboarding
**Sub-workflows**: 76 across 9 modules
**Source**: `docs/v2/W01_L2_Workflow_Decomposition_Full.xlsx`

---

## 1. Executive Summary

W01 is the most complex workflow in Juvion v2, orchestrating the entire student intake lifecycle from initial lead enquiry through to a fully onboarded, academically active student. It spans **76 sub-workflows** across **9 modules**:

| Module | Sub-domain(s) | Count | ID Range |
|--------|---------------|-------|----------|
| M01.1 | LEAD | 9 | W01-L2-001 to 009 |
| M01.2 | APP | 14 | W01-L2-010 to 023 |
| M01.3 | SEAT | 6 | W01-L2-024 to 029 |
| M01.4 | OFFER | 6 | W01-L2-030 to 035 |
| M01.5 | ENROL | 5 | W01-L2-036 to 040 |
| M01.6 | CANCEL | 4 | W01-L2-041 to 044 |
| M02 | PCORE, STUID, PARENT, VAULT | 7 | W01-L2-045 to 051 |
| M03 | CURR, SCHED | 4 | W01-L2-052 to 055 |
| M04 | FEECONF, BILLING, COLLECT, SCHCON | 5 | W01-L2-056 to 060 |
| M08 | MESS, LIBRARY, LABS | 3 | W01-L2-061 to 063 |
| M10 | EVID | 1 | W01-L2-064 |
| M11 | DASH | 1 | W01-L2-065 |
| M12 | IAC, COMMS, AI, INTG | 6 | W01-L2-066 to 071 |
| Juvi | LIFECYCLE, SPACE, HOME, COMPANION, NOTICE | 5 | W01-L2-072 to 076 |

### Admission Pathways

W01 supports three distinct pathways, each with variations in the pipeline:

- **Management Quota (15 pathway-specific + 42 shared = 57)**: Full pipeline from lead capture through fee negotiation. College-driven allotment via merit lists and allotment rounds.
- **Convener Quota (6 pathway-specific + 42 shared = 48)**: State-driven EAMCET/ECET allotment. Students report to college; application is auto-created from import. No lead capture or fee negotiation.
- **Lateral Entry (2 pathway-specific + 42 shared = 44)**: ECET-based entry at Year 2. Requires credit mapping from diploma to degree programme. Can enter via either convener or management pathway.

### AI Autonomy Distribution

| Category | Count | Examples |
|----------|-------|---------|
| Fully Autonomous | 45 | Lead scoring, OCR >= 90%, notifications, provisioning, dashboards |
| Autonomous with Flags | 18 | Dedup < 80%, OCR < 90%, edge cases, capacity issues, unmapped items |
| Human Decision Required | 13 | Fraud investigation, > Rs.50K waivers, late admission, cancellation approval |

---

## 2. Current Codebase State

### 2.1 Workflow Engine (COMPLETE)

The shared workflow engine at `backend/src/shared/workflow/` is fully functional:

- **`WorkflowDefinition.ts`**: Type system for phases, steps, transitions, guards. Registry with versioning.
- **`WorkflowEngine.ts`**: State machine with `startWorkflow`, `completeTask`, `triggerWorkflowStep`, `failTask`, `skipTask`. Supports parallel groups, guard evaluation, event emission.
- **`StepHandlers.ts`**: Handler registry pattern. Per-workflow, per-step handler registration.
- **`definitions/W01.ts`**: W01 definition with 6 phases, 26 steps (aggregated from the 76 sub-workflows), transitions with guards.

### 2.2 W01 Definition (COMPLETE)

The W01 state machine in `backend/src/shared/workflow/definitions/W01.ts` defines:

| Phase | ID | Steps | Status |
|-------|----|-------|--------|
| Lead Capture & Enquiry | M01.1_LEAD | lead_capture, lead_score, lead_dedup, lead_nurture, lead_convert | Complete |
| Application Processing | M01.2_APP | app_submit, doc_collection, doc_ocr, doc_review, eligibility_check, eligibility_review | Complete |
| Seat Inventory & Allotment | M01.3_SEAT | seat_check, merit_rank, allotment | Complete |
| Offer & Fee Negotiation | M01.4_OFFER | offer_generate, fee_negotiation, offer_acceptance | Complete |
| Enrolment & Provisioning | M01.5_ENROL | enrol_execute (parallel_group), provision_m02, provision_m03, provision_m04, provision_m08, provision_m12, provision_juvi, onboarding_complete | Complete |
| Cancellation & Recovery | M01.6_CANCEL | cancel_request, cancel_execute (parallel_group), cancel_m02, cancel_m04, cancel_m08, cancel_m12, cancel_juvi | Complete |

Guards implemented: `has_flagged_documents`, `all_documents_verified`, `is_edge_case`, `is_eligible`, `negotiation_requested`, `no_negotiation`.

### 2.3 Admissions Models (15 -- ALL EXIST)

| Model | File | W01 Enhanced? | Status |
|-------|------|---------------|--------|
| Inquiry | `models/admissions/Inquiry.ts` | Yes -- leadGrade, tags, interactionCount, workflowInstanceId | Complete |
| Applicant | `models/admissions/Applicant.ts` | Yes -- admissionType, eligibilityStatus, meritScore, workflowInstanceId | Complete |
| EntranceExamScore | `models/admissions/EntranceExamScore.ts` | Minimal | Complete |
| CounselingAllotment | `models/admissions/CounselingAllotment.ts` | Minimal | Complete |
| AdmissionOffer | `models/admissions/AdmissionOffer.ts` | Yes -- negotiatedFee, waiverAmount, offerLetterUrl, remindersSent | Complete |
| DocumentChecklist | `models/admissions/DocumentChecklist.ts` | Yes -- ocrStatus, ocrConfidence per doc, fraudFlagged, deficiencyDeadline | Complete |
| Admission | `models/admissions/Admission.ts` | Yes -- provisioningStatus, provisioning tracker per module | Complete |
| LeadInteraction | `models/admissions/LeadInteraction.ts` | New for W01 -- type, direction, channel, aiGenerated | Complete |
| LeadImportBatch | `models/admissions/LeadImportBatch.ts` | New for W01 | Complete |
| SeatInventory | `models/admissions/SeatInventory.ts` | New for W01 -- quota-wise split with auto-computed fills | Complete |
| AllotmentRound | `models/admissions/AllotmentRound.ts` | New for W01 -- criteria, dates, stats | Complete |
| AllotmentResult | `models/admissions/AllotmentResult.ts` | New for W01 -- meritRank, preferenceNumber, acceptance tracking | Complete |
| Waitlist | `models/admissions/Waitlist.ts` | New for W01 -- position, promotion tracking | Complete |
| FeeNegotiation | `models/admissions/FeeNegotiation.ts` | New for W01 -- AI threshold logic, escalation levels | Complete |
| AdmissionCancellation | `models/admissions/AdmissionCancellation.ts` | New for W01 -- reversal tracking per module, refund status | Complete |

### 2.4 Workflow Step Handlers (COMPLETE for M01 core)

File: `backend/src/modules/admissions/workflow.handlers.ts`

All 26 W01 step handlers are registered. Handlers cover the complete M01 pipeline from `lead_capture` through `onboarding_complete` and `cancel_*` steps. The handlers:

- Perform real CRUD operations on Inquiry, Applicant, DocumentChecklist, SeatInventory, AllotmentResult, Waitlist, FeeNegotiation, AdmissionOffer, Admission, AdmissionCancellation
- Cross-module provisioning handlers create Person, Student, Parent, Section enrollment, Invoice, HostelAllocation, TransportAllocation, LibraryMember, User records
- Juvi provisioning creates JuviConversation records
- Cancellation handlers perform module-level reversals

### 2.5 Services and Routes (COMPLETE)

**Core CRUD service** (`service.ts`): Full CRUD for Inquiry, Applicant, ExamScore, CounselingAllotment, Offer, DocumentChecklist, Admission. Includes `convertInquiryToApplicant`.

**Workflow service** (`workflow.service.ts`): LeadInteraction, ImportBatch, SeatInventory, AllotmentRound, AllotmentResult, Waitlist, FeeNegotiation (with AI auto-approve logic at Rs.50K threshold), Cancellation, workflow task queries, dashboard stats.

**Routes**: Two route files mounted:
- `/api/admissions/` -- Core CRUD routes (60 lines)
- `/api/admissions/workflow/` -- Workflow engine + all W01-specific routes (71 lines)

### 2.6 Cross-Module Models Referenced by Handlers

| Module | Model | Exists? | Used in W01 Handler? |
|--------|-------|---------|----------------------|
| M02 | Person | Yes | Yes -- provision_m02 |
| M02 | Student | Yes | Yes -- provision_m02 |
| M02 | Parent | Yes | Yes -- provision_m02 |
| M03 | Section | Yes | Yes -- provision_m03 |
| M03 | CourseOffering | Yes | Yes -- provision_m03 |
| M03 | CurriculumMap | Yes | Yes -- provision_m03 |
| M03 | Enrollment | Yes | Yes -- provision_m03 |
| M04 | Invoice | Yes | Yes -- provision_m04 |
| M04 | FeeStructure | Yes | Yes -- provision_m04 |
| M04 | StudentFeeAccount | Yes | Yes -- provision_m04 |
| M08/Welfare | HostelAllocation | Yes | Yes -- provision_m08 |
| M08/Welfare | HostelBlock | Yes | Referenced |
| M08/Welfare | HostelRoom | Yes | Referenced |
| M08/Welfare | TransportAllocation | Yes | Yes -- provision_m08 |
| M08/Welfare | TransportRoute | Yes | Referenced |
| M08/Library | LibraryMember | Yes | Yes -- provision_m08 |
| M12 | User | Yes | Yes -- provision_m12 |
| Juvi | JuviConversation | Yes | Yes -- provision_juvi |
| Juvi | JuviMessage | Yes | Referenced |
| Juvi | JuviPersonaConfig | Yes | Referenced |
| Juvi | JuviAction | Yes | Referenced |
| Workflow | WorkflowInstance | Yes | Core engine |
| Workflow | WorkflowTask | Yes | Core engine |

---

## 3. Sub-Workflow Catalog

### 3.1 M01.1 LEAD -- Lead Capture & Enquiry (9 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-001 | Capture Walk-in Enquiry | Student/parent arrives at office | Enquiry created with lead score; nurture initiated | Inquiry (C), LeadInteraction (C) | Auto: scoring, dedup >= 80%, nurture. Flags: dedup < 80%, high-value | **Exists** -- `lead_capture` handler |
| W01-L2-002 | Capture Web Form Enquiry | Web form submission via M12.4 | Enquiry created; AI follow-up initiated | Inquiry (C) | Autonomous: validation, scoring, dedup, ack | **Exists** -- `lead_capture` handler |
| W01-L2-003 | Capture WhatsApp Enquiry | WhatsApp message from unknown contact | Enquiry created; AI nurtures or escalates | Inquiry (C) | Auto: conversation, extraction, language detection | **Partial** -- handler exists; WhatsApp integration (M12.4) not yet connected |
| W01-L2-004 | Import EAMCET Allotment List | EAMCET counselling round publishes | Applications auto-created for allotted students | Applicant (C), DocumentChecklist (C), SeatInventory (U) | Autonomous: parsing, creation, deadline calc | **Partial** -- LeadImportBatch model exists; EAMCET portal integration missing |
| W01-L2-005 | Import ECET Allotment List | ECET publishes lateral entry allotment | Lateral applications auto-created at Year 2 | Applicant (C), DocumentChecklist (C), SeatInventory (U) | Autonomous: same as EAMCET | **Partial** -- same infrastructure as 004 |
| W01-L2-006 | Qualify and Score Lead | Enquiry created from any channel | Lead classified Hot/Warm/Cold with score | Inquiry (U) | Autonomous: scoring, classification, queue assignment | **Exists** -- `lead_score` handler with `deriveLeadGrade()` |
| W01-L2-007 | Nurture Lead via AI Conversation | Lead classified Warm/Cold | Lead converts OR marked Dormant | Inquiry (U), LeadInteraction (C) | Auto: messaging, response handling | **Exists** -- `lead_nurture` handler creates LeadInteraction |
| W01-L2-008 | Deduplicate and Merge Leads | New enquiry matches existing profile | Single profile with linked enquiries | Inquiry (U) | Auto: >= 80% merge. Human: < 80% decisions | **Exists** -- `lead_dedup` handler with phone/email matching |
| W01-L2-009 | Convert Lead to Application | Qualified lead decides to apply | Application created | Inquiry (U), Applicant (C), DocumentChecklist (C) | Autonomous: data transfer, checklist generation | **Exists** -- `lead_convert` handler calls `convertInquiryToApplicant` |

### 3.2 M01.2 APP -- Application Processing (14 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-010 | Submit Management Quota Application | Lead converts or direct initiation | Application status=Submitted | Applicant (C), DocumentChecklist (C) | Autonomous: validation, fee processing, checklist | **Exists** -- `app_submit` handler |
| W01-L2-011 | Record Convener Student Reporting | EAMCET-allotted student reports to college | Allotment status=Reported; doc collection begins | CounselingAllotment (U), Applicant (U) | Autonomous: notification, dashboard update | **Partial** -- CounselingAllotment model exists; no dedicated reporting handler |
| W01-L2-012 | Upload Documents (Self-Service) | Application submitted; checklist generated | All documents uploaded; ready for verification | DocumentChecklist (U) | Auto: quality check. Flags: poor quality | **Partial** -- DocumentChecklist model has per-doc tracking; no file upload endpoint |
| W01-L2-013 | Collect Physical Documents | Student arrives with originals | Originals verified; copies scanned | DocumentChecklist (U) | N/A physical verification | **Partial** -- `doc_collection` handler exists; no scan/upload flow |
| W01-L2-014 | Verify Documents via AI OCR | All documents uploaded | Verified OR discrepancies flagged | DocumentChecklist (U) | Auto: OCR, >= 90% auto-verify. Flags: < 90% | **Exists** -- `doc_ocr` handler with confidence-based flagging |
| W01-L2-015 | Review Flagged Documents | AI flags < 90% confidence | ST1 resolves: verified/corrected/deficient/rejected | DocumentChecklist (U) | N/A: human judgment | **Exists** -- `doc_review` handler with reviewOutcome processing |
| W01-L2-016 | Handle Document Deficiency | Required doc missing/failed | Deficiency communicated; deadline set | DocumentChecklist (U), Applicant (U) | Auto: notification, reminders | **Partial** -- deficiencyDeadline field exists; no reminder scheduler |
| W01-L2-017 | Flag Suspected Document Fraud | AI or ST1 detects tampering | Investigation initiated | Applicant (U), DocumentChecklist (U) | Auto: initial detection. Human: investigation | **Partial** -- fraudFlagged/fraudNotes fields exist; no investigation workflow |
| W01-L2-018 | Verify Eligibility (Standard Cases) | All documents verified | Eligible/Ineligible determined | Applicant (U) | Auto: standard rule evaluation | **Exists** -- `eligibility_check` handler with status derivation |
| W01-L2-019 | Review Eligibility Edge Cases | AI flags borderline case | ST1/Leadership final determination | Applicant (U) | N/A: human judgment. Learns from precedent | **Exists** -- `eligibility_review` handler |
| W01-L2-020 | Grant Conditional Eligibility | Pending item but meets criteria | Conditional eligibility with deadline | Applicant (U) | Auto: tracking, reminders | **Partial** -- eligibilityStatus has 'conditional' enum; no deadline tracker |
| W01-L2-021 | Verify Lateral Entry Eligibility | lateral_entry=true | Lateral eligibility for Year 2 | Applicant (U) | Auto: standard lateral rules. Flags: unmapped branch | **Partial** -- admissionType='lateral' exists; no lateral-specific rules engine |
| W01-L2-022 | Verify NRI/International Eligibility | admission_category=NRI | NRI eligibility confirmed; fee tier flagged | Applicant (U) | Auto: doc check. Flags: equivalence interpretation | **Missing** -- no NRI-specific fields or rules |
| W01-L2-023 | Verify TS-EPass Scholarship Eligibility | Reserved category indicated | Scholarship eligibility verified; flagged for M04 | Applicant (U) | Autonomous: preliminary check | **Missing** -- no scholarship eligibility model; deferred to M04 |

### 3.3 M01.3 SEAT -- Seat Inventory & Allotment (6 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-024 | Configure Seat Inventory | AICTE approval received | Seat inventory configured by programme/quota | SeatInventory (C) | Auto: validation. Human: approval | **Exists** -- `upsertSeatInventory` service + API |
| W01-L2-025 | Receive Convener Allotment | EAMCET round publishes (via 004) | Seat inventory updated; reporting tracking | SeatInventory (U) | Autonomous: inventory updates, dashboard | **Partial** -- SeatInventory fill tracking exists; no auto-update from import |
| W01-L2-026 | Track Convener Reporting and Slides | Reporting deadline approaches | Reported proceed; non-reporters lapse; seats slide | CounselingAllotment (U), SeatInventory (U) | Auto: tracking, notifications, lapse | **Missing** -- no deadline monitoring or auto-lapse logic |
| W01-L2-027 | Generate Management Merit List | Sufficient eligible apps; ST1 initiates | Ranked merit list published | AllotmentRound (C), Applicant (R) | Auto: ranking algorithm, notification | **Partial** -- AllotmentRound model exists; no automated ranking algorithm |
| W01-L2-028 | Execute Management Allotment Round | Merit list published; ST1 initiates | Seats allotted; waitlist generated | AllotmentResult (C), SeatInventory (U) | Auto: allotment algorithm. Human: publication | **Partial** -- AllotmentResult CRUD exists; no allotment algorithm |
| W01-L2-029 | Manage Waitlist and Auto-Promotion | Seat becomes available | Next waitlisted promoted and offered | Waitlist (U), AllotmentResult (C) | Autonomous: auto-promotion | **Partial** -- Waitlist model exists; no event-driven auto-promotion |

### 3.4 M01.4 OFFER -- Offer & Fee Negotiation (6 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-030 | Generate Admission Offer | Student allotted seat | Offer created with fee details; delivered | AdmissionOffer (C) | Autonomous: fee application, PDF, delivery | **Partial** -- `offer_generate` handler; no PDF gen or delivery |
| W01-L2-031 | Conduct Fee Negotiation | Parent initiates (management quota) | Negotiation concluded | FeeNegotiation (C), AdmissionOffer (U) | Auto: <= Rs.50K authority | **Exists** -- `createFeeNegotiation` with AI auto-approve threshold |
| W01-L2-032 | Escalate Fee Negotiation to Leadership | Waiver > Rs.50K or strategic | Leadership approves/rejects | FeeNegotiation (U) | Auto: packet prep. Human: decisions > Rs.50K | **Exists** -- escalation status + `resolveFeeNegotiation` |
| W01-L2-033 | Record Offer Rejection | Student declines | Offer closed; seat released; waitlist triggered | AdmissionOffer (U), SeatInventory (U) | Autonomous: processing, seat release, waitlist | **Partial** -- Offer status tracking; no auto seat-release chain |
| W01-L2-034 | Handle Offer Expiry | Acceptance deadline passes | Offer expired; seat released; waitlist triggered | AdmissionOffer (U), SeatInventory (U) | Auto: tracking, reminders, expiry processing | **Missing** -- no deadline monitor or auto-expiry job |
| W01-L2-035 | Accept Offer and Confirm Payment | Student accepts and pays | Offer accepted; triggers enrolment | AdmissionOffer (U), Payment (C via M04) | Autonomous: acceptance, payment, enrolment trigger | **Partial** -- `offer_acceptance` handler; no payment gateway integration |

### 3.5 M01.5 ENROL -- Enrolment & Handoff (5 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-036 | Execute Enrolment Transaction | Offer accepted + payment confirmed | Student fully enrolled; all downstream provisioned | Admission (C), + many cross-module | Auto: full parallel provisioning | **Exists** -- `enrol_execute` parallel_group with 6 provisioning handlers |
| W01-L2-037 | Handle Late Admission | Request after deadline | Approved/rejected | Applicant (C), Admission (C) | Auto: eligibility pre-check. Human: all approvals | **Missing** -- no late admission flow |
| W01-L2-038 | Allocate Hostel Room | is_hosteler=true during enrolment | Room allocated or waitlisted | HostelAllocation (C), HostelRoom (U) | Auto: allocation algorithm. Flags: capacity | **Exists** -- provision_m08 handler creates HostelAllocation |
| W01-L2-039 | Assign Transport Route | Transport required during enrolment | Route and stop assigned | TransportAllocation (C) | Auto: route matching | **Exists** -- provision_m08 handler creates TransportAllocation |
| W01-L2-040 | Complete Juvi Onboarding | Juvi account provisioned | First session complete; AI companion intro done | JuviConversation (C) | Autonomous: entire onboarding | **Partial** -- provision_juvi creates conversation; no app tour logic |

### 3.6 M01.6 CANCEL -- Cancellation & Recovery (4 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-041 | Process Enrolment Cancellation | Enrolled student requests withdrawal | Cancelled; systems reversed; refund; seat released | AdmissionCancellation (C), Student (U), multiple reversals | Auto: refund calc, reversals, waitlist. Human: confirmation | **Exists** -- `cancel_request` + `cancel_execute` handlers with parallel reversals |
| W01-L2-042 | Process Pre-Enrolment Cancellation | Withdrawal after payment, before enrolment | Offer cancelled; full refund; seat released | AdmissionOffer (U), AdmissionCancellation (C) | Autonomous: full processing | **Partial** -- cancellation model supports pre_enrolment type; simplified flow not distinct |
| W01-L2-043 | Execute Spot Admission Round | Unfilled seats; Leadership approves | Spot round completed; fill rate improved | AllotmentRound (C), Applicant (C), Admission (C) | Auto: fast-track processing. Human: round approval | **Missing** -- no spot round workflow |
| W01-L2-044 | Handle Convener Seat Surrender | Convener student cancels; internal fill impossible | Seat surrendered to state counselling | SeatInventory (U), AdmissionCancellation (U) | Auto: report generation. Human: state submission | **Missing** -- no surrender report or state integration |

### 3.7 M02 -- People & Identity Registry (7 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-045 | Create Person Record for Student | M01.5 ENROL passes enrolled data | Person record with unique person_id | Person (C) | Auto: validation, dedup, creation | **Exists** -- provision_m02 handler creates Person |
| W01-L2-046 | Create Student Identity Record | Person created; admission attributes passed | Student linked to Person; lifecycle=Onboarding | Student (C) | Autonomous: creation, attribute mapping | **Exists** -- provision_m02 handler creates Student |
| W01-L2-047 | Generate Roll Number | Student created; roll number requested | Roll number assigned per scheme | Student (U) | Autonomous: sequence gen, uniqueness | **Partial** -- handler sets rollNumber; no configurable scheme from M12.5 |
| W01-L2-048 | Transition Student Lifecycle to Active | All onboarding complete | lifecycle_state=Active | Student (U) | Autonomous: prerequisite validation, transition | **Partial** -- Student has status enum but no explicit prerequisite-check transition |
| W01-L2-049 | Create Parent Record | M01.5 passes parent/guardian data | Parent as Person with Parent role | Person (C), Parent (C) | Autonomous: dedup, creation | **Exists** -- provision_m02 handler creates Person + Parent |
| W01-L2-050 | Establish Parent-Student Linkage | Parent + Student created | ParentStudentLink with notification prefs | Parent (U: linkedStudents) | Autonomous: link, default prefs | **Partial** -- Parent.linkedStudents exists; no notification preference model |
| W01-L2-051 | Receive and Vault Verified Documents | M01.5 signals complete | Admission docs stored in vault | Document (C: multiple) | Autonomous: transfer, DigiLocker pull | **Missing** -- no Document vault model separate from DocumentChecklist |

### 3.8 M03 -- Academics (4 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-052 | Assign Section to New Student | M01.5 passes programme/branch/year | Student assigned to section | Section (U), Student (U via M02) | Autonomous: assignment, balancing | **Partial** -- provision_m03 handler assigns section; no balancing algorithm |
| W01-L2-053 | Register Courses for New Student | Section assigned; courses requested | Student registered for semester 1 (or 3 lateral) | Enrollment (C), CourseOffering (R) | Autonomous: curriculum lookup, roster | **Partial** -- provision_m03 handler enrolls; basic implementation |
| W01-L2-054 | Map Timetable to Student | Section assigned; courses registered | Personalized timetable viewable in Juvi | Timetable (R), TimetableSlot (R) | Autonomous: timetable mapping, Juvi push | **Missing** -- no timetable push to Juvi |
| W01-L2-055 | Apply Lateral Entry Credit Mapping | is_lateral_entry=true | Credit equivalences applied; bridge courses identified | CurriculumMap (R) | Auto: standard mapping. Flags: unmapped | **Missing** -- no LateralEntryCreditMapping model or logic |

### 3.9 M04 -- Finance & Fees (5 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-056 | Read Fee Structure for Offer | M01.4 requests fee structure | Fee components and amounts returned | FeeStructure (R), FeeLineItem (R) | Autonomous: rule evaluation | **Partial** -- FeeStructure model exists; no rule-based component evaluation |
| W01-L2-057 | Create First Semester Invoice | M01.5 signals; fee finalized | Invoice generated with all components | Invoice (C), FeeLineItem (C) | Autonomous: generation, allocation | **Partial** -- provision_m04 handler creates Invoice; basic implementation |
| W01-L2-058 | Create Fee Agreement for Negotiated Fees | Offer finalized with negotiation | Fee Agreement recorded for future invoices | FeeStructure (C), Concession (C) | Autonomous: creation | **Missing** -- no FeeAgreement model; Concession model exists but not connected |
| W01-L2-059 | Verify and Initialize Scholarship Eligibility | scholarship_eligible flag from eligibility | Scholarship Eligibility created | ScholarshipAllocation (C), Invoice (U) | Autonomous: eligibility creation | **Partial** -- ScholarshipAllocation model exists; no auto-init from W01 |
| W01-L2-060 | Record First Payment Transaction | Gateway confirms payment | Transaction recorded; receipt issued | Payment (C), Invoice (U) | Autonomous: recording, receipt gen | **Partial** -- Payment model exists; no gateway webhook handling |

### 3.10 M08 -- Campus Operations (3 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-061 | Activate Mess Subscription | Hostel allocation completed (038) | Mess subscription active | MessMenu (R), MessFeedback model exists | Autonomous: creation, fee trigger | **Missing** -- no MessSubscription model |
| W01-L2-062 | Create Library Membership | M01.5 signals enrollment complete | Library membership active | LibraryMember (C) | Autonomous: creation, notification | **Exists** -- provision_m08 handler creates LibraryMember |
| W01-L2-063 | Provision Lab Access | Course registration identifies lab courses | Lab access provisioned | Lab (R) | Autonomous: access provisioning | **Missing** -- no LabAccess model; Lab model exists as facility only |

### 3.11 M10 -- Compliance (1 sub-workflow)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-064 | Feed Intake Data as Compliance Evidence | Admission cycle ends (batch trigger) | Intake evidence collected and quality-scored | Evidence Record (C) | Autonomous: data pull, evidence creation | **Missing** -- no Evidence model or M10 compliance module |

### 3.12 M11 -- Governance (1 sub-workflow)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-065 | Update Fill Rate and Conversion Dashboards | Any M01 state change (event-driven) | Leadership dashboards reflect real-time funnel | Dashboard widgets | Autonomous: computation, refresh, alerting | **Partial** -- `getWorkflowStats` in workflow.service.ts provides aggregates; no M11 dashboard module |

### 3.13 M12 -- Juvion Platform (6 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-066 | Provision Student User Account | M01.5 signals; person_id available | User account with credentials | User (C) | Autonomous: account creation, cred gen | **Exists** -- provision_m12 handler creates User with hashed password |
| W01-L2-067 | Assign Student RBAC Role | User account created (066) | Student RBAC role assigned | RoleAssignment (C) | Autonomous: role determination | **Missing** -- no RoleAssignment creation in handler; RBAC module exists separately |
| W01-L2-068 | Execute Admission Notification Sequence | Key W01 stage transitions | Notifications sent to student/parent | Notification records | Autonomous: template, dispatch, tracking | **Missing** -- no notification dispatch system in W01 handlers |
| W01-L2-069 | Orchestrate EAMCET Integration Pull | ST1 initiates import | Allotment data pulled and delivered to M01 | IntegrationExecutionLog (C) | Autonomous: connection, pull, transform | **Missing** -- no integration gateway module |
| W01-L2-070 | Orchestrate Payment Gateway Integration | Student initiates payment | Payment processed via gateway | Payment (C via M04) | Autonomous: gateway integration | **Missing** -- no payment gateway integration |
| W01-L2-071 | Execute AG-01 Admissions Agent Functions | Various M01 events requiring AI | Predictions and recommendations generated | InferenceLog (C) | This IS the AI scope definition | **Missing** -- no AI inference service or agent framework |

### 3.14 Juvi -- Student App (5 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope | Status |
|----|------|---------|------------|--------------|----------|--------|
| W01-L2-072 | Provision Juvi Account | M12.1 creates user account (066) | Juvi profile created; app ready | JuviConversation (C) | Autonomous: profile creation, checklist | **Exists** -- provision_juvi handler creates JuviConversation |
| W01-L2-073 | Auto-Subscribe Student to Channels | Juvi account provisioned | Student subscribed to mandatory channels | ChannelMembership (C) | Autonomous: channel identification | **Missing** -- no Channel or ChannelMembership model |
| W01-L2-074 | Configure First-Launch Home Experience | Channels subscribed | Home screen configured for first login | HomeConfiguration (C) | Autonomous: home config, tour setup | **Missing** -- no HomeConfiguration model |
| W01-L2-075 | Execute AI Companion Introduction | App tour complete or companion tapped | AI companion introduced; first briefing | JuviConversation (C), JuviMessage (C) | Autonomous: intro, briefing generation | **Partial** -- JuviConversation/Message models exist; no intro logic |
| W01-L2-076 | Push Onboarding Notices | Juvi account provisioned | Critical notices delivered; ack tracked | JuviNoticeCard (C) | Autonomous: notice creation, reminders | **Missing** -- no JuviNoticeCard or acknowledgement tracking model |

---

## 4. Entity Gap Analysis

### 4.1 Existing Models -- Field Enhancements Needed

| Entity | Exists? | New Fields Needed | Notes |
|--------|---------|-------------------|-------|
| Inquiry | Yes | `aadhaarNumber`, `languagePreference` | W01-L2-003 needs language detection; 001 needs Aadhaar for dedup |
| Applicant | Yes | `nriPassportNumber`, `nriVisaValidity`, `scholarshipEligible`, `scholarshipScheme` | W01-L2-022 NRI fields; W01-L2-023 scholarship flag |
| Student | Yes | `lifecycleState` (distinct from status), `isLateralEntry`, `isHosteler`, `sectionId`, `labBatchId` | W01-L2-048 needs explicit lifecycle; 046 needs lateral/hosteler flags |
| Person | Yes | `nationality`, `digilockerConsent`, `digilockerLinked` | W01-L2-051 DigiLocker integration |
| Parent | Yes | `notificationPreferences` (structured JSON) | W01-L2-050 notification prefs per channel |
| DocumentChecklist | Yes | None significant | Well-enhanced already |
| AdmissionOffer | Yes | `paymentDeadline`, `graceperiodEnd` | W01-L2-034 expiry tracking |
| SeatInventory | Yes | `categoryWiseSplit` (SC/ST/OBC/EWS sub-quotas) | W01-L2-024 category-level granularity |
| CounselingAllotment | Yes | `reportingDeadline`, `reportedAt`, `reportingStatus`, `slideRound` | W01-L2-011 reporting; W01-L2-026 slides |

### 4.2 New Models Required

| Entity | Module | Sub-workflow Ref | Purpose | Priority |
|--------|--------|------------------|---------|----------|
| MeritList | M01.3 | W01-L2-027 | Published merit list with version, criteria, publish date | Phase 1 |
| SpotRound | M01.6 | W01-L2-043 | Spot admission round config, deadline, marketing channels | Phase 2 |
| FeeAgreement | M04 | W01-L2-058 | Negotiated fee agreement binding future invoices | Phase 1 |
| PaymentPlan | M04 | W01-L2-058 | Installment plan linked to FeeAgreement | Phase 2 |
| ScholarshipEligibility | M04 | W01-L2-059 | TS-EPass/category-based eligibility record pre-claim | Phase 1 |
| MessSubscription | M08 | W01-L2-061 | Mess subscription type, dietary pref, linked to hostel | Phase 1 |
| LabAccess | M08 | W01-L2-063 | Per-lab access record linked to student and course | Phase 1 |
| DocumentVault | M02 | W01-L2-051 | Permanent document store separate from admission checklist | Phase 2 |
| RollNumberHistory | M02 | W01-L2-047 | Roll number assignment audit trail | Phase 2 |
| LateralCreditMapping | M03 | W01-L2-055 | Diploma-to-degree credit equivalence rules | Phase 2 |
| EvidenceRecord | M10 | W01-L2-064 | Compliance evidence per NAAC/AICTE criterion | Phase 3 |
| DashboardWidget | M11 | W01-L2-065 | Configurable dashboard widget with data source | Phase 3 |
| DashboardAlert | M11 | W01-L2-065 | AI-generated dashboard alert for Leadership | Phase 3 |
| Channel | Juvi | W01-L2-073 | Communication channel (official, department, batch, section) | Phase 2 |
| ChannelMembership | Juvi | W01-L2-073 | Student membership in channel with unsub flag | Phase 2 |
| JuviProfile | Juvi | W01-L2-072 | Juvi-specific profile (display_name, bio, onboarding status) | Phase 2 |
| JuviOnboardingChecklist | Juvi | W01-L2-072 | Onboarding checklist items with completion tracking | Phase 2 |
| JuviNoticeCard | Juvi | W01-L2-076 | Notice card with ack_required, read tracking | Phase 2 |
| HomeConfiguration | Juvi | W01-L2-074 | Per-student home screen widget configuration | Phase 3 |
| IntegrationExecutionLog | M12 | W01-L2-069 | Integration gateway execution audit log | Phase 2 |
| InferenceLog | M12 | W01-L2-071 | AI agent inference call audit with confidence | Phase 3 |
| Notification | M12 | W01-L2-068 | Notification record with delivery status per channel | Phase 1 |
| NotificationTemplate | M12 | W01-L2-068 | Multi-language notification templates | Phase 1 |

---

## 5. API Endpoint Gap Analysis

### 5.1 Existing Endpoints (Complete)

| Method | Path | Description | Sub-workflow |
|--------|------|-------------|--------------|
| GET | `/api/admissions/stats` | Dashboard stats | W01-L2-065 (partial) |
| GET/POST/PUT/DELETE | `/api/admissions/inquiries[/:id]` | Inquiry CRUD | W01-L2-001/002/003 |
| POST | `/api/admissions/inquiries/:id/convert` | Convert to applicant | W01-L2-009 |
| GET/POST/PUT | `/api/admissions/applicants[/:id]` | Applicant CRUD | W01-L2-010 |
| GET/POST/PUT | `/api/admissions/exam-scores[/:id]` | Entrance exam scores | W01-L2-004/005 |
| GET/POST/PUT | `/api/admissions/counseling[/:id]` | Counseling allotments | W01-L2-011 |
| GET/POST/PUT | `/api/admissions/offers[/:id]` | Admission offers | W01-L2-030 |
| GET/PUT | `/api/admissions/documents[/:applicantId]` | Document checklists | W01-L2-012/013/014/015 |
| GET/POST | `/api/admissions/enrollments[/:id]` | Final admissions | W01-L2-036 |
| POST | `/api/admissions/workflow/instances` | Start workflow | Engine |
| GET | `/api/admissions/workflow/instances[/:instanceId]` | Workflow status | Engine |
| POST | `/api/admissions/workflow/instances/:instanceId/trigger-step` | Trigger optional step | Engine |
| POST | `/api/admissions/workflow/tasks/:taskId/complete` | Complete task | Engine |
| POST | `/api/admissions/workflow/tasks/:taskId/fail` | Fail task | Engine |
| POST | `/api/admissions/workflow/tasks/:taskId/skip` | Skip task | Engine |
| GET | `/api/admissions/workflow/tasks` | List my tasks | Engine |
| GET | `/api/admissions/workflow/stats` | Workflow dashboard | W01-L2-065 |
| GET/POST | `/api/admissions/workflow/inquiries/:inquiryId/interactions` | Lead interactions | W01-L2-007 |
| GET/POST | `/api/admissions/workflow/imports[/:id]` | Import batches | W01-L2-004/005 |
| GET/PUT | `/api/admissions/workflow/seats[/:id]` | Seat inventory | W01-L2-024 |
| GET/POST/PUT | `/api/admissions/workflow/allotment-rounds[/:id]` | Allotment rounds | W01-L2-027/028 |
| GET/POST/PUT | `/api/admissions/workflow/allotment-results[/:id]` | Allotment results | W01-L2-028 |
| GET/POST | `/api/admissions/workflow/waitlist` | Waitlist management | W01-L2-029 |
| GET/POST/PUT | `/api/admissions/workflow/fee-negotiations[/:id/resolve]` | Fee negotiations | W01-L2-031/032 |
| GET/POST/PUT | `/api/admissions/workflow/cancellations[/:id]` | Cancellations | W01-L2-041/042 |

### 5.2 Missing Endpoints

| Method | Path | Description | Sub-workflow | Priority |
|--------|------|-------------|--------------|----------|
| POST | `/api/admissions/workflow/imports/:id/execute` | Execute import batch (parse, create applicants) | W01-L2-004/005 | Phase 1 |
| POST | `/api/admissions/workflow/allotment-rounds/:id/execute` | Run allotment algorithm | W01-L2-028 | Phase 1 |
| POST | `/api/admissions/workflow/allotment-rounds/:id/publish` | Publish allotment results | W01-L2-028 | Phase 1 |
| POST | `/api/admissions/workflow/waitlist/:id/promote` | Manual waitlist promotion | W01-L2-029 | Phase 1 |
| POST | `/api/admissions/workflow/offers/:id/accept` | Student accepts offer | W01-L2-035 | Phase 1 |
| POST | `/api/admissions/workflow/offers/:id/reject` | Student rejects offer | W01-L2-033 | Phase 1 |
| POST | `/api/admissions/workflow/cancellations/:id/approve` | Approve cancellation | W01-L2-041 | Phase 1 |
| POST | `/api/admissions/workflow/cancellations/:id/execute` | Execute reversal chain | W01-L2-041 | Phase 1 |
| GET | `/api/admissions/workflow/merit-lists` | List merit lists | W01-L2-027 | Phase 1 |
| POST | `/api/admissions/workflow/merit-lists` | Generate merit list | W01-L2-027 | Phase 1 |
| POST | `/api/admissions/documents/:applicantId/upload` | Self-service doc upload | W01-L2-012 | Phase 1 |
| POST | `/api/admissions/documents/:applicantId/ocr` | Trigger OCR verification | W01-L2-014 | Phase 1 |
| GET | `/api/admissions/workflow/reporting-tracker` | Convener reporting status | W01-L2-026 | Phase 1 |
| POST | `/api/admissions/workflow/spot-rounds` | Create spot admission round | W01-L2-043 | Phase 2 |
| POST | `/api/admissions/workflow/surrender-reports` | Generate convener surrender | W01-L2-044 | Phase 2 |
| POST | `/api/admissions/applicants/:id/eligibility/lateral` | Lateral eligibility check | W01-L2-021 | Phase 2 |
| POST | `/api/admissions/applicants/:id/eligibility/nri` | NRI eligibility check | W01-L2-022 | Phase 2 |
| POST | `/api/admissions/applicants/:id/eligibility/scholarship` | Scholarship eligibility pre-check | W01-L2-023 | Phase 2 |
| GET | `/api/platform/notifications/admission/:applicantId` | Notification history | W01-L2-068 | Phase 2 |
| POST | `/api/platform/integrations/eamcet/pull` | EAMCET data pull | W01-L2-069 | Phase 2 |
| POST | `/api/platform/integrations/payment/initiate` | Payment gateway initiation | W01-L2-070 | Phase 2 |
| POST | `/api/platform/integrations/payment/webhook` | Payment gateway webhook | W01-L2-070 | Phase 2 |

---

## 6. State Machine Definitions

### 6.1 Master W01 Pipeline (IMPLEMENTED)

The primary state machine is already defined in `backend/src/shared/workflow/definitions/W01.ts`. The pipeline flows:

```
lead_capture -> lead_score -> lead_dedup -> lead_nurture -> lead_convert
  -> app_submit -> doc_collection -> doc_ocr
    -> [has_flagged_documents] -> doc_review -> eligibility_check
    -> [all_documents_verified] -> eligibility_check
  -> eligibility_check
    -> [is_edge_case] -> eligibility_review -> seat_check
    -> [is_eligible] -> seat_check
  -> seat_check -> merit_rank -> allotment
  -> offer_generate
    -> [negotiation_requested] -> fee_negotiation -> offer_acceptance
    -> [no_negotiation] -> offer_acceptance
  -> offer_acceptance -> enrol_execute (parallel) -> onboarding_complete

  // Cancellation (triggered from any post-offer state):
  -> cancel_request -> cancel_execute (parallel)
```

### 6.2 Admission Offer Lifecycle (NEEDS IMPLEMENTATION)

This is a sub-state-machine for `AdmissionOffer.status`:

```
States: offered -> accepted | declined | lapsed
                -> negotiating -> offered (revised)
                              -> escalated -> offered (revised) | declined

Transitions:
  offered + student_accepts + payment_confirmed -> accepted
  offered + student_declines                    -> declined
  offered + deadline_expires                    -> lapsed
  offered + negotiation_initiated               -> negotiating
  negotiating + ai_approves (<= 50K)            -> offered (revised fee)
  negotiating + escalated (> 50K)               -> escalated
  escalated + leadership_approves               -> offered (revised fee)
  escalated + leadership_rejects                -> offered (original)

Side Effects:
  -> declined: release seat (SeatInventory), trigger waitlist promotion
  -> lapsed:   same as declined
  -> accepted: trigger M01.5 ENROL enrol_execute
```

**Implementation**: Add a BullMQ job for offer deadline monitoring. Job checks every hour for offers past `validityDate` and transitions to `lapsed`.

### 6.3 Seat Allotment Round Lifecycle (NEEDS IMPLEMENTATION)

```
States: draft -> open -> processing -> published -> closed

Transitions:
  draft + configure      -> draft (updated)
  draft + activate       -> open (accepting applications)
  open + deadline_passes -> processing
  open + manual_close    -> processing
  processing + run_algo  -> published (results generated)
  published + finalize   -> closed

Guards:
  activate: at least 1 eligible applicant, seat inventory published
  run_algo: all applicants ranked
  finalize: acceptance deadline passed
```

### 6.4 Cancellation Pipeline (IMPLEMENTED)

```
States: requested -> approved -> in_progress -> completed | rejected

Transitions:
  requested + approve    -> approved
  requested + reject     -> rejected
  approved + execute     -> in_progress (parallel reversals begin)
  in_progress + all_done -> completed

Parallel Reversals (via cancel_execute parallel_group):
  cancel_m02: Deactivate student -> status='exited'
  cancel_m04: Calculate refund, create Refund record
  cancel_m08: De-allocate hostel, transport, library, lab
  cancel_m12: Deactivate User account
  cancel_juvi: Deactivate Juvi profile

Side Effects:
  -> completed: update SeatInventory (increment vacant), trigger waitlist auto-promotion
```

### 6.5 Convener Reporting Tracker (NEEDS IMPLEMENTATION)

```
States: allotted -> notified -> reported -> lapsed -> surrendered

Transitions:
  allotted + notification_sent -> notified
  notified + student_reports   -> reported
  notified + deadline_expires  -> lapsed
  lapsed + grace_granted       -> notified (extended deadline)
  lapsed + no_grace            -> surrendered

Side Effects:
  -> reported: proceed to doc_collection
  -> lapsed: update SeatInventory, report to state
  -> surrendered: generate surrender report
```

---

## 7. Business Logic Requirements

### 7.1 Lead Scoring Algorithm (W01-L2-006)

**Currently**: `deriveLeadGrade()` in workflow.handlers.ts provides basic score-to-grade mapping.

**Required Enhancement**:
- Inputs: programme demand index (seats filled / sanctioned), student location proximity, response time (time from first contact to engagement), engagement score (interaction count, channel diversity), academic background match
- Weights: configurable per college via M12.5 Tenant Config
- Output: numeric score 0-100, grade (Hot >= 70, Warm 40-69, Cold < 40)
- Learning: ST1 grade overrides should feed back to adjust weights

### 7.2 Duplicate Detection (W01-L2-008)

**Currently**: Phone and email exact match in `lead_dedup` handler.

**Required Enhancement**:
- Match fields: phone (exact), Aadhaar (exact), email (exact), name + DOB (fuzzy)
- Confidence calculation: phone match = 90%, Aadhaar = 99%, email = 70%, name+DOB = 50%, combined weighted score
- Auto-merge threshold: >= 80% (configurable)
- Flag threshold: 40-79%
- Below 40%: treat as unique

### 7.3 AI OCR Verification (W01-L2-014)

**Currently**: `doc_ocr` handler tracks confidence and flagging; actual OCR is simulated.

**Required Implementation**:
- OCR service integration (likely via M12.3 AI agent or external API)
- Document types: Aadhaar (extract name, DOB, number), 10th memo (extract marks, board, year), 12th memo (extract marks, stream, board), Transfer Certificate (extract institution, date)
- Cross-validation: extracted data vs Application data
- Confidence scoring: per-field confidence averaged to document confidence
- Tampering detection: image analysis for alterations, font consistency

### 7.4 Eligibility Rules Engine (W01-L2-018)

**Currently**: `eligibility_check` handler derives status from result; no rule evaluation.

**Required Implementation**:
- Rule source: M12.5 Tenant Config (per programme, per regulation)
- Standard rules: minimum 10th percentage, minimum 12th percentage, required subjects (MPC for engineering), age limits, category-specific relaxation percentages
- Lateral rules (W01-L2-021): diploma aggregate, branch mapping table, ECET rank threshold
- NRI rules (W01-L2-022): passport validity, academic equivalence table
- Output: `eligible` | `ineligible` | `conditional` | `edge_case` with detailed reasons

### 7.5 Seat Allotment Algorithm (W01-L2-028)

**Currently**: AllotmentResult CRUD exists; no ranking or allocation algorithm.

**Required Implementation**:
```
Input: eligible applicants[], seat inventory, round criteria
Algorithm:
  1. Sort applicants by criteria.sortBy (merit_score | eamcet_rank | inter_percentage)
  2. For each applicant in sorted order:
     a. Check preference 1 availability in SeatInventory (quota-specific)
     b. If available: allot, decrement inventory, create AllotmentResult(status=allotted)
     c. If not: check preference 2, then 3
     d. If no preference available: create AllotmentResult(status=waitlisted), add to Waitlist
  3. Handle tie-breaking: same score -> earlier application date
  4. Update round stats: totalApplicants, allottedCount, waitlistedCount
```

### 7.6 Fee Structure Resolution (W01-L2-056)

**Currently**: FeeStructure model exists with basic fields.

**Required Implementation**:
- Input: programme_id, quota_type, academic_year, is_hosteler, transport_required
- Lookup chain: FeeStructure -> FeeLineItem components (tuition, hostel, transport, lab, library, development, exam)
- Rule evaluation: quota-based tuition (management typically higher), hostel conditional on is_hosteler, transport conditional on transport_required
- Output: itemized fee breakdown with total, first installment amount

### 7.7 Refund Calculation (W01-L2-041/042)

**Currently**: AdmissionCancellation has refundAmount field; no calculation logic.

**Required Implementation**:
- Pre-enrolment (W01-L2-042): full refund minus application fee
- Post-enrolment prorated rules: within 15 days of admission = 90% refund, 15-30 days = 80%, 30-60 days = 50%, after 60 days = 0% (configurable per college)
- Deductions: outstanding fines, mess charges consumed, library fines
- Hostel: prorated monthly

### 7.8 Waitlist Auto-Promotion (W01-L2-029)

**Currently**: Waitlist model tracks position; no event-driven promotion.

**Required Implementation**:
- Trigger events: offer_rejected, offer_expired, cancellation_completed
- Algorithm: find top Waitlist entry for same programme/branch/quota, status='waiting'
- Action: promote (status='promoted'), create new AdmissionOffer, send notification
- Chain: if promoted candidate declines within 48h, promote next

---

## 8. Cross-Module Integration Points

### 8.1 M01 -> M02 (People) -- Enrolment Provisioning

**Trigger**: `provision_m02` step in enrol_execute parallel group
**Data Flow**:
- M01 passes: name, DOB, gender, Aadhaar, phone, email, address, parent info, admission photo
- M02 creates: Person (dedup by Aadhaar), Student (linked to Person, lifecycle=Onboarding), Parent (Person + Parent role), ParentStudentLink
- M02 returns: personId, studentId, rollNumber, parentId
- M01 updates: Admission record with studentId

**Current State**: Handler exists and creates Person, Student, Parent records. Missing: configurable roll number scheme, lifecycle transition logic, document vault transfer.

### 8.2 M01 -> M03 (Academics) -- Section & Course Assignment

**Trigger**: `provision_m03` step
**Data Flow**:
- M01 passes: studentId, programmeId, branchId, batchId, regulationId, isLateralEntry
- M03 performs: section assignment (balance algorithm), course registration (curriculum lookup), timetable mapping
- For lateral: credit mapping from diploma, bridge course identification

**Current State**: Handler assigns to first available section and creates basic enrollment. Missing: load balancing, lateral credit mapping, timetable push.

### 8.3 M01 -> M04 (Finance) -- Fee & Invoice

**Trigger**: Multiple touchpoints:
1. `offer_generate` step: reads fee structure for offer letter
2. `provision_m04` step: creates first invoice
3. `cancel_m04` step: processes refund

**Data Flow**:
- Offer: M01 requests fee breakdown by programme/quota/year -> M04 returns components
- Invoice: M01 passes studentId + fee structure -> M04 creates Invoice + line items
- Refund: M01 passes cancellation details -> M04 calculates refund, creates Refund record

**Current State**: Handler creates basic Invoice and StudentFeeAccount. Missing: fee rule engine, payment plan support, refund calculation.

### 8.4 M01 -> M08 (Campus) -- Hostel, Transport, Library, Labs

**Trigger**: `provision_m08` step
**Data Flow**:
- Hostel: isHosteler=true -> find available room -> create HostelAllocation -> trigger mess subscription
- Transport: transportRequired=true -> match route by location -> create TransportAllocation
- Library: always -> create LibraryMember
- Labs: from M03 course list -> create LabAccess per required lab

**Current State**: Handler creates HostelAllocation (finds available room), TransportAllocation (finds route), LibraryMember. Missing: mess subscription, lab access provisioning.

### 8.5 M01 -> M10 (Compliance) -- Evidence Collection

**Trigger**: Admission cycle end (batch job)
**Data Flow**: M10 pulls aggregate data from M01 (sanctioned vs actual intake, category distribution, quota fill rates). Creates EvidenceRecord mapped to NAAC criteria (2.1.1) and AICTE requirements.

**Current State**: Not implemented. No M10 module or evidence model.

### 8.6 M01 -> M11 (Governance) -- Dashboards

**Trigger**: Event-driven on any M01 state change
**Data Flow**: M11 recomputes funnel metrics (fill rate, conversion rate, yield) and refreshes dashboard widgets. AI generates demand signals and alerts.

**Current State**: `getWorkflowStats` provides basic aggregates. No event-driven refresh or M11 module.

### 8.7 M01 -> M12 (Platform) -- Account, Notifications, Integrations

**Trigger**: Multiple:
1. `provision_m12`: User account + RBAC
2. Stage transitions: notifications (offer issued, accepted, enrolled)
3. EAMCET/ECET import: integration gateway
4. Payment: gateway integration

**Current State**: Handler creates User with hashed password. Missing: RBAC role assignment, notification templates/dispatch, integration gateway, payment gateway.

### 8.8 M01 -> Juvi (Student App) -- Onboarding

**Trigger**: `provision_juvi` step
**Data Flow**: Create Juvi profile, subscribe to channels, configure home screen, trigger AI companion intro, push onboarding notices.

**Current State**: Handler creates JuviConversation. Missing: profile, channels, home config, notices, companion intro.

---

## 9. AI Agent Scope

### 9.1 Fully Autonomous (45 sub-workflows)

These require no human intervention under normal conditions:

| Category | Sub-workflows | Implementation Notes |
|----------|---------------|---------------------|
| Lead Scoring | W01-L2-006 | ML model or rule-based scoring with configurable weights |
| Lead Nurture | W01-L2-007 | Templated message sequences via WhatsApp/SMS, auto-escalation |
| Duplicate Detection (>= 80%) | W01-L2-008 | Multi-field matching with confidence scoring |
| OCR Verification (>= 90%) | W01-L2-014 | External OCR service, confidence-based auto-verify |
| Standard Eligibility Check | W01-L2-018 | Rules engine against M12.5 config |
| Seat Availability Check | W01-L2-024 (partial) | Real-time inventory query |
| Merit Ranking | W01-L2-027 (algo) | Deterministic sort by configured criteria |
| Allotment Algorithm | W01-L2-028 (algo) | Preference-matching with inventory check |
| Offer Generation | W01-L2-030 | Fee lookup, PDF generation, multi-channel delivery |
| Fee Negotiation (<= Rs.50K) | W01-L2-031 | Auto-approve within threshold |
| Offer Expiry Processing | W01-L2-034 | Scheduled job, reminder sequence, auto-lapse |
| All Provisioning Steps | W01-L2-036, 045-055, 057, 060-063, 066, 072-076 | Parallel orchestration via workflow engine |
| Notification Sequences | W01-L2-068 | Template + channel selection + dispatch |
| Dashboard Updates | W01-L2-065 | Event-driven aggregation refresh |
| Compliance Evidence | W01-L2-064 | Batch data pull and quality scoring |

### 9.2 Autonomous with Human Flags (18 sub-workflows)

These run autonomously but flag specific cases for human review:

| Category | Sub-workflows | Flag Condition | Escalation Target |
|----------|---------------|----------------|-------------------|
| Dedup (< 80% confidence) | W01-L2-008 | Match confidence 40-79% | ST1 (Admissions Staff) |
| OCR (< 90% confidence) | W01-L2-014/015 | Document confidence below threshold | ST1 |
| Eligibility Edge Cases | W01-L2-019/020 | Borderline marks, interpretation needed | ST1 or HOD |
| Lateral Branch Mapping | W01-L2-021/055 | Unmapped diploma programme | HOD (F2) |
| NRI Equivalence | W01-L2-022 | Academic equivalence unclear | ST1 |
| Capacity Issues | W01-L2-038/039 | Hostel/transport at capacity | Warden (ST6) |
| Import Parse Errors | W01-L2-004/005 | Data format mismatch | ST1 |
| Convener Reporting | W01-L2-026 | Unusual non-reporting pattern | Leadership (P4) |
| Integration Failures | W01-L2-069/070 | Portal/gateway timeout after retries | ST1 |

### 9.3 Human Decision Required (13 sub-workflows)

These cannot proceed without explicit human judgment:

| Category | Sub-workflows | Decision Maker | Authority Level |
|----------|---------------|----------------|-----------------|
| Document Fraud Investigation | W01-L2-017 | Leadership (P4) | Only Leadership can confirm fraud |
| Fee Waiver > Rs.50K | W01-L2-032 | Leadership (P4) | Institutional financial authority |
| Late Admission Approval | W01-L2-037 | ST1 or Leadership | Depends on timing/regulatory constraints |
| Cancellation Approval | W01-L2-041/042 | Admissions Head | Post-enrolment requires head approval |
| Spot Round Authorization | W01-L2-043 | Leadership (P4) | Strategic institutional decision |
| Convener Seat Surrender | W01-L2-044 | ST1 | Regulatory compliance submission |
| Physical Document Verification | W01-L2-013 | ST1 | Original vs copy comparison |
| Eligibility Review (edge) | W01-L2-019 | HOD or Leadership | Precedent-setting decisions |
| Conditional Eligibility Grant | W01-L2-020 | ST1 | Within ST1 authority |

---

## 10. Implementation Phases

### Phase 1: Core Pipeline (Weeks 1-4)

**Goal**: Complete the end-to-end management quota admission pipeline from lead to enrolled student.

#### Week 1-2: Business Logic Layer

| Task | Sub-workflow | Description |
|------|-------------|-------------|
| Lead scoring rules engine | W01-L2-006 | Configurable weight-based scoring with programme demand integration |
| Enhanced duplicate detection | W01-L2-008 | Multi-field match with confidence scoring, auto-merge above threshold |
| Eligibility rules engine | W01-L2-018 | Rule-based evaluation from tenant config |
| Allotment algorithm | W01-L2-028 | Preference-matching with inventory decrement and waitlist generation |
| MeritList model + API | W01-L2-027 | New model, generation endpoint, publish endpoint |
| Waitlist auto-promotion | W01-L2-029 | Event-driven promotion on seat release |

#### Week 2-3: Offer and Payment Flow

| Task | Sub-workflow | Description |
|------|-------------|-------------|
| Offer deadline monitoring | W01-L2-034 | BullMQ recurring job for expiry detection |
| Offer accept/reject endpoints | W01-L2-033/035 | API endpoints with seat release chain |
| Fee structure resolution | W01-L2-056 | Rule-based fee component calculation |
| Invoice generation | W01-L2-057 | Proper line-item creation from fee structure |
| Cancellation approval/execution | W01-L2-041/042 | Approval endpoint, parallel reversal execution |
| Refund calculation | W01-L2-041 | Prorated refund logic |

#### Week 3-4: New Models and Endpoints

| Task | Sub-workflow | Description |
|------|-------------|-------------|
| MeritList model | W01-L2-027 | version, criteria, publishDate, status |
| MessSubscription model | W01-L2-061 | subscription_type, dietary_preference, linked to hostel |
| LabAccess model | W01-L2-063 | Per-lab access linked to student and course |
| ScholarshipEligibility model | W01-L2-059 | Pre-claim eligibility for TS-EPass and category schemes |
| FeeAgreement model | W01-L2-058 | Negotiated terms binding future invoices |
| Notification model + templates | W01-L2-068 | Multi-channel delivery with language support |
| Missing API endpoints | Various | All Phase 1 endpoints from section 5.2 |

### Phase 2: Automation & Integration (Weeks 5-8)

**Goal**: Add external integrations, convener pathway support, and AI automation.

#### Week 5-6: Convener Pathway

| Task | Sub-workflow | Description |
|------|-------------|-------------|
| EAMCET import parser | W01-L2-004 | Batch import with validation and applicant auto-creation |
| ECET import parser | W01-L2-005 | Lateral entry variant of EAMCET import |
| Convener reporting tracker | W01-L2-011/026 | Reporting deadline monitoring, auto-lapse, grace periods |
| Convener seat surrender | W01-L2-044 | Surrender report generation |
| Spot admission round | W01-L2-043 | Configurable spot round with fast-track processing |
| CounselingAllotment field enhancements | W01-L2-011 | reportingDeadline, reportedAt, reportingStatus |

#### Week 7-8: AI and Integration

| Task | Sub-workflow | Description |
|------|-------------|-------------|
| OCR service integration | W01-L2-014 | Connect to external OCR API, implement confidence scoring |
| WhatsApp Business integration | W01-L2-003 | M12.4 integration for lead capture and notifications |
| Payment gateway integration | W01-L2-070 | Razorpay/CCAvenue webhook handling |
| Notification dispatch system | W01-L2-068 | Template-based multi-channel dispatch (WhatsApp, SMS, email) |
| Integration gateway (M12.4) | W01-L2-069 | Retry logic, circuit breaker, execution logging |
| Lateral credit mapping | W01-L2-055 | LateralCreditMapping model, bridge course identification |
| NRI eligibility rules | W01-L2-022 | Passport/visa validation, equivalence tables |
| Document vault (M02.5) | W01-L2-051 | Separate persistent document store from checklist |

### Phase 3: Optimization & Intelligence (Weeks 9-12)

**Goal**: AI intelligence layer, compliance integration, Juvi app features, analytics dashboards.

#### Week 9-10: Juvi Student App

| Task | Sub-workflow | Description |
|------|-------------|-------------|
| JuviProfile model | W01-L2-072 | display_name, bio, onboarding status |
| Channel + ChannelMembership models | W01-L2-073 | Official channels, auto-subscribe logic |
| JuviNoticeCard model | W01-L2-076 | ack_required, read tracking, reminders |
| HomeConfiguration model | W01-L2-074 | Per-student widget config |
| AI companion intro | W01-L2-075 | First briefing generation, capability tour |
| Onboarding checklist tracking | W01-L2-040/072 | Photo, bio, CoC ack, companion intro completion |

#### Week 11-12: Compliance, Governance, Intelligence

| Task | Sub-workflow | Description |
|------|-------------|-------------|
| EvidenceRecord model (M10) | W01-L2-064 | NAAC/AICTE criteria mapping, quality scoring |
| Dashboard widgets (M11) | W01-L2-065 | Real-time funnel visualization, demand signals |
| DashboardAlert model | W01-L2-065 | AI-generated alerts for programme underperformance |
| AG-01 Admissions Agent | W01-L2-071 | Unified AI inference service for all M01 AI tasks |
| InferenceLog model | W01-L2-071 | Audit trail for all AI predictions with confidence |
| Lead scoring ML model | W01-L2-006 | Upgrade from rules-based to ML with feedback loop |
| Yield prediction | W01-L2-028 | Predict acceptance rates to optimize allotment |

---

## Summary of Implementation Readiness

| Area | Status | Completeness |
|------|--------|-------------|
| Workflow Engine | Complete | 100% |
| W01 State Machine Definition | Complete | 100% |
| M01 Models (15) | Complete | 100% |
| M01 Step Handlers (26) | Complete | 100% (core logic; some need deepening) |
| M01 CRUD Services | Complete | 100% |
| M01 Workflow Services | Complete | 100% |
| M01 Routes | Complete | 85% (missing action endpoints) |
| Cross-module provisioning | Partial | 70% (creates records; missing mess, lab, channels) |
| Business logic algorithms | Partial | 30% (CRUD exists; algorithms missing) |
| External integrations | Missing | 5% (no OCR, payment gateway, WhatsApp, EAMCET portal) |
| Notification system | Missing | 0% |
| AI Agent framework | Missing | 0% |
| M10/M11 modules | Missing | 0% |
| Juvi app features | Partial | 20% (conversation model; no channels/notices/home) |

The codebase has a strong foundation. The workflow engine, state machine, models, handlers, and API surface are all in place for the core M01 pipeline. The primary gaps are: (1) business logic algorithms (allotment, eligibility rules, fee calculation), (2) external integrations (OCR, payment, messaging), (3) cross-module models (mess, lab, channels, notices), and (4) the intelligence layer (AI agent, dashboards, compliance).
