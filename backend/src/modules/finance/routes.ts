import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
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
} from './validation';

const router = Router();
router.use(authenticate);

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
router.post('/payments/gateway-webhook', validate(processGatewayWebhookSchema), ctrl.processGatewayWebhook);

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

export default router;
