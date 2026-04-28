import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { createUserRateLimit } from '../../middleware/rateLimitPerUser';
import { verifyPaymentWebhookSignature } from '../../middleware/webhookSignature';
import * as ctrl from './controller';
import * as feePinCtrl from './fee-pin-controller';
import * as feeTemplateCtrl from './fee-component-template-controller';
import * as feePinAuditCtrl from './fee-pin-audit-controller';
import * as feeAnalyticsCtrl from './fee-analytics-controller';
import * as feeHoldsCtrl from './fee-holds-controller';
import * as feeCategoryCtrl from './fee-category-controller';
import {
  createFeeStructureSchema, updateFeeStructureSchema,
  createStudentFeeAccountSchema, updateStudentFeeAccountSchema,
  createFeeLineItemSchema, updateFeeLineItemSchema,
  createPaymentSchema, updatePaymentSchema,
  createScholarshipSchema, updateScholarshipSchema,
  createScholarshipAllocationSchema, updateScholarshipAllocationSchema,
  createConcessionSchema, updateConcessionSchema,
  createRefundSchema, updateRefundSchema,
  createFinePenaltySchema, updateFinePenaltySchema,
  createInvoiceSchema, updateInvoiceSchema,
  createBudgetSchema, updateBudgetSchema,
  createExpenseSchema, updateExpenseSchema,
  createFinancialLedgerSchema, updateFinancialLedgerSchema,
  createPaymentGatewayLogSchema, updatePaymentGatewayLogSchema,
  createFeeReminderSchema, updateFeeReminderSchema,
  createFinancialReportSchema,
  createFeeStructureInstanceSchema,
  cloneFeeStructureSchema,
  rejectFeeStructureSchema,
  createFeeComponentSchema,
  updateFeeComponentSchema,
  createFeeComponentRuleSchema,
  updateFeeComponentRuleSchema,
  evaluateFeeRulesSchema,
  testFeeRulesSchema,
  generateSemesterInvoiceBatchSchema,
  generateEnrolmentInvoiceSchema,
  generateExamFeeInvoiceBatchSchema,
  generateAdHocInvoiceSchema,
  adjustInvoiceSchema,
  disputeInvoiceSchema,
  writeOffInvoiceSchema,
  detectSiblingDiscountSchema,
  createFeeAgreementSchema,
  updateFeeAgreementSchema,
  createPaymentPlanSchema,
  updatePaymentPlanSchema,
  createInvoiceLineItemSchema,
  updateInvoiceLineItemSchema,
  processGatewayWebhookSchema,
  recordCounterPaymentSchema,
  importBankStatementSchema,
  manualMatchPaymentSchema,
  reissueReceiptSchema,
  recordPaymentBounceSchema,
  resolveOverpaymentSchema,
  executeRefundSchema,
  createPaymentTransactionSchema,
  updatePaymentTransactionSchema,
  createReceiptSchema,
  updateReceiptSchema,
  createReconciliationEntrySchema,
  updateReconciliationEntrySchema,
  createBounceRecordSchema,
  updateBounceRecordSchema,
  createOverpaymentRecordSchema,
  updateOverpaymentRecordSchema,
  verifyScholarshipEligibilityBatchSchema,
  submitScholarshipClaimsBatchSchema,
  pollScholarshipClaimStatusSchema,
  processScholarshipDisbursementSchema,
  processHardshipConcessionSchema,
  applyMeritScholarshipBatchSchema,
  detectStaffWardConcessionSchema,
  renewScholarshipsBatchSchema,
  createScholarshipEligibilitySchema,
  updateScholarshipEligibilitySchema,
  createScholarshipClaimSchema,
  updateScholarshipClaimSchema,
  createScholarshipReceivableSchema,
  updateScholarshipReceivableSchema,
  createScholarshipCreditSchema,
  updateScholarshipCreditSchema,
  identifyDefaultersSchema,
  processEscalationsSchema,
  computeDistressScoreSchema,
  referToWelfareSchema,
  processWelfareOutcomeSchema,
  recommendHoldsSchema,
  applyFinancialHoldSchema,
  releaseFinancialHoldSchema,
  resolveDefaulterSchema,
  logPhoneFollowUpSchema,
  createDefaulterRecordSchema,
  updateDefaulterRecordSchema,
  createEscalationActionSchema,
  updateEscalationActionSchema,
  updateFinancialHoldSchema,
  createWelfareReferralSchema,
  updateWelfareReferralSchema,
  syncStudentStatusSchema,
  independentHardshipSchema,
  initiateGatewayPaymentSchema,
  submitTSEPassClaimsSchema,
  triggerReminderSequenceSchema,
  cloneFeeStructureSchema_wf,
  approveFeeStructureSchema,
  evaluateFeeRulesSchema_wf,
  generateSemesterInvoiceSchema,
  generateBatchInvoicesSchema,
  generateExamFeeInvoiceSchema,
  adjustInvoiceSchema_wf,
  disputeInvoiceSchema_wf,
  writeOffInvoiceSchema_wf,
  recordOnlinePaymentSchema,
  recordCounterPaymentSchema_wf,
  importBankStatementSchema_wf,
  matchPaymentSchema,
  handleBounceSchema,
  cancelReceiptSchema_wf,
  runReconciliationSchema,
  resolveDiscrepancySchema,
  requestRefundSchema,
  approveRefundSchema_wf,
  verifyScholarshipSchema,
  submitClaimBatchSchema,
  processDisbursementSchema,
  applyHardshipConcessionSchema,
  applyMeritScholarshipSchema,
  renewScholarshipSchema,
  identifyDefaultersSchema_wf,
  escalateDefaulterSchema,
  referToWelfareSchema_wf,
  applyHoldSchema,
  releaseHoldSchema,
  scheduleVendorPaymentSchema,
  confirmVendorPaymentSchema,
  generateRevenueReportSchema,
  feePinRePinSchema,
  commitmentSheetRegenerateSchema,
  programmeTransferSchema,
  feeComponentCreateSchema,
  feeComponentUpdateSchema,
  dashboardQuerySchema,
  defaultersQuerySchema,
  holdsListQuerySchema,
  waiveHoldSchema,
  pauseEscalationSchema,
  createFeeCategorySchema,
  updateFeeCategorySchema,
  feeCategoryListQuerySchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Shared rate-limiter used by fee-configuration (T12) and
// fee-analytics-and-alerts (T8) routes. 60 requests/min/user. See
// `.captain/specs/fee-collection-analytics-and-alerts/plan.md` §1.8.
const feeConfigRateLimit = createUserRateLimit({ max: 60, windowMs: 60_000 });

// ═══════════════════════════════════════════════════════════════
//  T8: Fee Analytics & Alerts HTTP API
//  Declared BEFORE the legacy `/holds` CRUD routes so the new
//  `GET /holds` (listing via fee-holds-service) takes precedence
//  over the older `listFinancialHolds` controller below.
//  Spec: .captain/specs/fee-collection-analytics-and-alerts/
// ═══════════════════════════════════════════════════════════════

// Analytics — dashboard + defaulters (reads).
router.get(
  '/analytics/dashboard',
  authorize('finance', 'read'),
  feeConfigRateLimit,
  validate(dashboardQuerySchema, 'query'),
  feeAnalyticsCtrl.getDashboardHandler,
);
router.get(
  '/analytics/defaulters',
  authorize('finance', 'read'),
  feeConfigRateLimit,
  validate(defaultersQuerySchema, 'query'),
  feeAnalyticsCtrl.getDefaultersHandler,
);

// Holds — list + principal-gated activate / waive.
router.get(
  '/holds',
  authorize('finance', 'read'),
  feeConfigRateLimit,
  validate(holdsListQuerySchema, 'query'),
  feeHoldsCtrl.listHoldsHandler,
);
router.post(
  '/holds/:id/activate',
  authorize('finance', 'update'),
  feeConfigRateLimit,
  feeHoldsCtrl.activateHoldHandler,
);
router.post(
  '/holds/:id/waive',
  authorize('finance', 'update'),
  feeConfigRateLimit,
  validate(waiveHoldSchema),
  feeHoldsCtrl.waiveHoldHandler,
);

// Pause auto-escalation on a student's DefaulterRecord(s).
router.post(
  '/students/:id/pause-escalation',
  authorize('finance', 'update'),
  feeConfigRateLimit,
  validate(pauseEscalationSchema),
  feeHoldsCtrl.pauseEscalationHandler,
);

// Dashboard
router.get('/stats', authorize('finance', 'read'), ctrl.dashboardStats);

// Fee Structure
router.get('/fee-structures', authorize('finance', 'read'), ctrl.listFeeStructures);
router.get('/fee-structures/:id', authorize('finance', 'read'), ctrl.getFeeStructure);
router.post('/fee-structures', authorize('finance', 'create'), validate(createFeeStructureSchema), ctrl.createFeeStructure);
router.put('/fee-structures/:id', authorize('finance', 'update'), validate(updateFeeStructureSchema), ctrl.updateFeeStructure);
router.delete('/fee-structures/:id', authorize('finance', 'delete'), ctrl.deleteFeeStructure);

// Student Fee Accounts
router.get('/student-fee-accounts', authorize('finance', 'read'), ctrl.listStudentFeeAccounts);
router.get('/student-fee-accounts/:id', authorize('finance', 'read'), ctrl.getStudentFeeAccount);
router.post('/student-fee-accounts', authorize('finance', 'create'), validate(createStudentFeeAccountSchema), ctrl.createStudentFeeAccount);
router.put('/student-fee-accounts/:id', authorize('finance', 'update'), validate(updateStudentFeeAccountSchema), ctrl.updateStudentFeeAccount);
router.delete('/student-fee-accounts/:id', authorize('finance', 'delete'), ctrl.deleteStudentFeeAccount);

// Fee Line Items
router.get('/fee-line-items', authorize('finance', 'read'), ctrl.listFeeLineItems);
router.get('/fee-line-items/:id', authorize('finance', 'read'), ctrl.getFeeLineItem);
router.post('/fee-line-items', authorize('finance', 'create'), validate(createFeeLineItemSchema), ctrl.createFeeLineItem);
router.put('/fee-line-items/:id', authorize('finance', 'update'), validate(updateFeeLineItemSchema), ctrl.updateFeeLineItem);
router.delete('/fee-line-items/:id', authorize('finance', 'delete'), ctrl.deleteFeeLineItem);

// ═══ W03: Payment Gateway Webhook ════════════════════════════
// Unauthenticated (gateways don't hold our JWT) but gated by HMAC
// signature verification. `verifyPaymentWebhookSignature` runs AFTER
// `validate` so the body is parsed + validated before signature check;
// the middleware reads `orderId` from the validated body and resolves
// `req.collegeId` from the matching PaymentGatewayLog.
router.post(
  '/payments/gateway-webhook',
  validate(processGatewayWebhookSchema),
  verifyPaymentWebhookSignature,
  ctrl.processGatewayWebhook,
);

// ═══ W03: Payment Collection ═════════════════════════════════
router.post('/payments/counter', authorize('finance', 'create'), validate(recordCounterPaymentSchema), ctrl.recordCounterPayment);
router.post('/payments/bank-import', authorize('finance', 'create'), validate(importBankStatementSchema), ctrl.importBankStatement);
router.post('/payments/:id/match', authorize('finance', 'update'), validate(manualMatchPaymentSchema), ctrl.manualMatchPayment);
router.post('/payments/:id/flag-duplicate', authorize('finance', 'update'), ctrl.flagDuplicatePayment);
router.post('/payments/:id/bounce', authorize('finance', 'update'), validate(recordPaymentBounceSchema), ctrl.recordPaymentBounce);

// Payments
router.get('/payments', authorize('finance', 'read'), ctrl.listPayments);
router.get('/payments/:id', authorize('finance', 'read'), ctrl.getPayment);
router.post('/payments', authorize('finance', 'create'), validate(createPaymentSchema), ctrl.createPayment);
router.put('/payments/:id', authorize('finance', 'update'), validate(updatePaymentSchema), ctrl.updatePayment);
router.delete('/payments/:id', authorize('finance', 'delete'), ctrl.deletePayment);

// Scholarships
router.get('/scholarships', authorize('finance', 'read'), ctrl.listScholarships);
router.get('/scholarships/:id', authorize('finance', 'read'), ctrl.getScholarship);
router.post('/scholarships', authorize('finance', 'create'), validate(createScholarshipSchema), ctrl.createScholarship);
router.put('/scholarships/:id', authorize('finance', 'update'), validate(updateScholarshipSchema), ctrl.updateScholarship);
router.delete('/scholarships/:id', authorize('finance', 'delete'), ctrl.deleteScholarship);

// Scholarship Allocations
router.get('/scholarship-allocations', authorize('finance', 'read'), ctrl.listScholarshipAllocations);
router.post('/scholarship-allocations', authorize('finance', 'create'), validate(createScholarshipAllocationSchema), ctrl.createScholarshipAllocation);
router.put('/scholarship-allocations/:id', authorize('finance', 'update'), validate(updateScholarshipAllocationSchema), ctrl.updateScholarshipAllocation);
router.delete('/scholarship-allocations/:id', authorize('finance', 'delete'), ctrl.deleteScholarshipAllocation);

// Concessions
router.get('/concessions', authorize('finance', 'read'), ctrl.listConcessions);
router.post('/concessions', authorize('finance', 'create'), validate(createConcessionSchema), ctrl.createConcession);
router.put('/concessions/:id', authorize('finance', 'update'), validate(updateConcessionSchema), ctrl.updateConcession);
router.delete('/concessions/:id', authorize('finance', 'delete'), ctrl.deleteConcession);

// ═══ W03: Refund Actions (before CRUD :id routes) ════════════
router.post('/refunds/:id/approve', authorize('finance', 'update'), ctrl.approveRefund);
router.post('/refunds/:id/execute', authorize('finance', 'update'), validate(executeRefundSchema), ctrl.executeRefund);

// Refunds
router.get('/refunds', authorize('finance', 'read'), ctrl.listRefunds);
router.post('/refunds', authorize('finance', 'create'), validate(createRefundSchema), ctrl.createRefund);
router.put('/refunds/:id', authorize('finance', 'update'), validate(updateRefundSchema), ctrl.updateRefund);
router.delete('/refunds/:id', authorize('finance', 'delete'), ctrl.deleteRefund);

// Fines & Penalties
router.get('/fines', authorize('finance', 'read'), ctrl.listFinePenalties);
router.post('/fines', authorize('finance', 'create'), validate(createFinePenaltySchema), ctrl.createFinePenalty);
router.put('/fines/:id', authorize('finance', 'update'), validate(updateFinePenaltySchema), ctrl.updateFinePenalty);
router.delete('/fines/:id', authorize('finance', 'delete'), ctrl.deleteFinePenalty);

// ═══ W03: Invoice Batch Generation ═══════════════════════════
router.post('/invoices/batch/semester', authorize('finance', 'create'), validate(generateSemesterInvoiceBatchSchema), ctrl.generateSemesterInvoiceBatch);
router.post('/invoices/enrolment', authorize('finance', 'create'), validate(generateEnrolmentInvoiceSchema), ctrl.generateEnrolmentInvoice);
router.post('/invoices/batch/exam', authorize('finance', 'create'), validate(generateExamFeeInvoiceBatchSchema), ctrl.generateExamFeeInvoiceBatch);
router.post('/invoices/ad-hoc', authorize('finance', 'create'), validate(generateAdHocInvoiceSchema), ctrl.generateAdHocInvoice);

// Invoices
router.get('/invoices', authorize('finance', 'read'), ctrl.listInvoices);
router.get('/invoices/:id', authorize('finance', 'read'), ctrl.getInvoice);
router.post('/invoices', authorize('finance', 'create'), validate(createInvoiceSchema), ctrl.createInvoice);
router.put('/invoices/:id', authorize('finance', 'update'), validate(updateInvoiceSchema), ctrl.updateInvoice);
router.delete('/invoices/:id', authorize('finance', 'delete'), ctrl.deleteInvoice);

// Budget
router.get('/budgets', authorize('finance', 'read'), ctrl.listBudgets);
router.get('/budgets/:id', authorize('finance', 'read'), ctrl.getBudget);
router.post('/budgets', authorize('finance', 'create'), validate(createBudgetSchema), ctrl.createBudget);
router.put('/budgets/:id', authorize('finance', 'update'), validate(updateBudgetSchema), ctrl.updateBudget);
router.delete('/budgets/:id', authorize('finance', 'delete'), ctrl.deleteBudget);

// Expenses
router.get('/expenses', authorize('finance', 'read'), ctrl.listExpenses);
router.get('/expenses/:id', authorize('finance', 'read'), ctrl.getExpense);
router.post('/expenses', authorize('finance', 'create'), validate(createExpenseSchema), ctrl.createExpense);
router.put('/expenses/:id', authorize('finance', 'update'), validate(updateExpenseSchema), ctrl.updateExpense);
router.delete('/expenses/:id', authorize('finance', 'delete'), ctrl.deleteExpense);

// Financial Ledger
router.get('/ledger', authorize('finance', 'read'), ctrl.listFinancialLedger);
router.post('/ledger', authorize('finance', 'create'), validate(createFinancialLedgerSchema), ctrl.createFinancialLedger);
router.put('/ledger/:id', authorize('finance', 'update'), validate(updateFinancialLedgerSchema), ctrl.updateFinancialLedger);
router.delete('/ledger/:id', authorize('finance', 'delete'), ctrl.deleteFinancialLedger);

// Payment Gateway Logs
router.get('/gateway-logs', authorize('finance', 'read'), ctrl.listPaymentGatewayLogs);
router.post('/gateway-logs', authorize('finance', 'create'), validate(createPaymentGatewayLogSchema), ctrl.createPaymentGatewayLog);
router.put('/gateway-logs/:id', authorize('finance', 'update'), validate(updatePaymentGatewayLogSchema), ctrl.updatePaymentGatewayLog);
router.delete('/gateway-logs/:id', authorize('finance', 'delete'), ctrl.deletePaymentGatewayLog);

// Fee Reminders
router.get('/reminders', authorize('finance', 'read'), ctrl.listFeeReminders);
router.post('/reminders', authorize('finance', 'create'), validate(createFeeReminderSchema), ctrl.createFeeReminder);
router.put('/reminders/:id', authorize('finance', 'update'), validate(updateFeeReminderSchema), ctrl.updateFeeReminder);
router.delete('/reminders/:id', authorize('finance', 'delete'), ctrl.deleteFeeReminder);

// Financial Reports
router.get('/reports', authorize('finance', 'read'), ctrl.listFinancialReports);
router.post('/reports', authorize('finance', 'create'), validate(createFinancialReportSchema), ctrl.createFinancialReport);
router.delete('/reports/:id', authorize('finance', 'delete'), ctrl.deleteFinancialReport);

// ═══ W03: Fee Structure Instance Lifecycle ═══════════════════
router.get('/fee-structure-instances', authorize('finance', 'read'), ctrl.listFeeStructureInstances);
router.get('/fee-structure-instances/:id', authorize('finance', 'read'), ctrl.getFeeStructureInstance);
router.post('/fee-structure-instances', authorize('finance', 'create'), validate(createFeeStructureInstanceSchema), ctrl.createFeeStructureInstance);
router.post('/fee-structures/clone', authorize('finance', 'create'), validate(cloneFeeStructureSchema), ctrl.cloneFeeStructure);
router.post('/fee-structure-instances/:id/submit', authorize('finance', 'update'), ctrl.submitFeeStructure);
router.post('/fee-structure-instances/:id/approve', authorize('finance', 'update'), ctrl.approveFeeStructure);
router.post('/fee-structure-instances/:id/activate', authorize('finance', 'update'), ctrl.activateFeeStructure);
router.post('/fee-structure-instances/:id/reject', authorize('finance', 'update'), validate(rejectFeeStructureSchema), ctrl.rejectFeeStructure);
router.post('/fee-structure-instances/:id/archive', authorize('finance', 'update'), ctrl.archiveFeeStructure);
router.get('/fee-structure-instances/:id/comparison', authorize('finance', 'read'), ctrl.getFeeStructureComparison);
router.get('/fee-structure-instances/:id/revenue-projection', authorize('finance', 'read'), ctrl.getFeeStructureRevenueProjection);

// ═══ W03: Fee Components ═════════════════════════════════════
router.get('/fee-components', authorize('finance', 'read'), ctrl.listFeeComponents);
router.get('/fee-components/:id', authorize('finance', 'read'), ctrl.getFeeComponent);
router.post('/fee-components', authorize('finance', 'create'), validate(createFeeComponentSchema), ctrl.createFeeComponent);
router.put('/fee-components/:id', authorize('finance', 'update'), validate(updateFeeComponentSchema), ctrl.updateFeeComponent);
router.delete('/fee-components/:id', authorize('finance', 'delete'), ctrl.deleteFeeComponent);

// ═══ W03: Fee Component Rules ════════════════════════════════
router.post('/fee-component-rules/evaluate', authorize('finance', 'read'), validate(evaluateFeeRulesSchema), ctrl.evaluateFeeRules);
router.post('/fee-component-rules/test', authorize('finance', 'read'), validate(testFeeRulesSchema), ctrl.testFeeRulesWithProfiles);
router.get('/fee-component-rules', authorize('finance', 'read'), ctrl.listFeeComponentRules);
router.post('/fee-component-rules', authorize('finance', 'create'), validate(createFeeComponentRuleSchema), ctrl.createFeeComponentRule);
router.put('/fee-component-rules/:id', authorize('finance', 'update'), validate(updateFeeComponentRuleSchema), ctrl.updateFeeComponentRule);
router.delete('/fee-component-rules/:id', authorize('finance', 'delete'), ctrl.deleteFeeComponentRule);

// ═══ W03: Invoice Actions ════════════════════════════════════
router.post('/invoices/:id/adjust', authorize('finance', 'update'), validate(adjustInvoiceSchema), ctrl.adjustInvoice);
router.post('/invoices/:id/dispute', authorize('finance', 'update'), validate(disputeInvoiceSchema), ctrl.disputeInvoice);
router.post('/invoices/:id/confirm', authorize('finance', 'update'), ctrl.confirmInvoice);
router.post('/invoices/:id/write-off', authorize('finance', 'update'), validate(writeOffInvoiceSchema), ctrl.writeOffInvoice);
router.post('/concessions/sibling-detect', authorize('finance', 'create'), validate(detectSiblingDiscountSchema), ctrl.detectSiblingDiscount);

// ═══ W03: Fee Agreements ═════════════════════════════════════
router.get('/fee-agreements', authorize('finance', 'read'), ctrl.listFeeAgreements);
router.get('/fee-agreements/:id', authorize('finance', 'read'), ctrl.getFeeAgreement);
router.post('/fee-agreements', authorize('finance', 'create'), validate(createFeeAgreementSchema), ctrl.createFeeAgreement);
router.put('/fee-agreements/:id', authorize('finance', 'update'), validate(updateFeeAgreementSchema), ctrl.updateFeeAgreement);
router.delete('/fee-agreements/:id', authorize('finance', 'delete'), ctrl.deleteFeeAgreement);

// ═══ W03: Payment Plans ══════════════════════════════════════
router.get('/payment-plans', authorize('finance', 'read'), ctrl.listPaymentPlans);
router.get('/payment-plans/:id', authorize('finance', 'read'), ctrl.getPaymentPlan);
router.post('/payment-plans', authorize('finance', 'create'), validate(createPaymentPlanSchema), ctrl.createPaymentPlan);
router.put('/payment-plans/:id', authorize('finance', 'update'), validate(updatePaymentPlanSchema), ctrl.updatePaymentPlan);
router.delete('/payment-plans/:id', authorize('finance', 'delete'), ctrl.deletePaymentPlan);

// ═══ W03: Invoice Line Items ═════════════════════════════════
router.get('/invoice-line-items', authorize('finance', 'read'), ctrl.listInvoiceLineItems);
router.get('/invoice-line-items/:id', authorize('finance', 'read'), ctrl.getInvoiceLineItem);
router.post('/invoice-line-items', authorize('finance', 'create'), validate(createInvoiceLineItemSchema), ctrl.createInvoiceLineItem);
router.put('/invoice-line-items/:id', authorize('finance', 'update'), validate(updateInvoiceLineItemSchema), ctrl.updateInvoiceLineItem);
router.delete('/invoice-line-items/:id', authorize('finance', 'delete'), ctrl.deleteInvoiceLineItem);

// ═══ W03: Reconciliation ═════════════════════════════════════
router.post('/reconciliation/run', authorize('finance', 'create'), ctrl.runReconciliation);
router.get('/reconciliation/status', authorize('finance', 'read'), ctrl.getReconciliationStatus);

// ═══ W03: Receipts (action routes before CRUD :id routes) ════
router.post('/receipts/:id/reissue', authorize('finance', 'update'), validate(reissueReceiptSchema), ctrl.reissueReceipt);
router.post('/receipts/:id/cancel', authorize('finance', 'update'), ctrl.cancelReceipt);

// ═══ W03: Receipt CRUD ═══════════════════════════════════════
router.get('/receipts', authorize('finance', 'read'), ctrl.listReceipts);
router.get('/receipts/:id', authorize('finance', 'read'), ctrl.getReceipt);
router.post('/receipts', authorize('finance', 'create'), validate(createReceiptSchema), ctrl.createReceipt);
router.put('/receipts/:id', authorize('finance', 'update'), validate(updateReceiptSchema), ctrl.updateReceipt);
router.delete('/receipts/:id', authorize('finance', 'delete'), ctrl.deleteReceipt);

// ═══ W03: ReconciliationEntry CRUD ═══════════════════════════
router.get('/reconciliation-entries', authorize('finance', 'read'), ctrl.listReconciliationEntries);
router.get('/reconciliation-entries/:id', authorize('finance', 'read'), ctrl.getReconciliationEntry);
router.post('/reconciliation-entries', authorize('finance', 'create'), validate(createReconciliationEntrySchema), ctrl.createReconciliationEntry);
router.put('/reconciliation-entries/:id', authorize('finance', 'update'), validate(updateReconciliationEntrySchema), ctrl.updateReconciliationEntry);
router.delete('/reconciliation-entries/:id', authorize('finance', 'delete'), ctrl.deleteReconciliationEntry);

// ═══ W03: BounceRecord CRUD ══════════════════════════════════
router.get('/bounce-records', authorize('finance', 'read'), ctrl.listBounceRecords);
router.get('/bounce-records/:id', authorize('finance', 'read'), ctrl.getBounceRecord);
router.post('/bounce-records', authorize('finance', 'create'), validate(createBounceRecordSchema), ctrl.createBounceRecord);
router.put('/bounce-records/:id', authorize('finance', 'update'), validate(updateBounceRecordSchema), ctrl.updateBounceRecord);
router.delete('/bounce-records/:id', authorize('finance', 'delete'), ctrl.deleteBounceRecord);

// ═══ W03: OverpaymentRecord (action routes before CRUD :id routes) ═
router.post('/overpayments/:id/resolve', authorize('finance', 'update'), validate(resolveOverpaymentSchema), ctrl.resolveOverpayment);

// ═══ W03: OverpaymentRecord CRUD ═════════════════════════════
router.get('/overpayments', authorize('finance', 'read'), ctrl.listOverpaymentRecords);
router.get('/overpayments/:id', authorize('finance', 'read'), ctrl.getOverpaymentRecord);
router.post('/overpayments', authorize('finance', 'create'), validate(createOverpaymentRecordSchema), ctrl.createOverpaymentRecord);
router.put('/overpayments/:id', authorize('finance', 'update'), validate(updateOverpaymentRecordSchema), ctrl.updateOverpaymentRecord);
router.delete('/overpayments/:id', authorize('finance', 'delete'), ctrl.deleteOverpaymentRecord);

// ═══ W03: PaymentTransaction CRUD ════════════════════════════
router.get('/payment-transactions', authorize('finance', 'read'), ctrl.listPaymentTransactions);
router.get('/payment-transactions/:id', authorize('finance', 'read'), ctrl.getPaymentTransaction);
router.post('/payment-transactions', authorize('finance', 'create'), validate(createPaymentTransactionSchema), ctrl.createPaymentTransaction);
router.put('/payment-transactions/:id', authorize('finance', 'update'), validate(updatePaymentTransactionSchema), ctrl.updatePaymentTransaction);
router.delete('/payment-transactions/:id', authorize('finance', 'delete'), ctrl.deletePaymentTransaction);

// ═══ W03 Phase 4: Scholarship & Concession Workflow Routes ═══════════════════

// Scholarship workflow actions
router.post('/scholarships/eligibility/batch', authorize('finance', 'create'), validate(verifyScholarshipEligibilityBatchSchema), ctrl.verifyScholarshipEligibilityBatch);
router.post('/scholarships/claims/submit-batch', authorize('finance', 'create'), validate(submitScholarshipClaimsBatchSchema), ctrl.submitScholarshipClaimsBatch);
router.post('/scholarships/claims/poll-status', authorize('finance', 'read'), validate(pollScholarshipClaimStatusSchema), ctrl.pollScholarshipClaimStatus);
router.post('/scholarships/disbursement/process', authorize('finance', 'update'), validate(processScholarshipDisbursementSchema), ctrl.processScholarshipDisbursement);
router.post('/scholarship-receivables/:id/convert', authorize('finance', 'update'), ctrl.convertReceivableToLiability);
router.post('/concessions/hardship', authorize('finance', 'create'), validate(processHardshipConcessionSchema), ctrl.processHardshipConcession);
router.post('/concessions/merit/batch', authorize('finance', 'create'), validate(applyMeritScholarshipBatchSchema), ctrl.applyMeritScholarshipBatch);
router.post('/concessions/staff-ward/detect', authorize('finance', 'create'), validate(detectStaffWardConcessionSchema), ctrl.detectStaffWardConcession);
router.post('/scholarships/renewal/batch', authorize('finance', 'create'), validate(renewScholarshipsBatchSchema), ctrl.renewScholarshipsBatch);

// ScholarshipEligibility CRUD
router.get('/scholarship-eligibility', authorize('finance', 'read'), ctrl.listScholarshipEligibilities);
router.get('/scholarship-eligibility/:id', authorize('finance', 'read'), ctrl.getScholarshipEligibility);
router.post('/scholarship-eligibility', authorize('finance', 'create'), validate(createScholarshipEligibilitySchema), ctrl.createScholarshipEligibility);
router.put('/scholarship-eligibility/:id', authorize('finance', 'update'), validate(updateScholarshipEligibilitySchema), ctrl.updateScholarshipEligibility);
router.delete('/scholarship-eligibility/:id', authorize('finance', 'delete'), ctrl.deleteScholarshipEligibility);

// ScholarshipClaim CRUD
router.get('/scholarship-claims', authorize('finance', 'read'), ctrl.listScholarshipClaims);
router.get('/scholarship-claims/:id', authorize('finance', 'read'), ctrl.getScholarshipClaim);
router.post('/scholarship-claims', authorize('finance', 'create'), validate(createScholarshipClaimSchema), ctrl.createScholarshipClaim);
router.put('/scholarship-claims/:id', authorize('finance', 'update'), validate(updateScholarshipClaimSchema), ctrl.updateScholarshipClaim);
router.delete('/scholarship-claims/:id', authorize('finance', 'delete'), ctrl.deleteScholarshipClaim);

// ScholarshipReceivable CRUD (action route before :id CRUD routes)
router.get('/scholarship-receivables', authorize('finance', 'read'), ctrl.listScholarshipReceivables);
router.get('/scholarship-receivables/:id', authorize('finance', 'read'), ctrl.getScholarshipReceivable);
router.post('/scholarship-receivables', authorize('finance', 'create'), validate(createScholarshipReceivableSchema), ctrl.createScholarshipReceivable);
router.put('/scholarship-receivables/:id', authorize('finance', 'update'), validate(updateScholarshipReceivableSchema), ctrl.updateScholarshipReceivable);
router.delete('/scholarship-receivables/:id', authorize('finance', 'delete'), ctrl.deleteScholarshipReceivable);

// ScholarshipCredit CRUD
router.get('/scholarship-credits', authorize('finance', 'read'), ctrl.listScholarshipCredits);
router.get('/scholarship-credits/:id', authorize('finance', 'read'), ctrl.getScholarshipCredit);
router.post('/scholarship-credits', authorize('finance', 'create'), validate(createScholarshipCreditSchema), ctrl.createScholarshipCredit);
router.put('/scholarship-credits/:id', authorize('finance', 'update'), validate(updateScholarshipCreditSchema), ctrl.updateScholarshipCredit);
router.delete('/scholarship-credits/:id', authorize('finance', 'delete'), ctrl.deleteScholarshipCredit);

// ═══ W03 Phase 5: Defaulter Management ═══════════════════════

// Workflow action routes (before CRUD :id routes)
router.post('/defaulters/identify', authorize('finance', 'create'), validate(identifyDefaultersSchema), ctrl.identifyDefaulters);
router.post('/defaulters/process-escalations', authorize('finance', 'update'), validate(processEscalationsSchema), ctrl.processEscalations);
router.post('/defaulters/:id/compute-distress', authorize('finance', 'update'), validate(computeDistressScoreSchema), ctrl.computeDistressScore);
router.post('/defaulters/:id/refer-welfare', authorize('finance', 'update'), validate(referToWelfareSchema), ctrl.referToWelfare);
router.post('/defaulters/:id/welfare-outcome', authorize('finance', 'update'), validate(processWelfareOutcomeSchema), ctrl.processWelfareOutcome);
router.post('/defaulters/:id/recommend-hold', authorize('finance', 'update'), validate(recommendHoldsSchema), ctrl.recommendHolds);
router.post('/defaulters/:id/resolve', authorize('finance', 'update'), validate(resolveDefaulterSchema), ctrl.resolveDefaulter);
router.post('/defaulters/:id/log-followup', authorize('finance', 'update'), validate(logPhoneFollowUpSchema), ctrl.logPhoneFollowUp);

// DefaulterRecord CRUD
router.get('/defaulters', authorize('finance', 'read'), ctrl.listDefaulterRecords);
router.get('/defaulters/:id', authorize('finance', 'read'), ctrl.getDefaulterRecord);
router.post('/defaulters', authorize('finance', 'create'), validate(createDefaulterRecordSchema), ctrl.createDefaulterRecord);
router.put('/defaulters/:id', authorize('finance', 'update'), validate(updateDefaulterRecordSchema), ctrl.updateDefaulterRecord);
router.delete('/defaulters/:id', authorize('finance', 'delete'), ctrl.deleteDefaulterRecord);

// EscalationAction CRUD
router.get('/escalation-actions', authorize('finance', 'read'), ctrl.listEscalationActions);
router.get('/escalation-actions/:id', authorize('finance', 'read'), ctrl.getEscalationAction);
router.post('/escalation-actions', authorize('finance', 'create'), validate(createEscalationActionSchema), ctrl.createEscalationAction);
router.put('/escalation-actions/:id', authorize('finance', 'update'), validate(updateEscalationActionSchema), ctrl.updateEscalationAction);
router.delete('/escalation-actions/:id', authorize('finance', 'delete'), ctrl.deleteEscalationAction);

// FinancialHold - action routes before CRUD :id routes
router.post('/holds', authorize('finance', 'create'), validate(applyFinancialHoldSchema), ctrl.applyFinancialHold);
router.get('/holds', authorize('finance', 'read'), ctrl.listFinancialHolds);
router.get('/holds/check/:studentId', authorize('finance', 'read'), ctrl.checkFinancialHolds);
router.post('/holds/:id/release', authorize('finance', 'update'), validate(releaseFinancialHoldSchema), ctrl.releaseFinancialHold);
router.get('/holds/:id', authorize('finance', 'read'), ctrl.getFinancialHold);
router.put('/holds/:id', authorize('finance', 'update'), validate(updateFinancialHoldSchema), ctrl.updateFinancialHold);
router.delete('/holds/:id', authorize('finance', 'delete'), ctrl.deleteFinancialHold);

// WelfareReferral CRUD
router.get('/welfare-referrals', authorize('finance', 'read'), ctrl.listWelfareReferrals);
router.get('/welfare-referrals/:id', authorize('finance', 'read'), ctrl.getWelfareReferral);
router.post('/welfare-referrals', authorize('finance', 'create'), validate(createWelfareReferralSchema), ctrl.createWelfareReferral);
router.put('/welfare-referrals/:id', authorize('finance', 'update'), validate(updateWelfareReferralSchema), ctrl.updateWelfareReferral);
router.delete('/welfare-referrals/:id', authorize('finance', 'delete'), ctrl.deleteWelfareReferral);

// ═══ W03 Phase 7: Cross-Module Integration & Events ═════════

router.post('/sync/student-status', authenticate, validate(syncStudentStatusSchema), ctrl.syncStudentStatus);
router.get('/clearance/:studentId', authenticate, ctrl.getFinancialClearance);
router.get('/distress-signals/:defaulterRecordId', authenticate, ctrl.getDistressSignals);
router.post('/independent-hardship', authenticate, validate(independentHardshipSchema), ctrl.submitIndependentHardship);
router.get('/dashboards/revenue', authenticate, ctrl.revenueDashboard);
router.get('/dashboards/defaulter-trends', authenticate, ctrl.defaulterTrendAnalysis);
router.get('/policies/fee', authenticate, ctrl.feePolicy);
router.post('/gateway/initiate', authenticate, validate(initiateGatewayPaymentSchema), ctrl.initiateGatewayPayment);
router.post('/ts-epass/submit', authenticate, validate(submitTSEPassClaimsSchema), ctrl.submitTSEPassClaims);
router.post('/reminders/trigger', authenticate, validate(triggerReminderSequenceSchema), ctrl.triggerReminderSequence);

// ═══ W03 Fee Lifecycle Routes ═══════════════════════════════

// ── Fee Configuration ──────────────────────────────────────
router.post('/fee-structures/clone', authorize('finance', 'create'), validate(cloneFeeStructureSchema_wf), ctrl.cloneFeeStructureCtrl);
router.post('/fee-structures/:id/submit', authorize('finance', 'update'), ctrl.submitFeeStructureCtrl);
router.post('/fee-structures/:id/approve', authorize('finance', 'update'), validate(approveFeeStructureSchema), ctrl.approveFeeStructureCtrl);
router.post('/fee-component-rules/evaluate', authorize('finance', 'read'), validate(evaluateFeeRulesSchema_wf), ctrl.evaluateFeeRulesCtrl);

// ── Invoice Generation ─────────────────────────────────────
router.post('/invoices/semester', authorize('finance', 'create'), validate(generateSemesterInvoiceSchema), ctrl.generateSemesterInvoiceCtrl);
router.post('/invoices/batch/semester', authorize('finance', 'create'), validate(generateBatchInvoicesSchema), ctrl.generateBatchInvoicesCtrl);
router.post('/invoices/exam', authorize('finance', 'create'), validate(generateExamFeeInvoiceSchema), ctrl.generateExamFeeInvoiceCtrl);
router.post('/invoices/:id/adjust', authorize('finance', 'update'), validate(adjustInvoiceSchema_wf), ctrl.adjustInvoiceCtrl);
router.post('/invoices/:id/dispute', authorize('finance', 'update'), validate(disputeInvoiceSchema_wf), ctrl.disputeInvoiceCtrl);
router.post('/invoices/:id/write-off', authorize('finance', 'update'), validate(writeOffInvoiceSchema_wf), ctrl.writeOffInvoiceCtrl);

// ── Payment Processing ─────────────────────────────────────
router.post('/payments/online', authorize('finance', 'create'), validate(recordOnlinePaymentSchema), ctrl.recordOnlinePaymentCtrl);
router.post('/payments/counter', authorize('finance', 'create'), validate(recordCounterPaymentSchema_wf), ctrl.recordCounterPaymentCtrl);
router.post('/payments/bank-import', authorize('finance', 'create'), validate(importBankStatementSchema_wf), ctrl.importBankStatementCtrl);
router.post('/payments/:id/match', authorize('finance', 'update'), validate(matchPaymentSchema), ctrl.matchPaymentCtrl);
router.get('/payments/:id/duplicate-check', authorize('finance', 'read'), ctrl.detectDuplicateCtrl);
router.post('/payments/:id/bounce', authorize('finance', 'update'), validate(handleBounceSchema), ctrl.handleBounceCtrl);

// ── Receipts ───────────────────────────────────────────────
router.post('/receipts/generate', authorize('finance', 'create'), ctrl.generateReceiptCtrl);
router.post('/receipts/:id/cancel', authorize('finance', 'update'), validate(cancelReceiptSchema_wf), ctrl.cancelReceiptCtrl);
router.post('/receipts/:id/reissue', authorize('finance', 'create'), ctrl.reissueReceiptCtrl);

// ── Reconciliation ─────────────────────────────────────────
router.post('/reconciliation/run', authorize('finance', 'create'), validate(runReconciliationSchema), ctrl.runReconciliationCtrl);
router.put('/reconciliation-entries/:id/resolve', authorize('finance', 'update'), validate(resolveDiscrepancySchema), ctrl.resolveDiscrepancyCtrl);

// ── Refunds ────────────────────────────────────────────────
router.post('/refunds/request', authorize('finance', 'create'), validate(requestRefundSchema), ctrl.requestRefundCtrl);
router.post('/refunds/:id/approve', authorize('finance', 'update'), validate(approveRefundSchema_wf), ctrl.approveRefundCtrl);
router.post('/refunds/:id/process', authorize('finance', 'update'), ctrl.processRefundCtrl);

// ── Scholarships & Concessions ─────────────────────────────
router.post('/scholarships/eligibility/verify', authorize('finance', 'create'), validate(verifyScholarshipSchema), ctrl.verifyScholarshipEligibilityCtrl);
router.post('/scholarship-claims/submit-batch', authorize('finance', 'create'), validate(submitClaimBatchSchema), ctrl.submitClaimBatchCtrl);
router.post('/scholarship-claims/:id/disburse', authorize('finance', 'update'), validate(processDisbursementSchema), ctrl.processDisbursementCtrl);
router.post('/concessions/hardship', authorize('finance', 'create'), validate(applyHardshipConcessionSchema), ctrl.applyHardshipConcessionCtrl);
router.post('/concessions/merit', authorize('finance', 'create'), validate(applyMeritScholarshipSchema), ctrl.applyMeritScholarshipCtrl);
router.post('/scholarships/eligibility/renew', authorize('finance', 'create'), validate(renewScholarshipSchema), ctrl.renewScholarshipCtrl);

// ── Defaulter Management ───────────────────────────────────
router.post('/defaulters/identify', authorize('finance', 'create'), validate(identifyDefaultersSchema_wf), ctrl.identifyDefaultersCtrl);
router.post('/defaulters/:id/escalate', authorize('finance', 'update'), validate(escalateDefaulterSchema), ctrl.escalateDefaulterCtrl);
router.get('/defaulters/:id/distress-score', authorize('finance', 'read'), ctrl.computeDistressCtrl);
router.post('/defaulters/:id/refer-welfare', authorize('finance', 'create'), validate(referToWelfareSchema_wf), ctrl.referToWelfareCtrl);
router.post('/holds', authorize('finance', 'create'), validate(applyHoldSchema), ctrl.applyHoldCtrl);
router.post('/holds/:id/release', authorize('finance', 'update'), validate(releaseHoldSchema), ctrl.releaseHoldCtrl);

// ── Financial Clearance ────────────────────────────────────
router.get('/clearance/:studentId', authorize('finance', 'read'), ctrl.checkFinancialClearanceCtrl);

// ── Vendor Payments ────────────────────────────────────────
router.post('/vendor-payments/schedule', authorize('finance', 'create'), validate(scheduleVendorPaymentSchema), ctrl.scheduleVendorPaymentCtrl);
router.post('/vendor-payments/:id/confirm', authorize('finance', 'update'), validate(confirmVendorPaymentSchema), ctrl.confirmVendorPaymentCtrl);

// ── Revenue Reports ────────────────────────────────────────
router.post('/revenue-reports', authorize('finance', 'create'), validate(generateRevenueReportSchema), ctrl.generateRevenueReportCtrl);

// ═══ Fee Configuration (Task 12) ═════════════════════════════
// Per-student pin management, component template CRUD, audit reads.
// All routes sit behind authenticate + authorize + per-user rate limit.
// Principal-gated actions use `authorize('finance', 'approve')` which
// the default policy set grants to role=principal (and super_admin via
// wildcard). See shared/rbac/defaults.ts. `feeConfigRateLimit` is
// declared at the top of this file (shared with the T8 routes above).

// Student pin management
router.get(
  '/students/:id/pins',
  authorize('people', 'read'),
  feeConfigRateLimit,
  feePinCtrl.listStudentPins,
);
router.post(
  '/students/:id/pins/re-pin',
  authorize('finance', 'approve'),
  feeConfigRateLimit,
  validate(feePinRePinSchema),
  feePinCtrl.rePinStudent,
);
router.post(
  '/students/:id/commitment-sheet/regenerate',
  authorize('finance', 'update'),
  feeConfigRateLimit,
  validate(commitmentSheetRegenerateSchema),
  feePinCtrl.regenerateCommitmentSheet,
);
router.post(
  '/students/:id/transfer-programme',
  authorize('finance', 'approve'),
  feeConfigRateLimit,
  validate(programmeTransferSchema),
  feePinCtrl.transferProgramme,
);

// Component template CRUD
router.get(
  '/component-template',
  authorize('finance', 'read'),
  feeConfigRateLimit,
  feeTemplateCtrl.listTemplateComponents,
);
router.post(
  '/component-template/components',
  authorize('finance', 'update'),
  feeConfigRateLimit,
  validate(feeComponentCreateSchema),
  feeTemplateCtrl.createTemplateComponent,
);
router.put(
  '/component-template/components/:componentId',
  authorize('finance', 'update'),
  feeConfigRateLimit,
  validate(feeComponentUpdateSchema),
  feeTemplateCtrl.updateTemplateComponent,
);
router.delete(
  '/component-template/components/:componentId',
  authorize('finance', 'update'),
  feeConfigRateLimit,
  feeTemplateCtrl.deleteTemplateComponent,
);

// Pin-audit reads
router.get(
  '/pin-audit/coverage',
  authorize('finance', 'read'),
  feeConfigRateLimit,
  feePinAuditCtrl.getCoverage,
);
router.get(
  '/pin-audit/invariants',
  authorize('finance', 'read'),
  feeConfigRateLimit,
  feePinAuditCtrl.getInvariants,
);

// ═══ Fee Category CRUD ═══════════════════════════════════════════
// Per-college reservation-category catalog (OC, OBC, SC, ST, NRI, …).
// Drives the FeeStructure form's Category dropdown. Stored as a string
// `code` in FeeStructure.category — see fee-pin-service for the
// string-equality matching contract that downstream callers rely on.
router.get(
  '/fee-categories',
  authorize('finance', 'read'),
  feeConfigRateLimit,
  validate(feeCategoryListQuerySchema, 'query'),
  feeCategoryCtrl.listFeeCategories,
);
router.post(
  '/fee-categories',
  authorize('finance', 'create'),
  feeConfigRateLimit,
  validate(createFeeCategorySchema),
  feeCategoryCtrl.createFeeCategory,
);
router.get(
  '/fee-categories/:id',
  authorize('finance', 'read'),
  feeConfigRateLimit,
  feeCategoryCtrl.getFeeCategory,
);
router.patch(
  '/fee-categories/:id',
  authorize('finance', 'update'),
  feeConfigRateLimit,
  validate(updateFeeCategorySchema),
  feeCategoryCtrl.updateFeeCategory,
);
router.delete(
  '/fee-categories/:id',
  authorize('finance', 'delete'),
  feeConfigRateLimit,
  feeCategoryCtrl.deleteFeeCategory,
);

export default router;
