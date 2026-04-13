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
    res.json(await service.listFeeStructures(req.collegeId!, Number(page) || 1, Number(limit) || 20, academicYearId, req.authScope));
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
  try { res.json(await service.listStudentFeeAccounts(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
    res.json(await service.listFeeLineItems(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, status, req.authScope));
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
    res.json(await service.listPayments(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, status, req.authScope));
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
    res.json(await service.listScholarships(req.collegeId!, Number(page) || 1, Number(limit) || 20, academicYearId, req.authScope));
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
    res.json(await service.listScholarshipAllocations(req.collegeId!, Number(page) || 1, Number(limit) || 20, scholarshipId, studentId, status, req.authScope));
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
    res.json(await service.listConcessions(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, req.authScope));
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
    res.json(await service.listRefunds(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, req.authScope));
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
    res.json(await service.listFinePenalties(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, req.authScope));
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
    res.json(await service.listInvoices(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, studentId, req.authScope));
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
    res.json(await service.listBudgets(req.collegeId!, Number(page) || 1, Number(limit) || 20, academicYearId, req.authScope));
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
    res.json(await service.listExpenses(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
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
  try { res.json(await service.listFinancialLedger(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listPaymentGatewayLogs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
    res.json(await service.listFeeReminders(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, channel, status, req.authScope));
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
  try { res.json(await service.listFinancialReports(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
}
export async function createFinancialReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFinancialReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFinancialReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFinancialReport(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: Fee Structure Instance ══════════════════════════

export async function listFeeStructureInstances(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, academicYearId, status } = req.query as any;
    res.json(await service.listFeeStructureInstances(req.collegeId!, Number(page) || 1, Number(limit) || 20, academicYearId, status));
  } catch (err) { next(err); }
}

export async function getFeeStructureInstance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFeeStructureInstance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createFeeStructureInstance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFeeStructureInstance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function cloneFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { sourceInstanceId, newAcademicYearId } = req.body;
    res.status(201).json(await service.cloneFeeStructure(req.collegeId!, sourceInstanceId, newAcademicYearId, who(req)));
  } catch (err) { next(err); }
}

export async function submitFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.submitFeeStructure(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function approveFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.approveFeeStructure(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function activateFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.activateFeeStructure(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function rejectFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { comments } = req.body;
    res.json(await service.rejectFeeStructure(req.collegeId!, req.params.id as string, comments, who(req)));
  } catch (err) { next(err); }
}

export async function archiveFeeStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.archiveFeeStructure(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function getFeeStructureComparison(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFeeStructureComparison(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function getFeeStructureRevenueProjection(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFeeStructureRevenueProjection(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// ═══ W03: Fee Components ══════════════════════════════════

export async function listFeeComponents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { feeStructureInstanceId, page, limit } = req.query as any;
    res.json(await service.listFeeComponents(req.collegeId!, feeStructureInstanceId, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}

export async function getFeeComponent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFeeComponent(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createFeeComponent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFeeComponent(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateFeeComponent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFeeComponent(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteFeeComponent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFeeComponent(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: Fee Component Rules ═════════════════════════════

export async function listFeeComponentRules(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { feeComponentId, page, limit } = req.query as any;
    res.json(await service.listFeeComponentRules(req.collegeId!, feeComponentId, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}

export async function createFeeComponentRule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFeeComponentRule(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateFeeComponentRule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFeeComponentRule(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteFeeComponentRule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFeeComponentRule(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: Fee Rules Engine ════════════════════════════════

export async function evaluateFeeRules(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { feeStructureInstanceId, studentProfile } = req.body;
    res.json(await service.evaluateFeeRules(req.collegeId!, feeStructureInstanceId, studentProfile));
  } catch (err) { next(err); }
}

export async function testFeeRulesWithProfiles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { feeStructureInstanceId, profiles } = req.body;
    res.json(await service.testFeeRulesWithProfiles(req.collegeId!, feeStructureInstanceId, profiles));
  } catch (err) { next(err); }
}

// ═══ W03: Invoice Batch Generation ════════════════════════

export async function generateSemesterInvoiceBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { semesterId, academicYearId } = req.body;
    res.status(201).json(await service.generateSemesterInvoiceBatch(req.collegeId!, semesterId, academicYearId, who(req)));
  } catch (err) { next(err); }
}

export async function generateEnrolmentInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { studentId, feeStructureInstanceId, firstPaymentAmount = 0 } = req.body;
    res.status(201).json(await service.generateEnrolmentInvoice(req.collegeId!, studentId, feeStructureInstanceId, firstPaymentAmount, who(req)));
  } catch (err) { next(err); }
}

export async function generateExamFeeInvoiceBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { semesterId, examType, feeAmount, studentIds } = req.body;
    res.status(201).json(await service.generateExamFeeInvoiceBatch(req.collegeId!, semesterId, examType, feeAmount, studentIds, who(req)));
  } catch (err) { next(err); }
}

export async function generateAdHocInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { studentId, items, dueDate, description } = req.body;
    res.status(201).json(await service.generateAdHocInvoice(req.collegeId!, studentId, items, new Date(dueDate), description, who(req)));
  } catch (err) { next(err); }
}

// ═══ W03: Invoice Actions ═════════════════════════════════

export async function adjustInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { adjustments, reason } = req.body;
    res.json(await service.adjustInvoice(req.collegeId!, req.params.id as string, adjustments, reason, who(req)));
  } catch (err) { next(err); }
}

export async function disputeInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { disputeReason } = req.body;
    res.json(await service.disputeInvoice(req.collegeId!, req.params.id as string, disputeReason, who(req)));
  } catch (err) { next(err); }
}

export async function confirmInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await service.confirmInvoice(req.collegeId!, req.params.id as string, who(req)));
  } catch (err) { next(err); }
}

export async function writeOffInvoice(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { approvedBy, reason } = req.body;
    res.json(await service.writeOffInvoice(req.collegeId!, req.params.id as string, approvedBy, reason, who(req)));
  } catch (err) { next(err); }
}

export async function detectSiblingDiscount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.body;
    res.status(201).json(await service.detectSiblingDiscount(req.collegeId!, academicYearId, who(req)));
  } catch (err) { next(err); }
}

// ═══ W03: Fee Agreements ══════════════════════════════════

export async function listFeeAgreements(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await service.listFeeAgreements(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope));
  } catch (err) { next(err); }
}

export async function getFeeAgreement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFeeAgreement(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createFeeAgreement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFeeAgreement(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateFeeAgreement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFeeAgreement(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteFeeAgreement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFeeAgreement(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: Payment Plans ═══════════════════════════════════

export async function listPaymentPlans(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await service.listPaymentPlans(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope));
  } catch (err) { next(err); }
}

export async function getPaymentPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPaymentPlan(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createPaymentPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPaymentPlan(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updatePaymentPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePaymentPlan(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deletePaymentPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePaymentPlan(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: Invoice Line Items ══════════════════════════════

export async function listInvoiceLineItems(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { invoiceId, page, limit } = req.query as any;
    res.json(await service.listInvoiceLineItems(req.collegeId!, invoiceId, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}

export async function getInvoiceLineItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getInvoiceLineItem(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createInvoiceLineItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createInvoiceLineItem(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateInvoiceLineItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateInvoiceLineItem(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteInvoiceLineItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteInvoiceLineItem(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: Payment Collection ═════════════════════════════════

export async function processGatewayWebhook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { orderId, amount, transactionRef, gatewayResponse } = req.body;
    res.json(await service.processGatewayWebhook(req.collegeId!, orderId, amount, transactionRef, gatewayResponse ?? {}, who(req)));
  } catch (err) { next(err); }
}

export async function recordCounterPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { invoiceId, studentId, amount, paymentMode, ddNumber, ddBank, ddDate, collectedBy } = req.body;
    const ddDateParsed = ddDate ? new Date(ddDate as string) : undefined;
    res.status(201).json(await service.recordCounterPayment(req.collegeId!, invoiceId, studentId, amount, paymentMode, ddNumber, ddBank, ddDateParsed, collectedBy, who(req)));
  } catch (err) { next(err); }
}

export async function importBankStatement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { entries } = req.body;
    const parsed = (entries as Array<{ bankRef: string; amount: number; senderName?: string; creditDate: string }>).map(e => ({
      bankRef: e.bankRef,
      amount: e.amount,
      senderName: e.senderName ?? '',
      creditDate: new Date(e.creditDate),
    }));
    res.json(await service.importBankStatement(req.collegeId!, parsed, who(req)));
  } catch (err) { next(err); }
}

export async function manualMatchPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { invoiceId } = req.body;
    res.json(await service.manualMatchPayment(req.collegeId!, req.params.id as string, invoiceId, who(req)));
  } catch (err) { next(err); }
}

// ═══ W03: Reconciliation ═════════════════════════════════════

export async function runReconciliation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.runReconciliation(req.collegeId!, who(req))); } catch (err) { next(err); }
}

export async function getReconciliationStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getReconciliationStatus(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ W03: Receipt Management ═════════════════════════════════

export async function reissueReceipt(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { channel } = req.body;
    res.status(201).json(await service.reissueReceipt(req.collegeId!, req.params.id as string, channel ?? 'email', who(req)));
  } catch (err) { next(err); }
}

export async function cancelReceipt(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.cancelReceipt(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: Duplicate / Bounce / Overpayment / Refund ══════════

export async function flagDuplicatePayment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.flagDuplicatePayment(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function recordPaymentBounce(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { reason, penaltyAmount } = req.body;
    res.json(await service.recordPaymentBounce(req.collegeId!, req.params.id as string, reason, penaltyAmount ?? 0, who(req)));
  } catch (err) { next(err); }
}

export async function resolveOverpayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { resolution } = req.body;
    res.json(await service.resolveOverpayment(req.collegeId!, req.params.id as string, resolution, who(req)));
  } catch (err) { next(err); }
}

export async function approveRefund(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.approveRefund(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function executeRefund(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { refundTransactionRef } = req.body;
    res.json(await service.executeRefund(req.collegeId!, req.params.id as string, refundTransactionRef, who(req)));
  } catch (err) { next(err); }
}

// ═══ W03: PaymentTransaction CRUD ════════════════════════════

export async function listPaymentTransactions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, invoiceId, reconciliationStatus } = req.query as any;
    res.json(await service.listPaymentTransactions(req.collegeId!, Number(page) || 1, Number(limit) || 20, invoiceId, reconciliationStatus));
  } catch (err) { next(err); }
}

export async function getPaymentTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPaymentTransaction(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createPaymentTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPaymentTransaction(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updatePaymentTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePaymentTransaction(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deletePaymentTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePaymentTransaction(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: Receipt CRUD ═══════════════════════════════════════

export async function listReceipts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, status } = req.query as any;
    res.json(await service.listReceipts(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, status));
  } catch (err) { next(err); }
}

export async function getReceipt(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getReceipt(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createReceipt(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createReceiptRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateReceipt(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateReceiptRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteReceipt(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteReceiptRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: ReconciliationEntry CRUD ═══════════════════════════

export async function listReconciliationEntries(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listReconciliationEntries(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}

export async function getReconciliationEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getReconciliationEntry(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createReconciliationEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createReconciliationEntry(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateReconciliationEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateReconciliationEntry(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteReconciliationEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteReconciliationEntry(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: BounceRecord CRUD ══════════════════════════════════

export async function listBounceRecords(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, invoiceId } = req.query as any;
    res.json(await service.listBounceRecords(req.collegeId!, Number(page) || 1, Number(limit) || 20, invoiceId));
  } catch (err) { next(err); }
}

export async function getBounceRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getBounceRecord(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createBounceRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createBounceRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateBounceRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateBounceRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteBounceRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteBounceRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03: OverpaymentRecord CRUD ═════════════════════════════

export async function listOverpaymentRecords(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, resolution } = req.query as any;
    res.json(await service.listOverpaymentRecords(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, resolution));
  } catch (err) { next(err); }
}

export async function getOverpaymentRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getOverpaymentRecord(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createOverpaymentRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createOverpaymentRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateOverpaymentRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateOverpaymentRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteOverpaymentRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteOverpaymentRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
