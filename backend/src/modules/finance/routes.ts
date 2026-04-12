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

export default router;
