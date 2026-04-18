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
import { PaymentTransaction } from '../../models/finance/PaymentTransaction';
import { Receipt } from '../../models/finance/Receipt';
import { ReconciliationEntry } from '../../models/finance/ReconciliationEntry';
import { BounceRecord } from '../../models/finance/BounceRecord';
import { OverpaymentRecord } from '../../models/finance/OverpaymentRecord';
import { ScholarshipEligibility } from '../../models/finance/ScholarshipEligibility';
import { ScholarshipClaim } from '../../models/finance/ScholarshipClaim';
import { ScholarshipReceivable } from '../../models/finance/ScholarshipReceivable';
import { ScholarshipCredit } from '../../models/finance/ScholarshipCredit';
import { SemesterResult } from '../../models/academic-ops/SemesterResult';
import { AttendanceSummary } from '../../models/academic-ops/AttendanceSummary';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { EscalationAction } from '../../models/finance/EscalationAction';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { WelfareReferral } from '../../models/finance/WelfareReferral';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { Student } from '../../models/people/Student';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';
import crypto from 'crypto';

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

// ═══ Payment Collection ═══════════════════════════════════

// W03-L2-017: Gateway Webhook Handler
export async function processGatewayWebhook(
  collegeId: string,
  orderId: string,
  amount: number,
  transactionRef: string,
  gatewayResponse: Record<string, unknown>,
  performedBy: string,
) {
  // Idempotency check
  const existing = await PaymentGatewayLog.findOne({ collegeId, orderId, status: 'success' }).lean();
  if (existing) {
    const existingTx = await PaymentTransaction.findOne({ collegeId, gatewayOrderId: orderId }).lean();
    const existingReceipt = existingTx?.receiptId
      ? await Receipt.findOne({ _id: existingTx.receiptId, collegeId }).lean()
      : null;
    return {
      paymentTransactionId: existingTx ? String(existingTx._id) : null,
      receiptNumber: existingReceipt?.receiptNumber ?? null,
      invoiceStatus: null,
    };
  }

  const gatewayLog = await PaymentGatewayLog.findOne({ collegeId, orderId });
  if (!gatewayLog) throw new AppError(404, 'Payment gateway log not found');

  gatewayLog.status = 'success';
  gatewayLog.gatewayResponse = gatewayResponse;
  gatewayLog.completedAt = new Date();
  // Signature verification happens upstream in the route middleware
  // (`verifyPaymentWebhookSignature`). If that middleware didn't pass,
  // this service would never be reached — so this value reflects a
  // confirmed HMAC check, not a self-attestation.
  gatewayLog.signatureVerified = true;
  gatewayLog.webhookReceivedAt = new Date();
  await gatewayLog.save();

  const invoice = await Invoice.findOne({ _id: gatewayLog.invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found for this gateway order');

  const tx = await PaymentTransaction.create({
    collegeId,
    studentId: gatewayLog.studentId,
    invoiceId: gatewayLog.invoiceId,
    channel: 'gateway',
    paymentMode: 'online',
    reconciliationStatus: 'received',
    gatewayOrderId: orderId,
    transactionRef,
    amount,
    paymentDate: new Date(),
  });

  const payable = invoice.netPayable ?? invoice.totalAmount;
  const invoiceStatus = amount >= payable ? 'paid' : 'partially_paid';
  invoice.status = invoiceStatus;
  await invoice.save();

  const receiptNumber = `REC-${Date.now()}`;
  const receipt = await Receipt.create({
    collegeId,
    receiptNumber,
    paymentTransactionId: tx._id,
    studentId: gatewayLog.studentId,
    amount,
    channel: 'email',
    status: 'issued',
  });

  tx.receiptId = receipt._id as unknown as typeof tx.receiptId;
  await tx.save();

  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: String(tx._id),
    entityName: receiptNumber,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { paymentTransactionId: String(tx._id), receiptNumber, invoiceStatus };
}

// W03-L2-018: Counter Payment (Cash/DD)
export async function recordCounterPayment(
  collegeId: string,
  invoiceId: string,
  studentId: string,
  amount: number,
  paymentMode: string,
  ddNumber: string | undefined,
  ddBank: string | undefined,
  ddDate: Date | undefined,
  _collectedBy: string,
  performedBy: string,
) {
  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const channel = paymentMode === 'dd' ? 'dd' : 'cash';

  const tx = await PaymentTransaction.create({
    collegeId,
    studentId,
    invoiceId,
    channel,
    paymentMode,
    reconciliationStatus: 'received',
    amount,
    paymentDate: new Date(),
    ddNumber,
    ddBank,
    ddDate,
  });

  const payable = invoice.netPayable ?? invoice.totalAmount;
  const invoiceStatus = amount >= payable ? 'paid' : 'partially_paid';
  invoice.status = invoiceStatus;
  await invoice.save();

  const receiptNumber = `REC-${Date.now()}`;
  const receipt = await Receipt.create({
    collegeId,
    receiptNumber,
    paymentTransactionId: tx._id,
    studentId,
    amount,
    channel: 'print',
    status: 'issued',
  });

  tx.receiptId = receipt._id as unknown as typeof tx.receiptId;
  await tx.save();

  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: String(tx._id),
    entityName: receiptNumber,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { paymentTransactionId: String(tx._id), receiptNumber, invoiceStatus };
}

// W03-L2-019: Bank Statement Import (NEFT/RTGS matching)
export async function importBankStatement(
  collegeId: string,
  entries: { bankRef: string; amount: number; senderName: string; creditDate: Date }[],
  performedBy: string,
) {
  let processed = 0;
  let matched = 0;
  let discrepancies = 0;

  for (const entry of entries) {
    // Auto-match: find unpaid invoices with same amount
    const matchingInvoices = await Invoice.find({
      collegeId,
      totalAmount: entry.amount,
      status: { $in: ['sent', 'generated', 'partially_paid'] },
    }).lean();

    let reconciliationStatus: string;

    if (matchingInvoices.length === 1) {
      reconciliationStatus = 'matched';
      matched++;
    } else {
      reconciliationStatus = 'discrepancy';
      discrepancies++;
    }

    // We need studentId for PaymentTransaction — try to get from matched invoice
    const invoice = matchingInvoices.length === 1 ? matchingInvoices[0] : null;

    if (!invoice) {
      // Create a stub transaction without studentId is not possible given schema requires it
      // Instead, store a ReconciliationEntry with no transaction (not valid either)
      // Best approach: skip creating PaymentTransaction without studentId; only flag discrepancy
      discrepancies = discrepancies; // already incremented
      processed++;
      continue;
    }

    const tx = await PaymentTransaction.create({
      collegeId,
      studentId: invoice.studentId,
      invoiceId: invoice._id,
      channel: 'neft',
      paymentMode: 'neft',
      reconciliationStatus,
      amount: entry.amount,
      transactionRef: entry.bankRef,
      paymentDate: entry.creditDate ?? new Date(),
    });

    await ReconciliationEntry.create({
      collegeId,
      paymentTransactionId: tx._id,
      bankStatementRef: entry.bankRef,
      matchedAmount: entry.amount,
      status: reconciliationStatus === 'matched' ? 'matched' : 'discrepancy_flagged',
    });

    if (reconciliationStatus === 'matched' && invoice) {
      const payable = (invoice as any).netPayable ?? invoice.totalAmount;
      const newStatus = entry.amount >= payable ? 'paid' : 'partially_paid';
      await Invoice.findByIdAndUpdate(invoice._id, { status: newStatus });
    }

    processed++;
  }

  await createAuditLog({
    collegeId,
    entityType: 'ReconciliationEntry',
    entityId: `BANK-IMPORT-${Date.now()}`,
    entityName: `Bank Statement Import`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { processed, matched, discrepancies };
}

// W03-L2-019: Manual Match for Unmatched Payments
export async function manualMatchPayment(
  collegeId: string,
  paymentTransactionId: string,
  invoiceId: string,
  performedBy: string,
) {
  const tx = await PaymentTransaction.findOne({ _id: paymentTransactionId, collegeId });
  if (!tx) throw new AppError(404, 'Payment transaction not found');
  if (tx.reconciliationStatus !== 'discrepancy') {
    throw new AppError(400, 'Only discrepancy transactions can be manually matched');
  }

  tx.reconciliationStatus = 'matched';
  tx.invoiceId = invoiceId as unknown as typeof tx.invoiceId;
  await tx.save();

  let entry = await ReconciliationEntry.findOne({ collegeId, paymentTransactionId: tx._id });
  if (!entry) {
    entry = await ReconciliationEntry.create({
      collegeId,
      paymentTransactionId: tx._id,
      matchedAmount: tx.amount,
      status: 'resolved',
      resolvedBy: performedBy as any,
      resolvedAt: new Date(),
    });
  } else {
    entry.status = 'resolved';
    entry.resolvedBy = performedBy as any;
    entry.resolvedAt = new Date();
    await entry.save();
  }

  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (invoice) {
    const payable = invoice.netPayable ?? invoice.totalAmount;
    invoice.status = tx.amount >= payable ? 'paid' : 'partially_paid';
    await invoice.save();
  }

  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: paymentTransactionId,
    entityName: `Manual Match`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return tx;
}

// W03-L2-020: Reconciliation Cycle
export async function runReconciliation(collegeId: string, performedBy: string) {
  const txs = await PaymentTransaction.find({ collegeId, reconciliationStatus: 'received' }).lean();

  let total = txs.length;
  let matched = 0;
  let discrepancies = 0;

  for (const tx of txs) {
    const entry = await ReconciliationEntry.findOne({
      collegeId,
      paymentTransactionId: tx._id,
      status: 'matched',
    }).lean();

    if (entry) {
      matched++;
    } else {
      await PaymentTransaction.findByIdAndUpdate(tx._id, { reconciliationStatus: 'discrepancy' });
      await ReconciliationEntry.create({
        collegeId,
        paymentTransactionId: tx._id,
        matchedAmount: tx.amount,
        status: 'discrepancy_flagged',
      });
      discrepancies++;
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'ReconciliationEntry',
    entityId: `RECON-RUN-${Date.now()}`,
    entityName: `Reconciliation Run`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { total, matched, discrepancies };
}

export async function getReconciliationStatus(collegeId: string) {
  const [txCounts, entryCounts] = await Promise.all([
    PaymentTransaction.aggregate([
      { $match: { collegeId } },
      { $group: { _id: '$reconciliationStatus', count: { $sum: 1 } } },
    ]),
    ReconciliationEntry.aggregate([
      { $match: { collegeId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const txSummary: Record<string, number> = {};
  for (const item of txCounts) {
    txSummary[item._id as string] = item.count as number;
  }

  const entrySummary: Record<string, number> = {};
  for (const item of entryCounts) {
    entrySummary[item._id as string] = item.count as number;
  }

  return { transactions: txSummary, entries: entrySummary };
}

// ═══ Receipt Management ════════════════════════════════════

// W03-L2-021: Reissue Receipt
export async function reissueReceipt(
  collegeId: string,
  receiptId: string,
  channel: string,
  performedBy: string,
) {
  const oldReceipt = await Receipt.findOne({ _id: receiptId, collegeId });
  if (!oldReceipt) throw new AppError(404, 'Receipt not found');

  oldReceipt.status = 'reissued';
  await oldReceipt.save();

  const receiptNumber = `REC-${Date.now()}`;
  const newReceipt = await Receipt.create({
    collegeId,
    receiptNumber,
    paymentTransactionId: oldReceipt.paymentTransactionId,
    studentId: oldReceipt.studentId,
    amount: oldReceipt.amount,
    channel,
    status: 'issued',
  });

  await createAuditLog({
    collegeId,
    entityType: 'Receipt',
    entityId: String(newReceipt._id),
    entityName: receiptNumber,
    action: 'create',
    changes: [],
    performedBy,
  });

  return newReceipt;
}

export async function cancelReceipt(collegeId: string, receiptId: string, performedBy: string) {
  const receipt = await Receipt.findOne({ _id: receiptId, collegeId });
  if (!receipt) throw new AppError(404, 'Receipt not found');

  receipt.status = 'cancelled';
  await receipt.save();

  await createAuditLog({
    collegeId,
    entityType: 'Receipt',
    entityId: receiptId,
    entityName: receipt.receiptNumber,
    action: 'update',
    changes: [],
    performedBy,
  });

  return receipt;
}

// W03-L2-022: Flag Duplicate Payment
export async function flagDuplicatePayment(
  collegeId: string,
  paymentTransactionId: string,
  performedBy: string,
) {
  const tx = await PaymentTransaction.findOne({ _id: paymentTransactionId, collegeId });
  if (!tx) throw new AppError(404, 'Payment transaction not found');

  const potentialDuplicates = await PaymentTransaction.find({
    collegeId,
    invoiceId: tx.invoiceId,
    amount: tx.amount,
    _id: { $ne: tx._id },
  }).lean();

  let isDuplicate = false;
  let overpaymentRecordId: string | undefined;

  if (potentialDuplicates.length > 0) {
    isDuplicate = true;
    const overpayment = await OverpaymentRecord.create({
      collegeId,
      studentId: tx.studentId,
      paymentTransactionId: tx._id,
      invoiceId: tx.invoiceId,
      overpaymentAmount: tx.amount,
      resolution: 'pending',
    });
    overpaymentRecordId = String(overpayment._id);
  }

  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: paymentTransactionId,
    entityName: `Duplicate Flag`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return { isDuplicate, overpaymentRecordId };
}

// W03-L2-023: Record Payment Bounce
export async function recordPaymentBounce(
  collegeId: string,
  paymentTransactionId: string,
  reason: string,
  penaltyAmount: number,
  performedBy: string,
) {
  const tx = await PaymentTransaction.findOne({ _id: paymentTransactionId, collegeId });
  if (!tx) throw new AppError(404, 'Payment transaction not found');

  tx.reconciliationStatus = 'reversed';
  await tx.save();

  const invoice = await Invoice.findOne({ _id: tx.invoiceId, collegeId });
  let invoiceStatus = invoice?.status ?? 'unknown';
  if (invoice) {
    if (invoice.status === 'paid') {
      invoice.status = 'sent';
    }
    // For partially_paid: leave as is
    await invoice.save();
    invoiceStatus = invoice.status;
  }

  // Cancel receipt if exists
  if (tx.receiptId) {
    await Receipt.findOneAndUpdate(
      { _id: tx.receiptId, collegeId },
      { status: 'cancelled' },
    );
  }

  const bounceRecord = await BounceRecord.create({
    collegeId,
    paymentTransactionId: tx._id,
    invoiceId: tx.invoiceId,
    reason,
    penaltyAmount,
    bouncedAt: new Date(),
  });

  let penaltyApplied = false;
  if (penaltyAmount > 0 && invoice) {
    const penaltyLineItem = await InvoiceLineItem.create({
      collegeId,
      invoiceId: invoice._id,
      description: `Bounce Penalty - ${reason}`,
      grossAmount: penaltyAmount,
      scholarshipAllocated: 0,
      concessionApplied: 0,
      netAmount: penaltyAmount,
      status: 'active',
    });
    await BounceRecord.findByIdAndUpdate(bounceRecord._id, { penaltyLineItemId: penaltyLineItem._id });
    penaltyApplied = true;
  }

  await createAuditLog({
    collegeId,
    entityType: 'BounceRecord',
    entityId: String(bounceRecord._id),
    entityName: `Bounce: ${reason}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { bounceRecordId: String(bounceRecord._id), invoiceStatus, penaltyApplied };
}

// W03-L2-024: Resolve Overpayment
export async function resolveOverpayment(
  collegeId: string,
  overpaymentRecordId: string,
  resolution: 'refund' | 'credit_forward',
  performedBy: string,
) {
  const overpayment = await OverpaymentRecord.findOne({ _id: overpaymentRecordId, collegeId });
  if (!overpayment) throw new AppError(404, 'Overpayment record not found');

  if (resolution === 'refund') {
    const refund = await Refund.create({
      collegeId,
      studentId: overpayment.studentId,
      amount: overpayment.overpaymentAmount,
      reason: 'Overpayment refund',
      refundMode: 'online',
      status: 'requested',
      sourceType: 'overpayment',
      sourceId: overpayment._id,
      invoiceId: overpayment.invoiceId,
    });
    overpayment.refundId = refund._id as unknown as typeof overpayment.refundId;
  }

  overpayment.resolution = resolution;
  overpayment.resolvedAt = new Date();
  await overpayment.save();

  await createAuditLog({
    collegeId,
    entityType: 'OverpaymentRecord',
    entityId: overpaymentRecordId,
    entityName: `Overpayment Resolution: ${resolution}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return overpayment;
}

// W03-L2-025: Approve Refund
export async function approveRefund(collegeId: string, refundId: string, performedBy: string) {
  const refund = await Refund.findOne({ _id: refundId, collegeId });
  if (!refund) throw new AppError(404, 'Refund not found');
  if (refund.status !== 'requested') throw new AppError(400, 'Only requested refunds can be approved');

  refund.status = 'approved';
  await refund.save();

  await createAuditLog({
    collegeId,
    entityType: 'Refund',
    entityId: refundId,
    entityName: `Refund ₹${refund.amount}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return refund;
}

// Execute Refund
export async function executeRefund(
  collegeId: string,
  refundId: string,
  refundTransactionRef: string,
  performedBy: string,
) {
  const refund = await Refund.findOne({ _id: refundId, collegeId });
  if (!refund) throw new AppError(404, 'Refund not found');
  if (refund.status !== 'approved') throw new AppError(400, 'Only approved refunds can be executed');

  refund.status = 'processed';
  refund.refundTransactionRef = refundTransactionRef;
  refund.processedDate = new Date();
  await refund.save();

  if (refund.sourceType === 'overpayment' && refund.sourceId) {
    const overpayment = await OverpaymentRecord.findOne({ _id: refund.sourceId, collegeId }).lean();
    if (overpayment) {
      await PaymentTransaction.findOneAndUpdate(
        { _id: overpayment.paymentTransactionId, collegeId },
        { reconciliationStatus: 'refunded' },
      );
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'Refund',
    entityId: refundId,
    entityName: `Refund ₹${refund.amount}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return refund;
}

// ═══ PaymentTransaction CRUD ══════════════════════════════

export async function listPaymentTransactions(
  collegeId: string,
  page = 1,
  limit = 20,
  invoiceId?: string,
  reconciliationStatus?: string,
) {
  const filter: any = { collegeId };
  if (invoiceId) filter.invoiceId = invoiceId;
  if (reconciliationStatus) filter.reconciliationStatus = reconciliationStatus;
  return paginate(PaymentTransaction, filter, page, limit, { createdAt: -1 });
}

export async function getPaymentTransaction(collegeId: string, id: string) {
  const doc = await PaymentTransaction.findOne({ _id: id, collegeId }).populate('studentId invoiceId receiptId');
  if (!doc) throw new AppError(404, 'Payment transaction not found');
  return doc;
}

export async function createPaymentTransaction(collegeId: string, data: any, performedBy: string) {
  const doc = await PaymentTransaction.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: String(doc._id),
    entityName: `Transaction ${doc.channel}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updatePaymentTransaction(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await PaymentTransaction.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Payment transaction not found');
  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: id,
    entityName: `Transaction ${doc.channel}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deletePaymentTransaction(collegeId: string, id: string, performedBy: string) {
  const doc = await PaymentTransaction.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Payment transaction not found');
  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: id,
    entityName: `Transaction ${doc.channel}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ Receipt CRUD ═════════════════════════════════════════

export async function listReceipts(
  collegeId: string,
  page = 1,
  limit = 20,
  studentId?: string,
  status?: string,
) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  return paginate(Receipt, filter, page, limit, { createdAt: -1 });
}

export async function getReceipt(collegeId: string, id: string) {
  const doc = await Receipt.findOne({ _id: id, collegeId }).populate('paymentTransactionId studentId');
  if (!doc) throw new AppError(404, 'Receipt not found');
  return doc;
}

export async function createReceiptRecord(collegeId: string, data: any, performedBy: string) {
  const doc = await Receipt.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'Receipt',
    entityId: String(doc._id),
    entityName: doc.receiptNumber,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateReceiptRecord(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Receipt.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Receipt not found');
  await createAuditLog({
    collegeId,
    entityType: 'Receipt',
    entityId: id,
    entityName: doc.receiptNumber,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteReceiptRecord(collegeId: string, id: string, performedBy: string) {
  const doc = await Receipt.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Receipt not found');
  await createAuditLog({
    collegeId,
    entityType: 'Receipt',
    entityId: id,
    entityName: doc.receiptNumber,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ ReconciliationEntry CRUD ═════════════════════════════

export async function listReconciliationEntries(
  collegeId: string,
  page = 1,
  limit = 20,
  status?: string,
) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  return paginate(ReconciliationEntry, filter, page, limit, { createdAt: -1 });
}

export async function getReconciliationEntry(collegeId: string, id: string) {
  const doc = await ReconciliationEntry.findOne({ _id: id, collegeId }).populate('paymentTransactionId resolvedBy');
  if (!doc) throw new AppError(404, 'Reconciliation entry not found');
  return doc;
}

export async function createReconciliationEntry(collegeId: string, data: any, performedBy: string) {
  const doc = await ReconciliationEntry.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'ReconciliationEntry',
    entityId: String(doc._id),
    entityName: `Recon Entry ${doc.status}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateReconciliationEntry(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await ReconciliationEntry.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Reconciliation entry not found');
  await createAuditLog({
    collegeId,
    entityType: 'ReconciliationEntry',
    entityId: id,
    entityName: `Recon Entry ${doc.status}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteReconciliationEntry(collegeId: string, id: string, performedBy: string) {
  const doc = await ReconciliationEntry.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Reconciliation entry not found');
  await createAuditLog({
    collegeId,
    entityType: 'ReconciliationEntry',
    entityId: id,
    entityName: `Recon Entry`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ BounceRecord CRUD ════════════════════════════════════

export async function listBounceRecords(
  collegeId: string,
  page = 1,
  limit = 20,
  invoiceId?: string,
) {
  const filter: any = { collegeId };
  if (invoiceId) filter.invoiceId = invoiceId;
  return paginate(BounceRecord, filter, page, limit, { bouncedAt: -1 });
}

export async function getBounceRecord(collegeId: string, id: string) {
  const doc = await BounceRecord.findOne({ _id: id, collegeId }).populate('paymentTransactionId invoiceId penaltyLineItemId');
  if (!doc) throw new AppError(404, 'Bounce record not found');
  return doc;
}

export async function createBounceRecord(collegeId: string, data: any, performedBy: string) {
  const doc = await BounceRecord.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'BounceRecord',
    entityId: String(doc._id),
    entityName: `Bounce: ${doc.reason}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateBounceRecord(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await BounceRecord.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Bounce record not found');
  await createAuditLog({
    collegeId,
    entityType: 'BounceRecord',
    entityId: id,
    entityName: `Bounce: ${doc.reason}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteBounceRecord(collegeId: string, id: string, performedBy: string) {
  const doc = await BounceRecord.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Bounce record not found');
  await createAuditLog({
    collegeId,
    entityType: 'BounceRecord',
    entityId: id,
    entityName: `Bounce Record`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ OverpaymentRecord CRUD ═══════════════════════════════

export async function listOverpaymentRecords(
  collegeId: string,
  page = 1,
  limit = 20,
  studentId?: string,
  resolution?: string,
) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (resolution) filter.resolution = resolution;
  return paginate(OverpaymentRecord, filter, page, limit, { createdAt: -1 });
}

export async function getOverpaymentRecord(collegeId: string, id: string) {
  const doc = await OverpaymentRecord.findOne({ _id: id, collegeId }).populate('studentId paymentTransactionId invoiceId refundId');
  if (!doc) throw new AppError(404, 'Overpayment record not found');
  return doc;
}

export async function createOverpaymentRecord(collegeId: string, data: any, performedBy: string) {
  const doc = await OverpaymentRecord.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'OverpaymentRecord',
    entityId: String(doc._id),
    entityName: `Overpayment ₹${doc.overpaymentAmount}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateOverpaymentRecord(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await OverpaymentRecord.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Overpayment record not found');
  await createAuditLog({
    collegeId,
    entityType: 'OverpaymentRecord',
    entityId: id,
    entityName: `Overpayment ₹${doc.overpaymentAmount}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteOverpaymentRecord(collegeId: string, id: string, performedBy: string) {
  const doc = await OverpaymentRecord.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Overpayment record not found');
  await createAuditLog({
    collegeId,
    entityType: 'OverpaymentRecord',
    entityId: id,
    entityName: `Overpayment Record`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ W03 Phase 4: Scholarship & Concession Workflow Functions ════════════════

// W03-L2-026: Verify scholarship eligibility in batch
export async function verifyScholarshipEligibilityBatch(
  collegeId: string,
  academicYearId: string,
  performedBy: string,
) {
  const allocations = await ScholarshipAllocation.find({ collegeId, academicYearId }).lean();
  let eligible = 0;
  let pending = 0;

  for (const allocation of allocations) {
    const scholarship = await Scholarship.findOne({ _id: allocation.scholarshipId, collegeId }).lean();
    if (!scholarship) continue;
    const schemeCode = scholarship.type;
    const isEligible = allocation.status === 'approved';

    await ScholarshipEligibility.create({
      collegeId,
      studentId: allocation.studentId,
      schemeCode,
      academicYearId,
      status: isEligible ? 'eligible' : 'pending',
      verificationMethod: isEligible ? 'auto' : 'manual',
      verifiedAt: isEligible ? new Date() : undefined,
      documentsStatus: isEligible ? 'complete' : undefined,
    });

    if (isEligible) eligible++;
    else pending++;
  }

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipEligibility',
    entityId: academicYearId,
    entityName: `Eligibility Batch AY:${academicYearId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { total: allocations.length, eligible, pending };
}

// W03-L2-027: Submit scholarship claims in batch
export async function submitScholarshipClaimsBatch(
  collegeId: string,
  schemeCode: string,
  academicYearId: string,
  performedBy: string,
) {
  const eligibilities = await ScholarshipEligibility.find({
    collegeId,
    schemeCode,
    academicYearId,
    status: 'eligible',
  }).lean();

  let submitted = 0;
  let totalClaimAmount = 0;

  for (const eligibility of eligibilities) {
    const allocation = await ScholarshipAllocation.findOne({
      collegeId,
      studentId: eligibility.studentId,
      academicYearId,
    }).lean();
    if (!allocation) continue;

    await ScholarshipClaim.create({
      collegeId,
      scholarshipEligibilityId: eligibility._id,
      studentId: eligibility.studentId,
      schemeCode,
      academicYearId,
      claimAmount: allocation.amount,
    });

    submitted++;
    totalClaimAmount += allocation.amount;
  }

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipClaim',
    entityId: academicYearId,
    entityName: `Claims Batch scheme:${schemeCode} AY:${academicYearId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { submitted, totalClaimAmount };
}

// W03-L2-028: Poll scholarship claim status (stub for TS-EPass integration)
export async function pollScholarshipClaimStatus(
  collegeId: string,
  academicYearId: string,
  _performedBy: string,
) {
  const claims = await ScholarshipClaim.find({
    collegeId,
    academicYearId,
    status: 'submitted',
  }).lean();

  return { pending: claims.length, claims };
}

// W03-L2-029: Process scholarship disbursement
export async function processScholarshipDisbursement(
  collegeId: string,
  scholarshipClaimId: string,
  disbursedAmount: number,
  performedBy: string,
) {
  const claim = await ScholarshipClaim.findOne({ _id: scholarshipClaimId, collegeId });
  if (!claim) throw new AppError(404, 'Scholarship claim not found');
  if (claim.status !== 'approved') throw new AppError(400, 'Claim must be approved before disbursement');

  let receivable = await ScholarshipReceivable.findOne({ collegeId, scholarshipClaimId });
  if (!receivable) {
    receivable = await ScholarshipReceivable.create({
      collegeId,
      scholarshipClaimId,
      studentId: claim.studentId,
      expectedAmount: claim.claimAmount,
    });
  }

  receivable.status = 'disbursed';
  receivable.disbursedAmount = disbursedAmount;
  receivable.disbursedAt = new Date();
  await receivable.save();

  const invoice = await Invoice.findOne({
    collegeId,
    studentId: claim.studentId,
    status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
  });

  let creditApplied = false;
  let invoiceUpdated = false;

  if (invoice) {
    await ScholarshipCredit.create({
      collegeId,
      scholarshipReceivableId: receivable._id,
      studentId: claim.studentId,
      invoiceId: invoice._id,
      amount: disbursedAmount,
    });

    const currentAllocated = invoice.scholarshipAllocated ?? 0;
    invoice.scholarshipAllocated = currentAllocated + disbursedAmount;
    const netPayable = (invoice.netPayable ?? invoice.totalAmount) - disbursedAmount;
    invoice.netPayable = Math.max(0, netPayable);
    await invoice.save();

    creditApplied = true;
    invoiceUpdated = true;
  }

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipReceivable',
    entityId: String(receivable._id),
    entityName: `Disbursement for claim ${scholarshipClaimId}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return { creditApplied, invoiceUpdated };
}

// W03-L2-030: Convert receivable to liability
export async function convertReceivableToLiability(
  collegeId: string,
  receivableId: string,
  performedBy: string,
) {
  const receivable = await ScholarshipReceivable.findOne({ _id: receivableId, collegeId });
  if (!receivable) throw new AppError(404, 'Scholarship receivable not found');
  if (receivable.status !== 'pending' && receivable.status !== 'overdue') {
    throw new AppError(400, 'Only pending or overdue receivables can be converted to liability');
  }

  receivable.status = 'converted_to_liability';
  await receivable.save();

  const claim = await ScholarshipClaim.findOne({ _id: receivable.scholarshipClaimId, collegeId }).lean();
  if (claim) {
    const invoice = await Invoice.findOne({
      collegeId,
      studentId: claim.studentId,
      status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
    });
    if (invoice) {
      invoice.netPayable = (invoice.netPayable ?? invoice.totalAmount) + receivable.expectedAmount;
      await invoice.save();
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipReceivable',
    entityId: receivableId,
    entityName: `Receivable converted to liability`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return receivable;
}

// W03-L2-031: Process hardship concession from M06 welfare referral
export async function processHardshipConcession(
  collegeId: string,
  studentId: string,
  recommendedRelief: number,
  welfareReferralId: string | undefined,
  approvedBy: string,
  performedBy: string,
) {
  const currentYear = await AcademicYear.findOne({ collegeId }).sort({ createdAt: -1 }).lean();
  if (!currentYear) throw new AppError(404, 'No academic year found');

  const concession = await Concession.create({
    collegeId,
    studentId,
    type: 'financial_hardship',
    source: 'm06_referral',
    flatAmount: recommendedRelief,
    reason: 'Welfare referral hardship concession',
    approvedBy,
    academicYearId: currentYear._id,
    status: 'approved',
    welfareReferralId: welfareReferralId || undefined,
  });

  await createAuditLog({
    collegeId,
    entityType: 'Concession',
    entityId: String(concession._id),
    entityName: `Hardship concession for student ${studentId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return concession;
}

// W03-L2-032: Apply merit scholarship in batch
export async function applyMeritScholarshipBatch(
  collegeId: string,
  academicYearId: string,
  minCGPA: number,
  amount: number,
  maxRecipients: number,
  performedBy: string,
) {
  const results = await SemesterResult.find({
    collegeId,
    cgpa: { $gte: minCGPA },
  }).sort({ cgpa: -1 }).limit(maxRecipients).lean();

  let awarded = 0;

  for (const result of results) {
    await ScholarshipAllocation.create({
      collegeId,
      scholarshipId: result.studentId,
      studentId: result.studentId,
      academicYearId,
      amount,
      status: 'approved',
    });
    awarded++;
  }

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipAllocation',
    entityId: academicYearId,
    entityName: `Merit scholarship batch AY:${academicYearId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { awarded };
}

// W03-L2-033: Detect staff ward concessions (stub — requires M05 HR integration)
export async function detectStaffWardConcession(
  collegeId: string,
  academicYearId: string,
  performedBy: string,
) {
  await createAuditLog({
    collegeId,
    entityType: 'Concession',
    entityId: academicYearId,
    entityName: `Staff ward detection AY:${academicYearId}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return { detected: 0, message: 'Staff-ward detection requires M05 HR integration' };
}

// W03-L2-034: Renew scholarships in batch for new academic year
export async function renewScholarshipsBatch(
  collegeId: string,
  academicYearId: string,
  performedBy: string,
) {
  const priorAllocations = await ScholarshipAllocation.find({
    collegeId,
    status: 'approved',
  }).lean();

  let renewed = 0;

  for (const allocation of priorAllocations) {
    const scholarship = await Scholarship.findOne({ _id: allocation.scholarshipId, collegeId }).lean();
    if (!scholarship) continue;
    const schemeCode = scholarship.type;

    await ScholarshipEligibility.create({
      collegeId,
      studentId: allocation.studentId,
      schemeCode,
      academicYearId,
      status: 'pending',
      verificationMethod: 'manual',
    });
    renewed++;
  }

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipEligibility',
    entityId: academicYearId,
    entityName: `Renewal batch AY:${academicYearId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { renewed };
}

// ═══ ScholarshipEligibility CRUD ═════════════════════════════

export async function listScholarshipEligibilities(
  collegeId: string,
  page = 1,
  limit = 20,
  academicYearId?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  if (status) filter.status = status;
  return paginate(ScholarshipEligibility, filter, page, limit, { createdAt: -1 });
}

export async function getScholarshipEligibility(collegeId: string, id: string) {
  const doc = await ScholarshipEligibility.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship eligibility not found');
  return doc;
}

export async function createScholarshipEligibility(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await ScholarshipEligibility.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipEligibility',
    entityId: String(doc._id),
    entityName: `Eligibility for scheme ${String(doc.schemeCode)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateScholarshipEligibility(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await ScholarshipEligibility.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Scholarship eligibility not found');
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipEligibility',
    entityId: id,
    entityName: `Eligibility for scheme ${String(doc.schemeCode)}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteScholarshipEligibility(collegeId: string, id: string, performedBy: string) {
  const doc = await ScholarshipEligibility.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship eligibility not found');
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipEligibility',
    entityId: id,
    entityName: `Scholarship Eligibility`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ ScholarshipClaim CRUD ════════════════════════════════════

export async function listScholarshipClaims(
  collegeId: string,
  page = 1,
  limit = 20,
  academicYearId?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  if (status) filter.status = status;
  return paginate(ScholarshipClaim, filter, page, limit, { createdAt: -1 });
}

export async function getScholarshipClaim(collegeId: string, id: string) {
  const doc = await ScholarshipClaim.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship claim not found');
  return doc;
}

export async function createScholarshipClaim(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await ScholarshipClaim.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipClaim',
    entityId: String(doc._id),
    entityName: `Claim for scheme ${String(doc.schemeCode)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateScholarshipClaim(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await ScholarshipClaim.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Scholarship claim not found');
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipClaim',
    entityId: id,
    entityName: `Claim for scheme ${String(doc.schemeCode)}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteScholarshipClaim(collegeId: string, id: string, performedBy: string) {
  const doc = await ScholarshipClaim.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship claim not found');
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipClaim',
    entityId: id,
    entityName: `Scholarship Claim`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ ScholarshipReceivable CRUD ═══════════════════════════════

export async function listScholarshipReceivables(
  collegeId: string,
  page = 1,
  limit = 20,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(ScholarshipReceivable, filter, page, limit, { createdAt: -1 });
}

export async function getScholarshipReceivable(collegeId: string, id: string) {
  const doc = await ScholarshipReceivable.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship receivable not found');
  return doc;
}

export async function createScholarshipReceivable(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await ScholarshipReceivable.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipReceivable',
    entityId: String(doc._id),
    entityName: `Receivable ₹${doc.expectedAmount}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateScholarshipReceivable(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await ScholarshipReceivable.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Scholarship receivable not found');
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipReceivable',
    entityId: id,
    entityName: `Receivable ₹${doc.expectedAmount}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteScholarshipReceivable(collegeId: string, id: string, performedBy: string) {
  const doc = await ScholarshipReceivable.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship receivable not found');
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipReceivable',
    entityId: id,
    entityName: `Scholarship Receivable`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ ScholarshipCredit CRUD ═══════════════════════════════════

export async function listScholarshipCredits(
  collegeId: string,
  page = 1,
  limit = 20,
  studentId?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (studentId) filter.studentId = studentId;
  return paginate(ScholarshipCredit, filter, page, limit, { appliedAt: -1 });
}

export async function getScholarshipCredit(collegeId: string, id: string) {
  const doc = await ScholarshipCredit.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship credit not found');
  return doc;
}

export async function createScholarshipCredit(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await ScholarshipCredit.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipCredit',
    entityId: String(doc._id),
    entityName: `Credit ₹${doc.amount}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateScholarshipCredit(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await ScholarshipCredit.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Scholarship credit not found');
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipCredit',
    entityId: id,
    entityName: `Credit ₹${doc.amount}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteScholarshipCredit(collegeId: string, id: string, performedBy: string) {
  const doc = await ScholarshipCredit.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Scholarship credit not found');
  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipCredit',
    entityId: id,
    entityName: `Scholarship Credit`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══════════════════════════════════════════════════════════════
// W03 Phase 5: Defaulter Management (W03-L2-035 to W03-L2-046)
// ═══════════════════════════════════════════════════════════════

// ─── W03-L2-035: Identify Defaulters ─────────────────────────
export async function identifyDefaulters(collegeId: string, performedBy: string) {
  const now = new Date();
  const overdueInvoices = await Invoice.find({
    collegeId,
    status: { $in: ['sent', 'generated', 'partially_paid'] },
    dueDate: { $lt: now },
  }).lean();

  let identified = 0;
  let totalOverdueAmount = 0;

  for (const invoice of overdueInvoices) {
    const existing = await DefaulterRecord.findOne({
      collegeId,
      invoiceId: invoice._id,
      escalationStage: { $nin: ['resolved', 'exited_hardship', 'exited_write_off'] },
    }).lean();
    if (existing) continue;

    if (!invoice.studentId) continue;

    const daysOverdue = Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / 86400000);
    const overdueAmount = (invoice.netPayable ?? invoice.totalAmount) - (invoice.scholarshipAllocated ?? 0) - (invoice.concessionApplied ?? 0);

    let escalationStage: 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' = 'stage_1';
    if (daysOverdue >= 60) escalationStage = 'stage_4';
    else if (daysOverdue >= 21) escalationStage = 'stage_3';
    else if (daysOverdue >= 14) escalationStage = 'stage_2';
    else escalationStage = 'stage_1';

    await DefaulterRecord.create({
      collegeId,
      studentId: invoice.studentId,
      invoiceId: invoice._id,
      overdueAmount: Math.max(0, overdueAmount),
      daysOverdue,
      escalationStage,
    });

    identified++;
    totalOverdueAmount += Math.max(0, overdueAmount);
  }

  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: 'batch',
    entityName: `Defaulter Identification`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { identified, totalOverdueAmount };
}

// ─── W03-L2-036/037/041/044: Process Escalations ─────────────
export async function processEscalations(collegeId: string, performedBy: string) {
  const now = new Date();
  const activeRecords = await DefaulterRecord.find({
    collegeId,
    escalationStage: { $nin: ['resolved', 'exited_hardship', 'exited_write_off'] },
  }).lean();

  let processed = 0;
  let escalated = 0;
  const actions: unknown[] = [];

  for (const record of activeRecords) {
    const invoice = await Invoice.findOne({ _id: record.invoiceId, collegeId }).lean();
    if (!invoice) continue;

    const daysOverdue = Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / 86400000);
    const currentStage = record.escalationStage as string;
    let newStage = currentStage;
    let actionCreated: unknown = null;

    const stageOrder: Record<string, number> = {
      stage_1: 1, stage_2: 2, stage_3: 3, stage_4: 4,
      welfare_referred: 2.5, resolved: 99, exited_hardship: 99, exited_write_off: 99,
    };
    const currentOrder = stageOrder[currentStage] ?? 0;

    if (daysOverdue >= 60 && record.overdueAmount > 50000 && currentOrder < 4) {
      newStage = 'stage_4';
      actionCreated = await EscalationAction.create({
        collegeId,
        defaulterRecordId: record._id,
        actionType: 'legal_notice_flag',
        status: 'scheduled',
        executedAt: now,
      });
    } else if (daysOverdue >= 21 && currentOrder < 3 && record.welfareReferralStatus !== 'referred') {
      newStage = 'stage_3';
      actionCreated = await EscalationAction.create({
        collegeId,
        defaulterRecordId: record._id,
        actionType: 'hold_recommendation',
        status: 'scheduled',
        executedAt: now,
      });
    } else if (daysOverdue >= 14 && currentOrder < 2) {
      newStage = 'stage_2';
      actionCreated = await EscalationAction.create({
        collegeId,
        defaulterRecordId: record._id,
        actionType: 'whatsapp_parent',
        status: 'executed',
        executedAt: now,
      });
    } else if (daysOverdue >= 7 && currentStage === 'stage_1') {
      actionCreated = await EscalationAction.create({
        collegeId,
        defaulterRecordId: record._id,
        actionType: 'sms_reminder',
        status: 'executed',
        executedAt: now,
      });
    }

    const updateData: Record<string, unknown> = { daysOverdue };
    if (newStage !== currentStage) {
      updateData.escalationStage = newStage;
      escalated++;
    }

    await DefaulterRecord.findByIdAndUpdate(record._id, updateData);

    if (actionCreated) actions.push(actionCreated);
    processed++;
  }

  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: 'batch',
    entityName: `Escalation Processing`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return { processed, escalated, actions };
}

// ─── W03-L2-038: Compute Distress Score ──────────────────────
export async function computeDistressScore(collegeId: string, defaulterRecordId: string, performedBy: string) {
  const record = await DefaulterRecord.findOne({ _id: defaulterRecordId, collegeId });
  if (!record) throw new AppError(404, 'Defaulter record not found');

  const studentId = String(record.studentId);
  const signals: { type: string; value: number; weight: number }[] = [];

  // Signal 1: attendance_drop
  const attendanceSummary = await AttendanceSummary.findOne({ collegeId, studentId: record.studentId })
    .sort({ createdAt: -1 })
    .lean();
  const attendanceSignal = attendanceSummary
    ? Math.max(0, Math.min(1, (75 - attendanceSummary.percentage) / 75))
    : 0;
  signals.push({ type: 'attendance_drop', value: attendanceSignal, weight: 0.2 });

  // Signal 2: communication_withdrawal (stub)
  signals.push({ type: 'communication_withdrawal', value: 0, weight: 0.2 });

  // Signal 3: prior_welfare (stub)
  signals.push({ type: 'prior_welfare', value: 0, weight: 0.2 });

  // Signal 4: academic_decline
  const semesterResults = await SemesterResult.find({ collegeId, studentId: record.studentId })
    .sort({ createdAt: -1 })
    .limit(2)
    .lean();
  let academicSignal = 0;
  if (semesterResults.length >= 2) {
    const current = semesterResults[0]!;
    const prior = semesterResults[1]!;
    if (prior.sgpa > 0) {
      academicSignal = Math.max(0, Math.min(1, (prior.sgpa - current.sgpa) / prior.sgpa));
    }
  }
  signals.push({ type: 'academic_decline', value: academicSignal, weight: 0.2 });

  // Signal 5: scholarship_pending
  const pendingScholarship = await ScholarshipReceivable.findOne({
    collegeId,
    studentId: record.studentId,
    status: { $in: ['pending', 'overdue'] },
  }).lean();
  const scholarshipSignal = pendingScholarship ? 1.0 : 0;
  signals.push({ type: 'scholarship_pending', value: scholarshipSignal, weight: 0.2 });

  const distressScore = signals.reduce((sum, s) => sum + s.value * s.weight, 0);

  record.distressSignals = signals;
  record.distressScore = distressScore;
  await record.save();

  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: defaulterRecordId,
    entityName: `Distress Score: ${distressScore.toFixed(2)}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return {
    distressScore,
    signals,
    threshold: 0.6,
    recommendReferral: distressScore > 0.6,
    studentId,
  };
}

// ─── W03-L2-039: Refer to Welfare ────────────────────────────
export async function referToWelfare(collegeId: string, defaulterRecordId: string, performedBy: string) {
  const record = await DefaulterRecord.findOne({ _id: defaulterRecordId, collegeId });
  if (!record) throw new AppError(404, 'Defaulter record not found');

  const stageOrder: Record<string, number> = { stage_1: 1, stage_2: 2, stage_3: 3, stage_4: 4 };
  if ((stageOrder[record.escalationStage] ?? 0) < 2) {
    throw new AppError(400, 'Welfare referral requires escalation stage 2 or higher');
  }

  const referral = await WelfareReferral.create({
    collegeId,
    defaulterRecordId: record._id,
    studentId: record.studentId,
    distressScore: record.distressScore ?? 0,
    distressSignals: record.distressSignals,
    referredBy: performedBy,
  });

  record.welfareReferralStatus = 'referred';
  record.escalationStage = 'welfare_referred';
  await record.save();

  await EscalationAction.create({
    collegeId,
    defaulterRecordId: record._id,
    actionType: 'welfare_referral',
    status: 'executed',
    executedAt: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'WelfareReferral',
    entityId: String(referral._id),
    entityName: `Welfare Referral`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return referral;
}

// ─── W03-L2-040: Process Welfare Outcome ─────────────────────
export async function processWelfareOutcome(
  collegeId: string,
  defaulterRecordId: string,
  outcome: 'genuine_hardship' | 'no_distress' | 'inconclusive',
  m06CaseId: string | undefined,
  performedBy: string,
) {
  const record = await DefaulterRecord.findOne({ _id: defaulterRecordId, collegeId });
  if (!record) throw new AppError(404, 'Defaulter record not found');

  const referral = await WelfareReferral.findOne({ collegeId, defaulterRecordId: record._id });
  if (!referral) throw new AppError(404, 'Welfare referral not found');

  referral.outcome = outcome;
  referral.returnedAt = new Date();
  referral.referralStatus = 'returned';
  if (m06CaseId) referral.m06CaseId = m06CaseId;
  await referral.save();

  record.welfareReferralStatus = 'returned';

  if (outcome === 'genuine_hardship') {
    record.escalationStage = 'exited_hardship';
  } else if (outcome === 'no_distress') {
    record.escalationStage = 'stage_3';
  }
  // inconclusive: keep as welfare_referred

  await record.save();

  await createAuditLog({
    collegeId,
    entityType: 'WelfareReferral',
    entityId: String(referral._id),
    entityName: `Welfare Outcome: ${outcome}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return { outcome, newStage: record.escalationStage };
}

// ─── W03-L2-041: Recommend Holds ─────────────────────────────
export async function recommendHolds(collegeId: string, defaulterRecordId: string, performedBy: string) {
  const record = await DefaulterRecord.findOne({ _id: defaulterRecordId, collegeId });
  if (!record) throw new AppError(404, 'Defaulter record not found');

  let holdTypes: string[] = [];
  if (record.escalationStage === 'stage_4') {
    holdTypes = ['exam_debarment', 'hostel_restriction', 'transcript_hold', 'full_clearance_block'];
  } else if (record.escalationStage === 'stage_3') {
    holdTypes = ['exam_debarment', 'hostel_restriction', 'transcript_hold'];
  }

  await EscalationAction.create({
    collegeId,
    defaulterRecordId: record._id,
    actionType: 'hold_recommendation',
    status: 'executed',
    executedAt: new Date(),
    outcome: holdTypes.join(', '),
  });

  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: defaulterRecordId,
    entityName: `Hold Recommendation`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return { recommended: holdTypes };
}

// ─── W03-L2-042: Apply Financial Hold ────────────────────────
export async function applyFinancialHold(
  collegeId: string,
  studentId: string,
  defaulterRecordId: string,
  holdType: 'exam_debarment' | 'hostel_restriction' | 'transcript_hold' | 'full_clearance_block',
  approvedBy: string,
  performedBy: string,
) {
  const hold = await FinancialHold.create({
    collegeId,
    studentId,
    defaulterRecordId,
    holdType,
    approvedBy,
    holdStatus: 'active',
    effectiveDate: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'FinancialHold',
    entityId: String(hold._id),
    entityName: `Hold: ${holdType}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return hold;
}

// ─── W03-L2-043: Check Financial Holds ───────────────────────
export async function checkFinancialHolds(collegeId: string, studentId: string) {
  const holds = await FinancialHold.find({ collegeId, studentId, holdStatus: 'active' }).lean();
  const holdTypes = holds.map(h => h.holdType);
  const hasActiveHold = holds.length > 0;
  const message = hasActiveHold
    ? `Student has ${holds.length} active financial hold(s): ${holdTypes.join(', ')}`
    : 'No active financial holds';
  return { hasActiveHold, holdTypes, holds, message };
}

// ─── W03-L2-045: Release Financial Hold ──────────────────────
export async function releaseFinancialHold(collegeId: string, holdId: string, reason: string, performedBy: string) {
  const hold = await FinancialHold.findOne({ _id: holdId, collegeId });
  if (!hold) throw new AppError(404, 'Financial hold not found');

  hold.holdStatus = 'released';
  hold.releaseDate = new Date();
  hold.releasedBy = performedBy as unknown as typeof hold.releasedBy;
  hold.releaseReason = reason;
  await hold.save();

  await createAuditLog({
    collegeId,
    entityType: 'FinancialHold',
    entityId: holdId,
    entityName: `Hold Released`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return hold;
}

// ─── W03-L2-045: Resolve Defaulter ───────────────────────────
export async function resolveDefaulter(
  collegeId: string,
  defaulterRecordId: string,
  resolutionType: 'payment' | 'write_off' | 'concession' | 'other',
  performedBy: string,
) {
  const record = await DefaulterRecord.findOne({ _id: defaulterRecordId, collegeId });
  if (!record) throw new AppError(404, 'Defaulter record not found');

  record.escalationStage = 'resolved';
  record.resolutionDate = new Date();
  record.resolutionType = resolutionType;
  await record.save();

  // Release all active holds for this student+defaulter
  await FinancialHold.updateMany(
    { collegeId, studentId: record.studentId, defaulterRecordId: record._id, holdStatus: 'active' },
    { holdStatus: 'released', releaseDate: new Date(), releaseReason: `Auto-released on resolution: ${resolutionType}` },
  );

  // Cancel any scheduled escalation actions
  await EscalationAction.updateMany(
    { collegeId, defaulterRecordId: record._id, status: 'scheduled' },
    { status: 'cancelled' },
  );

  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: defaulterRecordId,
    entityName: `Resolved: ${resolutionType}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return record;
}

// ─── W03-L2-046: Log Phone Follow-Up ─────────────────────────
export async function logPhoneFollowUp(
  collegeId: string,
  defaulterRecordId: string,
  outcome: string,
  notes: string | undefined,
  performedBy: string,
) {
  const action = await EscalationAction.create({
    collegeId,
    defaulterRecordId,
    actionType: 'phone_call_flag',
    status: 'executed',
    executedAt: new Date(),
    outcome,
    notes,
  });

  await createAuditLog({
    collegeId,
    entityType: 'EscalationAction',
    entityId: String(action._id),
    entityName: `Phone Follow-Up`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return action;
}

// ─── DefaulterRecord CRUD ─────────────────────────────────────
export async function listDefaulterRecords(collegeId: string, page = 1, limit = 20, escalationStage?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (escalationStage) filter.escalationStage = escalationStage;
  return paginate(DefaulterRecord, filter, page, limit);
}

export async function getDefaulterRecord(collegeId: string, id: string) {
  const doc = await DefaulterRecord.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Defaulter record not found');
  return doc;
}

export async function createDefaulterRecord(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await DefaulterRecord.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: String(doc._id),
    entityName: `Defaulter Record`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateDefaulterRecord(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await DefaulterRecord.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Defaulter record not found');
  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: id,
    entityName: `Defaulter Record`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteDefaulterRecord(collegeId: string, id: string, performedBy: string) {
  const doc = await DefaulterRecord.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Defaulter record not found');
  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: id,
    entityName: `Defaulter Record`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ─── EscalationAction CRUD ────────────────────────────────────
export async function listEscalationActions(collegeId: string, page = 1, limit = 20) {
  return paginate(EscalationAction, { collegeId }, page, limit);
}

export async function getEscalationAction(collegeId: string, id: string) {
  const doc = await EscalationAction.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Escalation action not found');
  return doc;
}

export async function createEscalationAction(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await EscalationAction.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'EscalationAction',
    entityId: String(doc._id),
    entityName: `Escalation Action: ${doc.actionType}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateEscalationAction(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await EscalationAction.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Escalation action not found');
  await createAuditLog({
    collegeId,
    entityType: 'EscalationAction',
    entityId: id,
    entityName: `Escalation Action`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteEscalationAction(collegeId: string, id: string, performedBy: string) {
  const doc = await EscalationAction.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Escalation action not found');
  await createAuditLog({
    collegeId,
    entityType: 'EscalationAction',
    entityId: id,
    entityName: `Escalation Action`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ─── FinancialHold CRUD ───────────────────────────────────────
export async function listFinancialHolds(collegeId: string, page = 1, limit = 20, studentId?: string, holdStatus?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (holdStatus) filter.holdStatus = holdStatus;
  return paginate(FinancialHold, filter, page, limit);
}

export async function getFinancialHold(collegeId: string, id: string) {
  const doc = await FinancialHold.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Financial hold not found');
  return doc;
}

export async function updateFinancialHold(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await FinancialHold.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Financial hold not found');
  await createAuditLog({
    collegeId,
    entityType: 'FinancialHold',
    entityId: id,
    entityName: `Financial Hold`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteFinancialHold(collegeId: string, id: string, performedBy: string) {
  const doc = await FinancialHold.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Financial hold not found');
  await createAuditLog({
    collegeId,
    entityType: 'FinancialHold',
    entityId: id,
    entityName: `Financial Hold`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ─── WelfareReferral CRUD ─────────────────────────────────────
export async function listWelfareReferrals(collegeId: string, page = 1, limit = 20) {
  return paginate(WelfareReferral, { collegeId }, page, limit);
}

export async function getWelfareReferral(collegeId: string, id: string) {
  const doc = await WelfareReferral.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Welfare referral not found');
  return doc;
}

export async function createWelfareReferral(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await WelfareReferral.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'WelfareReferral',
    entityId: String(doc._id),
    entityName: `Welfare Referral`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateWelfareReferral(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await WelfareReferral.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Welfare referral not found');
  await createAuditLog({
    collegeId,
    entityType: 'WelfareReferral',
    entityId: id,
    entityName: `Welfare Referral`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteWelfareReferral(collegeId: string, id: string, performedBy: string) {
  const doc = await WelfareReferral.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Welfare referral not found');
  await createAuditLog({
    collegeId,
    entityType: 'WelfareReferral',
    entityId: id,
    entityName: `Welfare Referral`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ W03 Phase 7: Cross-Module Integration & Events ═════════

// W03-L2-052: Sync student financial status
export async function syncStudentFinancialStatus(collegeId: string, studentId: string, performedBy: string) {
  const student = await Student.findOne({ _id: studentId, collegeId });
  if (!student) throw new AppError(404, 'Student not found');

  const overdueCount = await Invoice.countDocuments({ collegeId, studentId, status: 'overdue' });
  const partialCount = await Invoice.countDocuments({ collegeId, studentId, status: 'partially_paid' });
  const unpaidCount = await Invoice.countDocuments({
    collegeId,
    studentId,
    status: { $nin: ['paid', 'cancelled', 'written_off'] },
  });

  let feeStatus: 'paid' | 'partial' | 'overdue' | 'clear';
  if (overdueCount > 0) {
    feeStatus = 'overdue';
  } else if (partialCount > 0) {
    feeStatus = 'partial';
  } else if (unpaidCount === 0) {
    feeStatus = 'clear';
  } else {
    feeStatus = 'paid';
  }

  const activeHolds = await FinancialHold.countDocuments({ collegeId, studentId, holdStatus: 'active' });
  const hasFinancialHold = activeHolds > 0;

  const activeScholarship = await ScholarshipEligibility.countDocuments({
    collegeId,
    studentId,
    status: 'eligible',
  });
  const pendingScholarship = await ScholarshipEligibility.countDocuments({
    collegeId,
    studentId,
    status: 'pending',
  });

  let scholarshipStatus: 'active' | 'none' | 'pending';
  if (activeScholarship > 0) {
    scholarshipStatus = 'active';
  } else if (pendingScholarship > 0) {
    scholarshipStatus = 'pending';
  } else {
    scholarshipStatus = 'none';
  }

  const changes: { field: string; displayName: string; oldValue: unknown; newValue: unknown }[] = [];
  if (student.feeStatus !== feeStatus) {
    changes.push({ field: 'feeStatus', displayName: 'Fee Status', oldValue: student.feeStatus, newValue: feeStatus });
  }
  if (student.hasFinancialHold !== hasFinancialHold) {
    changes.push({ field: 'hasFinancialHold', displayName: 'Has Financial Hold', oldValue: student.hasFinancialHold, newValue: hasFinancialHold });
  }
  if (student.scholarshipStatus !== scholarshipStatus) {
    changes.push({ field: 'scholarshipStatus', displayName: 'Scholarship Status', oldValue: student.scholarshipStatus, newValue: scholarshipStatus });
  }

  await Student.updateOne({ _id: studentId, collegeId }, { feeStatus, hasFinancialHold, scholarshipStatus });

  await createAuditLog({
    collegeId,
    entityType: 'Student',
    entityId: studentId,
    entityName: `Student financial status sync`,
    action: 'update',
    changes,
    performedBy,
  });

  return { studentId, feeStatus, hasFinancialHold, scholarshipStatus, changesApplied: changes.length };
}

// W03-L2-053: Check financial clearance
export async function checkFinancialClearance(collegeId: string, studentId: string) {
  const unpaidCount = await Invoice.countDocuments({
    collegeId,
    studentId,
    status: { $nin: ['paid', 'cancelled', 'written_off'] },
  });

  const activeDefaulters = await DefaulterRecord.countDocuments({
    collegeId,
    studentId,
    escalationStage: { $nin: ['resolved', 'exited_hardship', 'exited_write_off'] },
  });

  const holdCount = await FinancialHold.countDocuments({ collegeId, studentId, holdStatus: 'active' });

  const pendingRefundCount = await Refund.countDocuments({
    collegeId,
    studentId,
    status: { $in: ['requested', 'approved', 'processing'] },
  });

  const reasons: string[] = [];
  if (unpaidCount > 0) reasons.push(`${unpaidCount} unpaid invoice(s)`);
  if (activeDefaulters > 0) reasons.push(`${activeDefaulters} active defaulter record(s)`);
  if (holdCount > 0) reasons.push(`${holdCount} active financial hold(s)`);
  if (pendingRefundCount > 0) reasons.push(`${pendingRefundCount} pending refund(s)`);

  let clearanceStatus: 'CLEAR' | 'BLOCKED' | 'PENDING_REFUND';
  if (unpaidCount > 0 || holdCount > 0 || activeDefaulters > 0) {
    clearanceStatus = 'BLOCKED';
  } else if (pendingRefundCount > 0) {
    clearanceStatus = 'PENDING_REFUND';
  } else {
    clearanceStatus = 'CLEAR';
  }

  return { clearanceStatus, reasons, unpaidCount, holdCount, pendingRefundCount };
}

// W03-L2-054: Feed distress signals to welfare module
export async function feedDistressSignals(collegeId: string, defaulterRecordId: string) {
  const record = await DefaulterRecord.findOne({ _id: defaulterRecordId, collegeId }).lean();
  if (!record) throw new AppError(404, 'Defaulter record not found');

  return {
    defaulterRecordId: String(record._id),
    studentId: String(record.studentId),
    distressScore: record.distressScore ?? 0,
    distressSignals: record.distressSignals,
    escalationStage: record.escalationStage,
  };
}

// W03-L2-055: Receive independent hardship referral from welfare module
export async function receiveIndependentHardship(
  collegeId: string,
  data: { studentId: string; recommendedRelief: number; documentation?: string; referredBy: string },
  performedBy: string,
) {
  const currentYear = await AcademicYear.findOne({ collegeId }).sort({ createdAt: -1 }).lean();
  if (!currentYear) throw new AppError(404, 'No academic year found');

  const concession = await Concession.create({
    collegeId,
    studentId: data.studentId,
    type: 'financial_hardship',
    source: 'm06_referral',
    flatAmount: data.recommendedRelief,
    reason: data.documentation || 'Independent hardship referral from welfare module',
    approvedBy: data.referredBy,
    academicYearId: currentYear._id,
    status: 'approved',
  });

  await createAuditLog({
    collegeId,
    entityType: 'Concession',
    entityId: String(concession._id),
    entityName: `Independent hardship concession for student ${data.studentId}`,
    action: 'create',
    changes: [
      { field: 'source', displayName: 'Source', oldValue: null, newValue: 'm06_referral' },
      { field: 'recommendedRelief', displayName: 'Recommended Relief', oldValue: null, newValue: data.recommendedRelief },
    ],
    performedBy,
  });

  return concession;
}

// W03-L2-056: Revenue dashboard
export async function getRevenueDashboard(collegeId: string, academicYearId?: string) {
  const invoiceFilter: Record<string, unknown> = { collegeId };
  if (academicYearId) {
    const feeAgreements = await FeeAgreement.find({ collegeId, academicYearId }).select('_id').lean();
    const feeAgreementIds = feeAgreements.map(fa => fa._id);
    invoiceFilter.feeAgreementId = { $in: feeAgreementIds };
  }

  const invoiceAgg = await Invoice.aggregate([
    { $match: invoiceFilter },
    {
      $group: {
        _id: null,
        totalInvoiced: { $sum: { $ifNull: ['$netPayable', '$totalAmount'] } },
        totalCollected: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, { $ifNull: ['$netPayable', '$totalAmount'] }, 0] },
        },
        totalOverdue: {
          $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, { $ifNull: ['$netPayable', '$totalAmount'] }, 0] },
        },
      },
    },
  ]);

  const invoiceSummary = invoiceAgg[0] as { totalInvoiced: number; totalCollected: number; totalOverdue: number } | undefined;
  const totalInvoiced = invoiceSummary?.totalInvoiced ?? 0;
  const totalCollected = invoiceSummary?.totalCollected ?? 0;
  const totalOverdue = invoiceSummary?.totalOverdue ?? 0;
  const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 10000) / 100 : 0;
  const overdueRate = totalInvoiced > 0 ? Math.round((totalOverdue / totalInvoiced) * 10000) / 100 : 0;

  const channelAgg = await PaymentTransaction.aggregate([
    { $match: { collegeId } },
    { $group: { _id: '$channel', total: { $sum: '$amount' } } },
  ]);
  const receivedByChannel: Record<string, number> = {};
  for (const row of channelAgg) {
    const key = row._id as string;
    receivedByChannel[key] = (row as { total: number }).total;
  }

  const defaulterAgg = await DefaulterRecord.aggregate([
    { $match: { collegeId } },
    { $group: { _id: '$escalationStage', count: { $sum: 1 } } },
  ]);
  const defaultersByStage: Record<string, number> = {};
  for (const row of defaulterAgg) {
    const key = row._id as string;
    defaultersByStage[key] = (row as { count: number }).count;
  }

  const activeHolds = await FinancialHold.countDocuments({ collegeId, holdStatus: 'active' });

  const receivableAgg = await ScholarshipReceivable.aggregate([
    { $match: { collegeId } },
    {
      $group: {
        _id: null,
        totalPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$expectedAmount', 0] } },
        totalDisbursed: { $sum: { $ifNull: ['$disbursedAmount', 0] } },
      },
    },
  ]);
  const receivableSummary = receivableAgg[0] as { totalPending: number; totalDisbursed: number } | undefined;
  const scholarshipPending = receivableSummary?.totalPending ?? 0;
  const scholarshipDisbursed = receivableSummary?.totalDisbursed ?? 0;

  return {
    totalInvoiced,
    totalCollected,
    collectionRate,
    totalOverdue,
    overdueRate,
    receivedByChannel,
    defaultersByStage,
    activeHolds,
    scholarshipPending,
    scholarshipDisbursed,
  };
}

// W03-L2-057: Defaulter trend analysis
export async function getDefaulterTrendAnalysis(collegeId: string, months = 6) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const newDefaultersAgg = await DefaulterRecord.aggregate([
    { $match: { collegeId, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const resolvedAgg = await DefaulterRecord.aggregate([
    {
      $match: {
        collegeId,
        resolutionDate: { $gte: startDate },
        escalationStage: { $in: ['resolved', 'exited_hardship', 'exited_write_off'] },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$resolutionDate' },
          month: { $month: '$resolutionDate' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const newMap = new Map<string, number>();
  for (const row of newDefaultersAgg) {
    const key = `${(row._id as { year: number; month: number }).year}-${String((row._id as { year: number; month: number }).month).padStart(2, '0')}`;
    newMap.set(key, (row as { count: number }).count);
  }

  const resolvedMap = new Map<string, number>();
  for (const row of resolvedAgg) {
    const key = `${(row._id as { year: number; month: number }).year}-${String((row._id as { year: number; month: number }).month).padStart(2, '0')}`;
    resolvedMap.set(key, (row as { count: number }).count);
  }

  const trends: { month: string; newDefaulters: number; resolved: number; netChange: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const nd = newMap.get(key) ?? 0;
    const res = resolvedMap.get(key) ?? 0;
    trends.push({ month: key, newDefaulters: nd, resolved: res, netChange: nd - res });
  }

  const totalNew = trends.reduce((s, t) => s + t.newDefaulters, 0);
  const averageMonthly = months > 0 ? Math.round(totalNew / months) : 0;
  const currentMonth = trends[trends.length - 1];
  const anomalyDetected = currentMonth ? currentMonth.newDefaulters > averageMonthly * 1.5 : false;

  return {
    trends,
    anomalyDetected,
    averageMonthly,
    currentMonth: currentMonth ?? null,
  };
}

// W03-L2-058: Consume fee policy from governance module
export async function consumeFeePolicy(_collegeId: string) {
  // Configurable defaults — would come from M11 governance module in production
  return {
    feeCeilings: [
      { programmeType: 'B.Tech', maxTuition: 120000, maxHostel: 60000 },
      { programmeType: 'M.Tech', maxTuition: 80000, maxHostel: 50000 },
      { programmeType: 'MBA', maxTuition: 150000, maxHostel: 70000 },
      { programmeType: 'Diploma', maxTuition: 35000, maxHostel: 30000 },
    ],
    mandatoryComponents: ['tuition', 'examination', 'library', 'development'],
    deadlinePolicies: {
      lateFeePercent: 2,
      gracePeriodDays: 15,
    },
  };
}

// W03-L2-060: Orchestrate gateway payment
export async function orchestrateGatewayPayment(
  collegeId: string,
  data: { studentId: string; invoiceIds: string[]; returnUrl: string },
  performedBy: string,
) {
  if (data.invoiceIds.length === 0) throw new AppError(400, 'At least one invoice must be selected');

  const invoices = await Invoice.find({
    _id: { $in: data.invoiceIds },
    collegeId,
    studentId: data.studentId,
    status: { $nin: ['paid', 'cancelled', 'written_off'] },
  }).lean();

  if (invoices.length === 0) throw new AppError(404, 'No payable invoices found');

  const total = invoices.reduce((sum, inv) => sum + (inv.netPayable ?? inv.totalAmount), 0);
  const idempotencyKey = crypto.randomUUID();

  const log = await PaymentGatewayLog.create({
    collegeId,
    studentId: data.studentId,
    orderId: `ORD-${Date.now()}-${idempotencyKey.slice(0, 8)}`,
    gateway: 'razorpay',
    amount: total,
    currency: 'INR',
    status: 'initiated',
    idempotencyKey,
    invoiceId: invoices[0]?._id,
  });

  await createAuditLog({
    collegeId,
    entityType: 'PaymentGatewayLog',
    entityId: String(log._id),
    entityName: `Gateway payment initiated for student ${data.studentId}`,
    action: 'create',
    changes: [
      { field: 'amount', displayName: 'Amount', oldValue: null, newValue: total },
      { field: 'invoiceCount', displayName: 'Invoice Count', oldValue: null, newValue: invoices.length },
    ],
    performedBy,
  });

  return {
    orderId: String(log._id),
    amount: total,
    idempotencyKey,
    gatewaySessionUrl: `${data.returnUrl}?order=${String(log._id)}`,
  };
}

// W03-L2-061: Orchestrate TS-ePass integration
export async function orchestrateTSEPassIntegration(
  collegeId: string,
  data: { schemeCode: string; academicYearId: string },
  performedBy: string,
) {
  const eligibleRecords = await ScholarshipEligibility.find({
    collegeId,
    schemeCode: data.schemeCode,
    academicYearId: data.academicYearId,
    status: 'eligible',
  }).lean();

  let claimsSubmitted = 0;
  let claimsSkipped = 0;
  const studentIds: string[] = [];

  for (const record of eligibleRecords) {
    const existingClaim = await ScholarshipClaim.findOne({
      collegeId,
      scholarshipEligibilityId: record._id,
      studentId: record.studentId,
      academicYearId: data.academicYearId,
    }).lean();

    if (existingClaim) {
      claimsSkipped++;
      continue;
    }

    const claim = await ScholarshipClaim.create({
      collegeId,
      scholarshipEligibilityId: record._id,
      studentId: record.studentId,
      schemeCode: data.schemeCode,
      academicYearId: data.academicYearId,
      claimAmount: 0,
      status: 'submitted',
      portalReference: `TSEPASS-${Date.now()}-${String(record.studentId).slice(-6)}`,
    });

    studentIds.push(String(record.studentId));
    claimsSubmitted++;

    await createAuditLog({
      collegeId,
      entityType: 'ScholarshipClaim',
      entityId: String(claim._id),
      entityName: `TS-ePass claim for student ${String(record.studentId)}`,
      action: 'create',
      changes: [],
      performedBy,
    });
  }

  return { claimsSubmitted, claimsSkipped, studentIds };
}

// W03-L2-062: Execute reminder sequence for defaulter
export async function executeReminderSequence(
  collegeId: string,
  defaulterRecordId: string,
  performedBy: string,
) {
  const record = await DefaulterRecord.findOne({ _id: defaulterRecordId, collegeId }).lean();
  if (!record) throw new AppError(404, 'Defaulter record not found');

  const stage = record.escalationStage;
  const stageChannelMap: Record<string, string[]> = {
    stage_1: ['sms'],
    stage_2: ['whatsapp'],
    stage_3: ['email', 'sms'],
    stage_4: ['sms', 'email', 'whatsapp'],
  };
  const stageTemplateMap: Record<string, string> = {
    stage_1: 'TPL_STAGE1_SMS',
    stage_2: 'TPL_STAGE2_WHATSAPP',
    stage_3: 'TPL_STAGE3_EMAIL_SMS',
    stage_4: 'TPL_STAGE4_ALL',
  };

  const channels = stageChannelMap[stage] ?? ['sms'];
  const templateId = stageTemplateMap[stage] ?? 'TPL_DEFAULT';

  const reminders = [];
  for (const channel of channels) {
    const reminder = await FeeReminder.create({
      collegeId,
      studentId: record.studentId,
      channel,
      dueAmount: record.overdueAmount,
      status: 'sent',
      invoiceId: record.invoiceId,
      escalationStage: stage,
      defaulterRecordId: record._id,
      templateId,
      deliveryStatus: 'pending',
    });
    reminders.push(reminder);
  }

  const actionTypeMap: Record<string, 'sms_reminder' | 'whatsapp_parent' | 'phone_call_flag'> = {
    stage_1: 'sms_reminder',
    stage_2: 'whatsapp_parent',
    stage_3: 'sms_reminder',
    stage_4: 'sms_reminder',
  };

  await EscalationAction.create({
    collegeId,
    defaulterRecordId: record._id,
    actionType: actionTypeMap[stage] ?? 'sms_reminder',
    status: 'executed',
    executedAt: new Date(),
    outcome: `Sent ${channels.length} reminder(s) via ${channels.join(', ')}`,
  });

  await createAuditLog({
    collegeId,
    entityType: 'FeeReminder',
    entityId: defaulterRecordId,
    entityName: `Reminder sequence for defaulter ${defaulterRecordId}`,
    action: 'create',
    changes: [
      { field: 'channels', displayName: 'Channels', oldValue: null, newValue: channels.join(', ') },
      { field: 'escalationStage', displayName: 'Escalation Stage', oldValue: null, newValue: stage },
    ],
    performedBy,
  });

  return {
    remindersCreated: reminders.length,
    channel: channels.join(', '),
    escalationStage: stage,
  };
}
