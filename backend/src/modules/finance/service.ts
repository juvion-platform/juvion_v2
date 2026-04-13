import { FeeStructure } from '../../models/finance/FeeStructure';
import { FeeStructureInstance } from '../../models/finance/FeeStructureInstance';
import { FeeComponent } from '../../models/finance/FeeComponent';
import { FeeComponentRule } from '../../models/finance/FeeComponentRule';
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
import { FeeAgreement } from '../../models/finance/FeeAgreement';
import { PaymentPlan } from '../../models/finance/PaymentPlan';
import { InvoiceLineItem } from '../../models/finance/InvoiceLineItem';
import { Student } from '../../models/people/Student';
import { Enrollment } from '../../models/academic-ops/Enrollment';
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

// ═══ Fee Structure Instance Lifecycle ════════════════════

export async function listFeeStructureInstances(collegeId: string, page = 1, limit = 20, academicYearId?: string, status?: string) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  if (status) filter.status = status;
  return paginate(FeeStructureInstance, filter, page, limit, { createdAt: -1 }, ['academicYearId', 'programmeId', 'branchId']);
}

export async function getFeeStructureInstance(collegeId: string, id: string) {
  const doc = await FeeStructureInstance.findOne({ _id: id, collegeId }).populate('academicYearId programmeId branchId priorVersionId');
  if (!doc) throw new AppError(404, 'Fee structure instance not found');
  return doc;
}

export async function createFeeStructureInstance(collegeId: string, data: any, who: string) {
  const doc = await FeeStructureInstance.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'FeeStructureInstance', entityId: String(doc._id), entityName: `Fee Structure Instance`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function cloneFeeStructure(collegeId: string, sourceInstanceId: string, newAcademicYearId: string, who: string) {
  const source = await FeeStructureInstance.findOne({ _id: sourceInstanceId, collegeId });
  if (!source) throw new AppError(404, 'Source fee structure instance not found');

  const sourceComponents = await FeeComponent.find({ feeStructureInstanceId: sourceInstanceId, collegeId });
  const sourceComponentIds = sourceComponents.map(c => String(c._id));
  const sourceRules = await FeeComponentRule.find({ feeComponentId: { $in: sourceComponentIds }, collegeId });

  const newInstance = await FeeStructureInstance.create({
    collegeId,
    academicYearId: newAcademicYearId,
    programmeId: source.programmeId,
    branchId: source.branchId,
    category: source.category,
    quota: source.quota,
    status: 'draft',
    priorVersionId: source._id,
    totalAmount: 0,
  });

  const oldToNewComponentId: Record<string, string> = {};
  const clonedComponents = [];
  for (const comp of sourceComponents) {
    const newComp = await FeeComponent.create({
      collegeId,
      feeStructureInstanceId: newInstance._id,
      name: comp.name,
      amount: comp.amount,
      isRefundable: comp.isRefundable,
      componentType: comp.componentType,
      isConditional: comp.isConditional,
      displayOrder: comp.displayOrder,
    });
    oldToNewComponentId[String(comp._id)] = String(newComp._id);
    clonedComponents.push(newComp);
  }

  for (const rule of sourceRules) {
    const newComponentId = oldToNewComponentId[String(rule.feeComponentId)];
    if (newComponentId) {
      await FeeComponentRule.create({
        collegeId,
        feeComponentId: newComponentId,
        conditionType: rule.conditionType,
        conditionValue: rule.conditionValue,
        operator: rule.operator,
        status: rule.status,
      });
    }
  }

  const totalAmount = clonedComponents.reduce((sum, c) => sum + c.amount, 0);
  newInstance.totalAmount = totalAmount;
  await newInstance.save();

  await createAuditLog({ collegeId, entityType: 'FeeStructureInstance', entityId: String(newInstance._id), entityName: `Cloned Fee Structure Instance`, action: 'create', changes: [], performedBy: who });

  return { instance: newInstance, components: clonedComponents };
}

export async function submitFeeStructure(collegeId: string, instanceId: string, who: string) {
  const instance = await FeeStructureInstance.findOne({ _id: instanceId, collegeId });
  if (!instance) throw new AppError(404, 'Fee structure instance not found');
  if (instance.status !== 'draft') throw new AppError(400, 'Can only submit draft structures');

  let comparisonData: Record<string, unknown> = {};
  if (instance.priorVersionId) {
    const priorComponents = await FeeComponent.find({ feeStructureInstanceId: String(instance.priorVersionId), collegeId }).lean();
    const currentComponents = await FeeComponent.find({ feeStructureInstanceId: instanceId, collegeId }).lean();

    const priorMap = new Map(priorComponents.map(c => [c.name, c.amount]));
    const compRows = currentComponents.map(c => {
      const priorAmount = priorMap.get(c.name) ?? 0;
      const changePct = priorAmount > 0 ? ((c.amount - priorAmount) / priorAmount) * 100 : 0;
      return { name: c.name, priorAmount, newAmount: c.amount, changePct: Math.round(changePct * 100) / 100 };
    });
    comparisonData = { rows: compRows };
  }

  const estimatedStudents = 100;
  const revenueProjection = instance.totalAmount * estimatedStudents;

  instance.status = 'submitted';
  instance.comparisonData = comparisonData;
  instance.revenueProjection = revenueProjection;
  await instance.save();

  await createAuditLog({ collegeId, entityType: 'FeeStructureInstance', entityId: instanceId, entityName: `Fee Structure Instance`, action: 'update', changes: [], performedBy: who });
  return instance;
}

export async function approveFeeStructure(collegeId: string, instanceId: string, who: string) {
  const instance = await FeeStructureInstance.findOne({ _id: instanceId, collegeId });
  if (!instance) throw new AppError(404, 'Fee structure instance not found');
  if (instance.status !== 'submitted') throw new AppError(400, 'Can only approve submitted structures');

  instance.status = 'approved';
  instance.approvedBy = who as any;
  instance.approvedAt = new Date();
  await instance.save();

  await createAuditLog({ collegeId, entityType: 'FeeStructureInstance', entityId: instanceId, entityName: `Fee Structure Instance`, action: 'update', changes: [], performedBy: who });
  return instance;
}

export async function activateFeeStructure(collegeId: string, instanceId: string, who: string) {
  const instance = await FeeStructureInstance.findOne({ _id: instanceId, collegeId });
  if (!instance) throw new AppError(404, 'Fee structure instance not found');
  if (instance.status !== 'approved') throw new AppError(400, 'Can only activate approved structures');

  await FeeStructureInstance.updateMany(
    {
      collegeId,
      programmeId: instance.programmeId,
      branchId: instance.branchId,
      quota: instance.quota,
      category: instance.category,
      status: 'active',
    },
    { status: 'superseded' },
  );

  instance.status = 'active';
  instance.effectiveDate = new Date();
  await instance.save();

  await createAuditLog({ collegeId, entityType: 'FeeStructureInstance', entityId: instanceId, entityName: `Fee Structure Instance`, action: 'update', changes: [], performedBy: who });
  return instance;
}

export async function rejectFeeStructure(collegeId: string, instanceId: string, comments: string, who: string) {
  const instance = await FeeStructureInstance.findOne({ _id: instanceId, collegeId });
  if (!instance) throw new AppError(404, 'Fee structure instance not found');
  if (instance.status !== 'submitted') throw new AppError(400, 'Can only reject submitted structures');

  instance.status = 'revision_required';
  instance.rejectionComments = comments;
  await instance.save();

  await createAuditLog({ collegeId, entityType: 'FeeStructureInstance', entityId: instanceId, entityName: `Fee Structure Instance`, action: 'update', changes: [], performedBy: who });
  return instance;
}

export async function archiveFeeStructure(collegeId: string, instanceId: string, who: string) {
  const instance = await FeeStructureInstance.findOne({ _id: instanceId, collegeId });
  if (!instance) throw new AppError(404, 'Fee structure instance not found');
  if (!['active', 'superseded'].includes(instance.status)) throw new AppError(400, 'Can only archive active or superseded structures');

  instance.status = 'archived';
  await instance.save();

  await createAuditLog({ collegeId, entityType: 'FeeStructureInstance', entityId: instanceId, entityName: `Fee Structure Instance`, action: 'update', changes: [], performedBy: who });
  return instance;
}

export async function getFeeStructureComparison(collegeId: string, instanceId: string) {
  const instance = await FeeStructureInstance.findOne({ _id: instanceId, collegeId });
  if (!instance) throw new AppError(404, 'Fee structure instance not found');

  if (instance.comparisonData && Object.keys(instance.comparisonData).length > 0) {
    return instance.comparisonData;
  }

  if (!instance.priorVersionId) {
    return { rows: [] };
  }

  const priorComponents = await FeeComponent.find({ feeStructureInstanceId: String(instance.priorVersionId), collegeId }).lean();
  const currentComponents = await FeeComponent.find({ feeStructureInstanceId: instanceId, collegeId }).lean();

  const priorMap = new Map(priorComponents.map(c => [c.name, c.amount]));
  const rows = currentComponents.map(c => {
    const priorAmount = priorMap.get(c.name) ?? 0;
    const changePct = priorAmount > 0 ? ((c.amount - priorAmount) / priorAmount) * 100 : 0;
    return { name: c.name, priorAmount, newAmount: c.amount, changePct: Math.round(changePct * 100) / 100 };
  });

  return { rows };
}

export async function getFeeStructureRevenueProjection(collegeId: string, instanceId: string) {
  const instance = await FeeStructureInstance.findOne({ _id: instanceId, collegeId });
  if (!instance) throw new AppError(404, 'Fee structure instance not found');

  const estimatedStudents = 100;
  const revenueProjection = instance.revenueProjection ?? instance.totalAmount * estimatedStudents;

  return { instanceId, totalAmount: instance.totalAmount, estimatedStudents, revenueProjection };
}

// ═══ Fee Components ═══════════════════════════════════════

export async function listFeeComponents(collegeId: string, feeStructureInstanceId: string, page = 1, limit = 20) {
  return paginate(FeeComponent, { collegeId, feeStructureInstanceId }, page, limit, { displayOrder: 1 });
}

export async function getFeeComponent(collegeId: string, id: string) {
  const doc = await FeeComponent.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee component not found');
  return doc;
}

async function recalcInstanceTotalAmount(collegeId: string, feeStructureInstanceId: string) {
  const components = await FeeComponent.find({ feeStructureInstanceId, collegeId }).lean();
  const totalAmount = components.reduce((sum, c) => sum + c.amount, 0);
  await FeeStructureInstance.findOneAndUpdate({ _id: feeStructureInstanceId, collegeId }, { totalAmount });
}

export async function createFeeComponent(collegeId: string, data: any, who: string) {
  const doc = await FeeComponent.create({ ...data, collegeId });
  await recalcInstanceTotalAmount(collegeId, data.feeStructureInstanceId);
  await createAuditLog({ collegeId, entityType: 'FeeComponent', entityId: String(doc._id), entityName: doc.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateFeeComponent(collegeId: string, id: string, data: any, who: string) {
  const doc = await FeeComponent.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Fee component not found');
  await recalcInstanceTotalAmount(collegeId, String(doc.feeStructureInstanceId));
  await createAuditLog({ collegeId, entityType: 'FeeComponent', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteFeeComponent(collegeId: string, id: string, who: string) {
  const doc = await FeeComponent.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee component not found');
  await recalcInstanceTotalAmount(collegeId, String(doc.feeStructureInstanceId));
  await createAuditLog({ collegeId, entityType: 'FeeComponent', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Fee Component Rules ══════════════════════════════════

export async function listFeeComponentRules(collegeId: string, feeComponentId: string, page = 1, limit = 20) {
  return paginate(FeeComponentRule, { collegeId, feeComponentId }, page, limit);
}

export async function createFeeComponentRule(collegeId: string, data: any, who: string) {
  const doc = await FeeComponentRule.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'FeeComponentRule', entityId: String(doc._id), entityName: `Rule: ${doc.conditionType}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateFeeComponentRule(collegeId: string, id: string, data: any, who: string) {
  const doc = await FeeComponentRule.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Fee component rule not found');
  await createAuditLog({ collegeId, entityType: 'FeeComponentRule', entityId: id, entityName: `Rule: ${doc.conditionType}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteFeeComponentRule(collegeId: string, id: string, who: string) {
  const doc = await FeeComponentRule.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee component rule not found');
  await createAuditLog({ collegeId, entityType: 'FeeComponentRule', entityId: id, entityName: `Rule: ${doc.conditionType}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Fee Rules Engine ═════════════════════════════════════

interface StudentProfile {
  programmeId?: string;
  branchId?: string;
  regulationId?: string;
  quota?: string;
  category?: string;
  isHosteler?: boolean;
  hasTransport?: boolean;
  labProgramme?: boolean;
  batchId?: string;
}

function resolveProfileValue(profile: StudentProfile, conditionType: string): unknown {
  switch (conditionType) {
    case 'hostel': return profile.isHosteler;
    case 'transport': return profile.hasTransport;
    case 'lab_programme': return profile.labProgramme;
    case 'quota': return profile.quota;
    case 'category': return profile.category;
    case 'regulation': return profile.regulationId;
    case 'batch': return profile.batchId;
    default: return undefined;
  }
}

function evaluateRule(conditionType: string, conditionValue: string, operator: string, profile: StudentProfile): boolean {
  const fieldValue = resolveProfileValue(profile, conditionType);
  const isBooleanField = conditionType === 'hostel' || conditionType === 'transport' || conditionType === 'lab_programme';

  switch (operator) {
    case 'equals': {
      if (isBooleanField) {
        return fieldValue === (conditionValue === 'true');
      }
      return String(fieldValue) === conditionValue;
    }
    case 'in': {
      const values = conditionValue.split(',').map(v => v.trim());
      return values.includes(String(fieldValue));
    }
    case 'not_in': {
      const values = conditionValue.split(',').map(v => v.trim());
      return !values.includes(String(fieldValue));
    }
    case 'exists': return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'not_exists': return fieldValue === undefined || fieldValue === null || fieldValue === '';
    default: return false;
  }
}

export async function evaluateFeeRules(collegeId: string, feeStructureInstanceId: string, studentProfile: StudentProfile) {
  const components = await FeeComponent.find({ feeStructureInstanceId, collegeId }).lean();

  const applicableComponents = [];
  for (const component of components) {
    if (!component.isConditional) {
      applicableComponents.push({
        componentId: String(component._id),
        name: component.name,
        amount: component.amount,
        componentType: component.componentType,
      });
    } else {
      const rules = await FeeComponentRule.find({ feeComponentId: String(component._id), collegeId }).lean();
      const allRulesPass = rules.every(rule =>
        evaluateRule(rule.conditionType, rule.conditionValue, rule.operator, studentProfile),
      );
      if (allRulesPass) {
        applicableComponents.push({
          componentId: String(component._id),
          name: component.name,
          amount: component.amount,
          componentType: component.componentType,
        });
      }
    }
  }

  const totalAmount = applicableComponents.reduce((sum, c) => sum + c.amount, 0);
  return { applicableComponents, totalAmount };
}

export async function testFeeRulesWithProfiles(collegeId: string, feeStructureInstanceId: string, profiles: StudentProfile[]) {
  const results = [];
  for (const profile of profiles) {
    const result = await evaluateFeeRules(collegeId, feeStructureInstanceId, profile);
    results.push({ profile, ...result });
  }
  return results;
}

// ═══ Batch Invoice Generation ═════════════════════════════

export async function generateSemesterInvoiceBatch(
  collegeId: string,
  semesterId: string,
  academicYearId: string,
  performedBy: string,
) {
  const batchId = `BATCH-${Date.now()}`;
  let generated = 0;
  let totalRevenue = 0;

  // Find distinct enrolled students for this semester
  const enrollments = await Enrollment.find({ collegeId, semesterId, status: 'enrolled' }).lean();
  const studentIds = [...new Set(enrollments.map(e => String(e.studentId)))];

  for (const studentId of studentIds) {
    const student = await Student.findOne({ _id: studentId, collegeId }).lean();
    if (!student) continue;

    const feeStructureInstance = await FeeStructureInstance.findOne({
      collegeId,
      programmeId: student.programmeId,
      status: 'active',
    }).lean();
    if (!feeStructureInstance) continue;

    const studentProfile: StudentProfile = {
      programmeId: student.programmeId ? String(student.programmeId) : undefined,
      branchId: student.branchId ? String(student.branchId) : undefined,
      regulationId: student.regulationId ? String(student.regulationId) : undefined,
      quota: student.quota,
      category: student.category,
      batchId: student.batchId ? String(student.batchId) : undefined,
    };

    const { applicableComponents } = await evaluateFeeRules(collegeId, String(feeStructureInstance._id), studentProfile);

    // Check for active FeeAgreement
    const feeAgreement = await FeeAgreement.findOne({ collegeId, studentId, status: 'active' }).lean();

    // Check for active ScholarshipAllocation
    const scholarshipAllocation = await ScholarshipAllocation.findOne({
      collegeId, studentId, academicYearId, status: { $in: ['approved', 'disbursed'] },
    }).lean();

    // Check for active Concession
    const concession = await Concession.findOne({
      collegeId, studentId, academicYearId, status: 'approved',
    }).lean();

    const grossTotal = applicableComponents.reduce((sum, c) => sum + c.amount, 0);
    const scholarshipTotal = scholarshipAllocation ? scholarshipAllocation.amount : 0;
    let concessionTotal = 0;
    if (concession) {
      if (concession.flatAmount) {
        concessionTotal = concession.flatAmount;
      } else if (concession.percentage) {
        concessionTotal = Math.round((grossTotal * concession.percentage) / 100);
      }
    }

    // Apply FeeAgreement override
    const effectiveGross = feeAgreement ? feeAgreement.negotiatedTotal : grossTotal;
    const netPayable = Math.max(0, effectiveGross - scholarshipTotal - concessionTotal);

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = await Invoice.create({
      collegeId,
      invoiceNumber,
      studentId,
      type: 'fee',
      items: applicableComponents.map(c => ({ description: c.name, amount: c.amount })),
      totalAmount: effectiveGross,
      scholarshipAllocated: scholarshipTotal,
      concessionApplied: concessionTotal,
      netPayable,
      dueDate,
      status: 'generated',
      semesterId,
      feeAgreementId: feeAgreement ? feeAgreement._id : undefined,
      batchId,
    });

    // Create InvoiceLineItems
    const componentCount = applicableComponents.length;
    for (const comp of applicableComponents) {
      const scholarshipProportion = componentCount > 0 ? scholarshipTotal / componentCount : 0;
      const concessionProportion = componentCount > 0 ? concessionTotal / componentCount : 0;
      const netAmount = Math.max(0, comp.amount - scholarshipProportion - concessionProportion);

      await InvoiceLineItem.create({
        collegeId,
        invoiceId: invoice._id,
        feeComponentId: comp.componentId,
        description: comp.name,
        grossAmount: comp.amount,
        scholarshipAllocated: Math.round(scholarshipProportion),
        concessionApplied: Math.round(concessionProportion),
        netAmount: Math.round(netAmount),
        status: 'active',
      });
    }

    generated++;
    totalRevenue += netPayable;
  }

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: batchId,
    entityName: `Batch ${batchId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { batchId, generated, totalRevenue };
}

export async function generateEnrolmentInvoice(
  collegeId: string,
  studentId: string,
  feeStructureInstanceId: string,
  firstPaymentAmount: number,
  performedBy: string,
) {
  const student = await Student.findOne({ _id: studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');

  const studentProfile: StudentProfile = {
    programmeId: student.programmeId ? String(student.programmeId) : undefined,
    branchId: student.branchId ? String(student.branchId) : undefined,
    regulationId: student.regulationId ? String(student.regulationId) : undefined,
    quota: student.quota,
    category: student.category,
    batchId: student.batchId ? String(student.batchId) : undefined,
  };

  const { applicableComponents } = await evaluateFeeRules(collegeId, feeStructureInstanceId, studentProfile);

  // Check for active FeeAgreement
  const feeAgreement = await FeeAgreement.findOne({ collegeId, studentId, status: 'active' }).lean();

  const grossTotal = applicableComponents.reduce((sum, c) => sum + c.amount, 0);
  const effectiveGross = feeAgreement ? feeAgreement.negotiatedTotal : grossTotal;
  const netPayable = Math.max(0, effectiveGross - firstPaymentAmount);

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const invoice = await Invoice.create({
    collegeId,
    invoiceNumber,
    studentId,
    type: 'fee',
    items: applicableComponents.map(c => ({ description: c.name, amount: c.amount })),
    totalAmount: effectiveGross,
    scholarshipAllocated: 0,
    concessionApplied: firstPaymentAmount > 0 ? firstPaymentAmount : 0,
    netPayable,
    dueDate,
    status: 'generated',
    feeAgreementId: feeAgreement ? feeAgreement._id : undefined,
  });

  for (const comp of applicableComponents) {
    await InvoiceLineItem.create({
      collegeId,
      invoiceId: invoice._id,
      feeComponentId: comp.componentId,
      description: comp.name,
      grossAmount: comp.amount,
      scholarshipAllocated: 0,
      concessionApplied: 0,
      netAmount: comp.amount,
      status: 'active',
    });
  }

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: String(invoice._id),
    entityName: invoice.invoiceNumber,
    action: 'create',
    changes: [],
    performedBy,
  });

  return invoice;
}

export async function generateExamFeeInvoiceBatch(
  collegeId: string,
  semesterId: string,
  examType: string,
  feeAmount: number,
  studentIds: string[],
  performedBy: string,
) {
  const batchId = `BATCH-${Date.now()}`;
  let generated = 0;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 15);

  for (const studentId of studentIds) {
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}-${generated}`;
    const invoice = await Invoice.create({
      collegeId,
      invoiceNumber,
      studentId,
      type: 'fee',
      examType,
      items: [{ description: `${examType} Exam Fee`, amount: feeAmount }],
      totalAmount: feeAmount,
      netPayable: feeAmount,
      scholarshipAllocated: 0,
      concessionApplied: 0,
      dueDate,
      status: 'generated',
      semesterId,
      batchId,
    });

    await InvoiceLineItem.create({
      collegeId,
      invoiceId: invoice._id,
      description: `${examType} Exam Fee`,
      grossAmount: feeAmount,
      scholarshipAllocated: 0,
      concessionApplied: 0,
      netAmount: feeAmount,
      status: 'active',
    });

    generated++;
  }

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: batchId,
    entityName: `Exam Batch ${batchId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { generated, batchId };
}

export async function generateAdHocInvoice(
  collegeId: string,
  studentId: string,
  items: { description: string; amount: number }[],
  dueDate: Date,
  description: string,
  performedBy: string,
) {
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;

  const invoice = await Invoice.create({
    collegeId,
    invoiceNumber,
    studentId,
    type: 'other',
    items,
    totalAmount,
    netPayable: totalAmount,
    scholarshipAllocated: 0,
    concessionApplied: 0,
    dueDate,
    status: 'draft',
  });

  for (const item of items) {
    await InvoiceLineItem.create({
      collegeId,
      invoiceId: invoice._id,
      description: item.description,
      grossAmount: item.amount,
      scholarshipAllocated: 0,
      concessionApplied: 0,
      netAmount: item.amount,
      status: 'active',
    });
  }

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: String(invoice._id),
    entityName: description || invoiceNumber,
    action: 'create',
    changes: [],
    performedBy,
  });

  return invoice;
}

// ═══ Invoice Adjustment Workflows ════════════════════════

export async function adjustInvoice(
  collegeId: string,
  invoiceId: string,
  adjustments: { lineItemId: string; newAmount: number; reason: string }[],
  _reason: string,
  performedBy: string,
) {
  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const changes: { field: string; displayName: string; oldValue: unknown; newValue: unknown }[] = [];

  for (const adj of adjustments) {
    const lineItem = await InvoiceLineItem.findOne({ _id: adj.lineItemId, collegeId, invoiceId });
    if (!lineItem) continue;

    const oldNet = lineItem.netAmount;
    const diff = adj.newAmount - lineItem.grossAmount;
    lineItem.grossAmount = adj.newAmount;
    lineItem.netAmount = Math.max(0, adj.newAmount - lineItem.scholarshipAllocated - lineItem.concessionApplied);

    if (lineItem.netAmount !== oldNet) {
      lineItem.status = 'adjusted';
    }

    await lineItem.save();
    changes.push({ field: `lineItem.${adj.lineItemId}.grossAmount`, displayName: 'Gross Amount', oldValue: lineItem.grossAmount - diff, newValue: adj.newAmount });
  }

  // Recalculate invoice totals
  const lineItems = await InvoiceLineItem.find({ collegeId, invoiceId }).lean();
  const newTotalAmount = lineItems.reduce((sum, li) => sum + li.grossAmount, 0);
  const newScholarshipAllocated = lineItems.reduce((sum, li) => sum + li.scholarshipAllocated, 0);
  const newConcessionApplied = lineItems.reduce((sum, li) => sum + li.concessionApplied, 0);
  const newNetPayable = lineItems.reduce((sum, li) => sum + li.netAmount, 0);

  invoice.totalAmount = newTotalAmount;
  invoice.scholarshipAllocated = newScholarshipAllocated;
  invoice.concessionApplied = newConcessionApplied;
  invoice.netPayable = newNetPayable;
  await invoice.save();

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: invoiceId,
    entityName: invoice.invoiceNumber,
    action: 'update',
    changes,
    performedBy,
  });

  return invoice;
}

export async function disputeInvoice(collegeId: string, invoiceId: string, _disputeReason: string, performedBy: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');
  if (!['sent', 'generated'].includes(invoice.status)) {
    throw new AppError(400, 'Only sent or generated invoices can be disputed');
  }

  invoice.status = 'disputed';
  await invoice.save();

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: invoiceId,
    entityName: invoice.invoiceNumber,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'sent', newValue: 'disputed' }],
    performedBy,
  });

  return invoice;
}

export async function confirmInvoice(collegeId: string, invoiceId: string, performedBy: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');
  if (invoice.status !== 'disputed') {
    throw new AppError(400, 'Only disputed invoices can be confirmed');
  }

  invoice.status = 'confirmed';
  await invoice.save();

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: invoiceId,
    entityName: invoice.invoiceNumber,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'disputed', newValue: 'confirmed' }],
    performedBy,
  });

  return invoice;
}

export async function writeOffInvoice(
  collegeId: string,
  invoiceId: string,
  _approvedBy: string,
  _reason: string,
  performedBy: string,
) {
  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const netPayable = invoice.netPayable ?? invoice.totalAmount;
  if (netPayable <= 0) {
    throw new AppError(400, 'Invoice has no unpaid balance to write off');
  }

  const prevStatus = invoice.status;
  invoice.status = 'written_off';
  await invoice.save();

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: invoiceId,
    entityName: invoice.invoiceNumber,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: prevStatus, newValue: 'written_off' }],
    performedBy,
  });

  return invoice;
}

export async function detectSiblingDiscount(
  collegeId: string,
  academicYearId: string,
  performedBy: string,
) {
  // Find all students with a feeResponsibleParentId
  const students = await Student.find({
    collegeId,
    feeResponsibleParentId: { $ne: null },
    status: 'active',
  }).lean();

  // Group by feeResponsibleParentId
  const parentMap = new Map<string, string[]>();
  for (const s of students) {
    if (!s.feeResponsibleParentId) continue;
    const parentKey = String(s.feeResponsibleParentId);
    const existing = parentMap.get(parentKey) ?? [];
    existing.push(String(s._id));
    parentMap.set(parentKey, existing);
  }

  let siblingGroups = 0;
  let concessionsCreated = 0;

  for (const [_parentId, siblingIds] of parentMap.entries()) {
    if (siblingIds.length < 2) continue;
    siblingGroups++;

    // Apply sibling discount concession to all siblings beyond the first
    for (let i = 1; i < siblingIds.length; i++) {
      const studentId = siblingIds[i];
      if (!studentId) continue;

      // Avoid duplicate concessions
      const existing = await Concession.findOne({
        collegeId,
        studentId,
        academicYearId,
        type: 'sibling',
        source: 'm04',
        status: { $in: ['requested', 'approved'] },
      }).lean();

      if (existing) continue;

      await Concession.create({
        collegeId,
        studentId,
        academicYearId,
        type: 'sibling',
        percentage: 10,
        reason: 'Sibling discount auto-detected',
        status: 'requested',
        source: 'm04',
      });
      concessionsCreated++;
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'Concession',
    entityId: `SIBLING-DETECT-${Date.now()}`,
    entityName: `Sibling Discount Detection`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { siblingGroups, concessionsCreated };
}

// ═══ Fee Agreement CRUD ═══════════════════════════════════

export async function listFeeAgreements(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(FeeAgreement, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'feeStructureInstanceId'] as any);
}

export async function getFeeAgreement(collegeId: string, id: string) {
  const doc = await FeeAgreement.findOne({ _id: id, collegeId }).populate('studentId feeStructureInstanceId');
  if (!doc) throw new AppError(404, 'Fee agreement not found');
  return doc;
}

export async function createFeeAgreement(collegeId: string, data: any, performedBy: string) {
  const doc = await FeeAgreement.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'FeeAgreement',
    entityId: String(doc._id),
    entityName: `Fee Agreement`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateFeeAgreement(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await FeeAgreement.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Fee agreement not found');
  await createAuditLog({
    collegeId,
    entityType: 'FeeAgreement',
    entityId: id,
    entityName: `Fee Agreement`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteFeeAgreement(collegeId: string, id: string, performedBy: string) {
  const doc = await FeeAgreement.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Fee agreement not found');
  await createAuditLog({
    collegeId,
    entityType: 'FeeAgreement',
    entityId: id,
    entityName: `Fee Agreement`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ Payment Plan CRUD ════════════════════════════════════

export async function listPaymentPlans(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(PaymentPlan, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'invoiceId', 'feeAgreementId'] as any);
}

export async function getPaymentPlan(collegeId: string, id: string) {
  const doc = await PaymentPlan.findOne({ _id: id, collegeId }).populate('studentId invoiceId feeAgreementId');
  if (!doc) throw new AppError(404, 'Payment plan not found');
  return doc;
}

export async function createPaymentPlan(collegeId: string, data: any, performedBy: string) {
  const doc = await PaymentPlan.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'PaymentPlan',
    entityId: String(doc._id),
    entityName: `Payment Plan`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updatePaymentPlan(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await PaymentPlan.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Payment plan not found');
  await createAuditLog({
    collegeId,
    entityType: 'PaymentPlan',
    entityId: id,
    entityName: `Payment Plan`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deletePaymentPlan(collegeId: string, id: string, performedBy: string) {
  const doc = await PaymentPlan.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Payment plan not found');
  await createAuditLog({
    collegeId,
    entityType: 'PaymentPlan',
    entityId: id,
    entityName: `Payment Plan`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ Invoice Line Item CRUD ═══════════════════════════════

export async function listInvoiceLineItems(collegeId: string, invoiceId: string, page = 1, limit = 20) {
  return paginate(InvoiceLineItem, { collegeId, invoiceId }, page, limit, { createdAt: 1 }, ['feeComponentId']);
}

export async function getInvoiceLineItem(collegeId: string, id: string) {
  const doc = await InvoiceLineItem.findOne({ _id: id, collegeId }).populate('feeComponentId invoiceId');
  if (!doc) throw new AppError(404, 'Invoice line item not found');
  return doc;
}

export async function createInvoiceLineItem(collegeId: string, data: any, performedBy: string) {
  const doc = await InvoiceLineItem.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'InvoiceLineItem',
    entityId: String(doc._id),
    entityName: doc.description,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateInvoiceLineItem(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await InvoiceLineItem.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Invoice line item not found');
  await createAuditLog({
    collegeId,
    entityType: 'InvoiceLineItem',
    entityId: id,
    entityName: doc.description,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteInvoiceLineItem(collegeId: string, id: string, performedBy: string) {
  const doc = await InvoiceLineItem.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Invoice line item not found');
  await createAuditLog({
    collegeId,
    entityType: 'InvoiceLineItem',
    entityId: id,
    entityName: doc.description,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}
