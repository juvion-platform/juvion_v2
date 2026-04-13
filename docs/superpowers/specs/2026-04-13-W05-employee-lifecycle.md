# W05 -- Employee Lifecycle Management: Implementation Spec

**Date**: 2026-04-13
**Workflow**: W05 -- Employee Lifecycle Management
**Status**: DERIVED | 79 Sub-Workflows across 10 Modules
**Primary Module**: M05 People Ops (HR)
**Supporting Modules**: M02, M03, M04, M06, M08, M09, M10, M11, M12, Juvi

---

## 1. Executive Summary

W05 covers the complete employee lifecycle for an Indian college ERP -- from hiring requisition through recruitment, onboarding, daily operations (leave, attendance, FDP tracking, appraisal), payroll data extraction, disciplinary proceedings, and separation/exit. It spans 79 sub-workflows organized into 8 sub-domains plus 3 exception/special-case workflows.

### Current State

M05 HR module has **19 models** and **~90 service functions** -- all pure CRUD with zero business logic. Every function follows the same pattern: create/read/update/delete with `collegeId` scoping and audit logging. There is:

- No hiring requisition or recruitment pipeline workflow
- No leave balance auto-deduction on approval
- No exam-clash detection for leave requests
- No CL auto-approval logic
- No attendance anomaly detection or monthly lock
- No FDP compliance tracking or OCR integration
- No appraisal cycle management, multi-source data aggregation, or moderation
- No payroll calculation (only static record storage)
- No exit clearance workflow, settlement computation, or relieving order generation
- No disciplinary case management
- No cross-module integration (M02, M03, M04, M06, M08, M09, M10, M11, M12)

### Target State

A fully workflow-driven HR module with state machines for recruitment, leave approval, appraisal cycles, disciplinary proceedings, and exit processing. AI agents handle sanctioned-strength validation, CL auto-approval, biometric processing, FDP OCR, appraisal data aggregation, settlement computation, and compliance reporting. Cross-module reads/writes enable faculty course substitution (M03), compliance evidence (M10), policy reference (M11), and account provisioning (M12).

### Scope Boundary

Payroll processing itself is **OUT OF SCOPE** -- Juvion generates a payroll data extract (attendance summary, leave consumed, LOP days, new joiners, exits) that an external payroll system consumes. The existing Payroll model is retained for storing results imported back from the external system.

---

## 2. Current Codebase State

### 2.1 Existing Models (19)

| # | Model | File | Key Fields | Gaps vs W05 |
|---|-------|------|-----------|-------------|
| 1 | Employee | `models/hr/Employee.ts` | personId, employeeId, departmentId, designation, employeeType, joiningDate, reportingToId, status | Missing: probationEndDate, contractEndDate, noticePeriodDays, superannuationDate, employeeCode generation |
| 2 | LeaveType | `models/hr/LeaveType.ts` | name, code, maxDaysPerYear, isCarryForward, maxCarryForward, applicableTo | Missing: minDaysPerRequest, maxDaysPerRequest, autoApproveEligible, autoApproveMaxDays, requiresDocument, encashmentAllowed, encashmentMaxDays, halfDayAllowed |
| 3 | LeaveApplication | `models/hr/LeaveApplication.ts` | employeeId, leaveTypeId, fromDate, toDate, days, reason, status, approvedBy, remarks | Missing: approvalChain[], currentApproverLevel, examClashDetected, substitutionTriggered, isHalfDay, documentUrl, withdrawnAt, autoApproved |
| 4 | LeaveBalance | `models/hr/LeaveBalance.ts` | employeeId, leaveTypeId, academicYearId, entitled, taken, balance | Missing: carriedForward, lapsed, encashed, lopDays |
| 5 | EmployeeAttendance | `models/hr/EmployeeAttendance.ts` | employeeId, date, checkIn, checkOut, status, source | Missing: isLocked, lateMinutes, anomalyFlags[], correctionRequestedBy, correctionApprovedBy, correctionReason |
| 6 | PayStructure | `models/hr/PayStructure.ts` | employeeId, basicPay, hra, da, otherAllowances, pfContribution, effectiveFrom, effectiveTo | Missing: specialPay, medicalAllowance, conveyanceAllowance, professionalTax, salaryBandRef |
| 7 | Payroll | `models/hr/Payroll.ts` | employeeId, month, year, basicPay, hra, da, otherAllowances, grossPay, pf, esi, tds, otherDeductions, netPay, status, paidDate | Adequate for external payroll import. Missing: lopDays, lopDeduction, dataExtractId |
| 8 | Appraisal | `models/hr/Appraisal.ts` | employeeId, academicYearId, reviewerId, selfRating, reviewerRating, finalRating, goals[], status | Missing: appraisalCycleId, appraisalType (faculty/staff), selfAssessmentData, aggregatedData{}, reviewerComments, moderationAdjustment, disputeStatus, outcomeType |
| 9 | Promotion | `models/hr/Promotion.ts` | employeeId, fromDesignation, toDesignation, fromPayScale, toPayScale, effectiveDate, remarks, approvedBy, status | Missing: appraisalId (link to triggering appraisal), approvalChain[] |
| 10 | Training | `models/hr/Training.ts` | title, type, conductedBy, startDate, endDate, venue, maxParticipants, status | Adequate for training event tracking |
| 11 | TrainingParticipant | `models/hr/TrainingParticipant.ts` | trainingId, employeeId, status, feedbackRating, certificateIssued | Missing: certificateUrl, hoursCompleted |
| 12 | Qualification | `models/hr/Qualification.ts` | personId, degree, specialization, university, yearOfPassing, percentage, cgpa, isHighest | Adequate |
| 13 | Grievance | `models/hr/Grievance.ts` | raisedBy, category, subject, description, priority, assignedTo, status, resolution, resolvedAt | Missing: escalationHistory[], timelineTracking |
| 14 | OnDuty | `models/hr/OnDuty.ts` | employeeId, fromDate, toDate, purpose, venue, status, approvedBy | Missing: documentUrl, attendanceLinked |
| 15 | ExitProcess | `models/hr/ExitProcess.ts` | employeeId, exitType, lastWorkingDate, reason, noDues[], exitInterviewDone, status | Missing: separationType (resignation/retirement/termination/death), noticeperiod, noticePeriodWaived, clearanceItems[], settlementId, relievingOrderUrl, experienceCertUrl |
| 16 | Recruitment | `models/hr/Recruitment.ts` | position, departmentId, vacancies, qualifications, experience, salary, postedDate, lastDate, status | Missing: positionType (faculty/staff), requisitionId, justification, sanctionedStrengthRef, approvalChain[], selectionCommitteeId |
| 17 | JobApplication | `models/hr/JobApplication.ts` | recruitmentId, applicantName, email, phone, resumeUrl, experience, currentDesignation, status, interviewDate, interviewRemarks | Missing: qualificationDetails{}, aiScreeningScore, aiScreeningRationale, interviewScores[], demoLectureScore, panelRemarks[], appointmentOrderId |
| 18 | Publication | `models/hr/Publication.ts` | facultyId, title, type, journalName, conferenceName, publishedDate, doi, impactFactor, indexing | Adequate |
| 19 | ResearchProject | `models/hr/ResearchProject.ts` | title, principalInvestigatorId, coInvestigators[], fundingAgency, sanctionedAmount, startDate, endDate, status | Adequate |

### 2.2 Existing Models in People Module (M02)

| Model | File | Relevance to W05 |
|-------|------|------------------|
| Faculty | `models/people/Faculty.ts` | personId, employeeCode, designation, specialization, contractType, status -- used for faculty-specific workflows |
| Staff | `models/people/Staff.ts` | personId, employeeCode, designation, staffType, status -- used for staff-specific workflows |
| Person | `models/people/Person.ts` | Base identity record |

### 2.3 Existing Service Functions (90 across 19 entities)

All 90 functions follow the identical CRUD pattern:
- `list<Entity>(collegeId, page, limit, ...filters, authScope?)` -- paginated list
- `get<Entity>(collegeId, id)` -- single record fetch
- `create<Entity>(collegeId, data, who)` -- insert + audit log
- `update<Entity>(collegeId, id, data, who)` -- findOneAndUpdate + audit log
- `delete<Entity>(collegeId, id, who)` -- findOneAndDelete + audit log

**No business logic exists in any service function.** Every create/update is a direct pass-through to Mongoose.

### 2.4 Existing Routes (160 lines)

All routes follow `router.verb('/path', authenticate, authorize('hr', action), [validate], ctrl.handler)`. There are 65 route definitions covering standard CRUD for all 19 entities plus 1 dashboard stats endpoint. No workflow-specific endpoints exist.

### 2.5 Governance Models Available for W05

| Model | Fields | W05 Usage |
|-------|--------|-----------|
| Policy (M11) | title, category, description, effectiveDate, status | Leave policy, notice period, gratuity rules, salary bands, FDP requirements |
| Committee (M11) | Governance body records | Selection committee references |

**Gap**: No dedicated `SanctionedStrength` or `SalaryBand` model in M11. W05 references these heavily.

---

## 3. Sub-Workflow Catalog

### 3.1 M05.5 RECRUIT -- Recruitment & Appointment (11 sub-workflows)

| ID | Name | Trigger | Resolution | Key Entities | AI Scope |
|----|------|---------|-----------|-------------|----------|
| W05-L2-001 | Submit Hiring Requisition | Vacancy identified | Requisition created with justification | HiringRequisition (C) | Auto: validate against M11 sanctioned strength |
| W05-L2-002 | Validate Requisition Against Sanctioned Strength | Requisition submitted | Flagged within/exceeding strength | HiringRequisition (R/U) | Auto: headcount comparison, flag generation |
| W05-L2-003 | Approve Hiring Requisition | Requisition validated | Approved/rejected | HiringRequisition (U) | Auto: route to correct approver |
| W05-L2-004 | Constitute Faculty Selection Committee | Faculty requisition approved | AICTE-compliant committee formed | SelectionCommittee (C) | Auto: generate template per AICTE norms |
| W05-L2-005 | Constitute Staff Selection Committee | Staff requisition approved | Internal committee formed | SelectionCommittee (C) | Auto: generate template |
| W05-L2-006 | Screen Applications Against Requirements | Applications received | Shortlist generated | HiringRequisition (R) | Auto: screen against qualifications, score |
| W05-L2-007 | Conduct Faculty Selection (AICTE) | Faculty shortlist finalized | Candidate selected, proceedings documented | SelectionCommittee (U) | Auto: track timeline, generate proceedings |
| W05-L2-008 | Conduct Staff Selection | Staff shortlist finalized | Candidate selected | SelectionCommittee (U) | Auto: track timeline |
| W05-L2-009 | Draft Appointment Order | Candidate selected | Draft appointment order ready | AppointmentOrder (C) | Auto: draft from template + M11 salary bands |
| W05-L2-010 | Approve & Issue Appointment Order | Draft reviewed | Order approved and issued | AppointmentOrder (U) | Auto: route for approval |
| W05-L2-011 | Process Candidate Acceptance/Decline | Order issued | Candidate accepted -> onboarding; declined -> next candidate | AppointmentOrder (U) | Auto: deadline tracking, reminders |

**Key faculty vs staff difference**: Faculty selection (W05-L2-004/007) requires AICTE-compliant committee composition (external experts, AICTE nominee, SC/ST representative) and demo lecture + interview. Staff selection (W05-L2-005/008) uses a simpler internal committee with interview + skill test.

### 3.2 Onboarding -- Cross-Module (6 sub-workflows)

| ID | Name | Module | Trigger | Resolution | Key Entities |
|----|------|--------|---------|-----------|-------------|
| W05-L2-012 | Create Employee Identity Record | M02 | Candidate accepted | Employee record in M02, employee code generated | Employee Record (C in M02) |
| W05-L2-013 | Provision Employee System Account | M12 | Identity created | System credentials + role-based access | System Account (C in M12) |
| W05-L2-014 | Conduct Induction & Policy Orientation | M05 | Account provisioned | Employee oriented, handbook acknowledged | Employee Record (U) |
| W05-L2-015 | Assign Faculty Course Load | M03 | Faculty onboarded | Courses assigned in M03 | Course Assignment (C/U in M03) |
| W05-L2-016 | Link Faculty Advisory Roles | M09 | Faculty onboarded | Advisory roles linked in M09 | Advisor Assignment (C/U in M09) |
| W05-L2-017 | Initialize Leave Balance | M05.1 | Identity created | Pro-rata leave balances initialized per M11 policy | LeaveBalance (C) |

### 3.3 M05.1 LEAVE -- Ongoing Leave Management (10 sub-workflows)

| ID | Name | Trigger | Resolution | AI Level |
|----|------|---------|-----------|----------|
| W05-L2-018 | Submit Leave Request | Employee needs absence | Request submitted, routed for processing | L2 |
| W05-L2-019 | Auto-Approve Casual Leave | CL submitted, <=2 days, balance OK, no exam clash | Auto-approved, balance deducted | **L3 (Autonomous)** |
| W05-L2-020 | Route Leave for HOD Approval (L1) | Does not qualify for auto-approval | HOD approves/rejects | L2 |
| W05-L2-021 | Escalate Leave to Dean/Principal (L2/L3) | Requires higher approval | Dean/Principal decides | L2 |
| W05-L2-022 | Process Sabbatical Request | Faculty sabbatical request | Full 4-level chain: HOD->Dean->Principal->Trust | L2 |
| W05-L2-023 | Detect Exam Period Clash | Any leave request (parallel check) | Clash detected -> escalation flag added | L3 |
| W05-L2-024 | Process Compensatory Off | Employee worked holiday/weekend | CO credited and consumed | L2 |
| W05-L2-025 | Annual Leave Balance Reset & Carry-Forward | Year end | Balances carried forward/lapsed per M11 policy | **L3 (Autonomous)** |
| W05-L2-026 | Withdraw Leave Request | Employee withdraws request | Request withdrawn, balance restored | L2 |
| W05-L2-027 | Trigger Faculty Substitution | Faculty leave approved | Substitute assigned in M03 | L2 |

**Auto-approval criteria for CL (W05-L2-019)**:
1. Leave type = Casual Leave
2. Duration <= 2 days
3. Balance >= requested days
4. No exam calendar clash (reads M03)
5. If all pass -> auto-approve, deduct balance, notify employee + HOD
6. If faculty -> trigger substitution (W05-L2-027)

### 3.4 M05.2 ATT -- Attendance & Time Tracking (6 sub-workflows)

| ID | Name | Trigger | Resolution | AI Level |
|----|------|---------|-----------|----------|
| W05-L2-028 | Record Daily Attendance from Biometric | Biometric swipe | Attendance record created (present/absent/late/half-day) | L3 |
| W05-L2-029 | Flag Attendance Anomaly | AI detects pattern | Anomaly flagged, HOD notified | L3 |
| W05-L2-030 | Submit & Approve OD Request | Employee on official duty | OD approved, attendance updated | L2 |
| W05-L2-031 | Reconcile Attendance with Leave Records | Monthly close or on-demand | Attendance and leave aligned, discrepancies flagged | L2 |
| W05-L2-032 | Lock Monthly Attendance | Month end | Records locked, summary to M10 compliance | L2 |
| W05-L2-033 | Process Manual Attendance Correction | Biometric failure/dispute | Correction approved with audit trail | L2 |

**Anomaly detection rules (W05-L2-029)**:
- > 3 late marks per month
- Missing check-out
- Irregular patterns
- Chronic threshold crossed -> referral to M05.CC1 (disciplinary)

### 3.5 M05.4 FDP -- Faculty Development Tracking (6 sub-workflows)

| ID | Name | Trigger | Resolution | AI Level |
|----|------|---------|-----------|----------|
| W05-L2-034 | Submit FDP Certificate | Faculty completes FDP | Record created, pending verification | Human action |
| W05-L2-035 | OCR & Extract FDP Hours | Certificate submitted | Hours/details extracted, confidence scored | L3 |
| W05-L2-036 | Verify FDP Certificate | Extracted data ready | Verified or rejected; duplicate check | L2 |
| W05-L2-037 | Compute FDP Compliance Gap | Record verified | Gap computed against AICTE requirement by cadre | L3 |
| W05-L2-038 | Nudge Faculty on FDP Shortfall | Gap approaching critical | Faculty and HOD notified with recommendations | L3 |
| W05-L2-039 | Report FDP Summary to Compliance | Reporting period | FDP data published to M10 for NAAC/NBA | L3 |

**AICTE FDP requirements by cadre**:
- Assistant Professor: 40 hours/year
- Associate Professor: 30 hours/year
- Professor: 20 hours/year

### 3.6 M05.3 APPR -- Appraisal & Performance (10 sub-workflows)

| ID | Name | Trigger | Resolution | AI Level |
|----|------|---------|-----------|----------|
| W05-L2-040 | Configure Appraisal Cycle | Academic year start | Cycle configured with dates, scope, weightages | Human |
| W05-L2-041 | Initiate Appraisal -- Generate Records | Cycle opened | Individual records created for eligible employees | L3 |
| W05-L2-042 | Employee Self-Assessment | Assessment window open | Self-assessment completed | Human |
| W05-L2-043 | Aggregate Faculty Appraisal Data | Self-assessment submitted | Multi-source data from M03, M02, M05.4, M09, M06 | **L3** |
| W05-L2-044 | Aggregate Staff Appraisal Data | Self-assessment submitted | Attendance + duty data assembled | L3 |
| W05-L2-045 | Reviewer Assessment | Data aggregation complete | HOD/section head completes ratings | L2 |
| W05-L2-046 | Moderate & Normalize Ratings | All assessments submitted | Ratings moderated across departments | L2 |
| W05-L2-047 | Finalize Ratings & Close Cycle | Moderation complete | Final ratings published, outcomes linked | L2 |
| W05-L2-048 | Handle Rating Dispute | Employee disputes | Dispute resolved: confirmed or revised | L2 |
| W05-L2-049 | Generate Promotion/PIP Recommendation | Ratings finalized | Top-rated -> promotion; below-threshold -> PIP | L2 |

**Faculty appraisal data sources (W05-L2-043, weighted)**:
- M03 teaching feedback scores: 30-40%
- M02 research publications: 15-20%
- M05.4 FDP hours: 10-15%
- M09 club advisory contributions: 5-10%
- M06 mentoring outcomes: 5-10%
- M05.2 attendance: 5-10%
- Self-assessment: 10-15%

**Staff appraisal data sources (W05-L2-044)**:
- M05.2 attendance summary
- Training/skill records
- Duty performance (supervisor assessment)

### 3.7 M05.6 EXIT -- Separation & Exit (17 sub-workflows)

| ID | Name | Trigger | Resolution | AI Level |
|----|------|---------|-----------|----------|
| W05-L2-050 | Initiate Resignation | Employee submits | Notice period computed, routed for acceptance | L2 |
| W05-L2-051 | Process Planned Retirement | Superannuation age reached | AI alerts AO 3 months ahead, proactive clearance | L3 |
| W05-L2-052 | Process Termination from Disciplinary | M05.CC1 outcome = termination | Separation request created | L2 |
| W05-L2-053 | Process Death Notification | Death notification received | Expedited settlement to nominee | L2 |
| W05-L2-054 | Determine Notice Period & Acceptance | Resignation created | Notice confirmed, last working day set | L2 |
| W05-L2-055 | Initiate Parallel Clearance | Separation approved | Clearance checklist generated, authorities notified | L3 |
| W05-L2-056 | Complete Department Handover | Clearance initiated | All responsibilities handed over | L2 |
| W05-L2-057 | Complete Library Clearance | Clearance initiated | No outstanding books/dues | L2 |
| W05-L2-058 | Complete Finance Clearance | Clearance initiated | No outstanding advances/dues | L2 |
| W05-L2-059 | Revoke IT Access & Recover Assets | Clearance initiated | Account deactivated, assets recovered | L2 |
| W05-L2-060 | Reassign Faculty Courses & Mentees | Faculty separation approved | All M03 assignments reassigned | L2 |
| W05-L2-061 | Reassign Faculty Advisory Roles | Faculty separation approved | M09 advisor roles reassigned | L2 |
| W05-L2-062 | Compute Final Settlement | All clearance complete | Settlement amount computed | **L3** |
| W05-L2-063 | Approve & Process Settlement | Settlement computed | Payment instruction to M04 | L2 |
| W05-L2-064 | Issue Relieving Order & Experience Certificate | Settlement processed | Documents issued | L2 |
| W05-L2-065 | Archive Employee Record | Separation completed | M02 lifecycle state -> Separated | L3 |
| W05-L2-066 | Trigger Replacement Requisition | Separation completed, position to refill | New requisition created -> W05-L2-001 | L2 |

### 3.8 M05.CC1 DISC -- Disciplinary Proceedings (8 sub-workflows)

| ID | Name | Trigger | Resolution | AI Level |
|----|------|---------|-----------|----------|
| W05-L2-067 | Initiate Disciplinary Case (Internal) | HOD reports misconduct | Case created, investigation begins | L2 |
| W05-L2-068 | Receive Disciplinary Referral from Welfare | M06 ICC/ARC finding | Case created from external referral | L2 |
| W05-L2-069 | Investigate Allegation | Case created | Investigation complete, findings documented | L2 |
| W05-L2-070 | Issue Show Cause Notice | Findings warrant action | Notice issued, response deadline set | L2 |
| W05-L2-071 | Record Response & Conduct Hearing | Response received or deadline elapsed | Hearing conducted | L1 (Advisory) |
| W05-L2-072 | Decide Disciplinary Outcome | Hearing complete | Warning / Fine / Suspension / Demotion / Termination | **L1 (Human only)** |
| W05-L2-073 | Communicate & Implement Outcome | Outcome decided | Outcome implemented across systems | L2 |
| W05-L2-074 | Process Appeal | Employee appeals | Upheld / Modified / Overturned | L1 |

### 3.9 Cross-Cutting & Special Cases (3 sub-workflows)

| ID | Name | Trigger | Resolution | AI Level |
|----|------|---------|-----------|----------|
| W05-L2-075 | Renew Contract Faculty Appointment | Contract approaching expiry | Renewed / converted to permanent / terminated | L2 |
| W05-L2-076 | Process Ad-Hoc Faculty Appointment | Urgent temporary vacancy | Ad-hoc faculty appointed on temp contract | L2 |
| W05-L2-077 | Handle Mid-Year Faculty Resignation | Faculty resignation during active term | Course continuity plan executed | L2 |

### 3.10 Compliance & Payroll Data (2 sub-workflows)

| ID | Name | Module | Trigger | Resolution |
|----|------|--------|---------|-----------|
| W05-L2-078 | Publish Student-Faculty Ratio to Compliance | M10 | Annual reporting period | Ratio computed and published to M10 |
| W05-L2-079 | Generate Payroll Data Extract | M05 | Monthly payroll cycle | Attendance, leave, LOP, joiners, exits extracted |

---

## 4. Entity Gap Analysis

### 4.1 New Models Required

| # | Model | Sub-Domain | Purpose | Key Fields |
|---|-------|-----------|---------|------------|
| 1 | **HiringRequisition** | RECRUIT | Formal request for new position or replacement | collegeId, departmentId, positionType (faculty/staff), designation, justification, justificationType (new/replacement), vacatedBy?, sanctionedStrengthRef?, headcountAtRequest, withinSanctionedStrength, approvalChain[], currentApproverLevel, status (draft/submitted/validated/approved/rejected/cancelled), approvedBy, approvedAt |
| 2 | **SelectionCommittee** | RECRUIT | Committee composition for hiring | collegeId, requisitionId, recruitmentId, committeeType (aicte_faculty/internal_staff), members[{personId, role, isExternal, isAICTENominee, isSCSTRep}], status (constituted/active/dissolved), constitutedAt |
| 3 | **AppointmentOrder** | RECRUIT | Formal appointment document | collegeId, recruitmentId, jobApplicationId, candidateName, designation, departmentId, salaryDetails{basic, hra, da, totalCTC}, probationMonths, noticePeriodDays, contractType, contractEndDate?, reportingToId, joiningDate, status (draft/approved/issued/accepted/declined/expired), issuedAt, acceptedAt, declinedAt, acceptanceDeadline |
| 4 | **FDPRecord** | FDP | Individual FDP/workshop/certification record | collegeId, facultyId, activityType (fdp/workshop/seminar/conference/certification), title, organiser, startDate, endDate, hours, certificateUrl, ocrExtractedData{}, ocrConfidence, isDuplicate, verificationStatus (pending/verified/rejected), verifiedBy, verifiedAt, complianceYear |
| 5 | **FDPComplianceSummary** | FDP | Per-faculty annual compliance snapshot | collegeId, facultyId, academicYearId, cadre, requiredHours, completedHours, gap, complianceStatus (compliant/partial/non_compliant), lastComputedAt |
| 6 | **AppraisalCycle** | APPR | Institutional appraisal cycle configuration | collegeId, academicYearId, name, startDate, endDate, selfAssessmentDeadline, reviewerDeadline, moderationDeadline, applicableTo (faculty/staff/both), weightageTemplate{}, status (configured/open/self_assessment/review/moderation/closed) |
| 7 | **SeparationRequest** | EXIT | Formal separation initiation | collegeId, employeeId, separationType (resignation/retirement/termination/death/contract_end), requestedLastWorkingDay, confirmedLastWorkingDay, noticePeriodDays, noticePeriodWaived, waiverApprovedBy?, reason, approvalChain[], currentApproverLevel, status (submitted/accepted/in_clearance/settled/completed/rejected), relatedDisciplinaryCaseId?, isRetirementProactive |
| 8 | **ExitClearance** | EXIT | Parallel clearance tracking | collegeId, separationRequestId, employeeId, items[{department, authority, status (pending/cleared/blocked), clearedBy?, clearedAt?, remarks?, blockedReason?}], overallStatus (in_progress/all_cleared/blocked), generatedAt, completedAt |
| 9 | **HandoverRecord** | EXIT | Department handover documentation | collegeId, separationRequestId, employeeId, items[{category (course/mentee/research/admin/asset/lab), description, successorId?, status (pending/completed), completedAt?}], verifiedByHOD, overallStatus (pending/in_progress/completed), verifiedAt |
| 10 | **FinalSettlement** | EXIT | Settlement computation | collegeId, separationRequestId, employeeId, leaveEncashmentDays, leaveEncashmentAmount, pendingReimbursements, gratuityAmount, gratuityEligible, gratuityYearsOfService, grossSettlement, advanceDeductions, dueDeductions, netSettlement, computedAt, status (computed/approved/processed/disputed), approvedBy, processedAt, paymentInstructionId? |
| 11 | **DisciplinaryCase** | DISC | Disciplinary proceeding record | collegeId, employeeId, caseNumber, origin (internal/external_referral), referralSource? (m06_icc/m06_arc/other), allegation, evidence[], investigatingAuthorityId, investigationFindings?, showCauseNoticeUrl?, showCauseIssuedAt?, responseDeadline?, responseReceivedAt?, responseText?, hearingDate?, hearingMinutesUrl?, outcome? (warning/fine/suspension/demotion/termination), outcomeDetails?, outcomeImplementedAt?, appealDeadline?, status (under_investigation/show_cause/hearing/decided/implemented/closed/appealed), timeline[] |
| 12 | **DisciplinaryOutcome** | DISC | Outcome implementation record | collegeId, disciplinaryCaseId, employeeId, outcomeType (warning/fine/suspension/demotion/termination), details{fineAmount?, suspensionDays?, demotionToDesignation?}, communicationLetterUrl?, implementedActions[], status (decided/communicated/implemented/appealed/overturned), appealId? |
| 13 | **PayrollDataExtract** | PAYROLL | Monthly payroll data export | collegeId, month, year, extractData{attendanceSummary[], leaveConsumed[], lopDays[], newJoiners[], separations[]}, status (draft/reviewed/released), reviewedBy, releasedAt |
| 14 | **AttendanceAnomaly** | ATT | Flagged attendance patterns | collegeId, employeeId, anomalyType (chronic_late/missing_swipe/irregular_pattern), month, year, details{lateCount?, missedCheckouts?, patternDescription?}, severity (info/warning/critical), referredToDisciplinary, disciplinaryCaseId?, flaggedAt |
| 15 | **AttendanceMonthlySummary** | ATT | Monthly attendance rollup | collegeId, employeeId, month, year, totalPresent, totalAbsent, totalLate, totalHalfDay, totalOnDuty, totalLeave, totalHoliday, lopDays, isLocked, lockedAt, lockedBy |

### 4.2 Existing Models Requiring Schema Enhancement

| Model | Fields to Add |
|-------|--------------|
| **Employee** | `probationEndDate: Date`, `contractEndDate: Date`, `noticePeriodDays: Number`, `superannuationDate: Date`, `inductionCompleted: Boolean`, `inductionCompletedAt: Date`, `biometricEnrolled: Boolean` |
| **LeaveType** | `autoApproveEligible: Boolean`, `autoApproveMaxDays: Number`, `minDaysPerRequest: Number`, `maxConsecutiveDays: Number`, `requiresDocument: Boolean`, `documentAfterDays: Number`, `encashmentAllowed: Boolean`, `maxEncashmentDays: Number`, `halfDayAllowed: Boolean`, `sabbaticalEligible: Boolean`, `approvalLevels: Number` |
| **LeaveApplication** | `approvalChain: [{level, approverId, status, decidedAt, remarks}]`, `currentApproverLevel: Number`, `examClashDetected: Boolean`, `examClashDetails: String`, `substitutionTriggered: Boolean`, `isHalfDay: Boolean`, `documentUrl: String`, `autoApproved: Boolean`, `withdrawnAt: Date`, `withdrawalApprovedBy: ObjectId` |
| **LeaveBalance** | `carriedForward: Number`, `lapsed: Number`, `encashed: Number`, `encashedAmount: Number`, `lopDays: Number` |
| **EmployeeAttendance** | `lateMinutes: Number`, `isLocked: Boolean`, `anomalyFlags: [String]`, `correctionRequestedBy: ObjectId`, `correctionApprovedBy: ObjectId`, `correctionReason: String`, `originalStatus: String` |
| **Appraisal** | `appraisalCycleId: ObjectId`, `appraisalType: String (faculty/staff)`, `selfAssessmentData: Mixed`, `aggregatedData: Mixed`, `aggregatedSources: [{source, module, data, weight}]`, `reviewerComments: String`, `moderationAdjustment: Number`, `moderatedBy: ObjectId`, `disputeStatus: String`, `disputeText: String`, `disputeResolvedBy: ObjectId`, `outcomeType: String (standard_increment/promotion/pip/no_change)` |
| **ExitProcess** | **DEPRECATED** -- replaced by SeparationRequest + ExitClearance + FinalSettlement |
| **Recruitment** | `positionType: String (faculty/staff)`, `requisitionId: ObjectId (ref HiringRequisition)`, `selectionCommitteeId: ObjectId`, `aicteCompliant: Boolean` |
| **JobApplication** | `qualificationDetails: Mixed`, `aiScreeningScore: Number`, `aiScreeningRationale: String`, `interviewScores: [{panelMemberId, score, remarks}]`, `demoLectureScore: Number`, `overallRank: Number`, `appointmentOrderId: ObjectId` |
| **TrainingParticipant** | `certificateUrl: String`, `hoursCompleted: Number` |
| **Promotion** | `appraisalId: ObjectId`, `approvalChain: [{level, approverId, status, decidedAt}]` |

### 4.3 Models NOT in M05 but Referenced

| Module | Model | W05 Usage | Exists? |
|--------|-------|-----------|---------|
| M11 | SanctionedStrength | Hiring requisition validation | **NO -- needs creation in M11** |
| M11 | SalaryBand | Appointment order drafting | **NO -- needs creation in M11** |
| M11 | LeavePolicy (detailed rules) | Auto-approval, carry-forward, encashment | Partially in LeaveType; M11 Policy model is too generic |
| M11 | NoticePeriodPolicy | Exit notice computation | **NO** |
| M11 | GratuityRule | Settlement computation | **NO** |
| M03 | ExamCalendar / ExamDutyRoster | Leave clash detection | Must exist in M03 |
| M03 | CourseAssignment | Faculty substitution | Must exist in M03 |
| M08 | LibraryRecord | Exit clearance | Must exist in M08 |
| M04 | AdvanceRecord | Exit financial clearance | Must exist in M04 |
| M10 | ComplianceEvidence | Receives evidence from W05 | Must exist in M10 |

---

## 5. API Endpoint Gap Analysis

### 5.1 Recruitment Endpoints (NEW)

```
POST   /api/hr/hiring-requisitions                     # W05-L2-001: Submit requisition
POST   /api/hr/hiring-requisitions/:id/validate        # W05-L2-002: Validate against sanctioned strength
POST   /api/hr/hiring-requisitions/:id/approve         # W05-L2-003: Approve/reject
GET    /api/hr/hiring-requisitions                      # List requisitions
GET    /api/hr/hiring-requisitions/:id                  # Get requisition

POST   /api/hr/selection-committees                     # W05-L2-004/005: Constitute committee
GET    /api/hr/selection-committees/:id                 # Get committee
PUT    /api/hr/selection-committees/:id                 # Update committee

POST   /api/hr/recruitments/:id/screen                 # W05-L2-006: AI screen applications
POST   /api/hr/recruitments/:id/record-selection       # W05-L2-007/008: Record selection outcome

POST   /api/hr/appointment-orders                      # W05-L2-009: Draft appointment order
POST   /api/hr/appointment-orders/:id/approve          # W05-L2-010: Approve appointment
POST   /api/hr/appointment-orders/:id/issue            # W05-L2-010: Issue to candidate
POST   /api/hr/appointment-orders/:id/respond          # W05-L2-011: Candidate accept/decline
GET    /api/hr/appointment-orders                      # List orders
GET    /api/hr/appointment-orders/:id                  # Get order
```

### 5.2 Onboarding Endpoints (CROSS-MODULE)

```
POST   /api/hr/onboarding/initialize-leave-balances    # W05-L2-017: Pro-rata leave init
POST   /api/hr/onboarding/induction-complete           # W05-L2-014: Mark induction done
# M02 /api/people/employees (existing) handles W05-L2-012
# M12 /api/platform/accounts (existing) handles W05-L2-013
```

### 5.3 Leave Management Endpoints (ENHANCED + NEW)

```
POST   /api/hr/leave-applications                      # ENHANCED: W05-L2-018 with balance check, clash detect
POST   /api/hr/leave-applications/:id/approve          # NEW: W05-L2-019/020/021 approval workflow
POST   /api/hr/leave-applications/:id/reject           # NEW: Rejection with reason
POST   /api/hr/leave-applications/:id/escalate         # NEW: W05-L2-021 escalation
POST   /api/hr/leave-applications/:id/withdraw         # NEW: W05-L2-026 withdrawal
POST   /api/hr/leave-applications/sabbatical           # NEW: W05-L2-022 sabbatical request

POST   /api/hr/leave-balances/initialize               # W05-L2-017: Bulk init for new employee
POST   /api/hr/leave-balances/annual-reset             # W05-L2-025: Year-end reset/carry-forward
GET    /api/hr/leave-balances/summary/:employeeId      # Leave balance dashboard

POST   /api/hr/compensatory-off                        # W05-L2-024: CO request
POST   /api/hr/compensatory-off/:id/approve            # CO approval
```

### 5.4 Attendance Endpoints (ENHANCED + NEW)

```
POST   /api/hr/attendance/biometric-ingest             # W05-L2-028: Bulk biometric import
GET    /api/hr/attendance/anomalies                    # W05-L2-029: List anomalies
POST   /api/hr/attendance/:id/correct                  # W05-L2-033: Request correction
POST   /api/hr/attendance/:id/approve-correction       # W05-L2-033: Approve correction
POST   /api/hr/attendance/reconcile                    # W05-L2-031: Reconcile with leave
POST   /api/hr/attendance/lock-month                   # W05-L2-032: Lock monthly records
GET    /api/hr/attendance/monthly-summary              # Monthly summary report
```

### 5.5 FDP Tracking Endpoints (NEW)

```
POST   /api/hr/fdp-records                             # W05-L2-034: Submit FDP certificate
POST   /api/hr/fdp-records/:id/ocr-extract             # W05-L2-035: Trigger OCR extraction
POST   /api/hr/fdp-records/:id/verify                  # W05-L2-036: Verify certificate
GET    /api/hr/fdp-records                             # List FDP records
GET    /api/hr/fdp-records/:id                         # Get FDP record

GET    /api/hr/fdp-compliance                          # W05-L2-037: Compliance summaries
POST   /api/hr/fdp-compliance/compute                  # W05-L2-037: Recompute compliance
POST   /api/hr/fdp-compliance/nudge                    # W05-L2-038: Send nudge notifications
POST   /api/hr/fdp-compliance/report                   # W05-L2-039: Generate M10 report
```

### 5.6 Appraisal Endpoints (ENHANCED + NEW)

```
POST   /api/hr/appraisal-cycles                        # W05-L2-040: Configure cycle
PUT    /api/hr/appraisal-cycles/:id                    # Update cycle
POST   /api/hr/appraisal-cycles/:id/initiate           # W05-L2-041: Generate records
POST   /api/hr/appraisal-cycles/:id/close              # W05-L2-047: Finalize & close
GET    /api/hr/appraisal-cycles                        # List cycles

POST   /api/hr/appraisals/:id/self-assessment          # W05-L2-042: Submit self-assessment
POST   /api/hr/appraisals/:id/aggregate                # W05-L2-043/044: Trigger data aggregation
POST   /api/hr/appraisals/:id/reviewer-assessment      # W05-L2-045: Submit reviewer assessment
POST   /api/hr/appraisals/:id/moderate                 # W05-L2-046: Moderation adjustment
POST   /api/hr/appraisals/:id/dispute                  # W05-L2-048: Submit dispute
POST   /api/hr/appraisals/:id/resolve-dispute          # W05-L2-048: Resolve dispute

POST   /api/hr/appraisals/generate-recommendations     # W05-L2-049: PIP/promotion recommendations
GET    /api/hr/appraisals/distribution                 # Rating distribution analysis
```

### 5.7 Exit/Separation Endpoints (NEW -- replaces simple ExitProcess CRUD)

```
POST   /api/hr/separations                             # W05-L2-050: Initiate resignation
POST   /api/hr/separations/retirement/:employeeId      # W05-L2-051: Process retirement
POST   /api/hr/separations/termination                 # W05-L2-052: From disciplinary
POST   /api/hr/separations/death                       # W05-L2-053: Death notification
POST   /api/hr/separations/:id/accept                  # W05-L2-054: Accept resignation
POST   /api/hr/separations/:id/reject                  # W05-L2-054: Reject resignation
POST   /api/hr/separations/:id/waive-notice            # W05-L2-054: Waive notice period
GET    /api/hr/separations                             # List separations
GET    /api/hr/separations/:id                         # Get separation

POST   /api/hr/exit-clearance/:separationId/initiate   # W05-L2-055: Generate clearance
POST   /api/hr/exit-clearance/:id/clear-item           # W05-L2-056-059: Clear individual item
GET    /api/hr/exit-clearance/:separationId            # Get clearance status

POST   /api/hr/handover/:separationId                  # W05-L2-056: Create handover record
PUT    /api/hr/handover/:id                            # Update handover items
POST   /api/hr/handover/:id/verify                     # HOD verifies handover

POST   /api/hr/settlements/:separationId/compute       # W05-L2-062: Compute settlement
POST   /api/hr/settlements/:id/approve                 # W05-L2-063: Approve settlement
POST   /api/hr/settlements/:id/process                 # W05-L2-063: Process payment
GET    /api/hr/settlements/:id                         # Get settlement

POST   /api/hr/separations/:id/relieve                 # W05-L2-064: Issue relieving order
POST   /api/hr/separations/:id/replacement-requisition # W05-L2-066: Trigger replacement
GET    /api/hr/retirement-alerts                       # W05-L2-051: Upcoming retirements
```

### 5.8 Disciplinary Endpoints (NEW)

```
POST   /api/hr/disciplinary-cases                      # W05-L2-067: Initiate case
POST   /api/hr/disciplinary-cases/from-referral        # W05-L2-068: From M06 referral
GET    /api/hr/disciplinary-cases                      # List cases
GET    /api/hr/disciplinary-cases/:id                  # Get case
PUT    /api/hr/disciplinary-cases/:id/investigation    # W05-L2-069: Update investigation
POST   /api/hr/disciplinary-cases/:id/show-cause       # W05-L2-070: Issue show cause
POST   /api/hr/disciplinary-cases/:id/record-response  # W05-L2-071: Record response
POST   /api/hr/disciplinary-cases/:id/hearing          # W05-L2-071: Record hearing
POST   /api/hr/disciplinary-cases/:id/decide           # W05-L2-072: Record outcome
POST   /api/hr/disciplinary-cases/:id/implement        # W05-L2-073: Implement outcome
POST   /api/hr/disciplinary-cases/:id/appeal           # W05-L2-074: Submit appeal
POST   /api/hr/disciplinary-cases/:id/resolve-appeal   # W05-L2-074: Resolve appeal
```

### 5.9 Payroll Data Extract Endpoints (NEW)

```
POST   /api/hr/payroll-extracts/generate               # W05-L2-079: Generate extract
GET    /api/hr/payroll-extracts                        # List extracts
GET    /api/hr/payroll-extracts/:id                    # Get extract
POST   /api/hr/payroll-extracts/:id/release            # Mark as released
```

### 5.10 Contract & Special Case Endpoints (NEW)

```
GET    /api/hr/contract-expiry-alerts                  # W05-L2-075: Upcoming contract expiries
POST   /api/hr/contract-renewal                        # W05-L2-075: Renew contract
POST   /api/hr/ad-hoc-appointment                     # W05-L2-076: Expedited ad-hoc hiring
POST   /api/hr/mid-year-resignation/:id/continuity-plan # W05-L2-077: Course continuity plan
```

### 5.11 Compliance Endpoints (CROSS-MODULE)

```
POST   /api/hr/compliance/student-faculty-ratio        # W05-L2-078: Compute & publish ratio
POST   /api/hr/compliance/fdp-report                   # W05-L2-039: FDP compliance to M10
POST   /api/hr/compliance/attendance-report             # W05-L2-032: Attendance to M10
```

---

## 6. State Machine Definitions

### 6.1 Recruitment Pipeline

```
HiringRequisition States:
  draft -> submitted -> validated -> approved -> fulfilled
                    \-> rejected
                    validated -> trust_escalated -> approved
                                               \-> rejected

Recruitment States (enhanced):
  open -> screening -> shortlisted -> selection -> selected -> filled
                                                \-> no_selection -> re_advertised
      \-> on_hold -> open
      \-> closed

AppointmentOrder States:
  draft -> approved -> issued -> accepted -> onboarding_triggered
                             \-> declined -> next_candidate | re_recruit
                             \-> expired -> next_candidate | re_recruit
```

**Transitions**:
- `HiringRequisition.approved` -> creates `Recruitment` record
- `Recruitment.selected` -> creates `AppointmentOrder`
- `AppointmentOrder.accepted` -> triggers onboarding (W05-L2-012 through 017)
- `AppointmentOrder.declined` + no next candidate -> `Recruitment.re_advertised`

### 6.2 Leave Approval State Machine

```
LeaveApplication States:
  draft -> submitted -> auto_approved (CL path)
                    \-> l1_pending -> l1_approved -> balance_deducted
                    |             \-> l1_rejected
                    |             \-> l2_pending -> l2_approved -> balance_deducted
                    |                           \-> l2_rejected
                    |                           \-> l3_pending -> l3_approved -> balance_deducted
                    |                                          \-> l3_rejected
                    |                                          \-> l4_pending (sabbatical)
                    \-> withdrawn (from any pending state)

  balance_deducted -> substitution_triggered (faculty only)
```

**Auto-approval rules (CL -> auto_approved)**:
1. leaveType.code === 'CL'
2. days <= leaveType.autoApproveMaxDays (default: 2)
3. leaveBalance.balance >= days
4. No exam calendar clash (M03 query)
5. examClashDetected === false

**Escalation triggers**:
- EL, ML, OD, LOP -> minimum L1 (HOD)
- Extended EL, medical > standard, LOP -> L2 (Dean) or L3 (Principal)
- Sabbatical -> L1 -> L2 -> L3 -> L4 (Trust)
- Exam period clash on any type -> force escalate to L2 (Dean)

### 6.3 Appraisal Cycle State Machine

```
AppraisalCycle States:
  configured -> open -> self_assessment -> review -> moderation -> closed

AppraisalRecord States:
  initiated -> self_assessment_pending -> self_assessment_complete
           -> aggregation_complete -> reviewer_pending -> reviewer_complete
           -> moderated -> finalized
           -> disputed -> dispute_resolved -> finalized
```

**Deadline enforcement**:
- Self-assessment window: cycle.startDate to cycle.selfAssessmentDeadline
- Reviewer window: cycle.selfAssessmentDeadline to cycle.reviewerDeadline
- Moderation window: cycle.reviewerDeadline to cycle.moderationDeadline
- Missed self-assessment deadline -> AI escalates to HOD, record flagged

### 6.4 Exit Process State Machine

```
SeparationRequest States:
  submitted -> accepted -> in_clearance -> settled -> completed
           \-> rejected (resignation only)

ExitClearance States:
  in_progress -> all_cleared -> settlement_triggered
             \-> blocked (any item blocked)

FinalSettlement States:
  computed -> approved -> processed -> paid
          \-> disputed -> recomputed -> approved

Per clearance item:
  pending -> cleared
         \-> blocked -> cleared (after resolution)
```

**Parallel clearance items** (generated per employee type):
- Department handover (all)
- Library clearance - M08 (all)
- Finance clearance - M04 (all)
- IT access revocation - M12 (all)
- Course reassignment - M03 (faculty only)
- Advisory role reassignment - M09 (faculty only)
- Hostel clearance (if applicable)
- Lab equipment return (if applicable)

### 6.5 Disciplinary Case State Machine

```
DisciplinaryCase States:
  under_investigation -> show_cause -> awaiting_response -> hearing -> decided -> implemented -> closed
                     \-> insufficient_evidence -> closed
  implemented -> appealed -> appeal_decided -> final_closed
                                            \-> overturned -> reversed -> closed
```

**Timeline enforcement**:
- Show cause response deadline: configurable (default 15 days)
- Response overdue -> proceed based on available evidence
- Appeal window: configurable (default 30 days from outcome communication)

---

## 7. Business Logic Requirements

### 7.1 Sanctioned Strength Validation (W05-L2-002)

```
Logic:
  1. Read SanctionedStrength from M11 for (department, positionType)
  2. Count current active employees from M02: Employee.countDocuments({
       collegeId, departmentId, employeeType matches positionType, status: 'active'
     })
  3. If currentCount < sanctionedStrength -> flag: 'within_limit'
  4. If currentCount >= sanctionedStrength -> flag: 'exceeds_limit'
  5. If exceeds AND justificationType === 'new' -> route to Trust (L4)
  6. Store flag on HiringRequisition.withinSanctionedStrength
```

### 7.2 Leave Balance Auto-Deduction (W05-L2-019/020/021)

```
On leave approval (any level):
  1. Find LeaveBalance for (employeeId, leaveTypeId, currentAcademicYearId)
  2. If balance.balance < days -> throw AppError(400, 'Insufficient leave balance')
  3. balance.taken += days
  4. balance.balance -= days
  5. If balance.balance < 0 -> convert excess to LOP:
     - balance.lopDays += Math.abs(balance.balance)
     - balance.balance = 0
  6. Save balance (atomic update with $inc)
  7. If employee is faculty -> trigger W05-L2-027 (substitution)
```

**Atomic operation** (prevents race conditions):
```typescript
await LeaveBalance.findOneAndUpdate(
  { _id: balanceId, balance: { $gte: days } },
  { $inc: { taken: days, balance: -days } },
  { new: true }
);
```

### 7.3 Pro-Rata Leave Initialization (W05-L2-017)

```
Logic:
  1. Read all LeaveTypes applicable to employee type
  2. For each leave type:
     - monthsRemaining = 12 - joiningMonth + 1 (or academic year months remaining)
     - proRataEntitlement = Math.ceil(leaveType.maxDaysPerYear * monthsRemaining / 12)
     - Create LeaveBalance record with entitled = proRataEntitlement, balance = proRataEntitlement
```

### 7.4 Annual Leave Reset & Carry-Forward (W05-L2-025)

```
For each employee, for each leave type:
  1. Read carry-forward rules from LeaveType (or M11 policy)
  2. CL: balance lapses entirely (carriedForward = 0, lapsed = remaining)
  3. EL: carry forward up to maxCarryForward days
     - carriedForward = Math.min(balance.balance, leaveType.maxCarryForward)
     - encashable = balance.balance - carriedForward (if encashmentAllowed)
     - lapsed = 0 (EL does not lapse if carry-forward)
  4. ML: typically does not carry forward
  5. Create new year LeaveBalance with entitled = maxDaysPerYear + carriedForward
  6. Update old year balance with lapsed, encashed amounts
```

### 7.5 Exam Clash Detection (W05-L2-023)

```
Logic (runs in parallel with leave submission):
  1. Read exam calendar windows from M03: ExamSchedule.find({
       collegeId, startDate: { $lte: leaveToDate }, endDate: { $gte: leaveFromDate }
     })
  2. Read employee exam duty assignments from M03: ExamDutyRoster.find({
       collegeId, employeeId, dutyDate: { $gte: leaveFromDate, $lte: leaveToDate }
     })
  3. If either query returns results:
     - leaveApplication.examClashDetected = true
     - leaveApplication.examClashDetails = JSON.stringify(clashDetails)
     - Force minimum approval level to L2 (Dean) regardless of leave type
```

### 7.6 Faculty Substitution Logic (W05-L2-027)

```
On faculty leave approval:
  1. Read faculty teaching schedule from M03 during leave period
  2. For each affected class:
     - Find eligible substitutes: same department, same/related subject, available (not on leave)
     - Rank by: subject match > availability > workload balance
  3. Generate substitution suggestions (AI)
  4. HOD confirms/overrides via API
  5. Update M03 timetable with substitution records
```

### 7.7 FDP Compliance Computation (W05-L2-037)

```
Logic:
  1. Read faculty cadre from M02/Employee designation mapping:
     - Assistant Professor -> 40 hours/year required
     - Associate Professor -> 30 hours/year required
     - Professor -> 20 hours/year required
  2. Sum verified FDP hours: FDPRecord.aggregate([
       { $match: { facultyId, complianceYear, verificationStatus: 'verified' } },
       { $group: { _id: null, totalHours: { $sum: '$hours' } } }
     ])
  3. gap = requiredHours - completedHours
  4. complianceStatus = gap <= 0 ? 'compliant' : (completedHours / requiredHours >= 0.5) ? 'partial' : 'non_compliant'
  5. Upsert FDPComplianceSummary
```

### 7.8 Multi-Source Appraisal Data Aggregation (W05-L2-043)

```
For faculty:
  1. Teaching feedback (M03): Average student feedback scores for all courses
     -> weight: 0.35 (configurable per cycle)
  2. Research (M02/HR): Publication count, impact factors, research projects
     -> weight: 0.175
  3. FDP (M05.4): FDPComplianceSummary.completedHours / requiredHours
     -> weight: 0.125
  4. Advisory (M09): Club/activity contributions (qualitative -> converted to score)
     -> weight: 0.075
  5. Mentoring (M06): Mentoring outcome scores
     -> weight: 0.075
  6. Attendance (M05.2): Present percentage
     -> weight: 0.075
  7. Self-assessment: Self-rating
     -> weight: 0.125

  Composite score = SUM(source_score * weight)
  Store in appraisal.aggregatedData with full source breakdown

For staff:
  1. Attendance (M05.2): Present percentage -> weight: 0.30
  2. Training records: Completed trainings -> weight: 0.20
  3. Duty performance (reviewer enters) -> weight: 0.50
```

### 7.9 Final Settlement Computation (W05-L2-062)

```
Logic:
  1. Leave encashment:
     - Read remaining EL balance (if encashmentAllowed)
     - dailyRate = (lastBasicPay + lastDA) / 30  (or per policy)
     - leaveEncashmentAmount = leaveEncashmentDays * dailyRate
  
  2. Gratuity (if eligible per M11 rules):
     - yearsOfService = (lastWorkingDate - joiningDate) in years
     - Eligible if yearsOfService >= 5 (Payment of Gratuity Act, 1972)
     - gratuityAmount = (lastBasicPay + lastDA) * 15 * yearsOfService / 26
     - Cap: Rs 25,00,000 (as per current limit, configurable in M11)
  
  3. Pending reimbursements (from M04 if any)
  
  4. Deductions:
     - Outstanding advances (from M04 clearance)
     - Any dues (library fines from M08, etc.)
  
  5. netSettlement = leaveEncashmentAmount + gratuityAmount + pendingReimbursements - advanceDeductions - dueDeductions
```

### 7.10 Notice Period Computation (W05-L2-054)

```
Logic:
  1. Read notice period from:
     a. AppointmentOrder.noticePeriodDays (if available)
     b. Employee contract terms
     c. M11 NoticePeriodPolicy by employee type and designation
  2. Default: 30 days for staff, 90 days for faculty (configurable)
  3. confirmedLastWorkingDay = max(requestedLastWorkingDay, today + noticePeriodDays)
  4. If employee requests shorter notice -> Principal decides waiver
```

### 7.11 Attendance Anomaly Detection (W05-L2-029)

```
Monthly anomaly scan:
  1. Late arrivals: count where lateMinutes > threshold per month
     - > 3 late marks -> severity: warning
     - > 6 late marks -> severity: critical -> refer to M05.CC1
  
  2. Missing swipes: days with checkIn but no checkOut (or vice versa)
     - > 2 per month -> flag
  
  3. Pattern detection: unusual check-in/check-out patterns
     - Statistical outlier detection on check-in times
  
  4. Chronic threshold:
     - 3 consecutive months with warnings -> auto-refer to disciplinary (M05.CC1)
     - Create AttendanceAnomaly record
     - Notify HOD
```

### 7.12 Payroll Data Extract Generation (W05-L2-079)

```
Monthly extract:
  1. Attendance summary: AttendanceMonthlySummary for all employees
  2. Leave consumed: LeaveApplication where status=approved AND overlaps month
  3. LOP days: LeaveBalance.lopDays for month (or derived from attendance)
  4. New joiners: Employee where joiningDate falls in month
  5. Separations: SeparationRequest where confirmedLastWorkingDay falls in month
  6. Package as PayrollDataExtract with structured data
  7. AO reviews -> marks as released
```

---

## 8. Cross-Module Integration Points

### 8.1 M02 People & Identity

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Write | W05-L2-012 | Create Employee identity record with generated employee code |
| Write | W05-L2-065 | Archive employee record (lifecycle state -> Separated) |
| Write | W05-L2-073 | Update status/designation on suspension/demotion |
| Read | W05-L2-002 | Current headcount for sanctioned strength check |
| Read | W05-L2-037 | Faculty cadre/designation for FDP requirements |
| Read | W05-L2-041 | Eligible employees for appraisal initiation |
| Read | W05-L2-043 | Research publications for appraisal aggregation |
| Read | W05-L2-064 | Employment history for experience certificate |
| Read | W05-L2-078 | Faculty count and student count for ratio computation |

### 8.2 M03 Academics

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Write | W05-L2-015 | Assign faculty course load on onboarding |
| Write | W05-L2-027 | Update timetable with substitute faculty on leave |
| Write | W05-L2-060 | Reassign courses and mentees on faculty exit |
| Read | W05-L2-019 | Exam calendar for CL auto-approval clash check |
| Read | W05-L2-023 | Exam duty roster for clash detection |
| Read | W05-L2-027 | Faculty teaching schedule for substitution |
| Read | W05-L2-043 | Teaching feedback scores for appraisal aggregation |
| Read | W05-L2-054 | Remaining sessions for mid-term exit impact |

### 8.3 M04 Finance & Fees

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Write | W05-L2-063 | Payment instruction for settlement |
| Write | W05-L2-073 | Fine from disciplinary outcome |
| Read | W05-L2-058 | Outstanding advances/dues for financial clearance |
| Read | W05-L2-062 | Pending reimbursements for settlement |

### 8.4 M06 Student Welfare

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Read | W05-L2-043 | Mentoring outcomes for faculty appraisal |
| Read | W05-L2-068 | ICC/ARC findings triggering disciplinary referral |

### 8.5 M08 Campus Ops (Library)

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Read | W05-L2-057 | Outstanding library books/dues for exit clearance |

### 8.6 M09 Student Development

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Write | W05-L2-016 | Link faculty advisory roles on onboarding |
| Write | W05-L2-061 | Reassign advisory roles on faculty exit |
| Read | W05-L2-043 | Club advisory contributions for appraisal |
| Read | W05-L2-038 | Upcoming FDP events for nudge suggestions |

### 8.7 M10 Compliance

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Write | W05-L2-004 | Selection committee evidence for NAAC/NBA |
| Write | W05-L2-007 | Selection proceedings evidence |
| Write | W05-L2-032 | Monthly attendance summary as compliance evidence |
| Write | W05-L2-039 | FDP compliance report for AICTE/NAAC |
| Write | W05-L2-047 | Faculty quality metrics from appraisal |
| Write | W05-L2-078 | Student-faculty ratio data |

### 8.8 M11 Governance

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Read | W05-L2-002 | Sanctioned strength, hiring policy |
| Read | W05-L2-006 | Qualification norms (UGC/AICTE) |
| Read | W05-L2-009 | Salary bands for appointment order |
| Read | W05-L2-017 | Leave entitlements per employee type |
| Read | W05-L2-025 | Carry-forward and encashment rules |
| Read | W05-L2-047 | Promotion eligibility criteria |
| Read | W05-L2-049 | PIP/promotion thresholds |
| Read | W05-L2-050 | Notice period policy |
| Read | W05-L2-054 | Notice period by contract type |
| Read | W05-L2-062 | Gratuity rules |
| Write | W05-L2-047 | Governance dashboard data |
| Write | W05-L2-066 | Sanctioned strength update (if position abolished) |

### 8.9 M12 Juvion Platform

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Write | W05-L2-013 | Account provisioning on onboarding |
| Write | W05-L2-059 | Account deprovisioning on exit |

### 8.10 Juvi Student App

| Direction | Sub-Workflows | Description |
|-----------|--------------|-------------|
| Write | W05-L2-077 | Student notification for mid-term faculty change |

### 8.11 Integration Implementation Approach

Cross-module integration should use **internal service-to-service calls** (not HTTP) since all modules run in the same Express process:

```typescript
// Example: Leave approval triggering M03 substitution
import * as academicsService from '../../modules/academics/service';

async function handleLeaveApproval(leaveApp: ILeaveApplication) {
  // ... deduct balance
  if (isFaculty(leaveApp.employeeId)) {
    await academicsService.triggerSubstitution(
      leaveApp.collegeId, leaveApp.employeeId, leaveApp.fromDate, leaveApp.toDate
    );
  }
}
```

For modules that may not have the needed service functions yet, create **integration hooks** -- placeholder service functions that initially log the cross-module call and return a no-op result, to be wired up when the target module implements the needed capability.

---

## 9. AI Agent Scope

### 9.1 Autonomy Levels by Sub-Domain

| Sub-Domain | L3 (Autonomous) | L2 (Supervised) | L1 (Advisory) |
|-----------|-----------------|-----------------|---------------|
| RECRUIT | Validate sanctioned strength, screen apps, draft appointment order | Committee template, shortlist generation | All approval decisions |
| Onboarding | Generate employee code, provision account, compute pro-rata leave | Suggest course assignment | Document verification |
| LEAVE | **Auto-approve CL** (policy-bound), balance computation, clash detection, carry-forward reset | Route with context, flag clashes, suggest substitutes | All non-CL approval decisions, sabbatical |
| ATT | **Auto-mark from biometric**, flag anomalies, generate summaries, lock records | Flag chronic patterns, reconcile with leave | Manual correction approval, OD approval |
| FDP | **OCR extraction**, compliance computation, nudge reminders, duplicate detection | Flag low-confidence OCR, suggest FDPs | Certificate verification, disciplinary for non-compliance |
| APPR | **Bulk record creation**, data aggregation, narrative summary, distribution analysis | Benchmark against peers, flag divergence | Rating assignment, moderation, promotion/PIP decisions |
| EXIT | **Compute settlement**, generate clearance checklist, draft relieving order, retirement alert | Flag overdue handover, impact analysis | Resignation acceptance, notice waiver, settlement approval |
| DISC | Track timelines, draft show cause notice, pull supporting records | Timeline monitoring, evidence assembly | **All decisions** (investigation, outcome, appeal) |

### 9.2 AI Agent Functions to Implement

```typescript
// recruitment-agent.ts
export async function validateAgainstSanctionedStrength(collegeId, requisitionId): Promise<ValidationResult>;
export async function screenApplications(collegeId, recruitmentId): Promise<ScreeningResult>;
export async function draftAppointmentOrder(collegeId, recruitmentId, candidateId): Promise<AppointmentDraft>;
export async function generateCommitteeTemplate(collegeId, positionType): Promise<CommitteeTemplate>;

// leave-agent.ts
export async function evaluateAutoApproval(collegeId, leaveApplicationId): Promise<AutoApprovalResult>;
export async function detectExamClash(collegeId, employeeId, fromDate, toDate): Promise<ClashResult>;
export async function suggestSubstitutes(collegeId, facultyId, fromDate, toDate): Promise<SubstituteSuggestion[]>;
export async function computeAnnualReset(collegeId, academicYearId): Promise<ResetResult>;

// attendance-agent.ts
export async function processBiometricLogs(collegeId, logs: BiometricLog[]): Promise<AttendanceResult[]>;
export async function detectAnomalies(collegeId, month, year): Promise<AnomalyResult[]>;
export async function reconcileWithLeave(collegeId, month, year): Promise<ReconciliationResult>;
export async function generateMonthlySummary(collegeId, month, year): Promise<MonthlySummary[]>;

// fdp-agent.ts
export async function ocrExtractCertificate(collegeId, fdpRecordId): Promise<OCRResult>;
export async function computeComplianceGap(collegeId, facultyId, year): Promise<ComplianceGap>;
export async function detectDuplicateFDP(collegeId, fdpRecord): Promise<DuplicateResult>;
export async function generateComplianceReport(collegeId, academicYearId): Promise<ComplianceReport>;

// appraisal-agent.ts
export async function bulkCreateAppraisalRecords(collegeId, cycleId): Promise<BulkResult>;
export async function aggregateFacultyData(collegeId, appraisalId): Promise<AggregatedData>;
export async function aggregateStaffData(collegeId, appraisalId): Promise<AggregatedData>;
export async function generateNarrativeSummary(collegeId, appraisalId): Promise<string>;
export async function analyzeRatingDistribution(collegeId, cycleId): Promise<DistributionAnalysis>;
export async function identifyPromotionPIPCandidates(collegeId, cycleId): Promise<RecommendationList>;

// exit-agent.ts
export async function computeNoticePeriod(collegeId, employeeId): Promise<NoticePeriodResult>;
export async function generateClearanceChecklist(collegeId, employeeId): Promise<ClearanceItem[]>;
export async function computeFinalSettlement(collegeId, separationRequestId): Promise<SettlementComputation>;
export async function draftRelievingOrder(collegeId, separationRequestId): Promise<DocumentDraft>;
export async function draftExperienceCertificate(collegeId, separationRequestId): Promise<DocumentDraft>;
export async function detectUpcomingRetirements(collegeId, withinMonths: number): Promise<RetirementAlert[]>;
export async function analyzeExitImpact(collegeId, employeeId): Promise<ImpactAnalysis>;

// compliance-agent.ts
export async function computeStudentFacultyRatio(collegeId): Promise<RatioResult>;
export async function generatePayrollExtract(collegeId, month, year): Promise<PayrollExtract>;
```

### 9.3 BullMQ Job Queues

| Queue | Jobs | Schedule |
|-------|------|----------|
| `hr:biometric` | Process biometric log batches | Continuous / every 5 minutes |
| `hr:attendance-anomaly` | Monthly anomaly detection scan | 1st of each month |
| `hr:attendance-lock` | Lock previous month records | 5th of each month |
| `hr:leave-reset` | Annual leave reset and carry-forward | Year-end (configurable) |
| `hr:fdp-compliance` | Recompute FDP compliance gaps | Weekly |
| `hr:fdp-nudge` | Send FDP shortfall nudges | Monthly |
| `hr:retirement-alert` | Check upcoming retirements | Daily |
| `hr:contract-expiry` | Check upcoming contract expiries | Daily |
| `hr:appraisal-reminder` | Send deadline reminders | Daily (during active cycle) |
| `hr:payroll-extract` | Generate monthly payroll extract | 25th of each month |
| `hr:disciplinary-timeline` | Check overdue disciplinary deadlines | Daily |

---

## 10. Implementation Phases

### Phase 1: Core Leave & Attendance Workflow (Priority: HIGH)

**Scope**: W05-L2-017 through W05-L2-033 (16 sub-workflows)
**Estimated effort**: 3-4 weeks

**Tasks**:
1. Enhance LeaveType schema with auto-approval and policy fields
2. Enhance LeaveApplication schema with approval chain, clash detection, withdrawal
3. Enhance LeaveBalance schema with carry-forward, LOP tracking
4. Enhance EmployeeAttendance schema with lock, anomaly, correction fields
5. Create AttendanceAnomaly model
6. Create AttendanceMonthlySummary model
7. Implement leave submission with balance validation
8. Implement CL auto-approval engine (reads M03 exam calendar -- stub initially)
9. Implement multi-level approval routing (HOD -> Dean -> Principal -> Trust)
10. Implement leave balance deduction (atomic operations)
11. Implement leave withdrawal with balance restoration
12. Implement compensatory-off workflow
13. Implement annual leave reset and carry-forward
14. Implement biometric log processing (stub for actual biometric integration)
15. Implement attendance anomaly detection
16. Implement attendance-leave reconciliation
17. Implement monthly attendance lock
18. Implement manual attendance correction with approval
19. Add all new API endpoints
20. Add BullMQ jobs for scheduled tasks

**Dependencies**: M03 exam calendar model (stub acceptable in Phase 1)

### Phase 2: Recruitment Pipeline (Priority: HIGH)

**Scope**: W05-L2-001 through W05-L2-011 + onboarding W05-L2-012 through W05-L2-017 (17 sub-workflows)
**Estimated effort**: 3-4 weeks

**Tasks**:
1. Create HiringRequisition model
2. Create SelectionCommittee model
3. Create AppointmentOrder model
4. Enhance Recruitment model with requisition link, committee reference
5. Enhance JobApplication model with AI screening, interview scores
6. Implement hiring requisition submission and validation
7. Implement sanctioned strength check (requires M11 SanctionedStrength -- stub initially)
8. Implement multi-level requisition approval
9. Implement selection committee constitution (AICTE template for faculty)
10. Implement application screening (AI-assisted -- basic scoring initially)
11. Implement appointment order drafting and approval
12. Implement candidate acceptance/decline flow
13. Implement onboarding trigger chain (M02 identity -> M12 account -> leave init)
14. Add all new API endpoints
15. Add state machine transitions

**Dependencies**: M11 SanctionedStrength model, M11 SalaryBand model (stubs acceptable)

### Phase 3: FDP Tracking & Appraisal (Priority: MEDIUM)

**Scope**: W05-L2-034 through W05-L2-049 (16 sub-workflows)
**Estimated effort**: 3-4 weeks

**Tasks**:
1. Create FDPRecord model
2. Create FDPComplianceSummary model
3. Create AppraisalCycle model
4. Enhance Appraisal model with cycle, aggregation, moderation, dispute fields
5. Enhance Promotion model with appraisal link
6. Implement FDP certificate submission
7. Implement OCR extraction (integrate with Juvi AI or external OCR service)
8. Implement duplicate FDP detection
9. Implement FDP compliance gap computation
10. Implement FDP nudge system
11. Implement appraisal cycle configuration and initiation
12. Implement bulk appraisal record generation
13. Implement self-assessment submission
14. Implement multi-source data aggregation (faculty and staff paths)
15. Implement reviewer assessment with AI narrative
16. Implement moderation and normalization
17. Implement rating finalization and dispute handling
18. Implement promotion/PIP recommendation generation
19. Add all new API endpoints
20. Add BullMQ jobs for FDP compliance monitoring

**Dependencies**: M03 teaching feedback API, M09 advisory API (stubs acceptable)

### Phase 4: Exit & Separation (Priority: MEDIUM)

**Scope**: W05-L2-050 through W05-L2-066 + W05-L2-075 through W05-L2-077 (20 sub-workflows)
**Estimated effort**: 3-4 weeks

**Tasks**:
1. Create SeparationRequest model
2. Create ExitClearance model
3. Create HandoverRecord model
4. Create FinalSettlement model
5. Deprecate ExitProcess model (migration path: wrap existing records)
6. Implement resignation initiation with notice computation
7. Implement proactive retirement detection and alerting
8. Implement termination trigger from disciplinary
9. Implement death notification processing
10. Implement notice period determination and waiver
11. Implement parallel clearance generation and tracking
12. Implement department handover with checklist generation
13. Implement cross-module clearance (library M08, finance M04, IT M12 -- stubs)
14. Implement faculty course/mentee reassignment trigger (M03)
15. Implement faculty advisory role reassignment trigger (M09)
16. Implement settlement computation (gratuity, leave encashment, deductions)
17. Implement settlement approval and payment instruction
18. Implement relieving order and experience certificate generation
19. Implement employee record archival
20. Implement replacement requisition trigger
21. Implement contract renewal workflow
22. Implement ad-hoc faculty appointment
23. Implement mid-year resignation with continuity plan
24. Add all new API endpoints

**Dependencies**: M04 advance records API, M08 library records API, M12 account management API

### Phase 5: Disciplinary Proceedings (Priority: LOWER)

**Scope**: W05-L2-067 through W05-L2-074 (8 sub-workflows)
**Estimated effort**: 2 weeks

**Tasks**:
1. Create DisciplinaryCase model
2. Create DisciplinaryOutcome model
3. Implement case initiation (internal and external referral)
4. Implement investigation tracking
5. Implement show cause notice generation
6. Implement response and hearing recording
7. Implement outcome decision and implementation
8. Implement cross-system outcome effects (M02 status, M04 fine, M05.6 termination)
9. Implement appeal processing
10. Implement timeline monitoring and overdue alerts
11. Add all new API endpoints
12. Add BullMQ job for timeline monitoring

**Dependencies**: M06 ICC/ARC findings API (for external referral)

### Phase 6: Compliance Reporting & Payroll Extract (Priority: LOWER)

**Scope**: W05-L2-078, W05-L2-079 (2 sub-workflows)
**Estimated effort**: 1 week

**Tasks**:
1. Create PayrollDataExtract model
2. Implement student-faculty ratio computation and M10 publishing
3. Implement monthly payroll data extract generation
4. Implement extract review and release workflow
5. Wire FDP compliance report to M10
6. Wire attendance summary to M10
7. Add all new API endpoints
8. Add BullMQ jobs for scheduled generation

### Phase 7: Cross-Module Integration Hardening

**Scope**: Replace all stubs with real cross-module calls
**Estimated effort**: 2-3 weeks (overlaps with target module development)

**Tasks**:
1. Wire M03 exam calendar reads for leave clash detection
2. Wire M03 course substitution writes for faculty leave
3. Wire M03 course reassignment for faculty exit
4. Wire M04 financial clearance reads for exit
5. Wire M04 payment instruction writes for settlement
6. Wire M06 mentoring outcome reads for appraisal
7. Wire M08 library clearance reads for exit
8. Wire M09 advisory role reads/writes for onboarding and exit
9. Wire M10 compliance evidence writes (all sub-domains)
10. Wire M11 policy reads (sanctioned strength, salary bands, leave policy, etc.)
11. Wire M12 account provisioning/deprovisioning for onboarding and exit
12. Wire Juvi student notification for mid-year faculty change

---

## Appendix A: Entity Count Summary

| Category | Count |
|----------|-------|
| Existing models to enhance | 11 |
| Existing models adequate as-is | 5 (Qualification, Publication, ResearchProject, Training, PayStructure) |
| Existing models to deprecate | 1 (ExitProcess -> SeparationRequest + ExitClearance + FinalSettlement) |
| New models to create | 15 |
| **Total models after implementation** | **33** |

## Appendix B: Service Function Count Estimate

| Category | Count |
|----------|-------|
| Existing CRUD functions (retained) | ~90 |
| New workflow functions (RECRUIT) | ~20 |
| New workflow functions (LEAVE) | ~18 |
| New workflow functions (ATT) | ~12 |
| New workflow functions (FDP) | ~10 |
| New workflow functions (APPR) | ~16 |
| New workflow functions (EXIT) | ~25 |
| New workflow functions (DISC) | ~14 |
| New workflow functions (PAYROLL/COMPLIANCE) | ~6 |
| New AI agent functions | ~25 |
| **Total service functions** | **~236** |

## Appendix C: API Endpoint Count

| Category | Current | New/Enhanced | Total |
|----------|---------|-------------|-------|
| Existing CRUD routes | 65 | 0 | 65 |
| Recruitment | 0 | 15 | 15 |
| Leave (enhanced) | 5 | 12 | 17 |
| Attendance (enhanced) | 3 | 8 | 11 |
| FDP | 0 | 9 | 9 |
| Appraisal (enhanced) | 5 | 12 | 17 |
| Exit/Separation | 5 | 20 | 20 |
| Disciplinary | 0 | 12 | 12 |
| Payroll Extract | 0 | 4 | 4 |
| Contract/Special | 0 | 4 | 4 |
| Compliance | 0 | 3 | 3 |
| **Total** | **65** | **~99** | **~177** |

## Appendix D: Faculty vs Staff Pathway Summary

| Area | Faculty-Specific | Staff-Specific |
|------|-----------------|----------------|
| Recruitment | AICTE committee (external experts, nominee, SC/ST rep), demo lecture + interview | Internal committee (HOD, senior staff, AO), interview + skill test |
| Onboarding | Course assignment (M03), advisory roles (M09) | N/A |
| Leave | Sabbatical (4-level chain), leave triggers M03 substitution | No sabbatical, no M03 impact |
| FDP | AICTE compliance tracking (40/30/20 hr by cadre), OCR, M10 evidence | N/A |
| Appraisal | Multi-source weighted (M03+M02+M05.4+M09+M06, 5-7 sources) | Simpler (attendance + duty performance, 2-3 sources) |
| Exit | Course/mentee reassignment (M03), advisory reassignment (M09), mid-year continuity plan, student notification | Admin duties/files/assets handover only |
| Contract | Contract renewal with performance review, ad-hoc appointment | Handled differently |
