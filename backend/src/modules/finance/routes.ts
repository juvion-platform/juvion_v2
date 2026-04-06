import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
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
router.get('/stats', ctrl.dashboardStats);

// Fee Structure
router.get('/fee-structures', ctrl.listFeeStructures);
router.get('/fee-structures/:id', ctrl.getFeeStructure);
router.post('/fee-structures', validate(createFeeStructureSchema), ctrl.createFeeStructure);
router.put('/fee-structures/:id', validate(updateFeeStructureSchema), ctrl.updateFeeStructure);
router.delete('/fee-structures/:id', ctrl.deleteFeeStructure);

// Student Fee Accounts
router.get('/student-fee-accounts', ctrl.listStudentFeeAccounts);
router.get('/student-fee-accounts/:id', ctrl.getStudentFeeAccount);
router.post('/student-fee-accounts', validate(createStudentFeeAccountSchema), ctrl.createStudentFeeAccount);
router.put('/student-fee-accounts/:id', validate(updateStudentFeeAccountSchema), ctrl.updateStudentFeeAccount);
router.delete('/student-fee-accounts/:id', ctrl.deleteStudentFeeAccount);

// Fee Line Items
router.get('/fee-line-items', ctrl.listFeeLineItems);
router.get('/fee-line-items/:id', ctrl.getFeeLineItem);
router.post('/fee-line-items', validate(createFeeLineItemSchema), ctrl.createFeeLineItem);
router.put('/fee-line-items/:id', validate(updateFeeLineItemSchema), ctrl.updateFeeLineItem);
router.delete('/fee-line-items/:id', ctrl.deleteFeeLineItem);

// Payments
router.get('/payments', ctrl.listPayments);
router.get('/payments/:id', ctrl.getPayment);
router.post('/payments', validate(createPaymentSchema), ctrl.createPayment);
router.put('/payments/:id', validate(updatePaymentSchema), ctrl.updatePayment);
router.delete('/payments/:id', ctrl.deletePayment);

// Scholarships
router.get('/scholarships', ctrl.listScholarships);
router.get('/scholarships/:id', ctrl.getScholarship);
router.post('/scholarships', validate(createScholarshipSchema), ctrl.createScholarship);
router.put('/scholarships/:id', validate(updateScholarshipSchema), ctrl.updateScholarship);
router.delete('/scholarships/:id', ctrl.deleteScholarship);

// Scholarship Allocations
router.get('/scholarship-allocations', ctrl.listScholarshipAllocations);
router.post('/scholarship-allocations', validate(createScholarshipAllocationSchema), ctrl.createScholarshipAllocation);
router.put('/scholarship-allocations/:id', validate(updateScholarshipAllocationSchema), ctrl.updateScholarshipAllocation);
router.delete('/scholarship-allocations/:id', ctrl.deleteScholarshipAllocation);

// Concessions
router.get('/concessions', ctrl.listConcessions);
router.post('/concessions', validate(createConcessionSchema), ctrl.createConcession);
router.put('/concessions/:id', validate(updateConcessionSchema), ctrl.updateConcession);
router.delete('/concessions/:id', ctrl.deleteConcession);

// Refunds
router.get('/refunds', ctrl.listRefunds);
router.post('/refunds', validate(createRefundSchema), ctrl.createRefund);
router.put('/refunds/:id', validate(updateRefundSchema), ctrl.updateRefund);
router.delete('/refunds/:id', ctrl.deleteRefund);

// Fines & Penalties
router.get('/fines', ctrl.listFinePenalties);
router.post('/fines', validate(createFinePenaltySchema), ctrl.createFinePenalty);
router.put('/fines/:id', validate(updateFinePenaltySchema), ctrl.updateFinePenalty);
router.delete('/fines/:id', ctrl.deleteFinePenalty);

// Invoices
router.get('/invoices', ctrl.listInvoices);
router.get('/invoices/:id', ctrl.getInvoice);
router.post('/invoices', validate(createInvoiceSchema), ctrl.createInvoice);
router.put('/invoices/:id', validate(updateInvoiceSchema), ctrl.updateInvoice);
router.delete('/invoices/:id', ctrl.deleteInvoice);

// Budget
router.get('/budgets', ctrl.listBudgets);
router.get('/budgets/:id', ctrl.getBudget);
router.post('/budgets', validate(createBudgetSchema), ctrl.createBudget);
router.put('/budgets/:id', validate(updateBudgetSchema), ctrl.updateBudget);
router.delete('/budgets/:id', ctrl.deleteBudget);

// Expenses
router.get('/expenses', ctrl.listExpenses);
router.get('/expenses/:id', ctrl.getExpense);
router.post('/expenses', validate(createExpenseSchema), ctrl.createExpense);
router.put('/expenses/:id', validate(updateExpenseSchema), ctrl.updateExpense);
router.delete('/expenses/:id', ctrl.deleteExpense);

// Financial Ledger
router.get('/ledger', ctrl.listFinancialLedger);
router.post('/ledger', validate(createFinancialLedgerSchema), ctrl.createFinancialLedger);
router.put('/ledger/:id', validate(updateFinancialLedgerSchema), ctrl.updateFinancialLedger);
router.delete('/ledger/:id', ctrl.deleteFinancialLedger);

// Payment Gateway Logs
router.get('/gateway-logs', ctrl.listPaymentGatewayLogs);
router.post('/gateway-logs', validate(createPaymentGatewayLogSchema), ctrl.createPaymentGatewayLog);
router.put('/gateway-logs/:id', validate(updatePaymentGatewayLogSchema), ctrl.updatePaymentGatewayLog);
router.delete('/gateway-logs/:id', ctrl.deletePaymentGatewayLog);

// Fee Reminders
router.get('/reminders', ctrl.listFeeReminders);
router.post('/reminders', validate(createFeeReminderSchema), ctrl.createFeeReminder);
router.put('/reminders/:id', validate(updateFeeReminderSchema), ctrl.updateFeeReminder);
router.delete('/reminders/:id', ctrl.deleteFeeReminder);

// Financial Reports
router.get('/reports', ctrl.listFinancialReports);
router.post('/reports', validate(createFinancialReportSchema), ctrl.createFinancialReport);
router.delete('/reports/:id', ctrl.deleteFinancialReport);

export default router;
