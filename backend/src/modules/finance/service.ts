import { FeeStructure } from '../../models/finance/FeeStructure';
import { StudentFeeAccount } from '../../models/finance/StudentFeeAccount';
import { FeeLineItem } from '../../models/finance/FeeLineItem';
import { Payment } from '../../models/finance/Payment';
import { Scholarship } from '../../models/finance/Scholarship';
import { ScholarshipAllocation } from '../../models/finance/ScholarshipAllocation';
import { Concession } from '../../models/finance/Concession';
import { Refund } from '../../models/finance/Refund';
import { FinePenalty } from '../../models/finance/FinePenalty';
import { Invoice } from '../../models/finance/Invoice';
import { Budget } from '../../models/finance/Budget';
import { Expense } from '../../models/finance/Expense';
import { FinancialLedger } from '../../models/finance/FinancialLedger';
import { PaymentGatewayLog } from '../../models/finance/PaymentGatewayLog';
import { FeeReminder } from '../../models/finance/FeeReminder';
import { FinancialReport } from '../../models/finance/FinancialReport';
import { Student } from '../../models/people/Student';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

const STUDENT_POPULATE = { path: 'studentId', populate: { path: 'personId' } };

async function assertStudentFeeGuardianReady(collegeId: string, studentId?: string) {
  if (!studentId) return;

  const student = await Student.findOne({ _id: studentId, collegeId }).lean();
  if (!student) {
    throw new AppError(404, 'Student not found');
  }
  if (!student.feeResponsibleParentId) {
    throw new AppError(400, 'Fee responsible guardian is required before creating finance records for this student');
  }
}

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    feeStructures, studentFeeAccounts, feeLineItems, payments,
    scholarships, concessions, refunds, budgets, expenses, invoices,
    fines, pendingLineItems, overdueLineItems,
  ] = await Promise.all([
    FeeStructure.countDocuments({ collegeId }),
    StudentFeeAccount.countDocuments({ collegeId }),
    FeeLineItem.countDocuments({ collegeId }),
    Payment.countDocuments({ collegeId }),
    Scholarship.countDocuments({ collegeId }),
    Concession.countDocuments({ collegeId }),
    Refund.countDocuments({ collegeId }),
    Budget.countDocuments({ collegeId }),
    Expense.countDocuments({ collegeId }),
    Invoice.countDocuments({ collegeId }),
    FinePenalty.countDocuments({ collegeId }),
    FeeLineItem.countDocuments({ collegeId, status: 'pending' }),
    FeeLineItem.countDocuments({ collegeId, status: 'overdue' }),
  ]);

  // Aggregate totals
  const [collectionAgg] = await Payment.aggregate([
    { $match: { collegeId, status: 'success' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const [pendingAgg] = await FeeLineItem.aggregate([
    { $match: { collegeId, status: { $in: ['pending', 'partial', 'overdue'] } } },
    { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } },
  ]);

  return {
    feeStructures, studentFeeAccounts, feeLineItems, payments,
    scholarships, concessions, refunds, budgets, expenses, invoices, fines,
    pendingLineItems, overdueLineItems,
    totalCollected: collectionAgg?.total || 0,
    totalPending: pendingAgg?.total || 0,
  };
}

// ═══ Fee Structure ════════════════════════════════════════

export async function listFeeStructures(collegeId: string, page = 1, limit = 20, academicYearId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(FeeStructure, filter, page, limit, { createdAt: -1 }, ['academicYearId', 'programmeId', 'branchId']);
}

export async function getFeeStructure(collegeId: string, id: string) {
  const doc = await FeeStructure.findOne({ _id: id, collegeId }).populate('academicYearId programmeId branchId');
  if (!doc) throw new AppError(404, 'Fee structure not found');
  return doc;
}

export async function createFeeStructure(collegeId: string, data: any, who: string) {
  const doc = await FeeStructure.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'FeeStructure', entityId: String(doc._id), entityName: `Fee Structure Y${data.year}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateFeeStructure(collegeId: string, id: string, data: any, who: string) {
  const doc = await FeeStructure.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Fee structure not found');
  await createAuditLog({ collegeId, entityType: 'FeeStructure', entityId: id, entityName: `Fee Structure Y${doc.year}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteFeeStructure(collegeId: string, id: string, who: string) {
  const doc = await FeeStructure.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee structure not found');
  await createAuditLog({ collegeId, entityType: 'FeeStructure', entityId: id, entityName: `Fee Structure Y${doc.year}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Student Fee Account ══════════════════════════════════

export async function listStudentFeeAccounts(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(StudentFeeAccount, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE] as any);
}

export async function getStudentFeeAccount(collegeId: string, id: string) {
  const doc = await StudentFeeAccount.findOne({ _id: id, collegeId }).populate('studentId');
  if (!doc) throw new AppError(404, 'Student fee account not found');
  return doc;
}

export async function createStudentFeeAccount(collegeId: string, data: any, who: string) {
  await assertStudentFeeGuardianReady(collegeId, data.studentId);
  const doc = await StudentFeeAccount.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'StudentFeeAccount', entityId: String(doc._id), entityName: `Fee Account`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateStudentFeeAccount(collegeId: string, id: string, data: any, who: string) {
  const doc = await StudentFeeAccount.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Student fee account not found');
  await createAuditLog({ collegeId, entityType: 'StudentFeeAccount', entityId: id, entityName: `Fee Account`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteStudentFeeAccount(collegeId: string, id: string, who: string) {
  const doc = await StudentFeeAccount.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Student fee account not found');
  await createAuditLog({ collegeId, entityType: 'StudentFeeAccount', entityId: id, entityName: `Fee Account`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Fee Line Items ═══════════════════════════════════════

export async function listFeeLineItems(collegeId: string, page = 1, limit = 20, studentId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(FeeLineItem, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'feeStructureId', 'academicYearId'] as any);
}

export async function getFeeLineItem(collegeId: string, id: string) {
  const doc = await FeeLineItem.findOne({ _id: id, collegeId }).populate('studentId feeStructureId academicYearId');
  if (!doc) throw new AppError(404, 'Fee line item not found');
  return doc;
}

export async function createFeeLineItem(collegeId: string, data: any, who: string) {
  await assertStudentFeeGuardianReady(collegeId, data.studentId);
  const doc = await FeeLineItem.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'FeeLineItem', entityId: String(doc._id), entityName: `${data.component}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateFeeLineItem(collegeId: string, id: string, data: any, who: string) {
  const doc = await FeeLineItem.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Fee line item not found');
  await createAuditLog({ collegeId, entityType: 'FeeLineItem', entityId: id, entityName: doc.component, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteFeeLineItem(collegeId: string, id: string, who: string) {
  const doc = await FeeLineItem.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee line item not found');
  await createAuditLog({ collegeId, entityType: 'FeeLineItem', entityId: id, entityName: doc.component, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Payments ═════════════════════════════════════════════

export async function listPayments(collegeId: string, page = 1, limit = 20, studentId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(Payment, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE] as any);
}

export async function getPayment(collegeId: string, id: string) {
  const doc = await Payment.findOne({ _id: id, collegeId }).populate('studentId collectedBy');
  if (!doc) throw new AppError(404, 'Payment not found');
  return doc;
}

export async function createPayment(collegeId: string, data: any, who: string) {
  await assertStudentFeeGuardianReady(collegeId, data.studentId);
  const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
  const receiptNumber = typeof data.receiptNumber === 'string' && data.receiptNumber.trim().length > 0
    ? data.receiptNumber.trim()
    : await generateReceiptNumber(collegeId, paymentDate);

  const doc = await Payment.create({
    ...data,
    collegeId,
    receiptNumber,
    paymentDate,
  });
  // Update allocated line items
  if (data.allocations?.length) {
    for (const alloc of data.allocations) {
      await FeeLineItem.findByIdAndUpdate(alloc.lineItemId, {
        $inc: { paidAmount: alloc.amount },
      });
      // Update status
      const li = await FeeLineItem.findById(alloc.lineItemId);
      if (li) {
        if (li.paidAmount >= li.amount) li.status = 'paid';
        else if (li.paidAmount > 0) li.status = 'partial';
        await li.save();
      }
    }
  }
  await createAuditLog({ collegeId, entityType: 'Payment', entityId: String(doc._id), entityName: doc.receiptNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePayment(collegeId: string, id: string, data: any, who: string) {
  const doc = await Payment.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Payment not found');
  await createAuditLog({ collegeId, entityType: 'Payment', entityId: id, entityName: doc.receiptNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePayment(collegeId: string, id: string, who: string) {
  const doc = await Payment.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Payment not found');
  await createAuditLog({ collegeId, entityType: 'Payment', entityId: id, entityName: doc.receiptNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}

async function generateReceiptNumber(collegeId: string, paymentDate: Date) {
  const year = paymentDate.getFullYear();
  const prefix = `RCP-${year}-`;
  const latestReceipt = await Payment.findOne({
    collegeId,
    receiptNumber: { $regex: `^${prefix}` },
  }).sort({ receiptNumber: -1 }).select('receiptNumber').lean();

  const latestSequence = latestReceipt?.receiptNumber
    ? Number(latestReceipt.receiptNumber.slice(prefix.length))
    : 0;
  const nextSequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1;

  return `${prefix}${String(nextSequence).padStart(3, '0')}`;
}

// ═══ Scholarships ═════════════════════════════════════════

export async function listScholarships(collegeId: string, page = 1, limit = 20, academicYearId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Scholarship, filter, page, limit, { createdAt: -1 }, ['academicYearId']);
}

export async function getScholarship(collegeId: string, id: string) {
  const doc = await Scholarship.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship not found');
  return doc;
}

export async function createScholarship(collegeId: string, data: any, who: string) {
  const doc = await Scholarship.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Scholarship', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateScholarship(collegeId: string, id: string, data: any, who: string) {
  const doc = await Scholarship.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Scholarship not found');
  await createAuditLog({ collegeId, entityType: 'Scholarship', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteScholarship(collegeId: string, id: string, who: string) {
  const doc = await Scholarship.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship not found');
  await createAuditLog({ collegeId, entityType: 'Scholarship', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Scholarship Allocations ══════════════════════════════

export async function listScholarshipAllocations(collegeId: string, page = 1, limit = 20, scholarshipId?: string, studentId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (scholarshipId) filter.scholarshipId = scholarshipId;
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(ScholarshipAllocation, filter, page, limit, { createdAt: -1 }, ['scholarshipId', STUDENT_POPULATE] as any);
}

export async function createScholarshipAllocation(collegeId: string, data: any, who: string) {
  await assertStudentFeeGuardianReady(collegeId, data.studentId);
  const doc = await ScholarshipAllocation.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ScholarshipAllocation', entityId: String(doc._id), entityName: `Allocation`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateScholarshipAllocation(collegeId: string, id: string, data: any, who: string) {
  const doc = await ScholarshipAllocation.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Scholarship allocation not found');
  await createAuditLog({ collegeId, entityType: 'ScholarshipAllocation', entityId: id, entityName: `Allocation`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteScholarshipAllocation(collegeId: string, id: string, who: string) {
  const doc = await ScholarshipAllocation.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship allocation not found');
  await createAuditLog({ collegeId, entityType: 'ScholarshipAllocation', entityId: id, entityName: `Allocation`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Concessions ══════════════════════════════════════════

export async function listConcessions(collegeId: string, page = 1, limit = 20, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(Concession, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'academicYearId'] as any);
}

export async function createConcession(collegeId: string, data: any, who: string) {
  await assertStudentFeeGuardianReady(collegeId, data.studentId);
  const doc = await Concession.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Concession', entityId: String(doc._id), entityName: data.type, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateConcession(collegeId: string, id: string, data: any, who: string) {
  const doc = await Concession.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Concession not found');
  await createAuditLog({ collegeId, entityType: 'Concession', entityId: id, entityName: doc.type, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteConcession(collegeId: string, id: string, who: string) {
  const doc = await Concession.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Concession not found');
  await createAuditLog({ collegeId, entityType: 'Concession', entityId: id, entityName: doc.type, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Refunds ══════════════════════════════════════════════

export async function listRefunds(collegeId: string, page = 1, limit = 20, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(Refund, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'paymentId'] as any);
}

export async function createRefund(collegeId: string, data: any, who: string) {
  await assertStudentFeeGuardianReady(collegeId, data.studentId);
  const doc = await Refund.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Refund', entityId: String(doc._id), entityName: `Refund ₹${data.amount}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateRefund(collegeId: string, id: string, data: any, who: string) {
  const doc = await Refund.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Refund not found');
  await createAuditLog({ collegeId, entityType: 'Refund', entityId: id, entityName: `Refund ₹${doc.amount}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteRefund(collegeId: string, id: string, who: string) {
  const doc = await Refund.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Refund not found');
  await createAuditLog({ collegeId, entityType: 'Refund', entityId: id, entityName: `Refund ₹${doc.amount}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Fines & Penalties ════════════════════════════════════

export async function listFinePenalties(collegeId: string, page = 1, limit = 20, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(FinePenalty, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE] as any);
}

export async function createFinePenalty(collegeId: string, data: any, who: string) {
  await assertStudentFeeGuardianReady(collegeId, data.studentId);
  const doc = await FinePenalty.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'FinePenalty', entityId: String(doc._id), entityName: data.type, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateFinePenalty(collegeId: string, id: string, data: any, who: string) {
  const doc = await FinePenalty.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Fine/penalty not found');
  await createAuditLog({ collegeId, entityType: 'FinePenalty', entityId: id, entityName: doc.type, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteFinePenalty(collegeId: string, id: string, who: string) {
  const doc = await FinePenalty.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fine/penalty not found');
  await createAuditLog({ collegeId, entityType: 'FinePenalty', entityId: id, entityName: doc.type, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Invoices ═════════════════════════════════════════════

export async function listInvoices(collegeId: string, page = 1, limit = 20, status?: string, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(Invoice, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE] as any);
}

export async function getInvoice(collegeId: string, id: string) {
  const doc = await Invoice.findOne({ _id: id, collegeId }).populate('studentId');
  if (!doc) throw new AppError(404, 'Invoice not found');
  return doc;
}

export async function createInvoice(collegeId: string, data: any, who: string) {
  await assertStudentFeeGuardianReady(collegeId, data.studentId);
  const doc = await Invoice.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Invoice', entityId: String(doc._id), entityName: data.invoiceNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateInvoice(collegeId: string, id: string, data: any, who: string) {
  const doc = await Invoice.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Invoice not found');
  await createAuditLog({ collegeId, entityType: 'Invoice', entityId: id, entityName: doc.invoiceNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteInvoice(collegeId: string, id: string, who: string) {
  const doc = await Invoice.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Invoice not found');
  await createAuditLog({ collegeId, entityType: 'Invoice', entityId: id, entityName: doc.invoiceNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Budget ═══════════════════════════════════════════════

export async function listBudgets(collegeId: string, page = 1, limit = 20, academicYearId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Budget, filter, page, limit, { createdAt: -1 }, ['academicYearId', 'departmentId']);
}

export async function getBudget(collegeId: string, id: string) {
  const doc = await Budget.findOne({ _id: id, collegeId }).populate('academicYearId departmentId');
  if (!doc) throw new AppError(404, 'Budget not found');
  return doc;
}

export async function createBudget(collegeId: string, data: any, who: string) {
  const doc = await Budget.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Budget', entityId: String(doc._id), entityName: data.category, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateBudget(collegeId: string, id: string, data: any, who: string) {
  const doc = await Budget.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Budget not found');
  await createAuditLog({ collegeId, entityType: 'Budget', entityId: id, entityName: doc.category, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteBudget(collegeId: string, id: string, who: string) {
  const doc = await Budget.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Budget not found');
  await createAuditLog({ collegeId, entityType: 'Budget', entityId: id, entityName: doc.category, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Expenses ═════════════════════════════════════════════

export async function listExpenses(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Expense, filter, page, limit, { createdAt: -1 }, ['budgetId']);
}

export async function getExpense(collegeId: string, id: string) {
  const doc = await Expense.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Expense not found');
  return doc;
}

export async function createExpense(collegeId: string, data: any, who: string) {
  const doc = await Expense.create({ ...data, collegeId });
  // Update budget spent amount if linked
  if (data.budgetId) {
    await Budget.findByIdAndUpdate(data.budgetId, { $inc: { spentAmount: data.amount } });
  }
  await createAuditLog({ collegeId, entityType: 'Expense', entityId: String(doc._id), entityName: data.description, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateExpense(collegeId: string, id: string, data: any, who: string) {
  const doc = await Expense.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Expense not found');
  await createAuditLog({ collegeId, entityType: 'Expense', entityId: id, entityName: doc.description, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteExpense(collegeId: string, id: string, who: string) {
  const doc = await Expense.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Expense not found');
  await createAuditLog({ collegeId, entityType: 'Expense', entityId: id, entityName: doc.description, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Financial Ledger ═════════════════════════════════════

export async function listFinancialLedger(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(FinancialLedger, filter, page, limit, { entryDate: -1 });
}

export async function createFinancialLedger(collegeId: string, data: any, who: string) {
  const doc = await FinancialLedger.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'FinancialLedger', entityId: String(doc._id), entityName: data.description, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateFinancialLedger(collegeId: string, id: string, data: any, who: string) {
  const doc = await FinancialLedger.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Ledger entry not found');
  await createAuditLog({ collegeId, entityType: 'FinancialLedger', entityId: id, entityName: doc.description, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteFinancialLedger(collegeId: string, id: string, who: string) {
  const doc = await FinancialLedger.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Ledger entry not found');
  await createAuditLog({ collegeId, entityType: 'FinancialLedger', entityId: id, entityName: doc.description, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Payment Gateway Log ══════════════════════════════════

export async function listPaymentGatewayLogs(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PaymentGatewayLog, filter, page, limit);
}

export async function createPaymentGatewayLog(collegeId: string, data: any, who: string) {
  const doc = await PaymentGatewayLog.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PaymentGatewayLog', entityId: String(doc._id), entityName: data.orderId, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePaymentGatewayLog(collegeId: string, id: string, data: any, who: string) {
  const doc = await PaymentGatewayLog.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Gateway log not found');
  await createAuditLog({ collegeId, entityType: 'PaymentGatewayLog', entityId: id, entityName: doc.orderId, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePaymentGatewayLog(collegeId: string, id: string, who: string) {
  const doc = await PaymentGatewayLog.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Gateway log not found');
  await createAuditLog({ collegeId, entityType: 'PaymentGatewayLog', entityId: id, entityName: doc.orderId, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Fee Reminders ════════════════════════════════════════

export async function listFeeReminders(collegeId: string, page = 1, limit = 20, studentId?: string, channel?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (channel) filter.channel = channel;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(FeeReminder, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE] as any);
}

export async function createFeeReminder(collegeId: string, data: any, who: string) {
  await assertStudentFeeGuardianReady(collegeId, data.studentId);
  const doc = await FeeReminder.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'FeeReminder', entityId: String(doc._id), entityName: data.channel, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateFeeReminder(collegeId: string, id: string, data: any, who: string) {
  const doc = await FeeReminder.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Fee reminder not found');
  await createAuditLog({ collegeId, entityType: 'FeeReminder', entityId: id, entityName: doc.channel, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteFeeReminder(collegeId: string, id: string, who: string) {
  const doc = await FeeReminder.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee reminder not found');
  await createAuditLog({ collegeId, entityType: 'FeeReminder', entityId: id, entityName: doc.channel, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Financial Reports ════════════════════════════════════

export async function listFinancialReports(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(FinancialReport, filter, page, limit, { generatedAt: -1 });
}

export async function createFinancialReport(collegeId: string, data: any, who: string) {
  const doc = await FinancialReport.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'FinancialReport', entityId: String(doc._id), entityName: data.reportType, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function deleteFinancialReport(collegeId: string, id: string, who: string) {
  const doc = await FinancialReport.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Report not found');
  await createAuditLog({ collegeId, entityType: 'FinancialReport', entityId: id, entityName: doc.reportType, action: 'delete', changes: [], performedBy: who });
  return doc;
}
