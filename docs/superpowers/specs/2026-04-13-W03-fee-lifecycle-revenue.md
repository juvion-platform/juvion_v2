# W03 -- Fee Lifecycle & Revenue Assurance: Implementation Spec

**Status:** DRAFT | 2026-04-13
**Workflow:** W03 | 69 sub-workflows across M04 (50), M02 (3), M06 (2), M11 (3), M12 (4), Juvi (4), Audit (3)
**Source:** W03_L2_Workflow_Decomposition.xlsx (derived April 2026)

---

## 1. Executive Summary

W03 covers the complete fee lifecycle for an Indian college ERP: fee structure configuration, student billing, payment collection and reconciliation, scholarship/concession management, defaulter escalation with welfare handoff, vendor disbursements, and year-end closure. The workflow spans 69 sub-workflows orchestrated primarily through M04 (Finance), with integration points into M02 (People), M06 (Welfare), M11 (Governance), M12 (Platform), and the Juvi student app.

**Current state:** M04 has 16 Mongoose models and 72 service functions, all pure CRUD scaffolding. There is no sub-domain separation (FEECONF, BILLING, COLLECT, SCHCON, DEFAULT, VENDPAY), no payment reconciliation logic, no late-fee calculation, no defaulter escalation state machine, no refund workflow, no financial-ledger double-entry bookkeeping, no TS-EPass integration, and no cross-module signaling to M06/M11. The gap between the current scaffold and the W03 spec is substantial across every layer: models, services, API endpoints, and business logic.

**AI autonomy breakdown:** 32 fully autonomous sub-workflows, 18 autonomous-with-flags, 19 human-decision-required. The escalation ladder is the clearest autonomy gradient: Stage 1-2 are autonomous, Stage 3 AI-recommends-human-approves, Stage 4 is human-decision-only.

---

## 2. Current Codebase State

### 2.1 Models (16 files in `backend/src/models/finance/`)

| Model | Fields (summary) | W03 Gaps |
|---|---|---|
| **FeeStructure** | academicYearId, programmeId, branchId, category, quota, year, components[{name, amount, isRefundable}], totalAmount | No `status` field (draft/submitted/approved/active/superseded/archived). No `effectiveDate`. Components are flat -- no separate FeeComponent model. No FeeComponentRule entity. No clone/versioning support. |
| **StudentFeeAccount** | studentId, totalDue, totalPaid, totalWaived, totalRefunded, balance, lastPaymentDate | No `feeStatus` enum. No scholarship-related tracking. No `hasFinancialHold`. Account is a single aggregate -- no per-year breakdown. |
| **FeeLineItem** | studentId, feeStructureId, component, academicYearId, semester, amount, paidAmount, waivedAmount, dueDate, status | Adequate as a base. Missing `invoiceId` link. Missing `scholarshipAllocated` field. |
| **Payment** | studentId, receiptNumber, amount, paymentMode, transactionRef, paymentDate, allocations[{lineItemId, amount}], status, collectedBy, remarks | Missing `invoiceId`. Missing `reconciliationStatus`. Missing `channel` (gateway vs counter vs NEFT). `allocations` maps to line items but not invoices. |
| **Invoice** | invoiceNumber, studentId, type, items[{description, amount}], totalAmount, dueDate, status, issuedDate | Status enum too narrow (missing: `generated`, `sent`, `partially_paid`, `disputed`, `written_off`). No `feeAgreementId`. No `netPayable` (after scholarship/concession). No `semesterId`. No `lineItems` ref (uses embedded items instead of referencing FeeLineItem). |
| **Scholarship** | name, provider, type, amount, criteria, academicYearId, maxRecipients, isActive | Adequate as master data. Missing detailed eligibility criteria schema. |
| **ScholarshipAllocation** | scholarshipId, studentId, academicYearId, amount, status, disbursedDate | Status enum too narrow. Missing `claimStatus`, `portalReference`, `receivableStatus`. No distinction between eligibility, claim, receivable, and credit entities. |
| **Concession** | studentId, type, percentage, flatAmount, reason, approvedBy, academicYearId, status | Missing `source` (M04 vs M06 referral). Missing `effectiveFrom`/`effectiveTo`. Missing `componentId` for targeted concession. |
| **Refund** | studentId, paymentId, amount, reason, refundMode, status, approvedBy, processedDate | Missing `invoiceId`. Missing `approvalThreshold` logic. Missing `refundTransactionRef`. |
| **FinePenalty** | studentId, type, reason, amount, dueDate, paidAmount, status, imposedBy | Adequate for basic fines. Missing `invoiceLineItemId` link. |
| **Budget** | academicYearId, departmentId, category, allocatedAmount, spentAmount, status | Outside core W03 scope (vendor payment budgets only tangentially relevant). |
| **Expense** | budgetId, category, description, amount, vendorName, invoiceNumber, invoiceDate, paidDate, status, approvedBy | Does not map to vendor payment workflow. Missing `vendorId` ref. Missing `paymentRequestId`. |
| **FinancialLedger** | entryDate, entryType, category, description, debit, credit, balance, referenceId, referenceType | Not double-entry. No `accountCode`. Single running balance is incorrect for a multi-account ledger. No period locking. |
| **PaymentGatewayLog** | studentId, orderId, gateway, amount, currency, status, gatewayResponse, initiatedAt, completedAt | Reasonable for logging. Missing `invoiceId`. Missing `signatureVerified` flag. Missing `webhookReceived` timestamp. |
| **FeeReminder** | studentId, lineItemId, channel, sentAt, dueAmount, status | Missing `escalationStage`. Missing `invoiceId`. Missing `templateId`. Missing `deliveryDetails` (read receipt, etc). |
| **FinancialReport** | reportType, periodFrom, periodTo, generatedBy, data, generatedAt | Generic report blob. Adequate for initial reporting; specific report types will need dedicated aggregation logic. |

### 2.2 Service Layer (72 functions in `backend/src/modules/finance/service.ts`)

All 72 functions follow the identical pattern: `list/get/create/update/delete` CRUD for each of the 16 models. The only business logic present:

1. `createPayment` -- allocates payment to FeeLineItems and updates their paid status
2. `createExpense` -- increments Budget.spentAmount
3. `generateReceiptNumber` -- sequential receipt numbering per year
4. `assertStudentFeeGuardianReady` -- checks feeResponsibleParentId before creating finance records
5. `getStats` -- dashboard aggregation counts

**Not present:** Invoice generation from fee structure, batch processing, reconciliation, scholarship claim lifecycle, defaulter identification/escalation, hold management, distress computation, refund approval workflow, vendor payment flow, period closure, audit export.

### 2.3 Routes (34 endpoints in `backend/src/modules/finance/routes.ts`)

All routes are flat CRUD under `/api/finance/`. No sub-domain routing (e.g., `/api/finance/billing/`, `/api/finance/defaulters/`). No batch endpoints. No webhook endpoints. No action-oriented endpoints (e.g., `POST /invoices/:id/dispute`, `POST /defaulters/:id/escalate`).

### 2.4 Cross-Module State

- **M02 (People):** Student model has `feeResponsibleParentId`, `category`, `quota`, `programmeId`, `branchId`. Missing: `feeStatus`, `hasFinancialHold`, `scholarshipStatus`.
- **M06 (Welfare):** No finance-related entities. No `WelfareReferral` model. No distress signal integration. CounselingSession and StudentGrievance exist but have no M04 linkage. Grievance category includes `'fee'` -- minimal connection.
- **M11 (Governance):** Policy model exists but no fee-policy-specific schema. No dashboard widget entities.
- **M12 (Platform):** No integration execution log. No notification dispatch service with delivery tracking.

---

## 3. Sub-Workflow Catalog

### 3.1 M04.1 FEECONF -- Fee Configuration (4 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-001** | Draft Annual Fee Structure | Academic year planning begins; prior year archived | Auto: prior year clone, inflation adjustment, policy validation. Flags: deviation >15%, missing components | Annual |
| **W03-L2-002** | Configure Fee Component Rules | Draft Fee Structure created | Auto: rule syntax validation, sample profile testing. Flags: ambiguous rules, conflicting conditions | Annual |
| **W03-L2-003** | Submit Fee Structure for Approval | Draft complete with all components and rules | Auto: comparison report, revenue projection. Human: all approval decisions | Annual |
| **W03-L2-004** | Approve and Activate Fee Structure | Trust/GB reviews submitted structure | N/A -- human judgment required for all approval decisions | Annual |

**Key entities (C/R/U):** Fee Structure Instance (C/U), Fee Component (C/U), Fee Component Rule (C/U)

**Steps detail:**
- W03-L2-001: Clone prior year -> AI applies inflation -> ST2 adjusts -> validate against M11.2 policy ceilings -> status Draft -> route to Leadership. Exception: new programme with no prior structure; policy ceiling exceeded requiring waiver.
- W03-L2-002: For each component define condition_type (hostel, transport, lab_programme, etc.) and condition_value -> validate against M02 programme registry -> test with sample profiles -> status Configured.
- W03-L2-003: Generate comparison report (prior vs proposed) -> calculate projected revenue impact -> Principal reviews -> submit to Trust/GB -> status Submitted -> notify via M12.2.
- W03-L2-004: Trust/GB meeting -> Approve/Modify/Reject -> if Approved: status Active, archive prior year, publish to M01.4 OFFER.

### 3.2 M04.2 BILLING -- Student Billing (11 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-005** | Generate Semester Invoice Batch (Continuing) | Semester start per Academic Calendar | Autonomous: batch generation, rule evaluation, credit allocation. Flags: attribute mismatch, missing fee structure | Per-semester |
| **W03-L2-006** | Generate First Invoice for New Enrolment | M01.5 ENROL signals enrolment complete | Autonomous: generation, Fee Agreement lookup, credit allocation | On-demand |
| **W03-L2-007** | Create Fee Agreement for Management Quota | M01.4 OFFER finalized with fee negotiation | Autonomous: creation based on M01 handoff | On-demand |
| **W03-L2-008** | Create Standard Payment Plan | Invoice generated; student requests plan | Autonomous: template application. Human: custom plan approval | On-demand |
| **W03-L2-009** | Generate Exam Fee Invoice | M03.5 EXAM enrollment confirmation | Autonomous: generation, deadline calculation | Per-semester |
| **W03-L2-010** | Generate Ad-Hoc Invoice | ST2 identifies special charge | N/A -- manual ST2 action | On-demand |
| **W03-L2-011** | Adjust Invoice for Mid-Year Change | Student attribute changes (hosteler->day scholar, transport drop) | Auto: proration calculation. Human: large adjustments | On-demand |
| **W03-L2-012** | Handle Invoice Dispute | Student/parent raises dispute | N/A -- human judgment for dispute resolution | On-demand |
| **W03-L2-013** | Apply Mid-Year Fee Revision | Leadership approves mid-year change | Auto: structure creation, notification. Human: approval | Rare |
| **W03-L2-014** | Apply Sibling Discount | Sibling linkage detected in M02 | Autonomous: detection, calculation, application. Flags: 3+ siblings | On-demand |
| **W03-L2-015** | Write Off Uncollectable Invoice | All recovery exhausted; Leadership approves | N/A -- human judgment for write-off decision | Rare |

**Steps detail (key sub-workflows):**
- W03-L2-005 (Semester batch): Retrieve active students -> for each: read M02 profile (programme, quota, hostel, transport) -> evaluate Fee Component Rules -> create Invoice with applicable components -> apply existing Scholarship Eligibility credits -> apply Concessions -> calculate net_payable -> status Generated -> Sent -> trigger notifications. Exception: missing S5 tag but in hostel (flag M02 update); fee structure not approved (halt batch).
- W03-L2-006 (New enrolment): Receive signal from M01.5 -> read finalized Fee Structure from offer -> check Fee Agreement (management quota) -> create Invoice -> apply pre-verified scholarship credits -> deduct first payment from W01 -> remaining = future installments.
- W03-L2-007 (Fee Agreement): Receive from M01.4 -> create Fee Agreement (negotiated_total, approval_authority) -> if custom plan: create Payment Plan -> all future invoices reference agreement -> valid for programme duration.
- W03-L2-011 (Mid-year adjustment): M02/M08 signals change -> identify affected components -> prorate credit/debit -> create adjustment line items -> net credit may trigger refund candidate.

### 3.3 M04.3 COLLECT -- Collection & Payments (10 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-016** | Dispatch Invoice Notification Sequence | Invoice status -> Sent | Autonomous: template selection, multi-channel dispatch, tracking | Per invoice |
| **W03-L2-017** | Record Online Payment (Gateway) | Payment gateway webhook received | Autonomous: webhook processing, matching, receipt generation | Continuous |
| **W03-L2-018** | Record Cash/DD Payment at Counter | Student pays at accounts counter | N/A -- physical handling. AI assists with receipt generation | Continuous |
| **W03-L2-019** | Record NEFT/RTGS Payment | Bank statement shows incoming credit | Auto: pattern recognition, auto-match (>=90% confidence). Flags: ambiguous | Daily/weekly |
| **W03-L2-020** | Execute Daily/Weekly Reconciliation | Reconciliation cycle trigger (scheduled) | Auto: matching algorithm, discrepancy detection. Human: resolution | Daily/weekly |
| **W03-L2-021** | Generate and Issue Receipt | Payment confirmed/reconciled | Autonomous: number generation, multi-channel delivery. Human: physical printing | Per payment |
| **W03-L2-022** | Detect Duplicate Payment | New payment matches existing for same invoice | Auto: detection. Human: confirmation before refund | Continuous |
| **W03-L2-023** | Handle Payment Bounce/Failure | Gateway reports failure OR DD/cheque bounces | Auto: reversal, penalty application. Human: penalty waiver | On-demand |
| **W03-L2-024** | Handle Overpayment Resolution | Overpayment Record created | N/A -- preference collection. Auto: credit forward application | On-demand |
| **W03-L2-025** | Process Refund | Refund approved (overpayment, cancellation, adjustment) | Auto: method determination, execution (gateway). Human: approval, manual bank | On-demand |

**Steps detail (key sub-workflows):**
- W03-L2-017 (Online payment): Gateway webhook -> validate signature -> create Payment Transaction (reconciliation_status=Received) -> match to Invoice -> update Invoice (Paid/Partially Paid) -> generate Receipt -> trigger confirmations -> if Paid, check/release holds.
- W03-L2-020 (Reconciliation): Online: verify gateway settlements match transactions. Bank: match credits to NEFT, DD deposits, cash register. Create Reconciliation Entry per match. Discrepancies -> ST2 queue.
- W03-L2-023 (Bounce): Failure notification -> create Bounce record -> reverse Invoice status -> cancel Receipt -> apply bounce penalty per policy -> create penalty line item -> notify.
- W03-L2-025 (Refund): Create Refund record -> approval (ST2 <=10K, Leadership >10K) -> determine method (reverse to original or bank transfer) -> execute -> confirm -> notify.

### 3.4 M04.4 SCHCON -- Scholarships & Concessions (9 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-026** | Verify Scholarship Eligibility (Batch) | Semester start; new students enrolled | Auto: attribute matching, clear case verification. Flags: unclear docs, multi-scheme | Per-semester |
| **W03-L2-027** | Submit Scholarship Claims to Government (TS-EPass) | Eligibility verified; claim window open | Auto: batch generation, submission. Human: pre-submission review | Per-scheme window |
| **W03-L2-028** | Track Scholarship Claim Status | Claims submitted; awaiting government action | Autonomous: polling, status update, receivable creation | Continuous |
| **W03-L2-029** | Process Scholarship Disbursement Receipt | Government disburses to institution account | Auto: matching, credit application. Flags: amount mismatch | Per-disbursement |
| **W03-L2-030** | Convert Scholarship Receivable to Student Liability | Receivable overdue; government hasn't disbursed | Flags: overdue. Human: conversion decision requires Leadership | Rare |
| **W03-L2-031** | Process Hardship Concession Request | M06 returns welfare assessment with hardship recommendation | N/A -- human judgment. Auto: concession application after approval | On-demand |
| **W03-L2-032** | Apply Merit Scholarship | Results published; students meet merit criteria | Auto: eligibility evaluation. Human: exceptional cases, tie-breakers | Per-semester/annual |
| **W03-L2-033** | Process Staff/Faculty Ward Concession | M05 confirms staff status; dependent enrolled | Autonomous: detection, application, monitoring. Human: exceptions | On-demand |
| **W03-L2-034** | Annual Scholarship Renewal Check | New academic year; existing scholarships need verification | Auto: rule evaluation. Flags: borderline academic standing, document expiry | Annual |

**Steps detail (key sub-workflows):**
- W03-L2-026 (Eligibility batch): Retrieve students -> read M02 attributes (category, income cert, caste cert, first-gen) -> match against scheme criteria -> auto-verify if documents clear (status=Eligible) -> flag manual review for unclear/expired docs.
- W03-L2-027 (TS-EPass claims): Claim window opens -> retrieve Eligible students -> generate batch -> submit to portal via M12.4 -> create Scholarship Claim (status=Submitted) -> capture portal_reference.
- W03-L2-029 (Disbursement): Bank statement credit from TS-EPass -> AI matches to pending Receivables -> create Scholarship Credit -> apply to Invoice (reduce net_payable) -> Receivable status Disbursed -> notify students.
- W03-L2-030 (Liability conversion): Receivable overdue >6 months -> ST2 reviews -> Leadership approves -> remove scholarship allocation from Invoice -> student re-enters collection cycle.

### 3.5 M04.5 DEFAULT -- Defaulter Management (12 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-035** | Identify Defaulters (Batch) | Invoice due date passed; payment not received | Autonomous: detection, record creation | Daily |
| **W03-L2-036** | Execute Stage 1 Escalation (Student Reminder) | Day 7+ reached | Autonomous: trigger, dispatch, tracking | Continuous |
| **W03-L2-037** | Execute Stage 2 Escalation (Parent Warning) | Day 14+ reached | Auto: dispatch, distress computation. Recommends: welfare referral | Continuous |
| **W03-L2-038** | Compute Distress Signal Score | Stage 2; distress evaluation needed | Autonomous: signal retrieval, computation, recommendation. Human: final referral decision | Per-defaulter at Stage 2 |
| **W03-L2-039** | Refer Defaulter to Welfare (M04->M06) | Distress score > threshold; ST2 approves | Auto: referral creation. Human: ST2 approval decision | On-demand |
| **W03-L2-040** | Receive Welfare Assessment Outcome (M06->M04) | M06 completes assessment; returns outcome | N/A -- welfare assessment is human judgment. Auto: routing based on outcome | On-demand |
| **W03-L2-041** | Execute Stage 3 Escalation (Recommend Holds) | Day 21+; no welfare referral OR no_distress returned | Auto: hold type determination. Recommends: does not apply autonomously | Continuous |
| **W03-L2-042** | Approve and Apply Financial Hold | ST2 reviews hold recommendation | N/A -- hold approval is human. Auto: system notifications after approval | On-demand |
| **W03-L2-043** | Enforce Financial Hold Across Systems | Hold active; enforcement points reached | Autonomous: enforcement at checkpoints. Logs attempts | Continuous |
| **W03-L2-044** | Execute Stage 4 Escalation (Flag for Legal) | Day 60+ AND amount > 50K threshold | Flags: threshold identification. Human: Principal decides all legal actions | Rare |
| **W03-L2-045** | Resolve Defaulter on Payment | Payment received; Invoice Paid | Autonomous: resolution, hold release, notification | Per-payment |
| **W03-L2-046** | Track Phone Follow-Up by ST2 | Stage 2+; AI flags for phone follow-up | Flags: candidates. Human: all phone interactions | Continuous |

**Escalation ladder (from Escalation Ladder sheet):**

| Stage | Day | AI Autonomy | Action | Hold Types |
|---|---|---|---|---|
| Stage 1 | 7+ | AUTO | SMS Reminder to student | -- |
| Stage 2 | 14+ | AUTO | WhatsApp Warning to parent | -- |
| Stage 2 | 14+ | AUTO | Distress Signal Computation | -- |
| Stage 2 | 14+ | RECOMMENDS | Welfare Referral (if distress > 0.6) | -- |
| Stage 3 | 21+ | RECOMMENDS | Financial Hold (ST2 approves) | exam_debarment, hostel_restriction, transcript_hold |
| Stage 3 | 21+ | FLAGS | Phone Follow-up (ST2 calls) | -- |
| Stage 4 | 60+ AND >50K | FLAGS | Legal Escalation (Principal decides) | full_clearance_block |

**Distress signal computation (from M04-M06 Welfare Handoff sheet):**

| Signal | Source | Weight | Computation |
|---|---|---|---|
| Attendance Drop | M03 (Attendance Summary) | 20% | (historical_avg - current_%) / historical_avg, capped at 1.0 |
| Communication Withdrawal | M12.2/Juvi (response rate) | 20% | 1 - (responses / outreach_attempts), last 30 days |
| Prior Welfare Flags | M06 (Case History) | 20% | case_count * 0.3, capped at 1.0 |
| Academic Decline | M03 (Semester Results) | 20% | (prior_SGPA - current_SGPA) / prior_SGPA, capped at 1.0 |
| Scholarship Pending | M04.4 (Receivable) | 20% | 1.0 if scholarship_receivable > 0 and overdue, else 0 |

Distress threshold: 0.6 (configurable per institution).

**Referral outcome routing (from M04-M06 Welfare Handoff sheet):**

| M06 Outcome | M04 Action |
|---|---|
| genuine_hardship | Exit escalation -> route to M04.4 for Hardship Concession (W03-L2-031) |
| no_distress | Resume escalation at Stage 3 -> Recommend Financial Hold (W03-L2-041) |
| inconclusive | Request more info from M06 OR escalate to Leadership |

### 3.6 M04.6 VENDPAY -- Vendor Disbursements (4 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-047** | Receive Vendor Payment Request from M08 | M08 approves vendor invoice | Auto: receipt, validation. Flags: unknown vendor, amount anomaly | Continuous |
| **W03-L2-048** | Schedule Vendor Payment | Payment Request received | Auto: scheduling below threshold. Human: above 1 lakh | Continuous |
| **W03-L2-049** | Execute Vendor Payment Batch | Scheduled date reached | Auto: batch generation. Human: final review before bank submission | Daily |
| **W03-L2-050** | Confirm Vendor Payment and Notify | Bank confirms execution | Autonomous: matching, confirmation, notification | Daily |

**Steps detail:**
- W03-L2-047: M08 sends Payment Request (vendor_id, invoice_ref, amount, cost_center) -> validate vendor exists, amount within contract terms -> status Received -> queue for scheduling.
- W03-L2-048: Determine payment terms (Net 30/15/immediate) -> calculate execution_date -> threshold check (<=1L auto, >1L Leadership) -> create Vendor Payment (status=Scheduled).
- W03-L2-049: Daily batch -> retrieve Vendor Payments for today -> generate bank payment file (NEFT batch format) -> ST2 reviews -> upload to bank -> status Executed.
- W03-L2-050: Bank statement confirms -> match to Vendor Payment -> status Bank Confirmed -> notify vendor -> update M08.

### 3.7 M02 -- People & Identity Registry (3 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-051** | Read Student Attributes for Invoice Generation | Invoice generation needs student profile | Autonomous: API lookup | Per-invoice |
| **W03-L2-052** | Update Student Financial Status | Payment/defaulter/scholarship events | Autonomous: state sync on events | Per-event |
| **W03-L2-053** | Check Financial Clearance for W10 Exit | W10 clearance initiated | Autonomous: status computation | Per-exit request |

**Key details:**
- W03-L2-051: M04 reads from M02: programme_id, branch_id, regulation, quota_type, is_hosteler, transport_required, category, scholarship_eligible flags.
- W03-L2-052: M04 events update M02 Student: fee_status (Paid/Partial/Overdue), has_financial_hold (true/false), scholarship_status (Active/None).
- W03-L2-053: M04 returns clearance_status: CLEAR / BLOCKED (with reasons) / PENDING_REFUND. Checks: unpaid invoices, active defaulter records, active holds, pending refunds.

### 3.8 M06 -- Student Welfare & Support (2 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-054** | Feed Financial Distress Signals to M06 CCD | Default detected OR escalation progresses | Autonomous: signal push, risk computation | Per-default event |
| **W03-L2-055** | Receive Independent Hardship Request from M06 | M06 identifies hardship independently | N/A -- human judgment. Same approval flow as W03-L2-031 | On-demand |

### 3.9 M11 -- Governance & Institutional Intelligence (3 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-056** | Feed Revenue Velocity to Dashboards | Any payment/invoice/defaulter event | Autonomous: metric computation, refresh | Continuous |
| **W03-L2-057** | Generate Defaulter Trend Analysis | Leadership request OR scheduled | Autonomous: analysis, insight generation, flagging | Weekly/monthly |
| **W03-L2-058** | Consume Fee Policy from M11.2 | Fee structure draft initiated | Autonomous: policy retrieval, validation application | Annual |

### 3.10 M12 -- Juvion Platform (4 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-059** | Execute AG-03 Finance Agent Functions | Various M04 events | This IS the AI scope definition for M04 | Continuous |
| **W03-L2-060** | Orchestrate Payment Gateway Integration | Student initiates online payment | Autonomous: gateway orchestration, webhook handling | Per-payment |
| **W03-L2-061** | Orchestrate TS-EPass Integration | Scholarship claim submission/status check | Autonomous: connection, submission, polling | Per-scheme window |
| **W03-L2-062** | Execute Escalating Reminder Sequences | Escalation stages progress | Autonomous: channel selection, dispatch, tracking | Per-escalation action |

### 3.11 Juvi -- Student App (4 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-063** | Display Fee Status Widget on Home | Student has pending balance | Autonomous: status check, widget rendering | Continuous |
| **W03-L2-064** | Push Fee Notices to Student Feed | Invoice/due date/payment/scholarship events | Autonomous: notice generation, push | Per-event |
| **W03-L2-065** | Handle Fee Query via AI Companion | Student asks fee question | Autonomous: query interpretation, response. Escalates: disputes, complex queries | On-demand |
| **W03-L2-066** | Process Payment via Juvi | Student taps Pay Now | Autonomous: flow orchestration, confirmation | On-demand |

### 3.12 Audit & Year-End Closure (3 sub-workflows)

| ID | Name | Trigger | AI Scope | Frequency |
|---|---|---|---|---|
| **W03-L2-067** | Generate Audit-Ready Financial Records | Audit cycle or year-end | Auto: data extraction, format transformation. Human: sensitive record review | Annual + on-demand |
| **W03-L2-068** | Reconcile Annual Revenue vs Budget | Academic year ends; final collections recorded | Auto: aggregation, variance calculation. Human: interpretation | Annual |
| **W03-L2-069** | Archive and Close Financial Period | Reconciliation complete; Leadership approves | N/A -- human approval. Auto: archival, carry-forward calculations | Annual |

---

## 4. Entity Gap Analysis

### 4.1 New Models Required

| Entity | Sub-Domain | Referenced By | Key Fields |
|---|---|---|---|
| **FeeStructureInstance** | FEECONF | W03-L2-001 to 004 | collegeId, academicYearId, programmeId, branchId, category, quota, status (draft/submitted/approved/active/superseded/archived), effectiveDate, totalAmount, priorVersionId, approvedBy, approvedAt |
| **FeeComponent** | FEECONF | W03-L2-001, 002 | collegeId, feeStructureInstanceId, name, amount, isRefundable, componentType (tuition/hostel/transport/lab/exam/library/other), isConditional |
| **FeeComponentRule** | FEECONF | W03-L2-002 | collegeId, feeComponentId, conditionType (hostel/transport/lab_programme/quota/category), conditionValue, operator (equals/in/not_in), status (configured/draft) |
| **FeeAgreement** | BILLING | W03-L2-007 | collegeId, studentId, feeStructureInstanceId, negotiatedTotal, baseTotal, waiverAmount, approvalAuthority, concessionDetails, validityPeriodYears, status (active/expired/cancelled) |
| **PaymentPlan** | BILLING | W03-L2-008 | collegeId, studentId, invoiceId, feeAgreementId, templateId, totalAmount, installments[{dueDate, amount, status}], status (active/completed/defaulted) |
| **InvoiceLineItem** | BILLING | W03-L2-005 to 015 | collegeId, invoiceId, feeComponentId, description, grossAmount, scholarshipAllocated, concessionApplied, netAmount, status |
| **PaymentTransaction** | COLLECT | W03-L2-017 to 025 | collegeId, studentId, invoiceId, amount, channel (gateway/cash/dd/neft/rtgs/upi/card), paymentMode, transactionRef, reconciliationStatus (received/matched/discrepancy/reversed), gatewayOrderId, ddNumber, ddBank, ddDate, paymentDate |
| **Receipt** | COLLECT | W03-L2-021 | collegeId, receiptNumber, paymentTransactionId, studentId, amount, issuedDate, channel (email/print/whatsapp), status (issued/cancelled/reissued), vaultDocId |
| **ReconciliationEntry** | COLLECT | W03-L2-020 | collegeId, paymentTransactionId, bankStatementRef, matchedAmount, status (matched/discrepancy_flagged/resolved), discrepancyType, resolvedBy, resolvedAt |
| **BounceRecord** | COLLECT | W03-L2-023 | collegeId, paymentTransactionId, invoiceId, reason, penaltyAmount, penaltyLineItemId, bouncedAt |
| **OverpaymentRecord** | COLLECT | W03-L2-022, 024 | collegeId, studentId, paymentTransactionId, invoiceId, overpaymentAmount, resolution (refund/credit_forward/pending), refundId, resolvedAt |
| **ScholarshipEligibility** | SCHCON | W03-L2-026 | collegeId, studentId, schemeCode, academicYearId, status (pending/eligible/ineligible/expired), verificationMethod (auto/manual), verifiedAt, documentsStatus |
| **ScholarshipClaim** | SCHCON | W03-L2-027, 028 | collegeId, scholarshipEligibilityId, studentId, schemeCode, academicYearId, claimAmount, portalReference, status (submitted/under_review/approved/rejected), submittedAt, rejectionReason |
| **ScholarshipReceivable** | SCHCON | W03-L2-028, 029, 030 | collegeId, scholarshipClaimId, studentId, expectedAmount, expectedDisbursementDate, status (pending/disbursed/overdue/converted_to_liability), disbursedAmount, disbursedAt |
| **ScholarshipCredit** | SCHCON | W03-L2-029 | collegeId, scholarshipReceivableId, studentId, invoiceId, invoiceLineItemId, amount, appliedAt |
| **DefaulterRecord** | DEFAULT | W03-L2-035 to 046 | collegeId, studentId, invoiceId, overdueAmount, daysOverdue, escalationStage (stage_1/stage_2/stage_3/stage_4/resolved), welfareReferralStatus (none/referred/returned), distressSignals[{type, value, weight}], distressScore, resolutionDate, resolutionType |
| **EscalationAction** | DEFAULT | W03-L2-036 to 046 | collegeId, defaulterRecordId, actionType (sms_reminder/whatsapp_parent/hold_recommendation/phone_call_flag/legal_notice_flag), status (scheduled/executed/cancelled), executedAt, outcome, notes |
| **FinancialHold** | DEFAULT | W03-L2-042, 043, 045 | collegeId, studentId, defaulterRecordId, holdType (exam_debarment/hostel_restriction/transcript_hold/full_clearance_block), holdStatus (active/released), effectiveDate, approvedBy, releaseDate, releasedBy |
| **WelfareReferral** | DEFAULT->M06 | W03-L2-039, 040 | collegeId, defaulterRecordId, studentId, distressScore, distressSignals[], referralStatus (referred/returned), outcome (genuine_hardship/no_distress/inconclusive), referredBy, returnedAt, m06CaseId |
| **PaymentRequest** | VENDPAY | W03-L2-047 | collegeId, vendorId, invoiceReference, amount, costCenter, servicePeriod, m08ApprovalDate, m08Approver, status (received/scheduled/executed/confirmed) |
| **VendorPayment** | VENDPAY | W03-L2-048 to 050 | collegeId, paymentRequestId, vendorId, amount, paymentTerms, executionDate, batchId, bankReference, status (scheduled/executed/bank_confirmed/failed) |
| **RevenueReconciliationReport** | Audit | W03-L2-068 | collegeId, academicYearId, totalInvoiced, totalCollected, scholarshipOffsets, concessionsGranted, writeOffs, outstandingReceivables, budgetVariance, status (draft/final) |

### 4.2 Existing Models Requiring Enhancement

| Model | Required Changes |
|---|---|
| **FeeStructure** | ADD: `status` enum (draft/submitted/approved/active/superseded/archived), `effectiveDate`, `priorVersionId`, `approvedBy`, `approvedAt`. Existing model may be repurposed as FeeStructureInstance or kept with enhancements. |
| **Invoice** | ADD: `feeAgreementId`, `semesterId`, `netPayable`, `scholarshipAllocated`, `concessionApplied`, `paymentPlanId`. CHANGE status enum to: draft/generated/sent/partially_paid/paid/overdue/disputed/confirmed/written_off/cancelled. CHANGE `items` from embedded to ref InvoiceLineItem[]. ADD `batchId` for batch tracking. |
| **Payment** | RENAME/REFACTOR to PaymentTransaction. ADD: `invoiceId`, `channel`, `reconciliationStatus`, `ddNumber`, `ddBank`, `ddDate`. REMOVE embedded allocations (move to separate allocation entity or handle via InvoiceLineItem updates). |
| **Concession** | ADD: `source` (m04/m06_referral/m05_staff), `feeComponentId`, `effectiveFrom`, `effectiveTo`, `welfareReferralId`. |
| **Refund** | ADD: `invoiceId`, `sourceType` (overpayment/cancellation/adjustment), `sourceId`, `refundTransactionRef`, `approvalThreshold`. |
| **FeeReminder** | ADD: `invoiceId`, `escalationStage`, `defaulterRecordId`, `templateId`, `deliveryStatus` (delivered/read/failed), `deliveryDetails`. |
| **FinancialLedger** | REDESIGN for double-entry: ADD `accountCode`, `accountName`, `journalEntryId`. REMOVE single `balance` field. Each entry must have equal debit and credit across two rows. ADD `periodId`, `isLocked`. |
| **PaymentGatewayLog** | ADD: `invoiceId`, `signatureVerified`, `webhookReceivedAt`, `idempotencyKey`. |
| **Student** (M02) | ADD: `feeStatus` (paid/partial/overdue/clear), `hasFinancialHold` (boolean), `scholarshipStatus` (active/none/pending). |

### 4.3 Entity Count Summary

- **New models needed:** 21
- **Existing models to enhance:** 9
- **Models adequate as-is:** Budget, Expense (outside core W03), Scholarship (master data), FinancialReport (generic reports)

---

## 5. API Endpoint Gap Analysis

### 5.1 Existing Endpoints (34 CRUD routes)

All current routes are generic CRUD: `GET/POST/PUT/DELETE` for each of the 16 models. These serve as base administrative CRUD and remain useful, but W03 requires action-oriented and batch endpoints.

### 5.2 New Endpoints Required

#### M04.1 FEECONF

| Method | Path | Sub-Workflow | Description |
|---|---|---|---|
| POST | `/api/finance/fee-structures/clone` | W03-L2-001 | Clone prior year structure to new academic year |
| POST | `/api/finance/fee-structures/:id/submit` | W03-L2-003 | Submit for approval (status Draft -> Submitted) |
| POST | `/api/finance/fee-structures/:id/approve` | W03-L2-004 | Approve and activate (status -> Active) |
| POST | `/api/finance/fee-structures/:id/reject` | W03-L2-004 | Reject with comments |
| GET | `/api/finance/fee-structures/:id/comparison` | W03-L2-003 | Prior year vs proposed comparison report |
| GET | `/api/finance/fee-structures/:id/revenue-projection` | W03-L2-003 | Projected revenue impact |
| CRUD | `/api/finance/fee-components` | W03-L2-001, 002 | Fee Component management |
| CRUD | `/api/finance/fee-component-rules` | W03-L2-002 | Fee Component Rule management |
| POST | `/api/finance/fee-component-rules/test` | W03-L2-002 | Test rules against sample student profiles |

#### M04.2 BILLING

| Method | Path | Sub-Workflow | Description |
|---|---|---|---|
| POST | `/api/finance/invoices/batch/semester` | W03-L2-005 | Generate semester invoice batch for continuing students |
| POST | `/api/finance/invoices/enrolment` | W03-L2-006 | Generate first invoice for new enrolment |
| POST | `/api/finance/invoices/:id/dispute` | W03-L2-012 | Mark invoice as disputed |
| POST | `/api/finance/invoices/:id/confirm` | W03-L2-012 | Confirm disputed invoice |
| POST | `/api/finance/invoices/:id/adjust` | W03-L2-011 | Create adjustment line items |
| POST | `/api/finance/invoices/:id/write-off` | W03-L2-015 | Write off uncollectable invoice |
| CRUD | `/api/finance/fee-agreements` | W03-L2-007 | Fee Agreement management |
| CRUD | `/api/finance/payment-plans` | W03-L2-008 | Payment Plan management |
| POST | `/api/finance/invoices/batch/exam` | W03-L2-009 | Generate exam fee invoice batch |
| POST | `/api/finance/invoices/ad-hoc` | W03-L2-010 | Generate ad-hoc invoice |
| POST | `/api/finance/concessions/sibling-detect` | W03-L2-014 | Detect and apply sibling discounts |

#### M04.3 COLLECT

| Method | Path | Sub-Workflow | Description |
|---|---|---|---|
| POST | `/api/finance/payments/gateway-webhook` | W03-L2-017 | Receive and process gateway webhook (unauthenticated, signature-verified) |
| POST | `/api/finance/payments/counter` | W03-L2-018 | Record counter payment (cash/DD) |
| POST | `/api/finance/payments/bank-import` | W03-L2-019 | Import bank statement for NEFT/RTGS matching |
| POST | `/api/finance/payments/:id/match` | W03-L2-019 | Manual match unmatched payment to invoice |
| POST | `/api/finance/reconciliation/run` | W03-L2-020 | Trigger reconciliation cycle |
| GET | `/api/finance/reconciliation/status` | W03-L2-020 | Current reconciliation status and discrepancies |
| CRUD | `/api/finance/reconciliation-entries` | W03-L2-020 | Reconciliation entry management |
| POST | `/api/finance/receipts/:id/reissue` | W03-L2-021 | Reissue receipt |
| POST | `/api/finance/receipts/:id/cancel` | W03-L2-021 | Cancel receipt |
| CRUD | `/api/finance/receipts` | W03-L2-021 | Receipt management |
| POST | `/api/finance/payments/:id/flag-duplicate` | W03-L2-022 | Flag potential duplicate |
| POST | `/api/finance/payments/:id/bounce` | W03-L2-023 | Record payment bounce |
| CRUD | `/api/finance/overpayments` | W03-L2-022, 024 | Overpayment management |
| POST | `/api/finance/overpayments/:id/resolve` | W03-L2-024 | Resolve overpayment (refund or credit) |
| POST | `/api/finance/refunds/:id/approve` | W03-L2-025 | Approve refund |
| POST | `/api/finance/refunds/:id/execute` | W03-L2-025 | Execute approved refund |

#### M04.4 SCHCON

| Method | Path | Sub-Workflow | Description |
|---|---|---|---|
| POST | `/api/finance/scholarships/eligibility/batch` | W03-L2-026 | Run batch eligibility verification |
| CRUD | `/api/finance/scholarship-eligibility` | W03-L2-026 | Scholarship Eligibility records |
| POST | `/api/finance/scholarships/claims/submit-batch` | W03-L2-027 | Submit claim batch to TS-EPass |
| CRUD | `/api/finance/scholarship-claims` | W03-L2-027, 028 | Scholarship Claim management |
| POST | `/api/finance/scholarships/claims/poll-status` | W03-L2-028 | Poll TS-EPass for claim status updates |
| POST | `/api/finance/scholarships/disbursement/process` | W03-L2-029 | Process scholarship disbursement from bank |
| CRUD | `/api/finance/scholarship-receivables` | W03-L2-028, 029 | Scholarship Receivable records |
| POST | `/api/finance/scholarship-receivables/:id/convert` | W03-L2-030 | Convert receivable to student liability |
| CRUD | `/api/finance/scholarship-credits` | W03-L2-029 | Scholarship Credit records |
| POST | `/api/finance/concessions/hardship` | W03-L2-031 | Process hardship concession from M06 |
| POST | `/api/finance/concessions/merit/batch` | W03-L2-032 | Batch apply merit scholarships |
| POST | `/api/finance/concessions/staff-ward/detect` | W03-L2-033 | Detect and apply staff-ward concessions |
| POST | `/api/finance/scholarships/renewal/batch` | W03-L2-034 | Annual renewal verification batch |

#### M04.5 DEFAULT

| Method | Path | Sub-Workflow | Description |
|---|---|---|---|
| POST | `/api/finance/defaulters/identify` | W03-L2-035 | Run batch defaulter identification |
| GET | `/api/finance/defaulters` | W03-L2-035 | List defaulter records with filters |
| GET | `/api/finance/defaulters/:id` | W03-L2-035 | Get defaulter detail with full history |
| POST | `/api/finance/defaulters/:id/escalate` | W03-L2-036-044 | Execute next escalation step |
| POST | `/api/finance/defaulters/:id/compute-distress` | W03-L2-038 | Compute distress signal score |
| POST | `/api/finance/defaulters/:id/refer-welfare` | W03-L2-039 | Create welfare referral |
| POST | `/api/finance/defaulters/:id/welfare-outcome` | W03-L2-040 | Receive welfare assessment outcome |
| POST | `/api/finance/defaulters/:id/recommend-hold` | W03-L2-041 | AI recommends hold types |
| POST | `/api/finance/holds` | W03-L2-042 | Create/approve financial hold |
| GET | `/api/finance/holds` | W03-L2-043 | List active holds |
| POST | `/api/finance/holds/:id/release` | W03-L2-045 | Release hold |
| GET | `/api/finance/holds/check/:studentId` | W03-L2-043 | Check if student has active holds (for cross-module enforcement) |
| POST | `/api/finance/defaulters/:id/resolve` | W03-L2-045 | Resolve defaulter on payment |
| POST | `/api/finance/defaulters/:id/log-followup` | W03-L2-046 | Log phone follow-up outcome |
| CRUD | `/api/finance/escalation-actions` | W03-L2-036-046 | Escalation action records |

#### M04.6 VENDPAY

| Method | Path | Sub-Workflow | Description |
|---|---|---|---|
| CRUD | `/api/finance/payment-requests` | W03-L2-047 | Vendor payment request management |
| POST | `/api/finance/vendor-payments/schedule` | W03-L2-048 | Schedule vendor payment |
| POST | `/api/finance/vendor-payments/batch/execute` | W03-L2-049 | Execute daily payment batch |
| POST | `/api/finance/vendor-payments/:id/confirm` | W03-L2-050 | Confirm vendor payment from bank |
| CRUD | `/api/finance/vendor-payments` | W03-L2-048-050 | Vendor payment records |

#### Cross-Module APIs

| Method | Path | Module | Sub-Workflow | Description |
|---|---|---|---|---|
| GET | `/api/finance/clearance/:studentId` | M02/M04 | W03-L2-053 | Financial clearance check for W10 exit |
| POST | `/api/finance/sync/student-status` | M02/M04 | W03-L2-052 | Push financial status to M02 |
| POST | `/api/welfare/referrals` | M06 | W03-L2-039 | Create welfare referral (M06 receives) |
| PUT | `/api/welfare/referrals/:id/outcome` | M06 | W03-L2-040 | Return welfare assessment to M04 |
| GET | `/api/governance/dashboards/revenue` | M11 | W03-L2-056 | Revenue dashboard data |
| GET | `/api/governance/dashboards/defaulters` | M11 | W03-L2-057 | Defaulter trend analysis |
| GET | `/api/governance/policies/fee` | M11 | W03-L2-058 | Fee policy rules |

### 5.3 Endpoint Count Summary

- **Existing:** 34 CRUD endpoints (keep as-is for admin CRUD)
- **New action endpoints:** ~55 endpoints
- **New CRUD sets (for new entities):** ~15 sets (60+ routes)
- **Total estimated:** ~150 routes across finance module

---

## 6. State Machine Definitions

### 6.1 Fee Structure Instance Lifecycle

```
                     +-----------+
                     |   Draft   |
                     +-----+-----+
                           |
                   submit (W03-L2-003)
                           |
                     +-----v-----+
                     | Submitted |
                     +-----+-----+
                          / \
              approve /     \ reject
                    /         \
          +--------v--+   +---v-----------+
          |  Approved  |   | Revision_Req |---> Draft
          +-----+------+   +--------------+
                |
        activate (W03-L2-004)
                |
          +-----v-----+
          |   Active   |
          +-----+------+
               / \
    supersede /   \ archive (year-end)
             /     \
    +--------v-+  +-v--------+
    |Superseded|  | Archived |
    +----------+  +----------+
```

States: `draft` | `submitted` | `approved` | `active` | `superseded` | `archived` | `revision_required`

### 6.2 Invoice Lifecycle

```
          +----------+
          |  Draft   | (ad-hoc only)
          +----+-----+
               |
          +----v------+
          | Generated | (batch creates here directly)
          +----+------+
               |
          +----v-----+
          |   Sent   |<---------- dispute resolved (confirmed)
          +----+-----+
              /|\
             / | \
            /  |  \
           /   |   \
          /    |    \
+--------v+ +--v--+ +v----------+
|Partially| |Paid | | Disputed  |---> adjust (W03-L2-011)
|  Paid   | +--+--+ +-----------+
+----+----+    |
     |         |
     +----+----+
          |
    [all paid]
          |
     +----v---+
     |  Paid  |
     +--------+

  [bounce: Paid/PartiallyPaid -> revert to previous state]
  [write-off: any unpaid state -> Written_Off]
  [cancel: any state -> Cancelled]
  [overdue: Sent/Generated with due_date < today -> Overdue (computed, not stored)]
```

States: `draft` | `generated` | `sent` | `partially_paid` | `paid` | `disputed` | `confirmed` | `written_off` | `cancelled`

### 6.3 Payment Transaction Lifecycle

```
    +----------+
    | Initiated| (gateway only)
    +----+-----+
         |
    +----v-----+        +---------+
    | Received |------->| Matched | (reconciliation)
    +----+-----+        +---------+
         |
         +------->+-----------+
                  |Discrepancy| (reconciliation mismatch)
                  +-----+-----+
                        |
                  +-----v----+
                  | Resolved | (ST2 manually resolves)
                  +----------+

    [bounce: Received/Matched -> Reversed]
    [refund: Matched -> Refunded]
```

Reconciliation statuses: `initiated` | `received` | `matched` | `discrepancy` | `resolved` | `reversed` | `refunded`

### 6.4 Scholarship Lifecycle (4-entity chain)

```
ScholarshipEligibility          ScholarshipClaim
+--------+                      +----------+
| Pending|-->+--------+         | Submitted|-->+-------------+-->+----------+
+--------+   |Eligible|-------->+----------+   |Under_Review |   | Approved |
             +--------+                        +-------------+   +----+-----+
             |Ineligible|                      |  Rejected   |        |
             +----------+                      +-------------+   +----v--------+
             |  Expired  |                                       |SchReceivable|
             +-----------+                                       +-----+-------+
                                                                       |
                                                          +------------+-----------+
                                                          |            |           |
                                                    +-----v---+ +-----v----+ +----v---------+
                                                    | Pending | | Disbursed| | Converted_to |
                                                    +---------+ +----+-----+ |  Liability   |
                                                                     |       +--------------+
                                                               +-----v--------+
                                                               |SchCredit (C) |
                                                               |applied to Inv|
                                                               +--------------+
```

### 6.5 Defaulter Escalation State Machine

```
                    +--------+
     identify       | Active |
     (W03-L2-035)-->|Stage 1 |
                    +---+----+
                        | Day 7+ (W03-L2-036: SMS)
                    +---v----+
                    |Stage 2 |--- distress score > 0.6
                    +---+----+        |
                        |        +----v---------+
                        |        |  Welfare     |
                        |        |  Referred    |
                        |        +----+---------+
                        |            / \
                        |  hardship /   \ no_distress
                        |         /     \
                        |   +----v--+  +-v----+
                        |   |Exited |  |Resume|
                        |   |(concn)|  +--+---+
                        |   +-------+     |
                    +---v----+<-----------+
                    |Stage 3 | Day 21+ (W03-L2-041: Hold recommendation)
                    +---+----+
                        | Day 60+ AND >50K (W03-L2-044: Legal flag)
                    +---v----+
                    |Stage 4 |
                    +--------+

           [Payment at any stage] --> Resolved (W03-L2-045)
```

States: `stage_1` | `stage_2` | `stage_3` | `stage_4` | `welfare_referred` | `resolved` | `exited_hardship` | `exited_write_off`

### 6.6 Refund Workflow

```
    +----------+
    | Requested|
    +----+-----+
         |
    [amount check]
    <=10K: ST2 / >10K: Leadership
         |
    +----v-----+      +---------+
    | Approved |      | Rejected|
    +----+-----+      +---------+
         |
    +----v------+
    | Processing|
    +----+------+
         |
    +----v------+
    | Processed |
    +----+------+
         |
    +----v-------+
    | Confirmed  | (bank/gateway confirms)
    +------------+
```

States: `requested` | `approved` | `rejected` | `processing` | `processed` | `confirmed` | `failed`

### 6.7 Vendor Payment Lifecycle

```
    +----------+      +-----------+      +----------+
    | Received |----->| Scheduled |----->| Executed |
    +----------+      +-----------+      +----+-----+
                      [>1L needs             |
                       Leadership]     +-----v---------+
                                       |Bank_Confirmed |
                                       +---------------+
                                       [failure: Failed -> retry]
```

States: `received` | `scheduled` | `pending_approval` | `approved` | `executed` | `bank_confirmed` | `failed`

---

## 7. Business Logic Requirements

### 7.1 Fee Component Rules Engine

**Purpose:** Evaluate which fee components apply to a given student based on their profile attributes.

```typescript
interface FeeComponentRule {
  conditionType: 'hostel' | 'transport' | 'lab_programme' | 'quota' | 'category' | 'regulation' | 'batch';
  conditionValue: string | string[];
  operator: 'equals' | 'in' | 'not_in' | 'exists' | 'not_exists';
}

// Evaluation: for each FeeComponent with isConditional=true,
// evaluate its rules against student profile from M02.
// Component applies if ALL rules pass (AND logic).
// Components with isConditional=false always apply.
```

**Required M02 attributes for rule evaluation:** programmeId, branchId, regulationId, quota, category, hostel tag (from HostelAllocation in M06), transport tag (from TransportAllocation in M06).

### 7.2 Invoice Generation (Batch)

**Semester batch (W03-L2-005):**
1. Query all active students for the semester from M02.
2. For each student, fetch profile attributes (W03-L2-051).
3. Retrieve active FeeStructureInstance matching student's programme/branch/quota/category.
4. Evaluate FeeComponentRules to determine applicable components.
5. Create Invoice with InvoiceLineItems for each applicable component.
6. Apply any active ScholarshipEligibility credits: reduce `scholarshipAllocated` on matching line items.
7. Apply any active Concession: reduce `concessionApplied` on matching line items.
8. Calculate `netPayable = grossAmount - scholarshipAllocated - concessionApplied`.
9. Check for FeeAgreement (management quota): if exists, use negotiated amounts.
10. Invoice status -> `generated` -> `sent`.
11. Trigger notification sequence (W03-L2-016).

**Error handling:** Missing fee structure -> halt batch with alert. Student missing profile attribute -> flag for M02 update, skip student.

### 7.3 Payment Gateway Integration

**Initiation flow (W03-L2-060):**
1. Student selects invoices to pay via portal or Juvi.
2. Create PaymentGatewayLog (status=initiated) with idempotency key.
3. Create order on gateway (Razorpay/CCAvenue) via M12.4.
4. Return payment link/session to client.

**Webhook flow (W03-L2-017):**
1. Receive webhook POST at `/api/finance/payments/gateway-webhook` (unauthenticated).
2. Validate gateway signature/checksum.
3. Idempotency check: skip if webhook already processed for this orderId.
4. Create PaymentTransaction (channel=gateway, reconciliationStatus=received).
5. Match to Invoice by orderId -> invoiceId mapping.
6. Update Invoice status (paid/partially_paid).
7. Update PaymentGatewayLog (status=success, completedAt).
8. Generate Receipt (W03-L2-021).
9. If Invoice fully paid: check for active DefaulterRecord -> resolve (W03-L2-045).

### 7.4 Reconciliation

**Daily reconciliation cycle (W03-L2-020):**

1. **Online payments:** Compare gateway settlement reports against PaymentTransactions with channel=gateway. Flag discrepancies where settlement amount != recorded amount.
2. **Bank NEFT/RTGS:** Import bank statement -> AI pattern-matches incoming credits to pending PaymentTransactions (reference contains student ID/roll number, amount matches). Auto-match at >=90% confidence. Queue ambiguous for ST2.
3. **DD deposits:** Match bank DD deposit confirmations to recorded DD PaymentTransactions.
4. **Cash deposits:** Match daily cash register total to sum of cash PaymentTransactions.
5. Create ReconciliationEntry for each match (status: matched or discrepancy_flagged).

### 7.5 TS-EPass Integration

**Claim submission (W03-L2-027):**
1. Generate claim batch: student_id, scheme_code, academic_year, claim_amount for all Eligible students.
2. Submit to TS-EPass portal via M12.4 integration adapter.
3. Capture portal_reference for each submission.
4. Create ScholarshipClaim (status=submitted).

**Status polling (W03-L2-028):**
1. Periodic job (daily/weekly) polls TS-EPass portal.
2. Update ScholarshipClaim status: under_review / approved / rejected.
3. On approved: create ScholarshipReceivable with expected_disbursement_date.
4. On rejected: log reason, notify ST2 for review.

**Disbursement receipt (W03-L2-029):**
1. Bank statement shows credit from TS-EPass.
2. Match to pending ScholarshipReceivables by scheme/batch identifiers.
3. For each match: create ScholarshipCredit, apply to student Invoice (reduce net_payable).
4. ScholarshipReceivable status -> Disbursed.

**Liability conversion (W03-L2-030):**
1. Receivable past expected date by >6 months or end of academic year.
2. Leadership approves conversion.
3. Remove scholarship allocation from Invoice -> net_payable increases.
4. Student re-enters standard collection cycle.

### 7.6 Distress Detection and Welfare Handoff

**Signal computation (W03-L2-038):**
```
distress_score = sum(weight_i * signal_i) for i in [attendance, communication, welfare, academic, scholarship]

Each signal is normalized to [0, 1]:
- attendance_drop = min((historical_avg - current_%) / historical_avg, 1.0)
- comms_withdrawal = min(1 - (responses / outreach_attempts), 1.0)  // last 30 days
- prior_welfare = min(case_count * 0.3, 1.0)
- academic_decline = min((prior_SGPA - current_SGPA) / prior_SGPA, 1.0)
- scholarship_pending = 1.0 if (scholarship_receivable > 0 AND overdue) else 0.0

Default weights: 0.2 each (configurable per institution)
Threshold: 0.6 (configurable)
```

**Referral flow:**
1. distress_score > 0.6 at Stage 2 -> AI recommends referral.
2. ST2 reviews distress signals display and approves.
3. Create WelfareReferral entity, pass to M06 (ST5).
4. Pause escalation ladder (do not advance to Stage 3).
5. M06 returns outcome: genuine_hardship / no_distress / inconclusive.
6. Route accordingly (see Section 3.5).

### 7.7 Financial Hold Enforcement

**Hold types and enforcement points:**

| Hold Type | Enforcing Module | Check Point |
|---|---|---|
| exam_debarment | M03 | Hall ticket issuance, exam registration |
| hostel_restriction | M08 | Hostel re-allocation |
| transcript_hold | M02 | Transcript request, document issuance |
| full_clearance_block | M02 | All clearance actions (W10 exit) |

**Cross-module API contract:** Each enforcing module calls `GET /api/finance/holds/check/:studentId` before allowing the restricted action. Returns `{ hasActiveHold: boolean, holdTypes: string[], message: string }`.

**Override:** Principal can override any hold in emergency situations (medical, etc.). Override is logged with reason.

### 7.8 Write-Off

**W03-L2-015:**
1. All escalation stages exhausted (Stage 4 reached).
2. Legal recovery deemed unviable (cost > amount).
3. ST2 prepares write-off case.
4. Finance Committee (Leadership) reviews and approves.
5. Invoice status -> `written_off`.
6. FinancialLedger: debit bad_debt_expense, credit accounts_receivable.
7. Release all holds.
8. Update M02 student record.
9. Audit trail preserved for year-end reporting.

### 7.9 Double-Entry Ledger

The current FinancialLedger model is single-entry (one row with debit and credit fields). W03 requires proper double-entry bookkeeping where each transaction creates two or more journal entries that must balance.

**Required account codes (minimum):**
- `ACCT_REC` -- Accounts Receivable (debit on invoice, credit on payment)
- `FEE_INCOME` -- Fee Income (credit on invoice)
- `CASH` -- Cash (debit on cash payment)
- `BANK` -- Bank Account (debit on NEFT/gateway payment)
- `SCHOLARSHIP_REC` -- Scholarship Receivable (debit on claim approved)
- `SCHOLARSHIP_INCOME` -- Scholarship Income (credit on disbursement)
- `REFUND_PAYABLE` -- Refund Payable (credit on refund approved)
- `BAD_DEBT` -- Bad Debt Expense (debit on write-off)
- `VENDOR_PAYABLE` -- Vendor Payable (credit on payment request)

**Example: Invoice generation**
- Debit ACCT_REC 50,000
- Credit FEE_INCOME 50,000

**Example: Payment receipt**
- Debit BANK 50,000
- Credit ACCT_REC 50,000

### 7.10 Period Closure

**W03-L2-069:**
1. Archive all records for the period (mark as `periodId`).
2. Lock records from modification (`isLocked=true` on ledger entries).
3. Carry forward outstanding balances to new period.
4. Roll forward active payment plans.
5. Carry forward unresolved defaulter records.
6. Reset sequential counters (receipt numbers, invoice numbers) for new period.

---

## 8. Cross-Module Integration Points

### 8.1 Integration Map

| Source | Target | Direction | Trigger | Data Exchanged |
|---|---|---|---|---|
| M01.5 ENROL | M04.2 BILLING | M01 -> M04 | Enrolment complete | studentId, feeStructureId, firstPaymentAmount |
| M01.4 OFFER | M04.2 BILLING | M01 -> M04 | Fee negotiation finalized | negotiatedTotal, waiverAmount, approvalAuthority |
| M02.2 STUID | M04.2 BILLING | M04 reads M02 | Invoice generation | programme, branch, quota, category, hostel, transport |
| M04 | M02.2 STUID | M04 -> M02 | Payment/defaulter/scholarship events | feeStatus, hasFinancialHold, scholarshipStatus |
| M03.2 Calendar | M04.2 BILLING | M03 -> M04 | Semester start | academicYearId, semesterId, startDate |
| M03.5 EXAM | M04.2 BILLING | M03 -> M04 | Exam enrollment | studentIds, examFeeComponent |
| M03.5 EXAM | M04.5 DEFAULT | M04 -> M03 | Hold enforcement | exam_debarment hold check |
| M03.5 Results | M04.4 SCHCON | M03 -> M04 | Results published | studentId, SGPA, rank (for merit scholarship) |
| M04.5 DEFAULT | M06 Welfare | M04 -> M06 | Distress detected | defaulterRecordId, distressSignals[], distressScore |
| M06 Welfare | M04.5 DEFAULT | M06 -> M04 | Assessment complete | outcome: genuine_hardship / no_distress / inconclusive |
| M06 Welfare | M04.4 SCHCON | M06 -> M04 | Independent hardship | studentId, recommendedRelief, documentation |
| M05 HR | M04.4 SCHCON | M05 -> M04 | Staff dependent enrolled | employeeId, dependentStudentId |
| M08 Campus | M04.6 VENDPAY | M08 -> M04 | Vendor invoice approved | vendorId, invoiceRef, amount, costCenter |
| M08 Campus | M04.5 DEFAULT | M04 -> M08 | Hold enforcement | hostel_restriction hold check |
| M04 | M10 Compliance | M04 -> M10 | Audit cycle | Financial records export |
| M04 | M11.1 DASH | M04 -> M11 | Any financial event | Revenue metrics, defaulter metrics |
| M11.2 POLICY | M04.1 FEECONF | M11 -> M04 | Fee structure draft | Fee ceilings, mandatory components, deadline policies |
| M12.2 COMMS | M04.5 DEFAULT | M04 -> M12 | Escalation action | Notification dispatch request |
| M12.4 INTG | M04.3 COLLECT | Bidirectional | Gateway payment | Payment session, webhook |
| M12.4 INTG | M04.4 SCHCON | Bidirectional | TS-EPass integration | Claim submission, status polling |

### 8.2 Event Bus / Cross-Module Signaling

W03 requires an event-driven mechanism for cross-module communication. Recommended approach:

**BullMQ job queues** (already a project dependency):

| Queue | Producer | Consumer | Events |
|---|---|---|---|
| `finance:invoice` | M04.2 | M12.2 (notifications), M11.1 (dashboard) | `invoice.generated`, `invoice.sent`, `invoice.paid` |
| `finance:payment` | M04.3 | M02 (status sync), M11.1 (dashboard), M04.5 (defaulter check) | `payment.confirmed`, `payment.bounced`, `payment.refunded` |
| `finance:defaulter` | M04.5 | M06 (distress signal), M11.1 (dashboard), M12.2 (escalation notifications) | `defaulter.created`, `defaulter.escalated`, `defaulter.resolved` |
| `finance:scholarship` | M04.4 | M02 (status sync), M11.1 (dashboard) | `scholarship.credited`, `scholarship.receivable_overdue` |
| `finance:hold` | M04.5 | M03 (exam check), M08 (hostel check), M02 (clearance check) | `hold.applied`, `hold.released` |
| `finance:vendor` | M04.6 | M08 (status update) | `vendor_payment.confirmed` |

### 8.3 Scheduled Jobs (BullMQ Cron)

| Job | Schedule | Sub-Workflow |
|---|---|---|
| `defaulter-identification` | Daily 6:00 AM | W03-L2-035 |
| `escalation-processor` | Every 4 hours | W03-L2-036/037/041/044 |
| `reconciliation-online` | Daily 11:00 PM | W03-L2-020 |
| `reconciliation-bank` | Weekly Monday 9:00 AM | W03-L2-020 |
| `scholarship-status-poll` | Daily 10:00 AM | W03-L2-028 |
| `vendor-payment-batch` | Daily 2:00 PM | W03-L2-049 |
| `overdue-invoice-scanner` | Daily 7:00 AM | Invoice status -> overdue |
| `dashboard-metrics-refresh` | Every 15 minutes | W03-L2-056 |

---

## 9. AI Agent Scope (AG-03)

From the AI vs Human sheet:

### 9.1 Fully Autonomous (32 sub-workflows)

These run without human intervention. AI executes, logs, and proceeds:

- Invoice batch generation (W03-L2-005, 006, 009)
- Fee component rule evaluation
- Payment webhook processing (W03-L2-017)
- Receipt generation (W03-L2-021)
- Notification dispatch (W03-L2-016, 062)
- Scholarship credit allocation (W03-L2-029)
- Duplicate payment detection (W03-L2-022)
- Dashboard metric updates (W03-L2-056)
- Defaulter identification (W03-L2-035)
- Stage 1 escalation (W03-L2-036)
- Reconciliation matching (W03-L2-020 -- matched items only)
- Student status sync (W03-L2-052)
- Financial clearance check (W03-L2-053)
- Receipt/notice generation (W03-L2-021, 064)
- Vendor payment receipt validation (W03-L2-047)
- Vendor payment confirmation (W03-L2-050)
- Sibling discount detection and application (W03-L2-014)
- Staff-ward concession detection (W03-L2-033)
- Merit scholarship evaluation (W03-L2-032 -- standard cases)
- Scholarship renewal check (W03-L2-034 -- standard cases)
- Fee widget rendering (W03-L2-063)
- AI companion fee queries (W03-L2-065 -- standard queries)

### 9.2 Autonomous with Flags (18 sub-workflows)

AI executes but flags anomalies or edge cases for human review:

- Distress signal computation (W03-L2-038): AI computes score, ST2 decides on referral
- Hold type recommendation (W03-L2-041): AI recommends, ST2 approves
- Duplicate payment confirmation (W03-L2-022): AI detects, ST2 confirms
- Reconciliation matching <90% confidence (W03-L2-019, 020): AI flags, ST2 matches
- Fee structure deviation >15% from prior year (W03-L2-001): AI flags for review
- Missing fee components (W03-L2-001): AI flags
- Ambiguous fee component rules (W03-L2-002): AI flags
- NEFT payment pattern matching (W03-L2-019): AI auto-matches high confidence, flags low
- Overdue scholarship receivables (W03-L2-030): AI flags, Leadership decides
- Phone follow-up candidates (W03-L2-046): AI flags, ST2 calls
- Scholarship eligibility unclear docs (W03-L2-026): AI flags, ST2 reviews
- Vendor amount anomaly (W03-L2-047): AI flags
- Revenue anomaly detection (W03-L2-057): AI flags
- Complex sibling structures (W03-L2-014): AI flags

### 9.3 Human Decision Required (19 sub-workflows)

AI provides data and recommendations, but humans make all decisions:

- Fee structure approval (W03-L2-003, 004): Trust/GB decides
- Hardship concession approval (W03-L2-031): ST2 (<=20%) / Principal (>20%)
- Financial hold approval (W03-L2-042): ST2
- Legal escalation (W03-L2-044): Principal
- Write-off approval (W03-L2-015): Finance Committee
- Refund approval >10K (W03-L2-025): Leadership
- Welfare referral approval (W03-L2-039): ST2
- Invoice dispute resolution (W03-L2-012): ST2
- Vendor payment approval >1L (W03-L2-048): Leadership
- Mid-year fee revision approval (W03-L2-013): Trust/GB
- Scholarship receivable-to-liability conversion (W03-L2-030): Leadership
- Custom payment plan approval (W03-L2-008): ST2
- Period closure approval (W03-L2-069): Leadership
- All phone follow-up interactions (W03-L2-046): ST2
- Counter payments (W03-L2-018): ST2 (physical cash handling)
- Welfare assessment (W03-L2-040): ST5 (M06)
- Override hold in emergency: Principal

---

## 10. Implementation Phases

### Phase 1: Foundation & Fee Configuration (FEECONF)
**Estimated effort:** 2 weeks
**Sub-workflows:** W03-L2-001 to 004

**Tasks:**
1. Create new models: FeeStructureInstance, FeeComponent, FeeComponentRule.
2. Enhance existing FeeStructure model (add status, effectiveDate, versioning).
3. Build fee structure lifecycle service: clone, submit, approve, activate.
4. Implement fee component rules engine with condition evaluation.
5. Add M11.2 policy consumption (read fee ceilings).
6. Build comparison report and revenue projection endpoints.
7. Add fee structure approval routes with proper authorization.

**Dependencies:** None (prerequisite for all other phases).

### Phase 2: Invoice Generation & Billing (BILLING)
**Estimated effort:** 3 weeks
**Sub-workflows:** W03-L2-005 to 015

**Tasks:**
1. Create new models: FeeAgreement, PaymentPlan, InvoiceLineItem.
2. Enhance Invoice model (new status enum, references, netPayable).
3. Build batch invoice generation service (semester, exam, enrolment).
4. Implement M02 attribute read integration for rule evaluation.
5. Build invoice adjustment logic (mid-year changes, proration).
6. Build dispute handling workflow.
7. Build sibling discount detection.
8. Build write-off workflow.
9. Implement FeeAgreement management for management quota.
10. Add payment plan creation with template system.

**Dependencies:** Phase 1 (fee structures must exist).

### Phase 3: Payment Collection & Reconciliation (COLLECT)
**Estimated effort:** 3 weeks
**Sub-workflows:** W03-L2-016 to 025

**Tasks:**
1. Create new models: PaymentTransaction, Receipt, ReconciliationEntry, BounceRecord, OverpaymentRecord.
2. Refactor Payment model -> PaymentTransaction with enhanced fields.
3. Build gateway webhook endpoint (unauthenticated, signature-verified).
4. Build counter payment recording.
5. Build bank statement import and NEFT/RTGS auto-matching.
6. Build reconciliation engine (daily online, weekly bank).
7. Build receipt generation and multi-channel delivery.
8. Build duplicate detection logic.
9. Build bounce handling with penalty application.
10. Build overpayment resolution workflow.
11. Build refund workflow with approval thresholds.
12. Integrate notification dispatch via M12.2.

**Dependencies:** Phase 2 (invoices must exist to collect against).

### Phase 4: Scholarships & Concessions (SCHCON)
**Estimated effort:** 2.5 weeks
**Sub-workflows:** W03-L2-026 to 034

**Tasks:**
1. Create new models: ScholarshipEligibility, ScholarshipClaim, ScholarshipReceivable, ScholarshipCredit.
2. Build batch eligibility verification service.
3. Build TS-EPass integration adapter (via M12.4).
4. Build claim submission and status polling.
5. Build disbursement receipt processing.
6. Build receivable-to-liability conversion.
7. Build hardship concession processing (from M06).
8. Build merit scholarship batch application.
9. Build staff-ward concession detection.
10. Build annual renewal check.
11. Enhance Concession model with source and targeting.

**Dependencies:** Phase 2 (invoices), Phase 3 (payment crediting). Can start in parallel with Phase 3 for eligibility/claim pieces.

### Phase 5: Defaulter Management (DEFAULT)
**Estimated effort:** 3 weeks
**Sub-workflows:** W03-L2-035 to 046

**Tasks:**
1. Create new models: DefaulterRecord, EscalationAction, FinancialHold, WelfareReferral.
2. Build daily defaulter identification job.
3. Build escalation state machine with stage progression.
4. Implement distress signal computation (M03/M06/M12 data aggregation).
5. Build welfare referral creation and outcome processing.
6. Build hold recommendation and approval workflow.
7. Build hold enforcement API (cross-module check endpoint).
8. Build defaulter resolution on payment.
9. Build Stage 4 legal escalation flagging.
10. Build phone follow-up tracking.
11. Set up BullMQ scheduled jobs for escalation processing.

**Dependencies:** Phase 3 (payments trigger resolution), Phase 4 (scholarship affects defaulter status). Distress computation requires M03/M06 APIs to exist.

### Phase 6: Vendor Payments (VENDPAY)
**Estimated effort:** 1.5 weeks
**Sub-workflows:** W03-L2-047 to 050

**Tasks:**
1. Create new models: PaymentRequest, VendorPayment.
2. Build payment request reception from M08.
3. Build scheduling with approval thresholds.
4. Build batch execution with bank file generation.
5. Build confirmation matching and vendor notification.

**Dependencies:** Can run in parallel with Phase 5. Requires M08 integration point.

### Phase 7: Cross-Module Integration & Events
**Estimated effort:** 2 weeks
**Sub-workflows:** W03-L2-051 to 058, 060 to 062

**Tasks:**
1. Build event bus using BullMQ queues.
2. Implement M02 student status sync.
3. Implement M02 financial clearance check API.
4. Build M06 distress signal feed.
5. Build M11 dashboard metrics feed.
6. Build M11 defaulter trend analysis.
7. Build M12.2 notification dispatch integration.
8. Build M12.4 payment gateway integration adapter.
9. Build M12.4 TS-EPass integration adapter.
10. Set up all scheduled jobs.
11. Add Student model fields (feeStatus, hasFinancialHold, scholarshipStatus).

**Dependencies:** Phases 1-6 complete. Integration adapters can be stubbed earlier.

### Phase 8: Juvi App & AI Agent
**Estimated effort:** 1.5 weeks
**Sub-workflows:** W03-L2-059, 063 to 066

**Tasks:**
1. Build fee status widget API.
2. Build fee notice push API.
3. Build AI companion fee query handler.
4. Build Juvi payment flow orchestration.
5. Implement AG-03 finance agent functions (default prediction, anomaly detection, distress computation).

**Dependencies:** Phase 7 (integration layer).

### Phase 9: Financial Ledger & Audit
**Estimated effort:** 2 weeks
**Sub-workflows:** W03-L2-067 to 069

**Tasks:**
1. Redesign FinancialLedger for double-entry bookkeeping.
2. Retrofit all payment/invoice/refund operations to create journal entries.
3. Build period closure workflow.
4. Build audit export service.
5. Build annual revenue reconciliation vs budget.
6. Implement record locking and archival.
7. Build carry-forward logic for outstanding balances.

**Dependencies:** All prior phases (ledger entries are created by all financial operations).

### Phase Summary

| Phase | Focus | Effort | Sub-Workflows | Cumulative |
|---|---|---|---|---|
| 1 | FEECONF | 2 weeks | 4 | 4 |
| 2 | BILLING | 3 weeks | 11 | 15 |
| 3 | COLLECT | 3 weeks | 10 | 25 |
| 4 | SCHCON | 2.5 weeks | 9 | 34 |
| 5 | DEFAULT | 3 weeks | 12 | 46 |
| 6 | VENDPAY | 1.5 weeks | 4 | 50 |
| 7 | Cross-Module | 2 weeks | 12 | 62 |
| 8 | Juvi & AI | 1.5 weeks | 4 | 66 |
| 9 | Ledger & Audit | 2 weeks | 3 | 69 |
| **Total** | | **~20.5 weeks** | **69** | |

**Parallelization opportunity:** Phases 4+5+6 can partially overlap after Phase 3 is complete, potentially compressing the total timeline to ~14-16 weeks with 2-3 developers.
