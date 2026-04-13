# Juvion v2 — Workflow Implementation Master Plan

**Date**: 2026-04-13
**Scope**: 10 workflows (W01–W10), ~600 sub-workflows, 12 modules + Juvi
**Specs**: `docs/superpowers/specs/2026-04-13-W{01..10}-*.md`

---

## 1. Current State Summary

| Module | Models | Service Functions | Business Logic | Status |
|--------|--------|-------------------|----------------|--------|
| M01 Admissions | 15 | 26 | W01 state machine + handlers | **Hybrid** |
| M02 People | 7 | 31 | Profile completeness only | Scaffolding |
| M03 Academics | 29 | 131 | Bulk entry, grade calc | Advanced CRUD |
| M04 Finance | 16 | 72 | Guardian ready check only | Scaffolding |
| M05 HR | 19 | 90 | Basic leave status | Scaffolding |
| M06 Welfare | 16 | 81 | None | Scaffolding |
| M07 Placement | 17 | 71 | Package aggregation | Scaffolding |
| M08 Campus Ops | 37 | 186 | None | Scaffolding |
| M09 Student Dev | 14 | 71 | None | Scaffolding |
| M10 Compliance | 10 | 51 | None | Scaffolding |
| M11 Governance | 5 | 26 | None | Scaffolding |
| M12 Platform | 8 | 46 | RBAC cache | Scaffolding |
| Juvi | 8 | 41 | None | Scaffolding |
| **Totals** | **177** | **933** | | **~90% CRUD** |

**Infrastructure already built**: Workflow engine (state machine), RBAC engine, audit logging, pagination, authentication, E2E test harness (131 tests).

---

## 2. Dependency Graph

```
W01 (Intake)
 ├── W02 (Academic) ← needs enrolled students
 │    ├── W03 (Finance) ← exam fees, fee clearance
 │    ├── W07 (Compliance) ← OBE evidence, pass rates
 │    └── W04 (Placement) ← CGPA, backlogs for eligibility
 ├── W03 (Finance) ← enrolment invoices
 ├── W05 (HR) ← faculty for course delivery
 │    ├── W02 (Academic) ← workload, substitution
 │    └── W07 (Compliance) ← faculty evidence
 ├── W06 (Welfare) ← signals from M03/M04/M08
 ├── W08 (Campus) ← hostel/mess/transport at onboarding
 └── W09 (Student Dev) ← clubs, activities

W10 (Exit) ← depends on ALL of above (clearance from every module)
```

**Key insight**: W01 is already partially built. W02/W03/W05 form the operational core. W10 is the terminal workflow. W06/W07/W08/W09 are largely independent of each other.

---

## 3. Phased Roadmap

### Phase A — Operational Core (Weeks 1–12)

The three workflows that run continuously every semester and touch every student.

| Track | Workflow | Weeks | Sub-Workflows | Key Deliverables |
|-------|----------|-------|---------------|------------------|
| A1 | **W01 Intake** | 1–4 | 76 | Complete admission pipeline, allotment algorithm, convener pathway |
| A2 | **W02 Academic** | 1–8 | 54 | Curriculum → scheduling → attendance → CIE → exams → results → OBE |
| A3 | **W03 Finance** | 3–10 | 69 | Fee config → invoicing → payment → reconciliation → scholarships → defaulters |

**A1 and A2 start in parallel** (different modules). **A3 starts week 3** once A1 fee structures land.

#### A1: W01 — Student Intake & Onboarding (Weeks 1–4)

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 1-2 | Business logic: lead scoring, dedup, eligibility, allotment algorithm | W01-L2-006,008,018,027-029 | §7 |
| 2-3 | Offer & payment: deadline monitoring, accept/reject, fee resolution, invoicing | W01-L2-033-035,056-057 | §7 |
| 3-4 | New models (MeritList, MessSubscription, LabAccess, ScholarshipEligibility, FeeAgreement) + missing endpoints | W01-L2-027,059,061,063 | §4,5 |

**Extends to weeks 5-8** for convener pathway (EAMCET/ECET), integrations (OCR, payment gateway, WhatsApp).
**Extends to weeks 9-12** for Juvi app, compliance, dashboards, AI intelligence.

#### A2: W02 — Academic Year Delivery (Weeks 1–8)

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 1 | Schema evolution + curriculum instantiation + academic calendar | W02-L2-001,002 | §4,6 |
| 2 | Scheduling: sections, faculty assignment, timetable conflict detection, electives | W02-L2-003-007 | §7 |
| 3 | Attendance: daily capture, threshold monitoring, condonation, parent notification | W02-L2-008-012 | §7 |
| 4 | CIE + teaching: computation engine, assignments, quizzes, course delivery tracking | W02-L2-013-018 | §7 |
| 5 | Exam setup: scheduling, seating, invigilation, hall ticket eligibility | W02-L2-019-022 | §6 |
| 6 | Hall tickets + conduct + bulk mark entry with anomaly detection | W02-L2-021-023 | §7 |
| 7 | Results: grade computation, SGPA/CGPA, backlog, promotion/detention, publication | W02-L2-024-029 | §6,7 |
| 8 | OBE: CO attainment, PO attainment, programme health + M02 state transitions | W02-L2-030-032,039-041 | §7 |

**New models**: AttendanceSummary, AttendanceAlert, CondonationRequest, LabBatch, Assignment, Submission, Quiz, QuizAttempt, SeatingPlan, InvigilationRoster, HallTicket, Backlog, CourseMaterial.
**M05 integration**: Workload recording (W02-L2-033), leave→substitution (W02-L2-034), invigilation duty (W02-L2-035).
**M04 integration**: Exam fee invoice (W02-L2-036), fee clearance check (W02-L2-037), scholarship credit (W02-L2-038).

#### A3: W03 — Fee Lifecycle & Revenue Assurance (Weeks 3–10)

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 3-4 | Fee configuration: FeeStructureInstance, FeeComponent, FeeComponentRule, approval workflow | W03-L2-001-004 | §4,6 |
| 5-6 | Invoicing: batch generation, line items, adjustments, disputes, payment plans | W03-L2-005-015 | §6,7 |
| 7-8 | Payment collection: gateway webhooks, reconciliation, receipts, bounce handling, refunds | W03-L2-016-025 | §6,7 |
| 9 | Scholarships & concessions: eligibility, allocation, TS-EPass, merit-cum-means | W03-L2-026-034 | §7 |
| 10 | Defaulter management: escalation ladder, holds, welfare referral, legal, write-off | W03-L2-035-046 | §6,7 |

**New models**: FeeStructureInstance, FeeComponent, FeeComponentRule, FeeAgreement, PaymentPlan, InvoiceLineItem, PaymentTransaction, Receipt, ReconciliationEntry, BounceRecord, OverpaymentRecord, DistressSignal.

---

### Phase B — People & Operations (Weeks 5–16)

HR and campus operations that support the academic core.

| Track | Workflow | Weeks | Sub-Workflows | Key Deliverables |
|-------|----------|-------|---------------|------------------|
| B1 | **W05 HR** | 5–16 | 79 | Leave workflow, recruitment, FDP, appraisal, payroll, exit |
| B2 | **W08 Campus** | 9–16 | 36+ | Hostel, mess, transport, library, labs, facilities, maintenance |

**B1 starts week 5** when W02 needs faculty workload. **B2 starts week 9** (W01 hostel/mess allocation needed by then).

#### B1: W05 — Employee Lifecycle Management (Weeks 5–16)

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 5-7 | Leave & attendance: balance validation, auto-approval, deduction, anomaly detection | W05-L2-017-033 | §6,7 |
| 8-10 | Recruitment: requisition, sanctioned strength check, selection committee, appointment | W05-L2-001-011 | §6,7 |
| 10-11 | Onboarding: M02 identity, M12 account, leave init, M03 assignment, M09 advisor | W05-L2-012-017 | §8 |
| 12-13 | FDP & appraisal: training tracking, appraisal cycle, 360° feedback, promotion | W05-L2-034-049 | §6,7 |
| 14-15 | Payroll data extract + exit process: resignation, retirement, clearance | W05-L2-050-055,062-074 | §6,7 |
| 16 | Cross-module: M03 workload, M06 appraisal data, M10 evidence, M11 policy | W05-L2-075-079 | §8 |

**New models**: HiringRequisition, SelectionCommittee, AppointmentOrder, AttendanceAnomaly, AttendanceMonthlySummary.

#### B2: W08 — Campus Life Operations (Weeks 9–16)

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 9-10 | Model migration (welfare→campus) + hostel allocation state machine + library circulation | W08-L2-001-009,019-023 | §4,6 |
| 11-12 | Transport allocation + mess operations (dual billing) + lab scheduling | W08-L2-010-018,024-027 | §6,7 |
| 13-14 | Facility management: booking, maintenance requests, vendor management | W08-L2-028-035 | §6,7 |
| 15-16 | Predictive maintenance + dashboards + clearance protocols for W10 | W08-L2-036-042 | §7,9 |

**Model migration**: 6 welfare models move to campus entity group (HostelBlock, HostelRoom, HostelAllocation, HostelVisitorLog, MessMenu, TransportRoute).
**New models**: ~26 (Bed, HostelAttendance, HostelLeave, DisciplineViolation, Menu, MealCoupon, MealAttendance, TransportStop, TripLog, TransportAttendance, LabSession, LabEquipment, FacilityBooking, MaintenanceTask, etc.)

---

### Phase C — Student Life & Welfare (Weeks 9–18)

Student-facing workflows that depend on the operational core being in place.

| Track | Workflow | Weeks | Sub-Workflows | Key Deliverables |
|-------|----------|-------|---------------|------------------|
| C1 | **W06 Welfare** | 9–18 | 80 | Grievances, statutory committees (ARC/ICC/SCST/GRC), mentoring, CCD |
| C2 | **W09 Student Dev** | 13–18 | ~45 | Clubs, events, achievements, budgets, portfolios |
| C3 | **W04 Placement** | 13–20 | 80 | CRM, profiles, training, drives, offers, dream policy, alumni |

#### C1: W06 — Student Welfare & Crisis Response (Weeks 9–18)

**NON-NEGOTIABLE**: AI flags; humans decide. No autonomous AI decisions on welfare outcomes.

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 9-11 | Foundation: 14 new models, GGM lifecycle, SLA tracking | W06-L2-001-008 | §4,6 |
| 12-13 | Statutory: ARC (anti-ragging) + DISC (discipline) with investigation lifecycle | W06-L2-009-015,048-053 | §6 |
| 14-15 | Statutory: ICC (POSH, 90-day deadline) + SCST + GRC | W06-L2-016-027 | §6 |
| 16-17 | Mentoring & counselling: assignment, sessions, concern routing, referrals | W06-L2-028-039 | §7 |
| 17-18 | CCD: compound risk scoring, multi-signal correlation, alert lifecycle, crisis protocol | W06-L2-040-055 | §7,9 |

**New models**: ~14 (GrievanceAssignment, SystemicPattern, MentorAssignment, MentorSession, MentorConcern, ICCComplaint, SCSTComplaint, GRCComplaint, CounsellingReferral, CompoundRiskScore, etc.)
**Critical constraint**: Confidentiality matrix — ICC is HIGHEST, ARC/SCST are HIGH, GGM/DISC are MEDIUM.

#### C2: W09 — Student Enrichment & Development (Weeks 13–18)

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 13-14 | Club lifecycle: proposal → approval → operation + membership + elections | W09-L2-001-008 | §6 |
| 15-16 | Events: fests, competitions, workshops, NCC/NSS, sports + M08 venue booking | W09-L2-009-020 | §6,7 |
| 17 | Achievements: verification pipeline, auto-capture, certificate generation | W09-L2-021-028 | §7 |
| 18 | Budget management + portfolio generation + M07/M10 feeds | W09-L2-029-037 | §7,8 |

**New models**: Fest, Competition, Workshop, Programme (NCC/NSS), Budget, BudgetTransaction, Certificate, Portfolio.
**M08 integration**: Facility booking for events. **M07 integration**: Portfolio → career profile.

#### C3: W04 — Placement Season Execution (Weeks 13–20)

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 13 | Entity foundation: 13 new models, schema expansion | W04-L2-* | §4 |
| 14-15 | State machines: season, drive, offer lifecycle + dream policy enforcement | W04-L2-030-055 | §6 |
| 16-17 | CRM: company scoring, outreach, onboarding, feedback, blacklisting | W04-L2-001-010 | §7 |
| 18 | Profiles + training: career profile, readiness scoring, mock interviews | W04-L2-011-024 | §7 |
| 19 | Portal + drives: recruiter portal, JD posting, applications, interviews | W04-L2-025-043 | §7 |
| 20 | Offers + alumni: dream policy, multi-offer, reneging, career records | W04-L2-044-069 | §6,7 |

**New models**: CompanyEngagementLog, CompanyProgrammeAffinity, PlacementDrive, DriveApplication, InterviewSchedule, RecruiterAccount, CareerProfile, PlacementReadinessScore, SkillRecord, PlacementBar, OptOutRecord, AlumniCareerRecord.
**Dream policy**: Placed students blocked from drives with CTC ≤ current offer. Allowed for ≥ 1.5× (configurable). System enforced — no override.

---

### Phase D — Compliance, Governance & Exit (Weeks 13–22)

The "closing the loop" workflows that consume data from all other modules.

| Track | Workflow | Weeks | Sub-Workflows | Key Deliverables |
|-------|----------|-------|---------------|------------------|
| D1 | **W07 Compliance** | 13–20 | ~40 | Evidence registry, readiness scoring, report generation, visit preparation |
| D2 | **W10 Exit** | 19–22 | 44 | Clearance orchestration, graduation, dropout detection, alumni, document generation |

#### D1: W07 — Accreditation & Compliance Readiness (Weeks 13–20)

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 13-14 | Models + evidence registry + manual evidence upload + readiness scoring | W07-L2-001-005 | §4,6 |
| 15-16 | Event-driven evidence collection from M01–M09 + deadline management | W07-L2-006-013 | §7 |
| 17-18 | Report lifecycle: template, section drafting, review, approval, submission | W07-L2-014-024 | §6 |
| 19-20 | Remediation tracking + AI agent (AG-06/AG-07) + NAAC/NBA/AICTE format export | W07-L2-025-038 | §7,9 |

**New models**: ~13 (EvidenceType, EvidenceCollectionRule, EvidenceRecord, CriterionEvidenceMapping, AssessmentRubric, ReadinessScore, GapRecord, AccreditationReport, ReportSection, ReportTemplate, SubmissionArtifact, RemediationPlan, ReadinessSnapshot).
**Dual mode**: Continuous background evidence collection (BullMQ jobs) + event-driven accreditation cycles.
**Regulatory bodies**: NAAC, NBA, AICTE, AISHE, University (JNTU).

#### D2: W10 — Student Exit & Transition (Weeks 19–22)

| Week | Focus | Sub-Workflows | Spec Section |
|------|-------|---------------|--------------|
| 19 | Core exit infrastructure: ClearanceWorkflow, ClearanceItem, ExitRequest, state machine | W10-L2-003-016 | §4,6 |
| 20 | Graduation: eligibility check, parallel clearance orchestration, record sealing | W10-L2-001-002,017-018 | §6,7 |
| 21 | Documents: template management, certificate/transcript generation, DigiLocker stub | W10-L2-019-023,028 | §7 |
| 22 | Dropout detection + exit interviews + alumni lifecycle + Juvi transition | W10-L2-024-027,029-035 | §7 |

**New models**: ClearanceWorkflow, ClearanceItem, ExitRequest, EscalationLog, DocumentTemplate, Document, Alumni.
**5 exit types**: Graduation, Dropout, Expulsion, Transfer, Year-Back. Each has distinct state machine paths.
**Clearance scope**: M03 (academic), M04 (financial), M08 (hostel/library/transport/lab), M05 (HR for faculty exits).

---

## 4. Cross-Module Integration Map

### Integration Points by Phase

| Source | Target | Integration | Phase | Type |
|--------|--------|-------------|-------|------|
| W01 → M04 | Fee structure resolution | Invoice on enrollment | A1/A3 | Event |
| W01 → M08 | Hostel/mess allocation | Room + subscription creation | A1/B2 | API call |
| W01 → M02 | Person + Student creation | Identity provisioning | A1 | API call |
| W01 → M12 | Account + RBAC | User provisioning | A1 | API call |
| W02 → M04 | Exam fee invoice | Fee clearance check | A2/A3 | API call |
| W02 → M05 | Faculty workload | Substitution cascade | A2/B1 | Event |
| W02 → M02 | Student state transition | Promotion/detention | A2 | API call |
| W02 → M10 | CO-PO evidence | Evidence push | A2/D1 | Event |
| W03 → M06 | Distress signal | Welfare referral | A3/C1 | Event |
| W03 → M02 | Student financial status | Financial hold | A3 | API call |
| W04 → M03 | CGPA/backlog read | Eligibility check | C3/A2 | API call |
| W04 → M06 | Stress/rejection signal | Counselling referral | C3/C1 | Event |
| W05 → M02 | Employee identity | Onboarding/exit | B1 | API call |
| W05 → M03 | Faculty assignment | Course delivery | B1/A2 | API call |
| W06 → M02 | Disciplinary record | Student record update | C1 | API call |
| W06 → M05 | Committee findings | HR action | C1/B1 | Event |
| W07 ← ALL | Evidence collection | All modules push | D1 | Event bus |
| W08 → M04 | Fee triggers | Hostel/transport/library fees | B2/A3 | Event |
| W08 → M06 | Welfare signals | Warden concerns | B2/C1 | Event |
| W09 → M07 | Portfolio | Career profile enrichment | C2/C3 | API call |
| W09 → M04 | Budget | Fund reservation/settlement | C2/A3 | API call |
| W10 ← ALL | Clearance | Parallel clearance from all | D2 | Orchestration |

### Shared Infrastructure Needed

| Component | Used By | Build In |
|-----------|---------|----------|
| Event bus (BullMQ) | W02, W03, W06, W07, W08, W09, W10 | Phase A (week 1) |
| State machine extensions | W01, W02, W03, W04, W05, W06, W10 | Phase A (week 1) |
| Notification service (M12.2) | ALL | Phase A (week 2) |
| SLA monitoring engine | W06, W07, W10 | Phase C (week 9) |
| Document generation (PDF) | W02, W10 | Phase D (week 21) |
| Clearance orchestrator | W10, W05 (exit) | Phase D (week 19) |

---

## 5. Metrics & Milestones

### Phase A Milestones (Weeks 1–12)

| Week | Milestone | Validation |
|------|-----------|------------|
| 2 | W01 management quota pipeline end-to-end | E2E: inquiry → applicant → allotment → offer → accept → enrolled |
| 4 | W02 attendance + CIE working | E2E: curriculum → timetable → attendance → CIE score |
| 6 | W03 invoice + payment collection | E2E: fee config → invoice → payment → receipt |
| 8 | W02 exam + results working | E2E: exam schedule → hall ticket → marks → grade → SGPA |
| 10 | W03 scholarships + defaulters | E2E: scholarship → credit → defaulter → hold → welfare referral |
| 12 | Operational core complete | All three workflows functioning together |

### Phase B Milestones (Weeks 5–16)

| Week | Milestone | Validation |
|------|-----------|------------|
| 7 | W05 leave workflow complete | E2E: apply → approve → balance deducted → attendance reconciled |
| 10 | W05 recruitment pipeline | E2E: requisition → approval → posting → shortlist → appointment |
| 12 | W08 hostel + library | E2E: allocation → attendance → fine → clearance |
| 16 | Campus operations live | All facility workflows operational |

### Phase C Milestones (Weeks 9–20)

| Week | Milestone | Validation |
|------|-----------|------------|
| 11 | W06 GGM grievance lifecycle | E2E: file → triage → assign → resolve → feedback |
| 15 | W06 statutory committees | E2E: complaint → investigation → hearing → decision |
| 16 | W09 club + event lifecycle | E2E: propose → approve → register → execute → close |
| 18 | W06 CCD risk scoring | E2E: multi-signal → score → alert → intervention |
| 20 | W04 placement season | E2E: season open → drive → application → interview → offer → accept |

### Phase D Milestones (Weeks 13–22)

| Week | Milestone | Validation |
|------|-----------|------------|
| 16 | W07 evidence registry + readiness | E2E: evidence collected → scored → gaps identified |
| 20 | W07 report generation | E2E: template → sections → review → approve → submit |
| 21 | W10 graduation pipeline | E2E: eligibility → clearance → seal → certificate → alumni |
| 22 | W10 all exit types | E2E: dropout detection → exit interview → clearance → transition |

---

## 6. Entity Creation Summary

### New Models Per Phase

| Phase | New Models | Enhanced Models | Total Delta |
|-------|------------|-----------------|-------------|
| A (W01+W02+W03) | ~40 | ~25 | 65 |
| B (W05+W08) | ~35 | ~15 | 50 |
| C (W06+W09+W04) | ~40 | ~20 | 60 |
| D (W07+W10) | ~20 | ~10 | 30 |
| **Total** | **~135** | **~70** | **205** |

Post-implementation: **177 existing + ~135 new = ~312 models**.

---

## 7. AI Agent Registry

| Agent ID | Module | Function | Autonomy Level |
|----------|--------|----------|----------------|
| AG-01 | M01 | Lead scoring, dedup, nurture | Autonomous with flags |
| M03-AI-01 | M03 | Timetable generation | Generates; human approves |
| M03-AI-02 | M03 | Attendance forecasting | Flags autonomously |
| M03-AI-03 | M03 | Mark anomaly detection | Flags; human validates |
| M03-AI-04 | M03 | Grade/SGPA/CGPA computation | Computes autonomously |
| M03-AI-05 | M03 | CO-PO attainment | Computes; human approves |
| M03-AI-06 | M03 | Compound risk scoring | Flags; humans decide |
| AG-04a | M07 | Company pipeline scoring | Recommends; TPO adjusts |
| AG-04b | M07 | Semantic job matching | Recommends; student applies |
| AG-04c | M07 | Dream policy enforcement | Enforces rules autonomously |
| AG-05 | M06 | Welfare signal correlation | **Flags only; humans decide** |
| AG-06 | M10 | Evidence collection + scoring | Collects; IQAC validates |
| AG-07 | M10 | Gap detection + remediation | Detects; IQAC decides |
| AG-08 | Juvi | Student companion | Read-only queries; escalates |

**Non-negotiable**: W06 welfare — AI flags; humans decide. No autonomous AI decisions on student welfare outcomes.

---

## 8. Spec Index

| Workflow | Spec File | Lines | Sub-Workflows |
|----------|-----------|-------|---------------|
| W01 Student Intake & Onboarding | `specs/2026-04-13-W01-student-intake-onboarding.md` | 865 | 76 |
| W02 Academic Year Delivery | `specs/2026-04-13-W02-academic-year-delivery.md` | 1,045 | 54 |
| W03 Fee Lifecycle & Revenue | `specs/2026-04-13-W03-fee-lifecycle-revenue.md` | 1,135 | 69 |
| W04 Placement Season | `specs/2026-04-13-W04-placement-season.md` | 1,399 | 80 |
| W05 Employee Lifecycle | `specs/2026-04-13-W05-employee-lifecycle.md` | 1,269 | 79 |
| W06 Student Welfare & Crisis | `specs/2026-04-13-W06-student-welfare-crisis.md` | 1,561 | 80 |
| W07 Accreditation & Compliance | `specs/2026-04-13-W07-accreditation-compliance.md` | 1,351 | ~40 |
| W08 Campus Life Operations | `specs/2026-04-13-W08-campus-life-operations.md` | 1,433 | 36+ |
| W09 Student Enrichment | `specs/2026-04-13-W09-student-enrichment.md` | 1,217 | ~45 |
| W10 Student Exit & Transition | `specs/2026-04-13-W10-student-exit-transition.md` | 1,945 | 44 |
| **Total** | | **13,220** | **~600** |

---

## 9. Execution Strategy

### Recommended Approach

Use **subagent-driven development** (proven in E2E testing phase). For each workflow phase:

1. Create a detailed task plan from the spec's implementation phases
2. Dispatch parallel agents for independent tasks
3. Sequential agents for dependent tasks
4. E2E test validation at each milestone
5. Code review agent after each phase

### Parallel Execution Opportunities

| Week | Can Run In Parallel |
|------|---------------------|
| 1-4 | W01 (logic) ‖ W02 (schema + curriculum + scheduling) |
| 5-8 | W02 (exams) ‖ W03 (fee config + invoicing) ‖ W05 (leave) |
| 9-12 | W03 (payments) ‖ W05 (recruitment) ‖ W06 (GGM) ‖ W08 (hostel) |
| 13-16 | W04 (entities) ‖ W06 (statutory) ‖ W07 (evidence) ‖ W09 (clubs) |
| 17-20 | W04 (drives) ‖ W06 (CCD) ‖ W07 (reports) ‖ W09 (portfolio) |
| 19-22 | W10 (exit + graduation + alumni) |

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Model name collisions | Already solved for Policy → RbacPolicy; audit all new models |
| Cross-module circular deps | Use event bus (BullMQ) for loose coupling; never import across modules |
| Payment gateway complexity | Start with mock gateway; real integration in Phase A3 week 8 |
| JNTU integration fragility | Circuit breaker + retry + manual fallback |
| Confidentiality enforcement (W06) | Middleware-level access control, not service-level |
| 177 → 312 model growth | Consistent patterns (collegeId, audit, pagination) keep it manageable |
