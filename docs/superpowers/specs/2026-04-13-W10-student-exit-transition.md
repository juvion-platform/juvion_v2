# W10 -- Student Exit & Transition: Implementation Specification

> **Status**: DRAFT | Date: 2026-04-13
> **Scope**: Graduation processing, voluntary withdrawal, expulsion, dropout formalization, inter-college transfer, clearance orchestration, document generation, alumni onboarding, dropout risk detection
> **Modules touched**: M02 People, M03 Academics, M04 Finance, M06 Welfare, M07 Placement, M08 Campus Ops, M09 Student Dev, M10 Compliance, M11 Governance, M12 Platform, Juvi AI (12 modules total)
> **Sub-workflows**: 44 (W10-L2-001 through W10-L2-044)

---

## 1. Executive Summary

W10 is the most cross-cutting workflow in Juvion v2. It governs how students leave the institution -- whether through graduation, voluntary withdrawal, expulsion, dropout formalization, or inter-college transfer. Each exit type shares a common clearance orchestration backbone but diverges in lifecycle transitions, document outputs, and post-exit outcomes.

### Five Exit Types

| Exit Type | Trigger | Terminal State | Documents Generated | Post-Exit Outcome |
|-----------|---------|---------------|--------------------|--------------------|
| **Graduation** | Final results published, eligibility confirmed | `graduated` | Transcript, Provisional Cert, Degree Cert, No-Dues, Migration (optional), Character (optional) | Alumni record created, Juvi transitions to alumni mode |
| **Withdrawal** | Student submits TC request | `withdrawn` | TC, Partial Transcript, No-Dues | Juvi deactivated, account deactivated |
| **Expulsion** | Disciplinary committee final decision | `expelled` | TC (noting expulsion), No-Dues | Immediate Juvi deactivation, campus access revoked |
| **Dropout** | Detected by M06 CCD, outreach exhausted | `withdrawn` (dropout) | TC (held for collection), Partial Transcript, No-Dues | Juvi deactivated, feeds attrition analytics |
| **Transfer** | Transfer request from student/destination | `transferred` | TC, Migration Cert, Transcript, No-Dues | Juvi deactivated, documents pushed to DigiLocker |

### Key Architectural Decisions

1. **Parallel clearance orchestration** via M12 using `ClearanceWorkflow` + `ClearanceItem` entities with SLA timers and automatic escalation
2. **Record sealing** -- once a student exits, their academic record becomes immutable (append-only audit trail)
3. **Alumni as first-class entity** -- graduates get a dedicated `Alumni` record with career tracking, mentor matching, and Juvi alumni experience
4. **Dropout detection is proactive** -- M06 correlates cross-module signals (attendance collapse, fee default, hostel checkout, Juvi withdrawal) to surface risk before formal dropout
5. **Document generation is template-driven** -- `DocumentTemplate` entities define certificate formats; AI populates them from student/academic data

---

## 2. Current Codebase State

### 2.1 What Exists

| Area | Current State | Location |
|------|--------------|----------|
| Student model | Has `status` enum: `prospective, active, year_back, detained, graduated, exited, alumni` | `backend/src/models/people/Student.ts` |
| Person model | Basic identity fields (name, phone, email, aadhaar, address) | `backend/src/models/people/Person.ts` |
| User model | Auth account with `role`, `personaType`, `isActive` flag | `backend/src/models/User.ts` |
| AlumniProfile model | Basic alumni info (personId, graduationYear, company, designation, willingToMentor) | `backend/src/models/placement/AlumniProfile.ts` |
| AlumniEvent model | Basic event CRUD (reunion, talk, mentoring, networking) | `backend/src/models/placement/AlumniEvent.ts` |
| PlacementOffer model | Offer tracking (company, package, status) linked to studentId | `backend/src/models/placement/PlacementOffer.ts` |
| Invoice model | Fee invoices by type (fee, hostel, transport, other) with status tracking | `backend/src/models/finance/Invoice.ts` |
| Refund model | Refund processing with approval workflow | `backend/src/models/finance/Refund.ts` |
| HostelAllocation | Student-room allocation with `active/vacated/transferred` status | `backend/src/models/welfare/HostelAllocation.ts` |
| TransportAllocation | Student-route allocation with `active/cancelled` status | `backend/src/models/welfare/TransportAllocation.ts` |
| SemesterResult | Per-semester results with SGPA, CGPA, backlogs, credits | `backend/src/models/academic-ops/SemesterResult.ts` |
| GradeCard | Per-course grades and marks per semester | `backend/src/models/academic-ops/GradeCard.ts` |
| CourseOutcome | CO-PO mapping for OBE compliance | `backend/src/models/academic-ops/CourseOutcome.ts` |
| Regulation | Academic regulation with totalCredits and maxYears | `backend/src/models/academic-structure/Regulation.ts` |
| CrisisAlert | Welfare crisis tracking (mental_health, ragging, etc.) | `backend/src/models/welfare/CrisisAlert.ts` |
| CounselingSession | Counseling session records | `backend/src/models/welfare/CounselingSession.ts` |
| Mentoring | Faculty-student mentoring records | `backend/src/models/student-dev/Mentoring.ts` |
| ClubMembership | Student club participation with status | `backend/src/models/student-dev/ClubMembership.ts` |
| Asset / AssetAllocation | Lab equipment and IT asset tracking | `backend/src/models/facilities/Asset.ts`, `AssetAllocation.ts` |
| WorkflowInstance | Generic workflow execution tracker with history | `backend/src/models/workflow/WorkflowInstance.ts` |
| WorkflowTask | Individual workflow task with assignee, SLA, status | `backend/src/models/workflow/WorkflowTask.ts` |
| Notification | Multi-channel notification delivery | `backend/src/models/communication/Notification.ts` |
| ComplianceCriteria | NAAC/NBA criteria with evidence tracking | `backend/src/models/compliance/ComplianceCriteria.ts` |
| RBAC Policy | Role-based access control with scope constraints | `backend/src/models/platform/Policy.ts` |
| People module | Full CRUD for Person/Student/Faculty/Staff/Parent/Org | `backend/src/modules/people/` |
| Placement module | CRUD for AlumniProfile, AlumniEvent, PlacementOffer, etc. | `backend/src/modules/placement/` |
| Juvi models | Conversation, Message, Persona, Usage metrics | `backend/src/models/juvi/` |

### 2.2 What Does NOT Exist (Gaps)

| Gap | Impact |
|-----|--------|
| **No exit/clearance workflow** | No mechanism to orchestrate parallel department clearances |
| **No `ClearanceWorkflow` or `ClearanceItem` entity** | Cannot track per-department clearance status with SLAs |
| **No `ExitRequest` entity** | Cannot record withdrawal/transfer requests with reasons |
| **No `Alumni` entity (distinct from AlumniProfile)** | AlumniProfile is placement-centric; lacks graduation data, engagement status, convocation tracking |
| **No `AlumniCareer` entity** | Cannot track career progression post-graduation |
| **No `AlumniEngagement` entity** | Cannot track alumni interactions (invitations, responses, mentor status) |
| **No `MentorMatch` entity** | Cannot match alumni mentors to current students |
| **No `DocumentTemplate` entity** | Cannot define certificate formats for TC, transcript, degree, etc. |
| **No `Document` (Vault) entity** | Cannot store generated, signed documents with DigiLocker tracking |
| **No `ExitInterview` entity** | Cannot capture structured exit reasons and feedback |
| **No `DropoutRiskAlert` entity** | Cannot surface proactive dropout risk signals |
| **No `EscalationLog` entity** | Cannot track clearance SLA escalations |
| **No `TransferRequest` entity** | Cannot manage inter-college transfer coordination |
| **No record sealing mechanism** | Student records can be mutated after exit |
| **No document generation pipeline** | No template engine for certificate PDF generation |
| **No DigiLocker integration** | No M12.4 INTG connector for document push |
| **No lifecycle state machine** | Student.status is a plain enum with no transition guards |
| **No dropout signal correlation** | No cross-module signal aggregation for risk detection |
| **Student.status enum is incomplete** | Missing `withdrawal_pending`, `expulsion_pending`, `transfer_pending`, `expelled`, `transferred` |
| **No graduation eligibility check** | No service that validates credits + CGPA + backlogs against regulation |
| **No alumni Juvi experience** | No account state transition from student to alumni mode |

---

## 3. Sub-Workflow Catalog

### 3.1 M02.2 STUID -- Exit Trigger & Lifecycle State Transition (7 sub-workflows)

#### W10-L2-001: Confirm Graduation Eligibility
- **Module**: M03.5 EXAM + M03.6 OBE
- **Exit Type**: Graduation
- **Trigger**: Final semester results published
- **Resolution**: Student confirmed as degree-eligible; `graduation_eligible = true`
- **Steps**:
  1. M03.5 publishes final semester results
  2. AI checks cumulative credit completion against regulation (R20/R23/R25)
  3. AI verifies minimum CGPA threshold met
  4. AI confirms zero active backlogs
  5. AI checks CO-PO attainment minimums (M03.6)
  6. If all pass: set `graduation_eligible = true` on Student
  7. If fail: flag specific deficiency and route to ST3 (Exam Cell)
- **Entities**: Student (R/U), SemesterResult (R), GradeCard (R), CourseOutcome (R), Regulation (R)
- **AI Scope**: L3 Auto -- eligibility check against regulation rules; flags edge cases (exactly at threshold, pending revaluation)
- **Exception Paths**: Pending revaluation holds eligibility; supplementary pending defers to next cycle; regulation mismatch triggers ST3 manual review

#### W10-L2-002: Transition Student to Graduated State
- **Module**: M02.2 STUID
- **Exit Type**: Graduation
- **Trigger**: Graduation eligibility confirmed (W10-L2-001)
- **Resolution**: Student `lifecycle_state = graduated`
- **Steps**:
  1. Validate all clearances complete (W10-L2-008 through W10-L2-015)
  2. Execute state transition: `active -> graduated`
  3. Record `graduation_date`, `degree_awarded`, `final_cgpa`
  4. Seal student record (immutable from this point)
  5. Trigger alumni record creation (W10-L2-028)
  6. Trigger document generation queue (W10-L2-017 through W10-L2-023)
  7. Notify student and parent via M12.2
- **Entities**: Student (U -- status, sealed), ExitRequest (R)
- **AI Scope**: L3 Auto -- state transition once all clearances verified; ST8 confirms if clearance exception exists
- **Exception Paths**: Clearance exception requires ST8 override with principal approval; delayed graduation handled in W10-L2-044

#### W10-L2-003: Process Voluntary Withdrawal Request
- **Module**: M02.2 STUID
- **Exit Type**: Withdrawal
- **Trigger**: Student submits TC request via portal or in-person
- **Resolution**: Withdrawal request recorded; clearance initiated
- **Steps**:
  1. Student or ST1 submits withdrawal request with reason
  2. System creates `ExitRequest` record
  3. AI categorizes reason (personal/financial/academic/transfer/other)
  4. Notify parent/guardian via M12.2
  5. If financial distress: route to M06.7 COUNS for exit interview before proceeding
  6. If approved: initiate parallel clearance (W10-L2-008)
  7. Set student status to `withdrawal_pending`
- **Entities**: Student (U -- status = withdrawal_pending), ExitRequest (C)
- **AI Scope**: L3 Auto -- request creation, reason classification, parent notification; ST8 reviews if reason requires counselling routing
- **Exception Paths**: Minor student requires mandatory parent consent; mid-semester triggers pro-rata refund; scholarship student triggers scholarship authority notification

#### W10-L2-004: Transition Student to Withdrawn State
- **Module**: M02.2 STUID
- **Exit Type**: Withdrawal
- **Trigger**: All clearances complete for voluntary withdrawal
- **Resolution**: Student `status = withdrawn`; TC issued
- **Steps**:
  1. Verify all clearances complete (financial, hostel, transport, library, lab, IT)
  2. Execute state transition: `active -> withdrawn` (or `withdrawal_pending -> withdrawn`)
  3. Record `exit_date`, `exit_reason`
  4. Seal student record
  5. Trigger TC generation (W10-L2-020)
  6. Trigger partial transcript generation (W10-L2-017)
  7. Deactivate Juvi account (W10-L2-035)
  8. Notify via M12.2
- **Entities**: Student (U -- status = withdrawn, sealed)
- **AI Scope**: L3 Auto -- state transition, document triggers, notifications; ST8 final confirmation
- **Exception Paths**: Outstanding dues waived requires principal approval recorded as clearance exception

#### W10-L2-005: Process Expulsion Exit
- **Module**: M02.2 STUID + M06.8 DISC
- **Exit Type**: Expulsion
- **Trigger**: Disciplinary committee final expulsion decision
- **Resolution**: Student `status = expelled`; exit processed urgently
- **Steps**:
  1. Receive expulsion decision from M06.8 DISC proceedings
  2. Principal ratifies expulsion (human decision point)
  3. Notify parent/guardian immediately (phone + written)
  4. Set student state: `active -> expelled` (or `suspended -> expelled`)
  5. Initiate parallel clearance with urgency flag (24hr SLA)
  6. Document expulsion reason linked to DISC case
  7. Trigger TC generation noting expulsion (W10-L2-020)
  8. Deactivate Juvi account immediately (W10-L2-035)
  9. Deactivate campus access (ID card, biometric)
  10. Archive M06.8 proceedings as sealed evidence
- **Entities**: Student (U -- status = expelled, sealed), DisciplinaryCase (R/U)
- **AI Scope**: L1 Human-led -- principal ratification mandatory; AI handles notifications, access deactivation, document triggers
- **Exception Paths**: Appeal filed holds expulsion execution; minor student has additional guardian notification protocols; hosteler requires immediate hostel vacation

#### W10-L2-006: Process Dropout Formalization
- **Module**: M02.2 STUID + M06.9 CCD
- **Exit Type**: Dropout
- **Trigger**: Dropout detected by M06.9 CCD and outreach exhausted
- **Resolution**: Student `status = withdrawn` (formalized dropout)
- **Steps**:
  1. Receive dropout confirmation from welfare outreach (W10-L2-025)
  2. If student contactable and willing: process as voluntary withdrawal (W10-L2-003)
  3. If student unreachable: ST8 initiates administrative withdrawal
  4. Document dropout reason and all outreach attempts
  5. Execute state transition: `active -> withdrawn` (dropout subtype)
  6. Initiate clearance -- departments verify unilaterally (student absent)
  7. Generate TC and hold for collection
  8. Deactivate Juvi account
  9. Record for M11 dropout analytics
- **Entities**: Student (U -- status = withdrawn), DropoutRecord (C), WelfareCase (R)
- **AI Scope**: L2 Recommend -- dropout classification, analytics feed; ST8 initiates administrative withdrawal
- **Exception Paths**: Student returns triggers reinstatement (separate); deceased student triggers posthumous handling (W10-L2-042)

#### W10-L2-007: Process Inter-College Transfer
- **Module**: M02.2 STUID
- **Exit Type**: Transfer
- **Trigger**: Transfer request from student or destination institution
- **Resolution**: Student `status = transferred`; migration documents issued
- **Steps**:
  1. Student submits transfer request with destination institution details
  2. ST8 verifies transfer eligibility (enrollment duration, academic standing)
  3. Parent/guardian consent obtained
  4. Principal approves transfer
  5. Initiate parallel clearance (W10-L2-008)
  6. Coordinate with destination institution (manual)
  7. Execute state transition: `active -> transferred`
  8. Generate TC + Migration Certificate (W10-L2-020, W10-L2-021)
  9. Generate transcript (W10-L2-017)
  10. Push documents to DigiLocker
  11. Deactivate Juvi account
- **Entities**: Student (U -- status = transferred, sealed), TransferRequest (C)
- **AI Scope**: L3 Auto -- clearance orchestration, document generation, DigiLocker push; Principal approval and destination institution coordination are human
- **Exception Paths**: Transfer to different university requires Migration Certificate from university registrar; mid-semester transfer limits academic record to last completed semester

### 3.2 M12 -- Parallel Clearance Orchestration (9 sub-workflows)

#### W10-L2-008: Initiate Parallel Clearance Workflow
- **Module**: M12.3 AI
- **Exit Type**: All
- **Trigger**: Any exit type confirmed and state set to `*_pending` or exit approved
- **Resolution**: All clearance departments notified simultaneously; tracking dashboard created
- **Steps**:
  1. AI creates `ClearanceWorkflow` record with exit type and student_id
  2. Generate clearance checklist based on student profile (hosteler? transport user? lab user?)
  3. Send simultaneous notifications to all applicable clearance authorities
  4. Create clearance tracking dashboard visible to ST8 and student
  5. Set SLA timers per clearance item (24hr for urgent/expulsion, 72hr standard)
  6. Monitor completion status in real-time
  7. Escalate overdue items: HOD -> Principal
- **Entities**: ClearanceWorkflow (C), ClearanceItem (C -- one per department)
- **AI Scope**: L3 Auto -- checklist generation, simultaneous notification, SLA monitoring, escalation
- **Exception Paths**: Student has no hostel/transport skips those items; urgent exit (expulsion) uses 24hr SLA; student absent (dropout) triggers unilateral clearance

#### W10-L2-009: Process Financial Clearance
- **Module**: M04.5 DEFAULT + M04.3 COLLECT
- **Exit Type**: All
- **Trigger**: Clearance workflow initiated
- **Resolution**: Financial clearance granted or exception documented
- **Steps**:
  1. AI scans all open invoices across fee types (tuition, hostel, transport, library fines, lab breakage)
  2. Calculate total outstanding amount
  3. If zero: auto-grant financial clearance
  4. If outstanding: notify student and parent with itemized dues
  5. Process incoming payments
  6. Calculate refund for prepaid amounts (pro-rata for mid-term exit)
  7. If hardship: route to M06 welfare for fee waiver consideration
  8. ST2 (Accounts) grants clearance once settled or waived
  9. Generate No-Dues entry for finance
- **Entities**: Invoice (R), Payment (R/C for refund), ClearanceItem (U -- finance), Refund (C if applicable)
- **AI Scope**: L2 Recommend -- outstanding calculation, refund computation, zero-balance auto-clear; ST2 confirms, hardship waiver decision is human
- **Exception Paths**: Disputed charges resolved by ST2; scholarship clawback notifies authority; hardship waiver requires principal approval

#### W10-L2-010: Process Hostel Clearance
- **Module**: M08.1 HOSTEL
- **Exit Type**: All (hostelers only, conditional)
- **Trigger**: Clearance workflow initiated; student is hosteler
- **Resolution**: Hostel clearance granted; room de-allocated
- **Steps**:
  1. ST6 (Warden) receives clearance notification
  2. Physical room inspection: verify vacated, furniture intact, keys returned
  3. Document any damage (linked to damage deposit)
  4. Calculate hostel dues (rent arrears + damage charges - deposit refund)
  5. If dues: route amount to M04 for collection
  6. De-allocate room: update occupancy, mark bed available
  7. Remove student from hostel attendance rolls
  8. ST6 grants hostel clearance
  9. Update ClearanceItem status
- **Entities**: HostelAllocation (U/D -- de-allocated), HostelRoom (U -- occupancy), ClearanceItem (U)
- **AI Scope**: L1 Human-led -- physical inspection, damage assessment; AI handles notification, de-allocation update
- **Exception Paths**: Damage dispute escalated to DSW; student absent triggers unilateral warden inspection, holds deposit

#### W10-L2-011: Process Transport Clearance
- **Module**: M08.3 TRANSPORT
- **Exit Type**: All (transport users only, conditional)
- **Trigger**: Clearance workflow initiated; student has transport allocation
- **Resolution**: Transport clearance granted; route allocation removed
- **Steps**:
  1. ST6 (Transport) receives clearance notification
  2. Verify no outstanding transport dues
  3. Remove student from route allocation
  4. Update route passenger count
  5. If transport pass/ID issued: collect or mark deactivated
  6. Grant transport clearance
  7. Update ClearanceItem status
- **Entities**: TransportAllocation (D), TransportRoute (U -- count), ClearanceItem (U)
- **AI Scope**: L3 Auto -- allocation removal, count update; pass collection verification is human
- **Exception Paths**: Mid-term exit triggers pro-rata transport fee refund via M04

#### W10-L2-012: Process Library Clearance
- **Module**: M08.4 LIBRARY
- **Exit Type**: All
- **Trigger**: Clearance workflow initiated
- **Resolution**: Library clearance granted; no outstanding books or fines
- **Steps**:
  1. ST6 (Librarian) receives clearance notification
  2. AI checks circulation records: any books issued to student?
  3. If books outstanding: notify student with return deadline
  4. Verify all books returned
  5. Check library fines: if unpaid, route to M04
  6. Deactivate library membership
  7. Grant library clearance
  8. Update ClearanceItem status
- **Entities**: BookIssue (R/U), LibraryMember (U -- deactivated), ClearanceItem (U)
- **AI Scope**: L3 Auto -- outstanding book check, fine calculation; librarian confirms physical return
- **Exception Paths**: Lost book triggers replacement cost added to M04 dues; rare book escalates to library committee

#### W10-L2-013: Process Lab Clearance
- **Module**: M08.5 LABS
- **Exit Type**: All
- **Trigger**: Clearance workflow initiated
- **Resolution**: Lab clearance granted; all equipment returned
- **Steps**:
  1. ST6 (Lab Technician) receives clearance notification
  2. Check equipment issue register for student
  3. Verify all issued equipment returned and in working condition
  4. If breakage/loss: compute replacement cost, route to M04
  5. Verify lab records and project submissions complete
  6. Grant lab clearance
  7. Update ClearanceItem status
- **Entities**: AssetAllocation (R/U), ClearanceItem (U)
- **AI Scope**: L2 Recommend -- equipment check against issue register; physical verification and breakage assessment are human
- **Exception Paths**: Equipment under repair holds clearance; shared project equipment requires team clearance

#### W10-L2-014: Process Academic Clearance
- **Module**: M03.4 TEACH + M03.5 EXAM
- **Exit Type**: All
- **Trigger**: Clearance workflow initiated
- **Resolution**: Academic clearance granted; all submissions and records complete
- **Steps**:
  1. F1 (course faculty) receives clearance notification for each enrolled course
  2. Verify all assignments submitted
  3. Verify lab records/journals complete and signed
  4. Verify project submissions (final year: project viva completed)
  5. ST3 verifies all exam records finalized
  6. Each F1 grants clearance per course
  7. Aggregate: all course clearances = academic clearance granted
  8. Update ClearanceItem status
- **Entities**: Enrollment (R), InternalAssessment (R), ClearanceItem (U)
- **AI Scope**: L2 Recommend -- submission completeness check, aggregation; F1 verifies quality, ST3 confirms exam records
- **Exception Paths**: Incomplete project triggers F1 extension or incomplete flag; missing internal marks escalated to HOD

#### W10-L2-015: Process IT & Platform Clearance
- **Module**: M12.1 IAC
- **Exit Type**: All
- **Trigger**: Clearance workflow initiated
- **Resolution**: All system access revoked; account deactivated or transitioned
- **Steps**:
  1. ST7 (IT Admin) receives clearance notification
  2. Deactivate institutional email (if applicable)
  3. Revoke LMS access
  4. Deactivate biometric/ID card access
  5. Revoke Juvion portal access (downgrade to read-only for graduates transitioning to alumni)
  6. For graduates: transition account to alumni role (W10-L2-030)
  7. For non-graduates: full deactivation
  8. Grant IT clearance
  9. Update ClearanceItem status
- **Entities**: User (U -- isActive/role), ClearanceItem (U)
- **AI Scope**: L3 Auto -- access revocation across systems; ST7 confirms physical ID card return
- **Exception Paths**: Data export request allows student to download personal data before deactivation

#### W10-L2-016: Track and Escalate Overdue Clearances
- **Module**: M12.3 AI
- **Exit Type**: All
- **Trigger**: Any clearance item exceeds SLA deadline
- **Resolution**: Overdue clearance escalated and resolved
- **Steps**:
  1. AI monitors all ClearanceItem SLA timers
  2. At 75% SLA: send reminder to clearance authority
  3. At 100% SLA: escalate to HOD of that department
  4. At 150% SLA: escalate to Principal with student exit blocked alert
  5. Log all escalation events
  6. Update clearance dashboard
  7. Once resolved: record resolution time for SLA analytics
- **Entities**: ClearanceItem (R/U), EscalationLog (C)
- **AI Scope**: L3 Auto -- all monitoring, reminders, escalation routing; HOD/Principal intervenes on overdue items
- **Exception Paths**: Clearance authority unavailable auto-routes to deputy or HOD

### 3.3 M02.5 VAULT -- Exit Document Generation (7 sub-workflows)

#### W10-L2-017: Generate Consolidated Transcript
- **Module**: M02.5 VAULT + M03.5 EXAM
- **Exit Type**: All
- **Trigger**: Exit clearances complete (or academic clearance for partial transcript)
- **Resolution**: Consolidated transcript generated, signed, issued
- **Steps**:
  1. Pull all semester results from M03.5 (marks, grades, credits, SGPA)
  2. Compute final CGPA
  3. Pull CO-PO attainment summary from M03.6
  4. Populate transcript template from DocumentTemplate
  5. Include regulation code, programme, branch, batch
  6. For non-graduates: mark as "transcript up to Semester X"
  7. Route for digital signature: Registrar (ST8)
  8. Generate signed PDF
  9. Store in Document Vault
  10. Push to DigiLocker via M12.4 INTG
- **Entities**: Document (C), DocumentTemplate (R), SemesterResult (R), GradeCard (R), Student (R)
- **AI Scope**: L3 Auto (generation), L1 (signing) -- data aggregation, template population, DigiLocker push are auto; ST8 signs
- **Exception Paths**: Pending revaluation holds transcript or issues provisional; backlogs clearly marked per university format

#### W10-L2-018: Generate Provisional Certificate
- **Module**: M02.5 VAULT
- **Exit Type**: Graduation
- **Trigger**: Graduation confirmed; before convocation
- **Resolution**: Provisional certificate issued
- **Steps**:
  1. Populate provisional certificate template with student identity, degree, CGPA
  2. Route for signatures: Principal + Registrar
  3. Generate signed PDF
  4. Store in Document Vault
  5. Push to DigiLocker
  6. Notify student
- **Entities**: Document (C), DocumentTemplate (R)
- **AI Scope**: L3 Auto (generation), L1 (signing)
- **Exception Paths**: None -- straightforward once graduation confirmed

#### W10-L2-019: Generate Degree Certificate
- **Module**: M02.5 VAULT
- **Exit Type**: Graduation
- **Trigger**: Convocation scheduled or direct collection authorized
- **Resolution**: Degree certificate generated, signed, ready for issuance
- **Steps**:
  1. Populate degree certificate template per university (JNTU) format
  2. Include: student name, father name, programme, branch, regulation, CGPA, class/distinction
  3. Include university registration number and date of birth
  4. Route for signatures: Principal + University Registrar
  5. Generate embossed/sealed copy (physical) + signed PDF (digital)
  6. Store in Document Vault
  7. Push digital copy to DigiLocker
  8. Mark `convocation_status` on Alumni record
- **Entities**: Document (C), DocumentTemplate (R), Alumni (U -- convocation_status)
- **AI Scope**: L3 Auto (generation), L1 (signing -- Principal signs, university registrar coordinates)
- **Exception Paths**: Delayed graduation issues degree at next convocation; name correction requires university approval before generation

#### W10-L2-020: Generate Transfer Certificate (TC)
- **Module**: M02.5 VAULT
- **Exit Type**: Withdrawal, Expulsion, Transfer
- **Trigger**: All clearances complete for non-graduation exit
- **Resolution**: TC generated, signed, issued
- **Steps**:
  1. Populate TC template with student identity, dates of study, conduct record
  2. For expulsion: TC notes "removed from rolls" per university convention
  3. For transfer: TC notes "transferred to [institution]"
  4. Include no-dues confirmation reference
  5. Route for signatures: Principal + Registrar
  6. Generate signed PDF
  7. Store in Document Vault
  8. Push to DigiLocker
  9. Notify student/parent: TC ready for collection
- **Entities**: Document (C), DocumentTemplate (R), Student (R)
- **AI Scope**: L3 Auto (generation), L1 (signing)
- **Exception Paths**: Expulsion TC carefully worded per legal guidelines; duplicate TC requires affidavit and fee

#### W10-L2-021: Generate Migration Certificate
- **Module**: M02.5 VAULT + M12.4 INTG
- **Exit Type**: Transfer, Graduation (if inter-university)
- **Trigger**: Transfer approved or graduate moving to different university
- **Resolution**: Migration certificate issued via university registrar
- **Steps**:
  1. ST8 submits migration certificate request to university (JNTU)
  2. Coordinate via M12.4 INTG if university portal available, else manual
  3. Upon university issuance: receive and store in Document Vault
  4. Notify student
  5. Push to DigiLocker
- **Entities**: Document (C), ExternalRequest (C)
- **AI Scope**: L3 Auto for notification and DigiLocker push; ST8 coordinates with university
- **Exception Paths**: University delay triggers escalation protocol via principal

#### W10-L2-022: Generate No-Dues Certificate
- **Module**: M02.5 VAULT
- **Exit Type**: All
- **Trigger**: All clearance items marked complete
- **Resolution**: No-dues certificate auto-generated
- **Steps**:
  1. Verify all ClearanceItems in ClearanceWorkflow are `status = complete`
  2. Auto-generate no-dues certificate listing all departments cleared with dates
  3. Store in Document Vault
  4. This is prerequisite for TC/Degree generation
- **Entities**: Document (C), ClearanceItem (R), ClearanceWorkflow (R)
- **AI Scope**: L4 Full Auto -- no human signature needed
- **Exception Paths**: Clearance with exception (waiver) noted on certificate

#### W10-L2-023: Generate Character Certificate
- **Module**: M02.5 VAULT + M06.8 DISC
- **Exit Type**: All (on request)
- **Trigger**: Student or employer requests character certificate
- **Resolution**: Character certificate generated with conduct record
- **Steps**:
  1. Student submits character certificate request
  2. AI checks M06.8 discipline record
  3. If clean record: generate standard good-conduct certificate
  4. If disciplinary record: flag for Principal review to determine wording
  5. Route for signature: Principal
  6. Store in Document Vault
- **Entities**: Document (C), DisciplinaryCase (R)
- **AI Scope**: L3 Auto for clean records; L1 Human-led if disciplinary history exists
- **Exception Paths**: Active disciplinary case withholds certificate until resolved

### 3.4 M06.9 CCD + M06.7 COUNS -- Dropout Detection & Intervention (4 sub-workflows)

#### W10-L2-024: Detect Dropout Risk Signals
- **Module**: M06.9 CCD
- **Exit Type**: Dropout
- **Trigger**: Continuous monitoring -- AI detects compound risk signals
- **Resolution**: At-risk student flagged to ST5 with risk score and signal summary
- **Steps**:
  1. AI correlates signals across modules:
     - M03: prolonged absence (>2 weeks), academic collapse (SGPA < 4.0)
     - M04: fee default with distress indicators
     - M08: hostel checkout without formal process
     - Juvi: communication withdrawal, isolation pattern
     - M06: prior welfare flags
  2. Compute compound dropout risk score (0-100)
  3. If score exceeds threshold (configurable, default 70): create `DropoutRiskAlert`
  4. Surface to ST5 (Welfare Staff) with signal breakdown
  5. Route to M06.6 MENT mentor if assigned
- **Entities**: DropoutRiskAlert (C), Student (R), AttendanceRecord (R), Invoice (R), HostelAllocation (R), JuviConversation (R), CrisisAlert (R)
- **AI Scope**: L2 Recommend -- all signal correlation, score computation, alert creation; ST5 reviews and decides action
- **Exception Paths**: False positive dismissed by ST5 with reason logged; multiple students flagged are priority-ranked by risk score

#### W10-L2-025: Conduct Dropout Outreach
- **Module**: M06.7 COUNS + M06.6 MENT
- **Exit Type**: Dropout
- **Trigger**: Dropout risk alert created (W10-L2-024) or prolonged absence
- **Resolution**: Student contacted; situation assessed; next action determined
- **Steps**:
  1. ST5 initiates welfare outreach (phone, visit, parent contact)
  2. F1 mentor reaches out if relationship exists
  3. Document all contact attempts
  4. If student contactable: conduct welfare interview, assess root cause (financial/family/academic/mental health), connect to support or facilitate clean exit
  5. If student unreachable after protocol attempts: document as dropout candidate
- **Entities**: WelfareCase (C/U), OutreachAttempt (C), DropoutRiskAlert (U)
- **AI Scope**: L1 Human-led -- all outreach conversations, assessment, decision; AI handles tracking and attempt logging
- **Exception Paths**: Student in crisis escalates to M06.7 COUNS immediately; parent unreachable escalates to Principal

#### W10-L2-026: Conduct Exit Interview
- **Module**: M06.7 COUNS
- **Exit Type**: Withdrawal, Dropout
- **Trigger**: Student confirmed leaving (voluntary or formalized dropout)
- **Resolution**: Exit interview completed; dropout reason documented
- **Steps**:
  1. Counsellor or ST5 conducts structured exit interview
  2. Document primary and secondary exit reasons (coded taxonomy)
  3. Capture student feedback on institutional experience
  4. Assess if any welfare follow-up needed post-exit
  5. Record in `ExitInterview` entity
  6. Feed anonymized data to M11.3 PREDICT for dropout pattern analysis
- **Entities**: ExitInterview (C), WelfareCase (U)
- **AI Scope**: L1 Human-led for interview; L4 Full Auto for analytics feed
- **Exception Paths**: Student refuses interview documented as refusal, proceed; distress indicators trigger immediate M06.7 referral

#### W10-L2-027: Close Expulsion Proceedings
- **Module**: M06.8 DISC
- **Exit Type**: Expulsion
- **Trigger**: Expulsion executed (W10-L2-005)
- **Resolution**: Disciplinary case closed; proceedings archived as sealed evidence
- **Steps**:
  1. Link DisciplinaryCase to student exit record
  2. Archive all proceedings documents (committee minutes, evidence, appeal records)
  3. Seal case: immutable from this point
  4. Update case status to `Closed`
  5. Feed anonymized outcome to M10 compliance evidence
  6. If appeal window open: note appeal deadline
- **Entities**: DisciplinaryCase (U -- closed/sealed), Document (C -- proceedings archive)
- **AI Scope**: L3 Auto -- archival, sealing, compliance feed; ST5/ST8 confirms closure
- **Exception Paths**: Appeal filed post-closure reopens case, holds sealed status

### 3.5 M02.6 ALUMNI + M07.7 + Juvi.8 -- Alumni Onboarding (7 sub-workflows)

#### W10-L2-028: Create Alumni Record
- **Module**: M02.6 ALUMNI
- **Exit Type**: Graduation
- **Trigger**: Student transitioned to Graduated (W10-L2-002)
- **Resolution**: Alumni record created with graduation data
- **Steps**:
  1. Create `Alumni` entity from Student record
  2. Copy: personId, studentId, graduation_date, degree_awarded, final_cgpa, programmeId, branchId, batchId
  3. Set `convocation_status = pending`
  4. Set `engagement_status = active`
  5. Set `last_contact_date = graduation_date`
- **Entities**: Alumni (C), Student (R)
- **AI Scope**: L4 Full Auto -- deterministic creation from student data
- **Exception Paths**: None

#### W10-L2-029: Seed Initial Career Record from Placement
- **Module**: M07.7 ALUMNI + M07.4 OFFERS
- **Exit Type**: Graduation
- **Trigger**: Alumni record created (W10-L2-028)
- **Resolution**: First AlumniCareer record created from placement data
- **Steps**:
  1. Check M07.4 for placement outcome: placed? offer accepted?
  2. If placed: create `AlumniCareer` record with employer, job_title, location from PlacementOffer
  3. If not placed: create record with `status = unknown`; career tracking invitation sent
  4. Link career record to alumni_id
- **Entities**: AlumniCareer (C), PlacementOffer (R)
- **AI Scope**: L4 Full Auto -- data copy from placement module
- **Exception Paths**: No placement data creates career record with `status = unknown`

#### W10-L2-030: Transition Juvi Account to Alumni
- **Module**: Juvi.8 LIFECYCLE
- **Exit Type**: Graduation
- **Trigger**: Alumni record created (W10-L2-028)
- **Resolution**: Juvi account transitioned to alumni state with appropriate access
- **Steps**:
  1. Execute Juvi account state transition: `active -> alumni`
  2. Modify access: remove academic channels, retain batch group (read-only)
  3. Auto-subscribe to alumni-specific channels (alumni batch, alumni placement)
  4. Update home screen to alumni experience (career updates, reunion events, giving)
  5. Limit AI Companion scope (career queries, alumni events -- no academic)
  6. Retain DM capability with opt-in students and other alumni/faculty
- **Entities**: JuviConversation (U -- scope limited), ChannelMembership (C/U/D)
- **AI Scope**: L4 Full Auto -- automated account transition
- **Exception Paths**: Student opts out of alumni Juvi triggers full deactivation instead

#### W10-L2-031: Auto-Subscribe Alumni to Channels
- **Module**: Juvi.1 SPACE
- **Exit Type**: Graduation
- **Trigger**: Juvi account transitioned to alumni (W10-L2-030)
- **Resolution**: Alumni subscribed to relevant channels
- **Steps**:
  1. Subscribe to alumni batch channel (Class of [year])
  2. Subscribe to alumni placement channel
  3. Subscribe to department alumni channel
  4. Create channel if first graduate of that batch
  5. Post farewell notification to original batch channel
- **Entities**: Channel (R/C if new), ChannelMembership (C)
- **AI Scope**: L4 Full Auto
- **Exception Paths**: None

#### W10-L2-032: Send Career Tracking Invitation
- **Module**: M07.7 ALUMNI
- **Exit Type**: Graduation
- **Trigger**: 1 week after graduation
- **Resolution**: Alumni invited to provide career updates; tracking initiated
- **Steps**:
  1. Generate personalized career tracking invitation
  2. Send via M12.2 (email + Juvi notification)
  3. Include career update form link, alumni network benefits, mentor matching opt-in
  4. If no response in 30 days: send reminder
  5. If no response in 90 days: mark `engagement_status = inactive`
- **Entities**: AlumniEngagement (C), Alumni (R/U -- engagement_status)
- **AI Scope**: L3 Auto -- invitation generation, reminder scheduling, status update; TPO (ST4) reviews inactive alumni quarterly
- **Exception Paths**: Email bounced marks contact stale, attempts via Juvi/phone

#### W10-L2-033: Onboard Alumni to Mentor Network
- **Module**: M07.7 ALUMNI
- **Exit Type**: Graduation
- **Trigger**: Alumni opts into mentoring via career tracking invitation
- **Resolution**: Alumni registered as mentor; matched with students
- **Steps**:
  1. Alumni completes mentor profile (expertise, availability, willingness)
  2. AI matches alumni to current students based on branch, interests, career path
  3. Create mentor-mentee suggestions visible to TPO (ST4)
  4. ST4 facilitates introduction
  5. Track mentoring engagement
- **Entities**: AlumniEngagement (C -- mentor), MentorMatch (C)
- **AI Scope**: L2 Recommend -- profile creation, matching algorithm; ST4 facilitates
- **Exception Paths**: Alumni declines triggers no further mentor outreach

#### W10-L2-034: Post Farewell Notification to Batch
- **Module**: Juvi.5 CONTENT + M12.2 COMMS
- **Exit Type**: Graduation
- **Trigger**: Student graduated and Juvi transitioned
- **Resolution**: Batch channel receives farewell notification
- **Steps**:
  1. Generate farewell notification for graduating student
  2. Post to batch/department channel
  3. Include alumni channel link, career tracking invitation
  4. Respect student privacy preferences (opt-out of public farewell)
- **Entities**: Post (C), Notification (C)
- **AI Scope**: L4 Full Auto
- **Exception Paths**: Student opts out skips public post, sends private notification only

### 3.6 Juvi.8 + M12.1 -- Non-Graduate Account Deactivation (2 sub-workflows)

#### W10-L2-035: Deactivate Juvi Account (Non-Graduate)
- **Module**: Juvi.8 LIFECYCLE
- **Exit Type**: Withdrawal, Expulsion, Dropout, Transfer
- **Trigger**: Non-graduation exit confirmed
- **Resolution**: Juvi account fully deactivated
- **Steps**:
  1. Execute Juvi account transition: `active -> deactivated`
  2. Remove from all channels
  3. Archive message history (retained per data retention policy)
  4. Disable all access
  5. For expulsion: immediate deactivation (no grace period)
  6. For withdrawal/transfer: 7-day grace period for data export
- **Entities**: JuviConversation (U -- archived), ChannelMembership (D)
- **AI Scope**: L4 Full Auto
- **Exception Paths**: Student requests data export within grace period

#### W10-L2-036: Deactivate Platform Account (Non-Graduate)
- **Module**: M12.1 IAC
- **Exit Type**: Withdrawal, Expulsion, Dropout, Transfer
- **Trigger**: IT clearance complete (W10-L2-015)
- **Resolution**: Juvion platform account deactivated; all access revoked
- **Steps**:
  1. Downgrade RBAC role to `None`
  2. Revoke all active sessions
  3. Deactivate login credentials (User.isActive = false)
  4. Retain audit trail per data retention policy
  5. Archive user record (not deleted)
- **Entities**: User (U -- isActive = false, role revoked)
- **AI Scope**: L3 Auto -- role revocation, session termination; ST7 confirms
- **Exception Paths**: None

### 3.7 M10 + M11 -- Compliance & Analytics Feed (4 sub-workflows)

#### W10-L2-037: Feed Exit Data as Compliance Evidence
- **Module**: M10.1 EVID
- **Exit Type**: All
- **Trigger**: Any student exit completed
- **Resolution**: Exit data recorded as NAAC/NBA compliance evidence
- **Steps**:
  1. Generate compliance evidence records: graduation rate, completion time, exit type distribution, placement-at-exit rate
  2. Map to NAAC criteria (Criterion 2: Student Performance)
  3. Map to NBA criteria (graduate attributes)
  4. Store in Evidence Registry with source references
- **Entities**: ComplianceCriteria (U -- evidence appended)
- **AI Scope**: L4 Full Auto
- **Exception Paths**: None

#### W10-L2-038: Update Attrition & Dropout Dashboard
- **Module**: M11.1 DASH
- **Exit Type**: All
- **Trigger**: Any student exit completed
- **Resolution**: Institutional dashboards updated
- **Steps**:
  1. Update KPIs: batch attrition rate, dropout rate by branch/programme, exit reason distribution, year-wise completion rate, time-to-graduation distribution
  2. Refresh trend comparisons (YoY, programme-wise)
  3. Feed into M11.3 PREDICT for future dropout risk modelling
- **Entities**: DashboardKPI (U), PredictiveSignal (C/U)
- **AI Scope**: L4 Full Auto
- **Exception Paths**: None

#### W10-L2-039: Update Graduation Rate Trends
- **Module**: M11.1 DASH + M11.3 PREDICT
- **Exit Type**: Graduation
- **Trigger**: Batch graduation processing complete
- **Resolution**: Graduation rate analytics updated; trends published
- **Steps**:
  1. Compute batch graduation rate (graduated / admitted in same batch)
  2. Compute programme-wise, branch-wise rates
  3. Compare against institutional targets and peer benchmarks
  4. Flag any programme with rate below threshold
  5. Publish to Principal dashboard
- **Entities**: DashboardKPI (U), Alert (C if below threshold)
- **AI Scope**: L4 Full Auto
- **Exception Paths**: None

#### W10-L2-040: Archive Student Activity & Portfolio Data
- **Module**: M09 + M02.2
- **Exit Type**: All
- **Trigger**: Student exit confirmed
- **Resolution**: Co-curricular portfolio archived with student record
- **Steps**:
  1. Snapshot student portfolio from M09 (clubs, events, achievements, NCC/NSS)
  2. Archive portfolio as sealed document in M02.5 VAULT
  3. For graduates: link portfolio to alumni career profile
  4. For non-graduates: archive with student record
  5. Deactivate active club memberships
- **Entities**: ClubMembership (U -- status = inactive), Achievement (R), Document (C -- portfolio snapshot)
- **AI Scope**: L4 Full Auto
- **Exception Paths**: None

### 3.8 M06.6 MENT -- Faculty Relationship Closure (1 sub-workflow)

#### W10-L2-041: Close Faculty Advisor Relationship
- **Module**: M06.6 MENT
- **Exit Type**: All
- **Trigger**: Student exit confirmed
- **Resolution**: Mentoring relationship closed; advisor notified
- **Steps**:
  1. Identify assigned faculty mentor from Mentoring
  2. Notify F1: student exiting, mentoring relationship closing
  3. Update mentoring record: `status = closed`, `close_reason = exit_type`
  4. For graduates: F1 can reconnect via alumni network
  5. For dropouts: F1 notified of welfare outcome
- **Entities**: Mentoring (U -- status = closed)
- **AI Scope**: L3 Auto -- notification, status update; F1 acknowledged
- **Exception Paths**: None

### 3.9 Exception Paths (3 sub-workflows)

#### W10-L2-042: Process Posthumous Degree
- **Module**: M02.2 STUID + M02.5 VAULT
- **Exit Type**: Exception
- **Trigger**: Student deceased during enrollment or after completing requirements
- **Resolution**: Posthumous degree issued; parent/guardian receives documents
- **Steps**:
  1. ST8 receives notification of student death with documentation
  2. Principal initiates posthumous degree process
  3. Verify academic standing at time of death
  4. If requirements met: issue degree posthumously; if not: institutional discretion (honorary)
  5. Generate degree certificate with "posthumously awarded" notation
  6. All clearances waived automatically
  7. Parent/guardian invited to convocation
  8. Student record sealed with deceased notation
  9. Juvi account memorialized or deactivated per family preference
- **Entities**: Student (U -- deceased/sealed), Document (C), Alumni (C -- posthumous)
- **AI Scope**: L1 Human-led -- Principal decision, family coordination; AI handles clearance waiver, document generation
- **Exception Paths**: Family requests privacy skips public announcement; pending disciplinary case resolved compassionately

#### W10-L2-043: Process Degree Revocation
- **Module**: M02.6 ALUMNI + M02.5 VAULT
- **Exit Type**: Exception
- **Trigger**: Fraud or academic misconduct discovered post-graduation
- **Resolution**: Degree revoked; alumni record updated; regulatory authorities notified
- **Steps**:
  1. Investigation confirms fraud
  2. Governing body approves revocation
  3. Revoke degree certificate: Document status = `revoked`
  4. Notify university registrar
  5. Update DigiLocker: revoke issued document
  6. Update Alumni record: `engagement_status = revoked`
  7. Notify alumnus formally
  8. Archive revocation proceedings
  9. Report to regulatory body (AICTE/university)
- **Entities**: Document (U -- revoked), Alumni (U -- revoked)
- **AI Scope**: L1 Human-led -- governing body decision, legal review; AI handles DigiLocker revocation, notifications
- **Exception Paths**: Legal challenge involves institutional legal counsel; alumnus unreachable triggers public notice per university regulations

#### W10-L2-044: Process Delayed Graduation
- **Module**: M02.2 STUID + M03.5 EXAM
- **Exit Type**: Exception
- **Trigger**: Student clears backlogs/supplementary exams after batch graduation
- **Resolution**: Student graduates in subsequent cycle
- **Steps**:
  1. Student completes pending backlogs/supplementary exams
  2. M03.5 publishes supplementary results
  3. Re-run graduation eligibility check (W10-L2-001)
  4. If eligible: initiate graduation from W10-L2-002
  5. Clearances may be partially complete from earlier attempt
  6. Issue provisional certificate immediately
  7. Degree certificate issued at next annual convocation
- **Entities**: Student (U -- status = graduated), SemesterResult (R)
- **AI Scope**: L3 Auto -- eligibility re-check, clearance status verification; ST3 confirms supplementary results
- **Exception Paths**: Multiple supplementary cycles re-trigger eligibility each time; maximum duration exceeded follows institutional policy

---

## 4. Entity Gap Analysis

### 4.1 New Entities Required

#### 4.1.1 ClearanceWorkflow (M12 Orchestration)
**File**: `backend/src/models/workflow/ClearanceWorkflow.ts`

```typescript
interface IClearanceWorkflow {
  collegeId: ObjectId;
  studentId: ObjectId;
  exitType: 'graduation' | 'withdrawal' | 'expulsion' | 'dropout' | 'transfer';
  exitRequestId?: ObjectId;       // ref to ExitRequest
  urgency: 'standard' | 'urgent'; // urgent = expulsion (24hr SLA)
  status: 'initiated' | 'in_progress' | 'completed' | 'completed_with_exceptions' | 'cancelled';
  initiatedBy: string;
  initiatedAt: Date;
  completedAt?: Date;
  totalItems: number;
  completedItems: number;
  metadata: Record<string, any>;  // exit-type-specific data
}
```

**Indexes**: `(collegeId, studentId)` unique, `(collegeId, status)`, `(collegeId, exitType, status)`

#### 4.1.2 ClearanceItem (M12 Orchestration)
**File**: `backend/src/models/workflow/ClearanceItem.ts`

```typescript
interface IClearanceItem {
  collegeId: ObjectId;
  clearanceWorkflowId: ObjectId;
  department: 'finance' | 'hostel' | 'transport' | 'library' | 'lab' | 'academic' | 'it_platform';
  assigneeRole: string;           // e.g., 'ST2', 'ST6', 'ST7', 'F1', 'ST3'
  assigneeId?: ObjectId;
  status: 'pending' | 'in_progress' | 'completed' | 'waived' | 'blocked';
  isApplicable: boolean;          // false for non-hosteler's hostel clearance
  slaHours: number;               // 72 standard, 24 urgent
  slaDeadline: Date;
  completedAt?: Date;
  completedBy?: string;
  waiverReason?: string;
  waiverApprovedBy?: string;      // principal approval for waivers
  notes?: string;
  metadata: Record<string, any>;  // dept-specific data (e.g., outstanding amount for finance)
}
```

**Indexes**: `(collegeId, clearanceWorkflowId, department)` unique, `(collegeId, status, slaDeadline)`, `(collegeId, assigneeRole, status)`

#### 4.1.3 ExitRequest (M02 People)
**File**: `backend/src/models/people/ExitRequest.ts`

```typescript
interface IExitRequest {
  collegeId: ObjectId;
  studentId: ObjectId;
  exitType: 'withdrawal' | 'transfer' | 'expulsion' | 'dropout_formalization';
  reason: string;
  reasonCategory: 'personal' | 'financial' | 'academic' | 'transfer' | 'family' | 'health' | 'disciplinary' | 'other';
  reasonDetails?: string;
  requestedBy: string;            // studentId or staffId who initiated
  requestedAt: Date;
  parentConsentObtained: boolean;
  parentConsentDate?: Date;
  principalApproval?: {
    approved: boolean;
    approvedBy: string;
    approvedAt: Date;
    notes?: string;
  };
  clearanceWorkflowId?: ObjectId;
  status: 'submitted' | 'under_review' | 'clearance_in_progress' | 'completed' | 'rejected' | 'cancelled';
  completedAt?: Date;
  // Transfer-specific fields
  destinationInstitution?: string;
  destinationUniversity?: string;
  // Expulsion-specific fields
  disciplinaryCaseId?: ObjectId;
  // Dropout-specific fields
  dropoutRiskAlertId?: ObjectId;
  outreachExhausted?: boolean;
}
```

**Indexes**: `(collegeId, studentId)`, `(collegeId, status)`, `(collegeId, exitType, status)`

#### 4.1.4 Alumni (M02 People -- distinct from AlumniProfile)
**File**: `backend/src/models/people/Alumni.ts`

```typescript
interface IAlumni {
  collegeId: ObjectId;
  personId: ObjectId;
  studentId: ObjectId;
  programmeId: ObjectId;
  branchId: ObjectId;
  batchId: ObjectId;
  regulationId?: ObjectId;
  graduationDate: Date;
  degreeAwarded: string;          // e.g., 'B.Tech', 'M.Tech'
  finalCgpa: number;
  classObtained: 'first_class_distinction' | 'first_class' | 'second_class' | 'pass';
  convocationStatus: 'pending' | 'attended' | 'absentia' | 'direct_collection';
  convocationDate?: Date;
  engagementStatus: 'active' | 'inactive' | 'revoked';
  lastContactDate: Date;
  alumniProfileId?: ObjectId;     // link back to placement AlumniProfile
  isPosthumous: boolean;
  metadata: Record<string, any>;
}
```

**Indexes**: `(collegeId, studentId)` unique, `(collegeId, personId)`, `(collegeId, batchId, branchId)`, `(collegeId, engagementStatus)`

#### 4.1.5 AlumniCareer (M07 Placement)
**File**: `backend/src/models/placement/AlumniCareer.ts`

```typescript
interface IAlumniCareer {
  collegeId: ObjectId;
  alumniId: ObjectId;
  companyName: string;
  jobTitle: string;
  location?: string;
  startDate?: Date;
  endDate?: Date;
  isCurrent: boolean;
  packageLpa?: number;
  source: 'placement' | 'self_reported' | 'linkedin' | 'tracking_form';
  verifiedBy?: string;
  verifiedAt?: Date;
}
```

**Indexes**: `(collegeId, alumniId, isCurrent)`, `(collegeId, alumniId)`

#### 4.1.6 AlumniEngagement (M07 Placement)
**File**: `backend/src/models/placement/AlumniEngagement.ts`

```typescript
interface IAlumniEngagement {
  collegeId: ObjectId;
  alumniId: ObjectId;
  type: 'career_tracking_invitation' | 'career_update' | 'mentor_registration' | 'event_participation' | 'guest_lecture' | 'donation';
  sentAt?: Date;
  respondedAt?: Date;
  status: 'sent' | 'opened' | 'responded' | 'declined' | 'expired';
  reminderCount: number;
  lastReminderAt?: Date;
  metadata: Record<string, any>;
}
```

**Indexes**: `(collegeId, alumniId, type)`, `(collegeId, status, type)`

#### 4.1.7 MentorMatch (M07 Placement)
**File**: `backend/src/models/placement/MentorMatch.ts`

```typescript
interface IMentorMatch {
  collegeId: ObjectId;
  alumniId: ObjectId;
  studentId: ObjectId;
  matchScore: number;             // AI-computed match quality (0-100)
  matchReasons: string[];         // e.g., ['same_branch', 'similar_career_interest']
  status: 'suggested' | 'approved_by_tpo' | 'introduced' | 'active' | 'closed' | 'declined';
  approvedBy?: string;
  introducedAt?: Date;
  lastInteractionAt?: Date;
}
```

**Indexes**: `(collegeId, alumniId, status)`, `(collegeId, studentId, status)`

#### 4.1.8 DocumentTemplate (M02 Vault)
**File**: `backend/src/models/people/DocumentTemplate.ts`

```typescript
interface IDocumentTemplate {
  collegeId: ObjectId;
  type: 'transcript' | 'provisional_certificate' | 'degree_certificate' | 'transfer_certificate' | 'migration_certificate' | 'no_dues_certificate' | 'character_certificate' | 'bonafide' | 'study_certificate';
  name: string;
  version: number;
  templateUrl: string;            // S3/storage path to .docx/.html template
  placeholders: string[];         // e.g., ['{{student_name}}', '{{cgpa}}', '{{degree}}']
  signatureSlots: {
    role: string;                 // 'principal', 'registrar', 'university_registrar'
    position: string;             // placement in template
  }[];
  regulationId?: ObjectId;       // template may vary by regulation
  universityFormat?: string;      // e.g., 'JNTU_R20'
  isActive: boolean;
}
```

**Indexes**: `(collegeId, type, isActive)`, `(collegeId, type, regulationId)`

#### 4.1.9 Document (M02 Vault)
**File**: `backend/src/models/people/Document.ts`

```typescript
interface IDocument {
  collegeId: ObjectId;
  studentId: ObjectId;
  alumniId?: ObjectId;
  templateId: ObjectId;
  type: 'transcript' | 'provisional_certificate' | 'degree_certificate' | 'transfer_certificate' | 'migration_certificate' | 'no_dues_certificate' | 'character_certificate' | 'portfolio_snapshot';
  title: string;
  serialNumber?: string;          // unique document serial for tracking
  fileUrl: string;                // S3/storage path to generated PDF
  status: 'draft' | 'pending_signature' | 'signed' | 'issued' | 'revoked';
  generatedAt: Date;
  signedAt?: Date;
  issuedAt?: Date;
  revokedAt?: Date;
  revokedReason?: string;
  signatures: {
    role: string;
    signedBy: string;
    signedAt: Date;
    signatureType: 'digital' | 'physical';
  }[];
  digiLockerStatus?: 'not_pushed' | 'pushed' | 'push_failed' | 'revoked';
  digiLockerPushedAt?: Date;
  digiLockerDocumentId?: string;  // ID from DigiLocker API
  isSealed: boolean;              // once issued, document is immutable
  exitRequestId?: ObjectId;
  metadata: Record<string, any>;
}
```

**Indexes**: `(collegeId, studentId, type)`, `(collegeId, serialNumber)` unique sparse, `(collegeId, status)`, `(collegeId, digiLockerStatus)`

#### 4.1.10 ExitInterview (M06 Welfare)
**File**: `backend/src/models/welfare/ExitInterview.ts`

```typescript
interface IExitInterview {
  collegeId: ObjectId;
  studentId: ObjectId;
  exitRequestId: ObjectId;
  interviewerId: ObjectId;        // counsellor or ST5
  interviewDate: Date;
  primaryReason: 'financial' | 'personal' | 'academic' | 'family' | 'health' | 'career_change' | 'relocation' | 'institutional' | 'other';
  secondaryReasons: string[];
  institutionalFeedback?: {
    teachingQuality: number;      // 1-5
    infrastructure: number;
    support: number;
    overallSatisfaction: number;
    suggestions?: string;
  };
  followUpRequired: boolean;
  followUpNotes?: string;
  status: 'scheduled' | 'completed' | 'student_declined';
}
```

**Indexes**: `(collegeId, studentId)`, `(collegeId, primaryReason)`

#### 4.1.11 DropoutRiskAlert (M06 Welfare)
**File**: `backend/src/models/welfare/DropoutRiskAlert.ts`

```typescript
interface IDropoutRiskAlert {
  collegeId: ObjectId;
  studentId: ObjectId;
  riskScore: number;              // 0-100
  signals: {
    source: 'attendance' | 'academic' | 'finance' | 'hostel' | 'juvi' | 'welfare';
    signalType: string;           // e.g., 'prolonged_absence', 'fee_default'
    description: string;
    weight: number;               // contribution to risk score
    dataRef?: {                   // reference to source data
      entityType: string;
      entityId: ObjectId;
    };
  }[];
  status: 'active' | 'under_outreach' | 'resolved_retained' | 'resolved_exited' | 'false_positive';
  assignedTo?: ObjectId;          // ST5 welfare staff
  mentorId?: ObjectId;            // faculty mentor
  outreachAttempts: {
    date: Date;
    method: 'phone' | 'visit' | 'parent_contact' | 'email' | 'juvi';
    contactedBy: string;
    outcome: 'reached' | 'unreachable' | 'voicemail' | 'refused';
    notes?: string;
  }[];
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}
```

**Indexes**: `(collegeId, status, riskScore)`, `(collegeId, studentId)`, `(collegeId, assignedTo, status)`

#### 4.1.12 EscalationLog (M12 Platform)
**File**: `backend/src/models/workflow/EscalationLog.ts`

```typescript
interface IEscalationLog {
  collegeId: ObjectId;
  clearanceItemId: ObjectId;
  clearanceWorkflowId: ObjectId;
  level: 'reminder' | 'hod' | 'principal';   // escalation tier
  escalatedAt: Date;
  escalatedTo: string;            // role or personId
  reason: string;                 // e.g., 'SLA exceeded at 100%'
  slaPercentage: number;          // 75, 100, 150
  resolvedAt?: Date;
  resolvedBy?: string;
}
```

**Indexes**: `(collegeId, clearanceWorkflowId)`, `(collegeId, clearanceItemId, level)`

### 4.2 Existing Entities Requiring Modification

#### 4.2.1 Student (backend/src/models/people/Student.ts)

**Current `status` enum**: `['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni']`

**Required `status` enum**:
```
['prospective', 'active', 'year_back', 'detained',
 'withdrawal_pending', 'expulsion_pending', 'transfer_pending', 'graduation_pending',
 'graduated', 'withdrawn', 'expelled', 'transferred', 'exited', 'alumni', 'deceased']
```

**New fields to add**:
```typescript
// Exit/graduation fields
graduationEligible?: boolean;
graduationDate?: Date;
degreeAwarded?: string;
finalCgpa?: number;
exitDate?: Date;
exitType?: 'graduation' | 'withdrawal' | 'expulsion' | 'dropout' | 'transfer';
exitReason?: string;
exitRequestId?: ObjectId;

// Record sealing
isSealed: boolean;                 // default false; set true on exit
sealedAt?: Date;
sealedBy?: string;

// Alumni link
alumniId?: ObjectId;
```

#### 4.2.2 AlumniProfile (backend/src/models/placement/AlumniProfile.ts)

**Add fields**:
```typescript
alumniId?: ObjectId;              // link to new Alumni entity
studentId?: ObjectId;             // direct link to student record
programmeId?: ObjectId;
branchId?: ObjectId;
batchId?: ObjectId;
engagementStatus: 'active' | 'inactive' | 'revoked';
lastContactDate?: Date;
```

#### 4.2.3 Mentoring (backend/src/models/student-dev/Mentoring.ts)

**Current `status` enum**: `['active', 'completed']`

**Required `status` enum**: `['active', 'completed', 'closed']`

**Add fields**:
```typescript
closeReason?: 'exit_graduation' | 'exit_withdrawal' | 'exit_expulsion' | 'exit_dropout' | 'exit_transfer' | 'reassignment' | 'academic_year_end';
closedAt?: Date;
```

#### 4.2.4 ClubMembership (backend/src/models/student-dev/ClubMembership.ts)

**Current `status` enum**: `['active', 'inactive']`

**Add field**:
```typescript
deactivatedReason?: 'student_exit' | 'voluntary' | 'term_end';
deactivatedAt?: Date;
```

#### 4.2.5 HostelAllocation (backend/src/models/welfare/HostelAllocation.ts)

**Add fields**:
```typescript
clearanceStatus?: 'pending' | 'cleared' | 'waived';
clearanceNotes?: string;
damageCharges?: number;
depositRefund?: number;
```

#### 4.2.6 TransportAllocation (backend/src/models/welfare/TransportAllocation.ts)

**Add to `status` enum**: `['active', 'cancelled', 'exit_cleared']`

#### 4.2.7 User (backend/src/models/User.ts)

**Add fields**:
```typescript
deactivatedAt?: Date;
deactivatedReason?: 'student_exit' | 'manual' | 'security';
previousRole?: string;            // stored before downgrade for audit trail
```

#### 4.2.8 JuviConversation (backend/src/models/juvi/JuviConversation.ts)

**Add to `status` enum**: `['active', 'closed', 'archived', 'alumni', 'deactivated']`

---

## 5. API Endpoint Gap Analysis

### 5.1 M02 People -- Exit & Alumni Endpoints

| Method | Path | Purpose | Sub-workflows |
|--------|------|---------|---------------|
| POST | `/api/people/students/:id/exit-request` | Submit withdrawal/transfer request | W10-L2-003, W10-L2-007 |
| GET | `/api/people/students/:id/exit-request` | Get exit request status | W10-L2-003 |
| PUT | `/api/people/students/:id/exit-request/:requestId/approve` | Principal approves exit | W10-L2-003, W10-L2-007 |
| POST | `/api/people/students/:id/check-graduation-eligibility` | Run graduation eligibility check | W10-L2-001 |
| POST | `/api/people/students/:id/transition` | Execute lifecycle state transition | W10-L2-002, W10-L2-004, W10-L2-005, W10-L2-006, W10-L2-007 |
| POST | `/api/people/students/:id/seal` | Seal student record (immutable) | W10-L2-002, W10-L2-004 |
| GET | `/api/people/students/:id/exit-summary` | Full exit summary (clearances, docs, status) | All |
| GET | `/api/people/alumni` | List alumni records | W10-L2-028 |
| GET | `/api/people/alumni/:id` | Get alumni detail | W10-L2-028 |
| PUT | `/api/people/alumni/:id` | Update alumni record | W10-L2-019, W10-L2-043 |

### 5.2 M12 Platform -- Clearance Orchestration Endpoints

| Method | Path | Purpose | Sub-workflows |
|--------|------|---------|---------------|
| POST | `/api/platform/clearance-workflows` | Initiate clearance workflow | W10-L2-008 |
| GET | `/api/platform/clearance-workflows/:id` | Get workflow with all items | W10-L2-008 |
| GET | `/api/platform/clearance-workflows` | List workflows (filter by status) | W10-L2-008 |
| PUT | `/api/platform/clearance-items/:id/complete` | Mark clearance item complete | W10-L2-009 to W10-L2-015 |
| PUT | `/api/platform/clearance-items/:id/waive` | Waive clearance item (with approval) | W10-L2-009 |
| GET | `/api/platform/clearance-items/my-pending` | Get pending items for current user's role | W10-L2-009 to W10-L2-015 |
| GET | `/api/platform/clearance-items/:id/escalations` | Get escalation history | W10-L2-016 |
| GET | `/api/platform/clearance-dashboard` | Aggregated clearance status dashboard | W10-L2-008 |

### 5.3 M02.5 Vault -- Document Generation Endpoints

| Method | Path | Purpose | Sub-workflows |
|--------|------|---------|---------------|
| GET | `/api/people/document-templates` | List templates | W10-L2-017 to W10-L2-023 |
| POST | `/api/people/document-templates` | Create/update template | W10-L2-017 to W10-L2-023 |
| POST | `/api/people/documents/generate` | Generate document from template | W10-L2-017 to W10-L2-023 |
| GET | `/api/people/documents` | List documents (filter by student/type) | W10-L2-017 to W10-L2-023 |
| GET | `/api/people/documents/:id` | Get document detail | W10-L2-017 to W10-L2-023 |
| PUT | `/api/people/documents/:id/sign` | Add signature to document | W10-L2-017 to W10-L2-023 |
| POST | `/api/people/documents/:id/push-digilocker` | Push document to DigiLocker | W10-L2-017, W10-L2-019 |
| PUT | `/api/people/documents/:id/revoke` | Revoke issued document | W10-L2-043 |

### 5.4 M06 Welfare -- Dropout & Exit Interview Endpoints

| Method | Path | Purpose | Sub-workflows |
|--------|------|---------|---------------|
| GET | `/api/welfare/dropout-risk-alerts` | List alerts (filter by status/score) | W10-L2-024 |
| GET | `/api/welfare/dropout-risk-alerts/:id` | Get alert with signal breakdown | W10-L2-024 |
| PUT | `/api/welfare/dropout-risk-alerts/:id/assign` | Assign alert to ST5 | W10-L2-024 |
| PUT | `/api/welfare/dropout-risk-alerts/:id/resolve` | Resolve alert (retained/exited/false_positive) | W10-L2-025 |
| POST | `/api/welfare/dropout-risk-alerts/:id/outreach` | Log outreach attempt | W10-L2-025 |
| POST | `/api/welfare/exit-interviews` | Record exit interview | W10-L2-026 |
| GET | `/api/welfare/exit-interviews` | List exit interviews | W10-L2-026 |

### 5.5 M07 Placement -- Alumni Career & Engagement Endpoints

| Method | Path | Purpose | Sub-workflows |
|--------|------|---------|---------------|
| GET | `/api/placement/alumni-careers` | List career records | W10-L2-029 |
| POST | `/api/placement/alumni-careers` | Create career record | W10-L2-029 |
| PUT | `/api/placement/alumni-careers/:id` | Update career record | W10-L2-029 |
| GET | `/api/placement/alumni-engagements` | List engagements | W10-L2-032 |
| POST | `/api/placement/alumni-engagements` | Create engagement | W10-L2-032 |
| GET | `/api/placement/mentor-matches` | List mentor matches | W10-L2-033 |
| POST | `/api/placement/mentor-matches` | Create match | W10-L2-033 |
| PUT | `/api/placement/mentor-matches/:id` | Update match status | W10-L2-033 |

---

## 6. State Machine Definitions

### 6.1 Student Lifecycle State Machine

```
                    +-------------------+
                    |   prospective     |
                    +--------+----------+
                             |
                         [admitted]
                             |
                    +--------v----------+
               +--->|     active        |<---+
               |    +---+---+---+---+--+    |
               |        |   |   |   |       |
               |   [grad][wd][exp][drop][xfr]
               |        |   |   |   |       |
               |   +----v   v   v   v----+  |
               |   |grad_  wd_  exp_ xfr_|  |
               |   |pend  pend pend pend |  |
               |   +--+-  -+-  -+-- -+---+  |
               |      |    |    |    |      |
               |  [clear][clear][ratify][clear]
               |      |    |    |    |      |
               |   +--v   v    v    v---+  |
               |   |grad with expel xfrd|  |
               |   |uated drawn      red|  |
               |   +----+--+---+---+----+  |
               |                           |
               |    year_back / detained   |
               +--------+---------+--------+
                [reactivated from detention]

Terminal states: graduated, withdrawn, expelled, transferred, deceased
Pending states: graduation_pending, withdrawal_pending, expulsion_pending, transfer_pending
```

**Allowed transitions**:
```typescript
const STUDENT_TRANSITIONS: Record<string, string[]> = {
  prospective: ['active'],
  active: ['graduation_pending', 'withdrawal_pending', 'expulsion_pending', 'transfer_pending', 'year_back', 'detained', 'deceased'],
  year_back: ['active', 'withdrawal_pending', 'dropout_formalization'],
  detained: ['active', 'withdrawal_pending', 'expelled'],
  graduation_pending: ['graduated'],
  withdrawal_pending: ['withdrawn', 'active'],         // can cancel withdrawal
  expulsion_pending: ['expelled', 'active'],           // appeal may reverse
  transfer_pending: ['transferred', 'active'],         // can cancel transfer
  // Terminal states have no outgoing transitions (except exception paths)
  graduated: [],
  withdrawn: [],
  expelled: [],
  transferred: [],
  deceased: [],
};
```

**Transition guard rules**:
1. `active -> graduation_pending`: requires `graduationEligible = true`
2. `graduation_pending -> graduated`: requires all ClearanceItems `status = completed` or `waived`
3. `active -> withdrawal_pending`: requires ExitRequest created
4. `withdrawal_pending -> withdrawn`: requires all ClearanceItems complete
5. `active -> expulsion_pending`: requires DisciplinaryCase with expulsion decision
6. `expulsion_pending -> expelled`: requires principal ratification
7. `active -> transfer_pending`: requires TransferRequest with principal approval
8. `transfer_pending -> transferred`: requires all ClearanceItems complete
9. Any terminal transition: triggers record sealing

### 6.2 Clearance Workflow State Machine

```
initiated -> in_progress -> completed
                         -> completed_with_exceptions
          -> cancelled

Per ClearanceItem:
pending -> in_progress -> completed
                       -> waived (with approval)
        -> blocked
```

**Workflow completion rule**: ClearanceWorkflow transitions to `completed` when ALL applicable ClearanceItems are `completed` or `waived`. If any item is `waived`, the workflow is `completed_with_exceptions`.

### 6.3 Document Lifecycle

```
draft -> pending_signature -> signed -> issued -> [revoked]
```

**Sealing rule**: Once `status = issued`, the document is immutable. Only exception is `revoked` status for degree revocation (W10-L2-043).

### 6.4 Alumni Engagement Lifecycle

```
active -> inactive (90 days no response to outreach)
       -> revoked (degree revocation)
```

### 6.5 Dropout Risk Alert Lifecycle

```
active -> under_outreach -> resolved_retained (student stays)
                         -> resolved_exited (student exits)
       -> false_positive (ST5 dismisses)
```

---

## 7. Business Logic Requirements

### 7.1 Graduation Eligibility Rules

The graduation eligibility check (W10-L2-001) must validate against the student's assigned Regulation entity.

```typescript
interface GraduationEligibilityResult {
  eligible: boolean;
  deficiencies: {
    type: 'credits' | 'cgpa' | 'backlogs' | 'co_po_attainment';
    required: number;
    actual: number;
    message: string;
  }[];
  pendingRevaluation: boolean;
  pendingSupplementary: boolean;
}

// Logic:
// 1. Sum totalCreditsEarned across all SemesterResults for student
// 2. Compare against Regulation.totalCredits
// 3. Get latest SemesterResult.cgpa and compare against regulation minimum (configurable per college)
// 4. Check SemesterResult.backlogs == 0 across all semesters (no active backlogs)
// 5. Check CO-PO attainment from CourseOutcome aggregation meets threshold
// 6. Check no pending revaluation requests
// 7. Check enrollment duration <= Regulation.maxYears
```

**Data sources**:
- `SemesterResult` -- credits, CGPA, backlogs (exists: `backend/src/models/academic-ops/SemesterResult.ts`)
- `Regulation` -- totalCredits, maxYears (exists: `backend/src/models/academic-structure/Regulation.ts`)
- `CourseOutcome` -- CO-PO attainment (exists: `backend/src/models/academic-ops/CourseOutcome.ts`)
- `GradeCard` -- per-course results (exists: `backend/src/models/academic-ops/GradeCard.ts`)

### 7.2 Parallel Clearance Orchestration

The clearance orchestration engine must:

1. **Generate applicable checklist**: Based on student profile, determine which clearance items apply:
   - Financial: always
   - Library: always
   - Academic: always
   - IT/Platform: always
   - Hostel: only if `HostelAllocation` exists with `status = active`
   - Transport: only if `TransportAllocation` exists with `status = active`
   - Lab: only if `AssetAllocation` exists with `allocatedTo = student.personId` and `status = allocated`

2. **Set SLA timers**: Based on exit urgency:
   - Standard: 72 hours per item
   - Urgent (expulsion): 24 hours per item
   - Configurable per college via Platform settings

3. **Monitor and escalate**: Background job (BullMQ) that runs every hour:
   - At 75% SLA: send reminder notification to assignee
   - At 100% SLA: escalate to HOD, log EscalationLog
   - At 150% SLA: escalate to Principal, create alert

4. **Auto-clear for zero-balance**: Financial clearance auto-completes if student has zero outstanding invoices and zero library fines

5. **Unilateral clearance for dropouts**: When student is absent (dropout formalization), departments can clear unilaterally based on their records

### 7.3 Dropout Risk Detection

The dropout risk score is a weighted composite of signals from multiple modules:

```typescript
interface DropoutSignalWeights {
  attendance_prolonged_absence: 25;     // >2 weeks continuous absence
  academic_collapse: 20;                // SGPA drop >2.0 or SGPA < 4.0
  fee_default_with_distress: 15;        // fee overdue >60 days
  hostel_informal_checkout: 15;         // vacated without process
  juvi_withdrawal: 10;                  // no Juvi activity >30 days
  prior_welfare_flags: 10;              // existing CrisisAlert or CounselingSession
  multiple_backlogs: 5;                 // >3 active backlogs
}
```

**Data sources**:
- `AttendanceRecord` from `backend/src/models/academic-ops/AttendanceRecord.ts`
- `SemesterResult` -- SGPA trends
- `Invoice` -- overdue status
- `HostelAllocation` -- unexpected vacated status
- `JuviConversation` -- last activity date
- `CrisisAlert`, `CounselingSession` -- prior flags

**Computation**: Background job runs daily; correlates signals; creates DropoutRiskAlert when score >= threshold (default 70, configurable per college).

### 7.4 Record Sealing

Once a student record is sealed:
1. `Student.isSealed = true`, `Student.sealedAt = now`, `Student.sealedBy = performer`
2. All subsequent update operations on the Student document must check `isSealed` and throw `AppError(403, 'Student record is sealed and cannot be modified')` unless the operation is an explicit unseal (admin-only, audited)
3. Related academic records (SemesterResult, GradeCard) become read-only
4. The sealed state is enforced at the service layer, not the database level, to allow for exception paths (e.g., posthumous degree, degree revocation)

**Implementation**: Middleware-like guard in the people service:
```typescript
function assertNotSealed(student: IStudent) {
  if (student.isSealed) {
    throw new AppError(403, 'Student record is sealed and cannot be modified after exit');
  }
}
```

### 7.5 Document Generation Pipeline

The document generation pipeline uses a template-based approach:

1. **Template definition**: `DocumentTemplate` stores the template URL (HTML or DOCX with Handlebars-style placeholders) and lists required placeholders
2. **Data aggregation**: Service pulls data from Student, Person, SemesterResult, GradeCard, Regulation, Programme, Branch, Batch
3. **Placeholder resolution**: Replace placeholders with actual values
4. **PDF generation**: Use `puppeteer` (for HTML) or `docxtemplater` + `libreoffice-convert` (for DOCX) to generate PDF
5. **Signature routing**: Create signature tasks for required signatories
6. **Storage**: Save PDF to file storage (S3-compatible); create Document record
7. **DigiLocker push**: If enabled, push signed document via M12.4 INTG

### 7.6 DigiLocker Integration

DigiLocker integration (M12.4 INTG) requires:
1. College must be registered as a DigiLocker "Issuer" with a valid API key
2. Documents are pushed via the DigiLocker Issuer API after signing
3. Document metadata includes: student Aadhaar number, document type, URI, hash
4. Revocation is supported via the DigiLocker Revoke API
5. Push status is tracked on the Document entity: `digiLockerStatus`, `digiLockerPushedAt`, `digiLockerDocumentId`

**Note**: This is a Phase 3 feature; initial implementation generates PDFs and stores locally. DigiLocker connector is deferred.

---

## 8. Cross-Module Integration Points

### 8.1 Integration Map

```
                    +-------------+
                    |  M02 People |  <-- PRIMARY OWNER
                    | (Lifecycle, |
                    |  Vault,     |
                    |  Alumni)    |
                    +------+------+
                           |
          +-------+--------+--------+-------+
          |       |        |        |       |
     +----v--+ +-v----+ +-v----+ +-v---+ +-v------+
     |M03    | |M04   | |M06   | |M07  | |M12     |
     |Acad   | |Fin   | |Welf  | |Place| |Platform|
     |elig   | |clear | |drop  | |alum | |orch    |
     +-------+ +------+ +------+ +-----+ +--------+
                                              |
               +--------+--------+--------+---+
               |        |        |        |
          +----v--+ +---v---+ +-v----+ +-v----+
          |M08    | |M09    | |M10   | |M11   |
          |Campus | |StuDev | |Compl | |Govn  |
          |clear  | |archiv | |evid  | |dash  |
          +-------+ +-------+ +------+ +------+
                                              |
                                         +----v---+
                                         | Juvi   |
                                         | acct   |
                                         +--------+
```

### 8.2 Module-by-Module Integration Details

#### M02 People (PRIMARY)
- **Provides to all**: Student lifecycle state, sealed record status, alumni records
- **Consumes from M03**: Graduation eligibility result, transcript data
- **Consumes from M04**: Financial clearance status
- **Consumes from M06**: Dropout confirmation, exit interview data, expulsion decision
- **Consumes from M07**: Placement data for alumni career seeding
- **Consumes from M08**: Hostel/transport/library/lab clearance status
- **Consumes from M12**: Clearance workflow completion status
- **Emits events**: `student.exit_initiated`, `student.graduated`, `student.withdrawn`, `student.expelled`, `student.transferred`, `student.record_sealed`

#### M03 Academics
- **Provides to M02**: Graduation eligibility check result, semester results, grade cards, CO-PO attainment
- **Provides to M12**: Academic clearance item completion
- **Consumes from M02**: Student exit notification (to finalize records)
- **Integration point**: `checkGraduationEligibility(collegeId, studentId)` service function

#### M04 Finance
- **Provides to M12**: Financial clearance item completion
- **Provides to M02**: Outstanding amount calculation, refund status
- **Consumes from M08**: Hostel damage charges, library fines, lab breakage costs
- **Consumes from M02**: Exit notification (to calculate pro-rata refunds)
- **Integration point**: `calculateStudentOutstanding(collegeId, studentId)`, `processExitRefund(collegeId, studentId)`

#### M06 Welfare
- **Provides to M02**: Dropout formalization trigger, expulsion decision
- **Provides to M11**: Exit interview data, dropout reason analytics
- **Consumes from M03**: Attendance data (for dropout signals)
- **Consumes from M04**: Fee default data (for dropout signals)
- **Consumes from M08**: Hostel checkout data (for dropout signals)
- **Consumes from Juvi**: Communication withdrawal data (for dropout signals)
- **Integration point**: `computeDropoutRiskScore(collegeId, studentId)`, `createDropoutRiskAlert()`

#### M07 Placement
- **Provides to M02**: Placement data for alumni career seeding
- **Consumes from M02**: Alumni record creation, graduation event
- **Manages**: AlumniCareer, AlumniEngagement, MentorMatch
- **Integration point**: `seedAlumniCareer(collegeId, alumniId, studentId)`

#### M08 Campus Ops (Hostel, Transport, Library, Lab)
- **Provides to M12**: Clearance items for hostel, transport, library, lab
- **Provides to M04**: Damage charges, fines, outstanding fees
- **Consumes from M12**: Clearance initiation notification
- **Integration points**: `checkHostelClearance()`, `checkTransportClearance()`, `checkLibraryClearance()`, `checkLabClearance()`

#### M09 Student Dev
- **Consumes from M02**: Student exit event (to archive portfolio, deactivate memberships)
- **Provides to M02**: Portfolio snapshot for vault
- **Integration point**: `archiveStudentPortfolio(collegeId, studentId)`

#### M10 Compliance
- **Consumes from M02**: Exit completion events (graduation, attrition)
- **Generates**: NAAC/NBA evidence records for Criterion 2
- **Integration point**: `generateExitComplianceEvidence(collegeId, exitData)`

#### M11 Governance
- **Consumes from M02**: Exit completion events
- **Consumes from M06**: Dropout analytics data
- **Updates**: Dashboard KPIs (attrition rate, graduation rate, dropout distribution)
- **Integration point**: `updateExitDashboardKPIs(collegeId)`, `updateGraduationRateTrends(collegeId, batchId)`

#### M12 Platform (Orchestration)
- **Provides to all**: Clearance workflow orchestration, SLA monitoring, escalation
- **Provides to M02**: Clearance completion status
- **Consumes from all clearance modules**: Item completion events
- **Manages**: ClearanceWorkflow, ClearanceItem, EscalationLog, account deactivation
- **Integration points**: `initiateClearanceWorkflow()`, `completeClearanceItem()`, `checkClearanceCompletion()`

#### Juvi AI
- **Consumes from M02**: Graduation event (transition to alumni), exit event (deactivation)
- **Provides to M06**: Communication withdrawal signals (for dropout detection)
- **Manages**: Account state transitions (active -> alumni, active -> deactivated), channel memberships
- **Integration points**: `transitionToAlumniJuvi()`, `deactivateJuviAccount()`

---

## 9. AI Agent Scope

### 9.1 AI vs Human Decision Matrix Summary

| Category | AI Scope | Human Scope | Autonomy |
|----------|----------|-------------|----------|
| Graduation eligibility check | Full computation against regulation rules | ST3 reviews edge cases | L3 Auto |
| Clearance initiation | Checklist generation, parallel notification, SLA timers | Each dept completes own item | L3 Auto |
| SLA monitoring & escalation | Track deadlines, send reminders, route escalations | HOD/Principal intervenes | L3 Auto |
| Financial clearance calculation | Scan invoices, compute total, identify refunds | ST2 confirms, hardship waiver | L2 Recommend |
| Document generation | Data aggregation, template population, PDF generation | Principal/Registrar sign | L3 Auto (gen) / L1 (sign) |
| DigiLocker push | Automated API call after signing | None | L4 Full Auto |
| Dropout risk detection | Cross-module signal correlation, risk score | ST5 reviews, decides action | L2 Recommend |
| Dropout outreach | Track attempts, log contacts | ST5/F1 make calls, assess | L1 Human-led |
| Exit approval (expulsion) | Notification routing, document prep | Principal ratifies | L1 Human-led |
| Hardship fee waiver | Flag hardship indicators | Principal approves with reason | L1 Human-led |
| Alumni record creation | Full auto from student data | None | L4 Full Auto |
| Alumni Juvi transition | Auto state change, channel management | None | L4 Full Auto |
| Career tracking invitation | Auto invitation, reminders, status | TPO reviews inactive quarterly | L3 Auto |
| Mentor matching | AI suggests based on profile/branch | ST4 facilitates | L2 Recommend |
| Compliance evidence | Auto extraction, NAAC/NBA mapping | None | L4 Full Auto |
| Dashboard updates | Auto KPI refresh | Principal reviews | L4 Full Auto |
| Posthumous degree | Clearance waiver, doc generation | Principal decision, family | L1 Human-led |
| Degree revocation | DigiLocker revocation, notifications | Governing body decision | L1 Human-led |

### 9.2 Juvi AI Companion Behavior

Post-exit, the AI companion's behavior changes based on exit type:

- **Graduate (alumni)**: Career advice, alumni event discovery, mentor matching, job market insights. No academic features.
- **Non-graduate (deactivated)**: Account fully disabled; no AI interaction.
- **Exception**: If college enables "alumni-lite" for withdrawn students who completed 75%+ of programme, limited Juvi access may be granted. This is a Phase 3 feature.

---

## 10. Implementation Phases

### Phase 1: Core Exit Infrastructure (Weeks 1-3)

**Goal**: Enable basic student exit processing with clearance orchestration.

**Entities to create**:
- `ClearanceWorkflow` (`backend/src/models/workflow/ClearanceWorkflow.ts`)
- `ClearanceItem` (`backend/src/models/workflow/ClearanceItem.ts`)
- `ExitRequest` (`backend/src/models/people/ExitRequest.ts`)
- `EscalationLog` (`backend/src/models/workflow/EscalationLog.ts`)

**Student model changes**:
- Expand `status` enum with pending and terminal states
- Add exit fields (exitType, exitDate, exitReason, exitRequestId)
- Add sealing fields (isSealed, sealedAt, sealedBy)
- Add graduationEligible field

**Services to implement**:
- `backend/src/modules/people/exit.service.ts` -- exit request creation, state transitions, sealing
- `backend/src/modules/platform/clearance.service.ts` -- workflow initiation, item management, completion checks
- State machine transition guard logic

**API endpoints**:
- POST `/api/people/students/:id/exit-request`
- GET `/api/people/students/:id/exit-request`
- PUT `/api/people/students/:id/exit-request/:requestId/approve`
- POST `/api/people/students/:id/transition`
- POST `/api/people/students/:id/seal`
- POST `/api/platform/clearance-workflows`
- GET `/api/platform/clearance-workflows/:id`
- PUT `/api/platform/clearance-items/:id/complete`
- PUT `/api/platform/clearance-items/:id/waive`
- GET `/api/platform/clearance-items/my-pending`

**BullMQ jobs**:
- `clearance-sla-monitor` -- hourly job checking SLA deadlines and sending escalations

**Sub-workflows covered**: W10-L2-003, W10-L2-004, W10-L2-005, W10-L2-006, W10-L2-007, W10-L2-008, W10-L2-009 through W10-L2-016

### Phase 2: Graduation & Document Generation (Weeks 4-6)

**Goal**: Enable graduation processing with eligibility checks and certificate generation.

**Entities to create**:
- `DocumentTemplate` (`backend/src/models/people/DocumentTemplate.ts`)
- `Document` (`backend/src/models/people/Document.ts`)
- `Alumni` (`backend/src/models/people/Alumni.ts`)

**Services to implement**:
- `backend/src/modules/academics/graduation.service.ts` -- eligibility check against regulation
- `backend/src/modules/people/document.service.ts` -- template management, document generation, PDF pipeline
- `backend/src/modules/people/alumni.service.ts` -- alumni record creation and management

**API endpoints**:
- POST `/api/people/students/:id/check-graduation-eligibility`
- GET/POST `/api/people/document-templates`
- POST `/api/people/documents/generate`
- GET `/api/people/documents`
- PUT `/api/people/documents/:id/sign`
- GET `/api/people/alumni`
- GET `/api/people/alumni/:id`

**Dependencies**: Phase 1 (clearance must work for graduation clearance)

**Sub-workflows covered**: W10-L2-001, W10-L2-002, W10-L2-017 through W10-L2-023, W10-L2-028

### Phase 3: Dropout Detection & Welfare (Weeks 7-8)

**Goal**: Proactive dropout risk detection and exit interview capture.

**Entities to create**:
- `DropoutRiskAlert` (`backend/src/models/welfare/DropoutRiskAlert.ts`)
- `ExitInterview` (`backend/src/models/welfare/ExitInterview.ts`)

**Services to implement**:
- `backend/src/modules/welfare/dropout-detection.service.ts` -- signal correlation, risk scoring
- `backend/src/modules/welfare/exit-interview.service.ts` -- structured interview recording

**API endpoints**:
- GET `/api/welfare/dropout-risk-alerts`
- PUT `/api/welfare/dropout-risk-alerts/:id/assign`
- PUT `/api/welfare/dropout-risk-alerts/:id/resolve`
- POST `/api/welfare/dropout-risk-alerts/:id/outreach`
- POST/GET `/api/welfare/exit-interviews`

**BullMQ jobs**:
- `dropout-risk-scanner` -- daily job correlating cross-module signals

**Sub-workflows covered**: W10-L2-024, W10-L2-025, W10-L2-026, W10-L2-027

### Phase 4: Alumni Engagement & Juvi (Weeks 9-10)

**Goal**: Full alumni lifecycle with career tracking, mentor matching, and Juvi account transitions.

**Entities to create**:
- `AlumniCareer` (`backend/src/models/placement/AlumniCareer.ts`)
- `AlumniEngagement` (`backend/src/models/placement/AlumniEngagement.ts`)
- `MentorMatch` (`backend/src/models/placement/MentorMatch.ts`)

**AlumniProfile model changes**: Add alumniId, studentId, programmeId, branchId, batchId, engagementStatus links

**Mentoring model changes**: Add `closed` status and `closeReason`

**ClubMembership model changes**: Add `deactivatedReason`, `deactivatedAt`

**Services to implement**:
- `backend/src/modules/placement/alumni-career.service.ts` -- career tracking, engagement management
- `backend/src/modules/placement/mentor-match.service.ts` -- AI-based matching
- `backend/src/modules/juvi/lifecycle.service.ts` -- account transitions (alumni/deactivated)
- `backend/src/modules/student-dev/portfolio-archive.service.ts` -- snapshot and archive

**API endpoints**:
- CRUD for AlumniCareer, AlumniEngagement, MentorMatch
- Juvi lifecycle transition endpoints

**BullMQ jobs**:
- `alumni-engagement-reminder` -- sends 30-day and 90-day follow-ups
- `career-tracking-invitation` -- 1 week post-graduation trigger

**Sub-workflows covered**: W10-L2-029 through W10-L2-035, W10-L2-036, W10-L2-040, W10-L2-041

### Phase 5: Compliance, Analytics & DigiLocker (Weeks 11-12)

**Goal**: Automated compliance evidence, attrition dashboards, and DigiLocker integration.

**Services to implement**:
- `backend/src/modules/compliance/exit-evidence.service.ts` -- NAAC/NBA evidence generation
- `backend/src/modules/governance/exit-dashboard.service.ts` -- KPI computation and dashboard feed
- `backend/src/modules/platform/digilocker.service.ts` -- DigiLocker issuer API integration

**API endpoints**:
- POST `/api/people/documents/:id/push-digilocker`
- PUT `/api/people/documents/:id/revoke`
- GET `/api/platform/clearance-dashboard`

**BullMQ jobs**:
- `compliance-evidence-generator` -- triggered on each student exit
- `dashboard-kpi-refresher` -- triggered on exit; also runs nightly

**Sub-workflows covered**: W10-L2-037, W10-L2-038, W10-L2-039, W10-L2-042, W10-L2-043, W10-L2-044

---

## Appendix A: Exit Type x Sub-Workflow Matrix

| Sub-Workflow | Grad | Withdraw | Expulsion | Dropout | Transfer |
|---|:---:|:---:|:---:|:---:|:---:|
| W10-L2-001 Confirm Grad Eligibility | Y | | | | |
| W10-L2-002 Transition Graduated | Y | | | | |
| W10-L2-003 Voluntary Withdrawal | | Y | | | |
| W10-L2-004 Transition Withdrawn | | Y | | | |
| W10-L2-005 Expulsion Exit | | | Y | | |
| W10-L2-006 Dropout Formalization | | | | Y | |
| W10-L2-007 Inter-College Transfer | | | | | Y |
| W10-L2-008 Initiate Clearance | Y | Y | Y | Y | Y |
| W10-L2-009 Financial Clearance | Y | Y | Y | Y | Y |
| W10-L2-010 Hostel Clearance | C | C | C | C | C |
| W10-L2-011 Transport Clearance | C | C | C | C | C |
| W10-L2-012 Library Clearance | Y | Y | Y | Y | Y |
| W10-L2-013 Lab Clearance | Y | Y | Y | Y | Y |
| W10-L2-014 Academic Clearance | Y | Y | Y | Y | Y |
| W10-L2-015 IT/Platform Clearance | Y | Y | Y | Y | Y |
| W10-L2-016 Track Overdue | Y | Y | Y | Y | Y |
| W10-L2-017 Transcript | Y | Y | Y | Y | Y |
| W10-L2-018 Provisional Cert | Y | | | | |
| W10-L2-019 Degree Cert | Y | | | | |
| W10-L2-020 Transfer Cert (TC) | | Y | Y | Y | Y |
| W10-L2-021 Migration Cert | C | | | | Y |
| W10-L2-022 No-Dues Cert | Y | Y | Y | Y | Y |
| W10-L2-023 Character Cert | C | C | | | C |
| W10-L2-024 Dropout Detection | | | | Y | |
| W10-L2-025 Dropout Outreach | | | | Y | |
| W10-L2-026 Exit Interview | | Y | | Y | |
| W10-L2-027 Close Expulsion | | | Y | | |
| W10-L2-028 Create Alumni | Y | | | | |
| W10-L2-029 Seed Career | Y | | | | |
| W10-L2-030 Juvi Alumni | Y | | | | |
| W10-L2-031 Alumni Channels | Y | | | | |
| W10-L2-032 Career Invitation | Y | | | | |
| W10-L2-033 Mentor Network | Y | | | | |
| W10-L2-034 Farewell Post | Y | | | | |
| W10-L2-035 Deactivate Juvi | | Y | Y | Y | Y |
| W10-L2-036 Deactivate Platform | | Y | Y | Y | Y |
| W10-L2-037 Compliance Evidence | Y | Y | Y | Y | Y |
| W10-L2-038 Attrition Dashboard | Y | Y | Y | Y | Y |
| W10-L2-039 Graduation Trends | Y | | | | |
| W10-L2-040 Archive Portfolio | Y | Y | Y | Y | Y |
| W10-L2-041 Close Mentor | Y | Y | Y | Y | Y |
| W10-L2-042 Posthumous Degree | E | | | | |
| W10-L2-043 Degree Revocation | E | | | | |
| W10-L2-044 Delayed Graduation | E | | | | |

**Legend**: Y = Applies, C = Conditional, E = Exception path only

## Appendix B: BullMQ Job Summary

| Job Name | Schedule | Purpose | Phase |
|----------|----------|---------|-------|
| `clearance-sla-monitor` | Every hour | Check ClearanceItem SLA deadlines, send reminders/escalations | 1 |
| `dropout-risk-scanner` | Daily 2:00 AM | Correlate cross-module signals, compute risk scores, create alerts | 3 |
| `alumni-engagement-reminder` | Daily 9:00 AM | Send 30-day and 90-day follow-up reminders to alumni | 4 |
| `career-tracking-invitation` | Daily 10:00 AM | Send career tracking invitations 1 week after graduation | 4 |
| `compliance-evidence-generator` | Event-triggered | Generate NAAC/NBA evidence on student exit | 5 |
| `dashboard-kpi-refresher` | Nightly 3:00 AM + event-triggered | Refresh attrition/graduation dashboard KPIs | 5 |
| `digilocker-push-retry` | Every 15 min | Retry failed DigiLocker document pushes | 5 |

## Appendix C: RBAC Permissions Required

| Endpoint Group | Roles | Notes |
|----------------|-------|-------|
| Exit request creation | student, staff (ST1, ST8) | Student can self-request withdrawal/transfer |
| Exit request approval | principal, admin | Principal approval required for transfer/expulsion |
| Clearance item completion | staff (ST2, ST6, ST7), faculty (F1), admin (ST3) | Each role completes their department's item |
| Clearance waiver | principal | Only principal can waive a clearance item |
| Document generation | staff (ST8), admin | Registrar triggers generation |
| Document signing | principal, staff (ST8) | Principal and Registrar sign certificates |
| Dropout risk alerts | staff (ST5), admin | Welfare staff manages alerts |
| Alumni management | staff (ST4, ST8), admin | TPO and Registrar manage alumni |
| Graduation eligibility | staff (ST3, ST8), admin | Exam cell and Registrar trigger checks |
| Record sealing | system (automated), admin | Sealing is triggered by state transition, admin can unseal |
