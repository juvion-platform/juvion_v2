import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Fee Structure ════════════════════════════════════════

export async function listFeeStructures(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, academicYearId } = req.query as any;
    res.json(await service.listFeeStructures(req.collegeId!, Number(page) || 1, Number(limit) || 20, academicYearId));
  } catch (err) { next(err); }
}
export async function getFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFeeStructure(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFeeStructure(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFeeStructure(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFeeStructure(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Student Fee Account ══════════════════════════════════

export async function listStudentFeeAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listStudentFeeAccounts(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getStudentFeeAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStudentFeeAccount(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createStudentFeeAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createStudentFeeAccount(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateStudentFeeAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateStudentFeeAccount(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteStudentFeeAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteStudentFeeAccount(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Fee Line Items ═══════════════════════════════════════

export async function listFeeLineItems(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, status } = req.query as any;
    res.json(await service.listFeeLineItems(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, status));
  } catch (err) { next(err); }
}
export async function getFeeLineItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFeeLineItem(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createFeeLineItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFeeLineItem(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFeeLineItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFeeLineItem(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFeeLineItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFeeLineItem(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Payments ═════════════════════════════════════════════

export async function listPayments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, status } = req.query as any;
    res.json(await service.listPayments(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, status));
  } catch (err) { next(err); }
}
export async function getPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPayment(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPayment(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePayment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePayment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePayment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePayment(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Scholarships ═════════════════════════════════════════

export async function listScholarships(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, academicYearId } = req.query as any;
    res.json(await service.listScholarships(req.collegeId!, Number(page) || 1, Number(limit) || 20, academicYearId));
  } catch (err) { next(err); }
}
export async function getScholarship(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getScholarship(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createScholarship(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createScholarship(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateScholarship(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateScholarship(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteScholarship(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteScholarship(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Scholarship Allocations ══════════════════════════════

export async function listScholarshipAllocations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, scholarshipId, studentId, status } = req.query as any;
    res.json(await service.listScholarshipAllocations(req.collegeId!, Number(page) || 1, Number(limit) || 20, scholarshipId, studentId, status));
  } catch (err) { next(err); }
}
export async function createScholarshipAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createScholarshipAllocation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateScholarshipAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateScholarshipAllocation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteScholarshipAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteScholarshipAllocation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Concessions ══════════════════════════════════════════

export async function listConcessions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId } = req.query as any;
    res.json(await service.listConcessions(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId));
  } catch (err) { next(err); }
}
export async function createConcession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createConcession(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateConcession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateConcession(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteConcession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteConcession(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Refunds ══════════════════════════════════════════════

export async function listRefunds(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId } = req.query as any;
    res.json(await service.listRefunds(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId));
  } catch (err) { next(err); }
}
export async function createRefund(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createRefund(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRefund(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateRefund(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRefund(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteRefund(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Fines & Penalties ════════════════════════════════════

export async function listFinePenalties(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId } = req.query as any;
    res.json(await service.listFinePenalties(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId));
  } catch (err) { next(err); }
}
export async function createFinePenalty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFinePenalty(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFinePenalty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFinePenalty(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFinePenalty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFinePenalty(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Invoices ═════════════════════════════════════════════

export async function listInvoices(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status, studentId } = req.query as any;
    res.json(await service.listInvoices(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, studentId));
  } catch (err) { next(err); }
}
export async function getInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getInvoice(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createInvoice(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateInvoice(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteInvoice(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Budget ═══════════════════════════════════════════════

export async function listBudgets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, academicYearId } = req.query as any;
    res.json(await service.listBudgets(req.collegeId!, Number(page) || 1, Number(limit) || 20, academicYearId));
  } catch (err) { next(err); }
}
export async function getBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getBudget(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createBudget(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateBudget(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteBudget(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteBudget(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Expenses ═════════════════════════════════════════════

export async function listExpenses(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listExpenses(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getExpense(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getExpense(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createExpense(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createExpense(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateExpense(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateExpense(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteExpense(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteExpense(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Financial Ledger ═════════════════════════════════════

export async function listFinancialLedger(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listFinancialLedger(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function createFinancialLedger(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFinancialLedger(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFinancialLedger(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFinancialLedger(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFinancialLedger(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFinancialLedger(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Payment Gateway Log ══════════════════════════════════

export async function listPaymentGatewayLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listPaymentGatewayLogs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function createPaymentGatewayLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPaymentGatewayLog(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePaymentGatewayLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePaymentGatewayLog(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePaymentGatewayLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePaymentGatewayLog(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Fee Reminders ════════════════════════════════════════

export async function listFeeReminders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, channel, status } = req.query as any;
    res.json(await service.listFeeReminders(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, channel, status));
  } catch (err) { next(err); }
}
export async function createFeeReminder(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFeeReminder(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFeeReminder(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFeeReminder(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFeeReminder(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFeeReminder(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Financial Reports ════════════════════════════════════

export async function listFinancialReports(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listFinancialReports(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function createFinancialReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFinancialReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFinancialReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFinancialReport(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
