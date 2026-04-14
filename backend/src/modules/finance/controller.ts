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

// ═══ W03 Phase 4: Scholarship & Concession Workflow Controllers ═══════════════

// W03-L2-026
export async function verifyScholarshipEligibilityBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.body as { academicYearId: string };
    res.json(await service.verifyScholarshipEligibilityBatch(req.collegeId!, academicYearId, who(req)));
  } catch (err) { next(err); }
}

// W03-L2-027
export async function submitScholarshipClaimsBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { schemeCode, academicYearId } = req.body as { schemeCode: string; academicYearId: string };
    res.json(await service.submitScholarshipClaimsBatch(req.collegeId!, schemeCode, academicYearId, who(req)));
  } catch (err) { next(err); }
}

// W03-L2-028
export async function pollScholarshipClaimStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.body as { academicYearId: string };
    res.json(await service.pollScholarshipClaimStatus(req.collegeId!, academicYearId, who(req)));
  } catch (err) { next(err); }
}

// W03-L2-029
export async function processScholarshipDisbursement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { scholarshipClaimId, disbursedAmount } = req.body as { scholarshipClaimId: string; disbursedAmount: number };
    res.json(await service.processScholarshipDisbursement(req.collegeId!, scholarshipClaimId, disbursedAmount, who(req)));
  } catch (err) { next(err); }
}

// W03-L2-030
export async function convertReceivableToLiability(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(await service.convertReceivableToLiability(req.collegeId!, req.params.id as string, who(req)));
  } catch (err) { next(err); }
}

// W03-L2-031
export async function processHardshipConcession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { studentId, recommendedRelief, welfareReferralId, approvedBy } = req.body as {
      studentId: string;
      recommendedRelief: number;
      welfareReferralId?: string;
      approvedBy: string;
    };
    res.status(201).json(await service.processHardshipConcession(req.collegeId!, studentId, recommendedRelief, welfareReferralId, approvedBy, who(req)));
  } catch (err) { next(err); }
}

// W03-L2-032
export async function applyMeritScholarshipBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId, minCGPA, amount, maxRecipients } = req.body as {
      academicYearId: string;
      minCGPA: number;
      amount: number;
      maxRecipients: number;
    };
    res.json(await service.applyMeritScholarshipBatch(req.collegeId!, academicYearId, minCGPA, amount, maxRecipients, who(req)));
  } catch (err) { next(err); }
}

// W03-L2-033
export async function detectStaffWardConcession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.body as { academicYearId: string };
    res.json(await service.detectStaffWardConcession(req.collegeId!, academicYearId, who(req)));
  } catch (err) { next(err); }
}

// W03-L2-034
export async function renewScholarshipsBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.body as { academicYearId: string };
    res.json(await service.renewScholarshipsBatch(req.collegeId!, academicYearId, who(req)));
  } catch (err) { next(err); }
}

// ═══ ScholarshipEligibility CRUD ═════════════════════════════

export async function listScholarshipEligibilities(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, academicYearId, status } = req.query as any;
    res.json(await service.listScholarshipEligibilities(req.collegeId!, Number(page) || 1, Number(limit) || 20, academicYearId, status));
  } catch (err) { next(err); }
}

export async function getScholarshipEligibility(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getScholarshipEligibility(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createScholarshipEligibility(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createScholarshipEligibility(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateScholarshipEligibility(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateScholarshipEligibility(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteScholarshipEligibility(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteScholarshipEligibility(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ ScholarshipClaim CRUD ════════════════════════════════════

export async function listScholarshipClaims(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, academicYearId, status } = req.query as any;
    res.json(await service.listScholarshipClaims(req.collegeId!, Number(page) || 1, Number(limit) || 20, academicYearId, status));
  } catch (err) { next(err); }
}

export async function getScholarshipClaim(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getScholarshipClaim(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createScholarshipClaim(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createScholarshipClaim(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateScholarshipClaim(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateScholarshipClaim(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteScholarshipClaim(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteScholarshipClaim(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ ScholarshipReceivable CRUD ═══════════════════════════════

export async function listScholarshipReceivables(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listScholarshipReceivables(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}

export async function getScholarshipReceivable(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getScholarshipReceivable(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createScholarshipReceivable(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createScholarshipReceivable(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateScholarshipReceivable(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateScholarshipReceivable(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteScholarshipReceivable(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteScholarshipReceivable(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ ScholarshipCredit CRUD ═══════════════════════════════════

export async function listScholarshipCredits(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId } = req.query as any;
    res.json(await service.listScholarshipCredits(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId));
  } catch (err) { next(err); }
}

export async function getScholarshipCredit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getScholarshipCredit(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createScholarshipCredit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createScholarshipCredit(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateScholarshipCredit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateScholarshipCredit(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteScholarshipCredit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteScholarshipCredit(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03 Phase 5: Defaulter Management ════════════════════════

export async function identifyDefaulters(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.identifyDefaulters(req.collegeId!, who(req))); } catch (err) { next(err); }
}

export async function processEscalations(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.processEscalations(req.collegeId!, who(req))); } catch (err) { next(err); }
}

export async function computeDistressScore(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.computeDistressScore(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function referToWelfare(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.referToWelfare(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function processWelfareOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { outcome, m06CaseId } = req.body as { outcome: 'genuine_hardship' | 'no_distress' | 'inconclusive'; m06CaseId?: string };
    res.json(await service.processWelfareOutcome(req.collegeId!, req.params.id as string, outcome, m06CaseId, who(req)));
  } catch (err) { next(err); }
}

export async function recommendHolds(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.recommendHolds(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

export async function applyFinancialHold(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { studentId, defaulterRecordId, holdType, approvedBy } = req.body as { studentId: string; defaulterRecordId: string; holdType: 'exam_debarment' | 'hostel_restriction' | 'transcript_hold' | 'full_clearance_block'; approvedBy: string };
    res.status(201).json(await service.applyFinancialHold(req.collegeId!, studentId, defaulterRecordId, holdType, approvedBy, who(req)));
  } catch (err) { next(err); }
}

export async function checkFinancialHolds(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.checkFinancialHolds(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}

export async function releaseFinancialHold(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as { reason: string };
    res.json(await service.releaseFinancialHold(req.collegeId!, req.params.id as string, reason, who(req)));
  } catch (err) { next(err); }
}

export async function resolveDefaulter(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { resolutionType } = req.body as { resolutionType: 'payment' | 'write_off' | 'concession' | 'other' };
    res.json(await service.resolveDefaulter(req.collegeId!, req.params.id as string, resolutionType, who(req)));
  } catch (err) { next(err); }
}

export async function logPhoneFollowUp(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { outcome, notes } = req.body as { outcome: string; notes?: string };
    res.status(201).json(await service.logPhoneFollowUp(req.collegeId!, req.params.id as string, outcome, notes, who(req)));
  } catch (err) { next(err); }
}

// ─── DefaulterRecord CRUD ─────────────────────────────────────

export async function listDefaulterRecords(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, escalationStage } = req.query as { page?: string; limit?: string; escalationStage?: string };
    res.json(await service.listDefaulterRecords(req.collegeId!, Number(page) || 1, Number(limit) || 20, escalationStage));
  } catch (err) { next(err); }
}

export async function getDefaulterRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getDefaulterRecord(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createDefaulterRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createDefaulterRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateDefaulterRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateDefaulterRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteDefaulterRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteDefaulterRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── EscalationAction CRUD ────────────────────────────────────

export async function listEscalationActions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    res.json(await service.listEscalationActions(req.collegeId!, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}

export async function getEscalationAction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getEscalationAction(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createEscalationAction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEscalationAction(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateEscalationAction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEscalationAction(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteEscalationAction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEscalationAction(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── FinancialHold CRUD ───────────────────────────────────────

export async function listFinancialHolds(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, studentId, holdStatus } = req.query as { page?: string; limit?: string; studentId?: string; holdStatus?: string };
    res.json(await service.listFinancialHolds(req.collegeId!, Number(page) || 1, Number(limit) || 20, studentId, holdStatus));
  } catch (err) { next(err); }
}

export async function getFinancialHold(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFinancialHold(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function updateFinancialHold(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFinancialHold(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteFinancialHold(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFinancialHold(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── WelfareReferral CRUD ─────────────────────────────────────

export async function listWelfareReferrals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as { page?: string; limit?: string };
    res.json(await service.listWelfareReferrals(req.collegeId!, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}

export async function getWelfareReferral(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getWelfareReferral(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createWelfareReferral(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createWelfareReferral(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

export async function updateWelfareReferral(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateWelfareReferral(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

export async function deleteWelfareReferral(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteWelfareReferral(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W03 Phase 7: Cross-Module Integration & Events ═════════

export async function syncStudentStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.syncStudentFinancialStatus(req.collegeId!, req.body.studentId, who(req));
    res.json(result);
  } catch (e) { next(e); }
}

export async function getFinancialClearance(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.checkFinancialClearance(req.collegeId!, req.params.studentId as string);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getDistressSignals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.feedDistressSignals(req.collegeId!, req.params.defaulterRecordId as string);
    res.json(result);
  } catch (e) { next(e); }
}

export async function submitIndependentHardship(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.receiveIndependentHardship(req.collegeId!, req.body, who(req));
    res.status(201).json(result);
  } catch (e) { next(e); }
}

export async function revenueDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.query as { academicYearId?: string };
    const result = await service.getRevenueDashboard(req.collegeId!, academicYearId);
    res.json(result);
  } catch (e) { next(e); }
}

export async function defaulterTrendAnalysis(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { months } = req.query as { months?: string };
    const result = await service.getDefaulterTrendAnalysis(req.collegeId!, months ? Number(months) : undefined);
    res.json(result);
  } catch (e) { next(e); }
}

export async function feePolicy(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.consumeFeePolicy(req.collegeId!);
    res.json(result);
  } catch (e) { next(e); }
}

export async function initiateGatewayPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.orchestrateGatewayPayment(req.collegeId!, req.body, who(req));
    res.json(result);
  } catch (e) { next(e); }
}

export async function submitTSEPassClaims(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.orchestrateTSEPassIntegration(req.collegeId!, req.body, who(req));
    res.json(result);
  } catch (e) { next(e); }
}

export async function triggerReminderSequence(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.executeReminderSequence(req.collegeId!, req.body.defaulterRecordId, who(req));
    res.json(result);
  } catch (e) { next(e); }
}

// ═══ W03 Fee Lifecycle & Revenue Assurance ══════════════════

import * as feeLifecycleService from './fee-lifecycle-service';

// ── Fee Configuration ──────────────────────────────────────

export async function cloneFeeStructureCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.cloneFeeStructure(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function submitFeeStructureCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.submitFeeStructure(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}
export async function approveFeeStructureCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.approveFeeStructure(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function evaluateFeeRulesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.evaluateFeeComponentRules(req.collegeId!, req.body)); } catch (e) { next(e); }
}

// ── Invoice Generation ─────────────────────────────────────

export async function generateSemesterInvoiceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.generateSemesterInvoice(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function generateBatchInvoicesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.generateBatchInvoices(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function generateExamFeeInvoiceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.generateExamFeeInvoice(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function adjustInvoiceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.adjustInvoice(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function disputeInvoiceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.disputeInvoice(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function writeOffInvoiceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.writeOffInvoice(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ── Payment Processing ─────────────────────────────────────

export async function recordOnlinePaymentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.recordOnlinePayment(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function recordCounterPaymentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.recordCounterPayment(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function importBankStatementCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.importBankStatement(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function matchPaymentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.matchPaymentToInvoice(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function detectDuplicateCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.detectDuplicatePayment(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function handleBounceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.handleBounce(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ── Receipts ───────────────────────────────────────────────

export async function generateReceiptCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.generateReceipt(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function cancelReceiptCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.cancelReceipt(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function reissueReceiptCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.reissueReceipt(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ── Reconciliation ─────────────────────────────────────────

export async function runReconciliationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.runReconciliation(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function resolveDiscrepancyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.resolveDiscrepancy(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ── Refunds ────────────────────────────────────────────────

export async function requestRefundCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.requestRefund(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function approveRefundCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.approveRefund(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function processRefundCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.processRefund(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ── Scholarships & Concessions ─────────────────────────────

export async function verifyScholarshipEligibilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.verifyScholarshipEligibility(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function submitClaimBatchCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.submitScholarshipClaimBatch(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function processDisbursementCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.processScholarshipDisbursement(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function applyHardshipConcessionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.applyHardshipConcession(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function applyMeritScholarshipCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.applyMeritScholarship(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function renewScholarshipCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.renewScholarshipEligibility(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

// ── Defaulter Management ───────────────────────────────────

export async function identifyDefaultersCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.identifyDefaulters(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function escalateDefaulterCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.escalateDefaulter(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function computeDistressCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.computeDistressScore(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function referToWelfareCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.referToWelfare(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function applyHoldCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.applyFinancialHold(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function releaseHoldCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.releaseFinancialHold(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ── Financial Clearance ────────────────────────────────────

export async function checkFinancialClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.checkFinancialClearance(req.collegeId!, req.params.studentId as string)); } catch (e) { next(e); }
}

// ── Vendor Payments ────────────────────────────────────────

export async function scheduleVendorPaymentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.scheduleVendorPayment(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function confirmVendorPaymentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await feeLifecycleService.confirmVendorPayment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ── Revenue Reports ────────────────────────────────────────

export async function generateRevenueReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await feeLifecycleService.generateRevenueReport(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
