import { FinancialLedger } from '../../models/finance/FinancialLedger';
import { RevenueReconciliationReport } from '../../models/finance/RevenueReconciliationReport';
import { Invoice } from '../../models/finance/Invoice';
import { PaymentTransaction } from '../../models/finance/PaymentTransaction';
import { ScholarshipCredit } from '../../models/finance/ScholarshipCredit';
import { Concession } from '../../models/finance/Concession';
import { Refund } from '../../models/finance/Refund';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface CreateJournalEntryInput {
  entryDate: Date;
  entryType: string;
  category: string;
  description: string;
  referenceId?: string;
  referenceType?: string;
  periodId?: string;
  studentId?: string;
  lines: JournalLine[];
}

// ---------------------------------------------------------------------------
// 1. Core double-entry journal entry
// ---------------------------------------------------------------------------

export async function createJournalEntry(collegeId: string, data: CreateJournalEntryInput) {
  if (data.lines.length < 2) {
    throw new AppError(400, 'Journal entry must have at least 2 lines');
  }

  const totalDebits = data.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = data.lines.reduce((sum, l) => sum + l.credit, 0);

  // Use a tolerance for floating-point comparison
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new AppError(400, 'Journal entry does not balance');
  }

  const journalEntryId = `JE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const docs = data.lines.map((line) => ({
    collegeId: new mongoose.Types.ObjectId(collegeId),
    entryDate: data.entryDate,
    entryType: data.entryType,
    category: data.category,
    description: data.description,
    debit: line.debit,
    credit: line.credit,
    balance: line.debit - line.credit,
    referenceId: data.referenceId,
    referenceType: data.referenceType,
    journalEntryId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    periodId: data.periodId,
    isLocked: false,
    ...(data.studentId ? { studentId: new mongoose.Types.ObjectId(data.studentId) } : {}),
  }));

  const entries = await FinancialLedger.insertMany(docs);
  return { journalEntryId, entries };
}

// ---------------------------------------------------------------------------
// 2. Invoice journal entry helper
// ---------------------------------------------------------------------------

export async function createInvoiceJournalEntry(
  collegeId: string,
  invoiceId: string,
  amount: number,
  studentId?: string,
  periodId?: string,
) {
  return createJournalEntry(collegeId, {
    entryDate: new Date(),
    entryType: 'income',
    category: 'fee_invoice',
    description: `Invoice ${invoiceId} raised`,
    referenceId: invoiceId,
    referenceType: 'Invoice',
    periodId,
    studentId,
    lines: [
      { accountCode: 'ACCT_REC', accountName: 'Accounts Receivable', debit: amount, credit: 0 },
      { accountCode: 'FEE_INCOME', accountName: 'Fee Income', debit: 0, credit: amount },
    ],
  });
}

// ---------------------------------------------------------------------------
// 3. Payment journal entry helper
// ---------------------------------------------------------------------------

export async function createPaymentJournalEntry(
  collegeId: string,
  paymentTransactionId: string,
  amount: number,
  channel: string,
  studentId?: string,
  periodId?: string,
) {
  const isCash = channel === 'cash';
  const debitCode = isCash ? 'CASH' : 'BANK';
  const debitName = isCash ? 'Cash' : 'Bank';

  return createJournalEntry(collegeId, {
    entryDate: new Date(),
    entryType: 'income',
    category: 'payment_received',
    description: `Payment ${paymentTransactionId} received via ${channel}`,
    referenceId: paymentTransactionId,
    referenceType: 'PaymentTransaction',
    periodId,
    studentId,
    lines: [
      { accountCode: debitCode, accountName: debitName, debit: amount, credit: 0 },
      { accountCode: 'ACCT_REC', accountName: 'Accounts Receivable', debit: 0, credit: amount },
    ],
  });
}

// ---------------------------------------------------------------------------
// 4. Scholarship journal entry helper
// ---------------------------------------------------------------------------

export async function createScholarshipJournalEntry(
  collegeId: string,
  scholarshipCreditId: string,
  amount: number,
  studentId?: string,
  periodId?: string,
) {
  return createJournalEntry(collegeId, {
    entryDate: new Date(),
    entryType: 'adjustment',
    category: 'scholarship_credit',
    description: `Scholarship credit ${scholarshipCreditId} applied`,
    referenceId: scholarshipCreditId,
    referenceType: 'ScholarshipCredit',
    periodId,
    studentId,
    lines: [
      { accountCode: 'SCHOLARSHIP_REC', accountName: 'Scholarship Receivable', debit: amount, credit: 0 },
      { accountCode: 'ACCT_REC', accountName: 'Accounts Receivable', debit: 0, credit: amount },
    ],
  });
}

// ---------------------------------------------------------------------------
// 5. Refund journal entry helper
// ---------------------------------------------------------------------------

export async function createRefundJournalEntry(
  collegeId: string,
  refundId: string,
  amount: number,
  studentId?: string,
  periodId?: string,
) {
  return createJournalEntry(collegeId, {
    entryDate: new Date(),
    entryType: 'expense',
    category: 'refund',
    description: `Refund ${refundId} processed`,
    referenceId: refundId,
    referenceType: 'Refund',
    periodId,
    studentId,
    lines: [
      { accountCode: 'REFUND_PAYABLE', accountName: 'Refund Payable', debit: amount, credit: 0 },
      { accountCode: 'BANK', accountName: 'Bank', debit: 0, credit: amount },
    ],
  });
}

// ---------------------------------------------------------------------------
// 6. Write-off journal entry helper
// ---------------------------------------------------------------------------

export async function createWriteOffJournalEntry(
  collegeId: string,
  invoiceId: string,
  amount: number,
  studentId?: string,
  periodId?: string,
) {
  return createJournalEntry(collegeId, {
    entryDate: new Date(),
    entryType: 'adjustment',
    category: 'write_off',
    description: `Invoice ${invoiceId} written off`,
    referenceId: invoiceId,
    referenceType: 'Invoice',
    periodId,
    studentId,
    lines: [
      { accountCode: 'BAD_DEBT', accountName: 'Bad Debt', debit: amount, credit: 0 },
      { accountCode: 'ACCT_REC', accountName: 'Accounts Receivable', debit: 0, credit: amount },
    ],
  });
}

// ---------------------------------------------------------------------------
// 7. Vendor payment journal entry helper
// ---------------------------------------------------------------------------

export async function createVendorPaymentJournalEntry(
  collegeId: string,
  vendorPaymentId: string,
  amount: number,
  periodId?: string,
) {
  return createJournalEntry(collegeId, {
    entryDate: new Date(),
    entryType: 'expense',
    category: 'vendor_payment',
    description: `Vendor payment ${vendorPaymentId} executed`,
    referenceId: vendorPaymentId,
    referenceType: 'VendorPayment',
    periodId,
    lines: [
      { accountCode: 'VENDOR_PAYABLE', accountName: 'Vendor Payable', debit: amount, credit: 0 },
      { accountCode: 'BANK', accountName: 'Bank', debit: 0, credit: amount },
    ],
  });
}

// ---------------------------------------------------------------------------
// 8. Get journal entry
// ---------------------------------------------------------------------------

export async function getJournalEntry(collegeId: string, journalEntryId: string) {
  const entries = await FinancialLedger.find({
    collegeId: new mongoose.Types.ObjectId(collegeId),
    journalEntryId,
  }).lean();
  return entries;
}

// ---------------------------------------------------------------------------
// 9. Get account balance
// ---------------------------------------------------------------------------

export async function getAccountBalance(
  collegeId: string,
  accountCode: string,
  asOfDate?: Date,
) {
  const match: Record<string, unknown> = {
    collegeId: new mongoose.Types.ObjectId(collegeId),
    accountCode,
  };
  if (asOfDate) {
    match['entryDate'] = { $lte: asOfDate };
  }

  const result = await FinancialLedger.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalDebit: { $sum: '$debit' },
        totalCredit: { $sum: '$credit' },
      },
    },
  ]);

  const row = result[0];
  const totalDebit = row ? (row as { totalDebit: number }).totalDebit : 0;
  const totalCredit = row ? (row as { totalCredit: number }).totalCredit : 0;

  return {
    accountCode,
    totalDebit,
    totalCredit,
    balance: totalDebit - totalCredit,
  };
}

// ---------------------------------------------------------------------------
// 10. Trial balance
// ---------------------------------------------------------------------------

export async function getTrialBalance(collegeId: string, periodId?: string) {
  const match: Record<string, unknown> = {
    collegeId: new mongoose.Types.ObjectId(collegeId),
    accountCode: { $exists: true, $ne: null },
  };
  if (periodId) {
    match['periodId'] = periodId;
  }

  const rows = await FinancialLedger.aggregate([
    { $match: match },
    {
      $group: {
        _id: { accountCode: '$accountCode', accountName: '$accountName' },
        totalDebit: { $sum: '$debit' },
        totalCredit: { $sum: '$credit' },
      },
    },
    { $sort: { '_id.accountCode': 1 } },
  ]);

  type AggRow = {
    _id: { accountCode: string; accountName: string };
    totalDebit: number;
    totalCredit: number;
  };

  let sumDebits = 0;
  let sumCredits = 0;

  const accounts = rows.map((r) => {
    const row = r as AggRow;
    sumDebits += row.totalDebit;
    sumCredits += row.totalCredit;
    return {
      accountCode: row._id.accountCode,
      accountName: row._id.accountName,
      totalDebit: row.totalDebit,
      totalCredit: row.totalCredit,
      balance: row.totalDebit - row.totalCredit,
    };
  });

  return {
    accounts,
    totalDebits: sumDebits,
    totalCredits: sumCredits,
    isBalanced: Math.abs(sumDebits - sumCredits) < 0.01,
  };
}

// ---------------------------------------------------------------------------
// 11. Generate audit records (W03-L2-067)
// ---------------------------------------------------------------------------

export async function generateAuditRecords(
  collegeId: string,
  data: { periodStart: Date; periodEnd: Date; academicYearId: string },
  performedBy: string,
) {
  const collegeOid = new mongoose.Types.ObjectId(collegeId);
  const dateFilter = { $gte: data.periodStart, $lte: data.periodEnd };

  const [ledgerEntries, invoices, payments, refunds] = await Promise.all([
    FinancialLedger.find({ collegeId: collegeOid, entryDate: dateFilter }).lean(),
    Invoice.find({ collegeId: collegeOid, issuedDate: dateFilter }).lean(),
    PaymentTransaction.find({ collegeId: collegeOid, paymentDate: dateFilter }).lean(),
    Refund.find({ collegeId: collegeOid, processedDate: dateFilter }).lean(),
  ]);

  const totalDebits = ledgerEntries.reduce((s, e) => s + (e.debit ?? 0), 0);
  const totalCredits = ledgerEntries.reduce((s, e) => s + (e.credit ?? 0), 0);

  await createAuditLog({
    collegeId,
    entityType: 'FinancialAudit',
    entityId: `audit-${data.periodStart.toISOString()}-${data.periodEnd.toISOString()}`,
    entityName: 'Financial Audit Export',
    action: 'create',
    changes: [
      { field: 'periodStart', displayName: 'Period Start', oldValue: null, newValue: data.periodStart.toISOString() },
      { field: 'periodEnd', displayName: 'Period End', oldValue: null, newValue: data.periodEnd.toISOString() },
    ],
    performedBy,
  });

  return {
    summary: {
      totalJournalEntries: ledgerEntries.length,
      totalInvoices: invoices.length,
      totalPayments: payments.length,
      totalRefunds: refunds.length,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    },
    exportDate: new Date(),
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
  };
}

// ---------------------------------------------------------------------------
// 12. Reconcile annual revenue (W03-L2-068)
// ---------------------------------------------------------------------------

export async function reconcileAnnualRevenue(
  collegeId: string,
  data: {
    academicYearId: string;
    periodStart: Date;
    periodEnd: Date;
    budgetAmount?: number;
  },
  performedBy: string,
) {
  const collegeOid = new mongoose.Types.ObjectId(collegeId);
  const academicYearOid = new mongoose.Types.ObjectId(data.academicYearId);
  const dateFilter = { $gte: data.periodStart, $lte: data.periodEnd };

  // Total invoiced (excluding cancelled)
  const invoiceAgg = await Invoice.aggregate([
    {
      $match: {
        collegeId: collegeOid,
        issuedDate: dateFilter,
        status: { $ne: 'cancelled' },
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$netPayable', '$totalAmount'] } } } },
  ]);
  const totalInvoiced = (invoiceAgg[0] as { total: number } | undefined)?.total ?? 0;

  // Total collected
  const paymentAgg = await PaymentTransaction.aggregate([
    { $match: { collegeId: collegeOid, paymentDate: dateFilter } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalCollected = (paymentAgg[0] as { total: number } | undefined)?.total ?? 0;

  // Scholarship offsets
  const scholarshipAgg = await ScholarshipCredit.aggregate([
    { $match: { collegeId: collegeOid, appliedAt: dateFilter } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const scholarshipOffsets = (scholarshipAgg[0] as { total: number } | undefined)?.total ?? 0;

  // Concessions granted (approved, effectiveFrom within period)
  const concessionAgg = await Concession.aggregate([
    {
      $match: {
        collegeId: collegeOid,
        status: 'approved',
        effectiveFrom: dateFilter,
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$flatAmount', 0] } } } },
  ]);
  const concessionsGranted = (concessionAgg[0] as { total: number } | undefined)?.total ?? 0;

  // Write-offs
  const writeOffAgg = await Invoice.aggregate([
    {
      $match: {
        collegeId: collegeOid,
        status: 'written_off',
        issuedDate: dateFilter,
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$netPayable', '$totalAmount'] } } } },
  ]);
  const writeOffs = (writeOffAgg[0] as { total: number } | undefined)?.total ?? 0;

  const outstandingReceivables =
    totalInvoiced - totalCollected - scholarshipOffsets - concessionsGranted - writeOffs;

  let budgetVariance: number | undefined;
  let budgetVariancePercent: number | undefined;
  if (data.budgetAmount != null && data.budgetAmount > 0) {
    budgetVariance = totalCollected - data.budgetAmount;
    budgetVariancePercent = (budgetVariance / data.budgetAmount) * 100;
  }

  const report = await RevenueReconciliationReport.findOneAndUpdate(
    { collegeId: collegeOid, academicYearId: academicYearOid },
    {
      $set: {
        totalInvoiced,
        totalCollected,
        scholarshipOffsets,
        concessionsGranted,
        writeOffs,
        outstandingReceivables,
        budgetAmount: data.budgetAmount,
        budgetVariance,
        budgetVariancePercent,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        generatedAt: new Date(),
        status: 'draft',
      },
      $setOnInsert: {
        collegeId: collegeOid,
        academicYearId: academicYearOid,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await createAuditLog({
    collegeId,
    entityType: 'RevenueReconciliationReport',
    entityId: String(report._id),
    entityName: `Revenue Reconciliation ${data.academicYearId}`,
    action: 'create',
    changes: [
      { field: 'totalInvoiced', displayName: 'Total Invoiced', oldValue: null, newValue: totalInvoiced },
      { field: 'totalCollected', displayName: 'Total Collected', oldValue: null, newValue: totalCollected },
      { field: 'outstandingReceivables', displayName: 'Outstanding Receivables', oldValue: null, newValue: outstandingReceivables },
    ],
    performedBy,
  });

  return report;
}

// ---------------------------------------------------------------------------
// 13. Close financial period (W03-L2-069)
// ---------------------------------------------------------------------------

export async function closeFinancialPeriod(
  collegeId: string,
  data: { periodId: string; academicYearId: string },
  performedBy: string,
) {
  const collegeOid = new mongoose.Types.ObjectId(collegeId);

  // Lock all ledger entries for this period
  const lockResult = await FinancialLedger.updateMany(
    { collegeId: collegeOid, periodId: data.periodId },
    { $set: { isLocked: true } },
  );

  // Carry forward: find students with non-zero ACCT_REC balance in this period
  const studentBalances = await FinancialLedger.aggregate([
    {
      $match: {
        collegeId: collegeOid,
        periodId: data.periodId,
        accountCode: 'ACCT_REC',
      },
    },
    {
      $group: {
        _id: '$studentId',
        totalDebit: { $sum: '$debit' },
        totalCredit: { $sum: '$credit' },
      },
    },
  ]);

  type StudentBalanceRow = { _id: mongoose.Types.ObjectId | null; totalDebit: number; totalCredit: number };

  let carriedForwardStudents = 0;
  let carriedForwardAmount = 0;

  for (const row of studentBalances) {
    const sb = row as StudentBalanceRow;
    const balance = sb.totalDebit - sb.totalCredit;
    if (Math.abs(balance) > 0.01 && sb._id) {
      carriedForwardStudents++;
      carriedForwardAmount += balance;

      // Create carry-forward journal entry for the new period
      await createJournalEntry(collegeId, {
        entryDate: new Date(),
        entryType: 'adjustment',
        category: 'carry_forward',
        description: `Carry forward from period ${data.periodId}`,
        referenceId: data.periodId,
        referenceType: 'PeriodClosure',
        periodId: `${data.periodId}-CF`,
        studentId: String(sb._id),
        lines: balance > 0
          ? [
              { accountCode: 'ACCT_REC', accountName: 'Accounts Receivable', debit: balance, credit: 0 },
              { accountCode: 'SUSPENSE', accountName: 'Suspense', debit: 0, credit: balance },
            ]
          : [
              { accountCode: 'SUSPENSE', accountName: 'Suspense', debit: Math.abs(balance), credit: 0 },
              { accountCode: 'ACCT_REC', accountName: 'Accounts Receivable', debit: 0, credit: Math.abs(balance) },
            ],
      });
    }
  }

  // Note: unresolved DefaulterRecord entries for this period carry forward implicitly.
  // They remain active until resolved through the defaulter management workflow.

  await createAuditLog({
    collegeId,
    entityType: 'FinancialPeriod',
    entityId: data.periodId,
    entityName: `Period ${data.periodId}`,
    action: 'update',
    changes: [
      { field: 'periodId', displayName: 'Period', oldValue: data.periodId, newValue: 'closed' },
      { field: 'lockedEntries', displayName: 'Locked Entries', oldValue: 0, newValue: lockResult.modifiedCount },
      { field: 'carriedForwardStudents', displayName: 'Carried Forward Students', oldValue: 0, newValue: carriedForwardStudents },
    ],
    performedBy,
  });

  return {
    lockedEntries: lockResult.modifiedCount,
    carriedForwardStudents,
    carriedForwardAmount,
  };
}

// ---------------------------------------------------------------------------
// 14. Finalize reconciliation report
// ---------------------------------------------------------------------------

export async function finalizeReconciliationReport(
  collegeId: string,
  reportId: string,
  performedBy: string,
) {
  const report = await RevenueReconciliationReport.findOne({
    _id: new mongoose.Types.ObjectId(reportId),
    collegeId: new mongoose.Types.ObjectId(collegeId),
  });

  if (!report) {
    throw new AppError(404, 'Revenue reconciliation report not found');
  }

  if (report.status === 'final') {
    throw new AppError(400, 'Report is already finalized');
  }

  report.status = 'final';
  report.finalizedBy = new mongoose.Types.ObjectId(performedBy) as unknown as mongoose.Schema.Types.ObjectId;
  report.finalizedAt = new Date();
  await report.save();

  await createAuditLog({
    collegeId,
    entityType: 'RevenueReconciliationReport',
    entityId: String(report._id),
    entityName: `Revenue Reconciliation ${String(report.academicYearId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'draft', newValue: 'final' },
      { field: 'finalizedBy', displayName: 'Finalized By', oldValue: null, newValue: performedBy },
    ],
    performedBy,
  });

  return report;
}

// ---------------------------------------------------------------------------
// 15. Standard CRUD for RevenueReconciliationReport
// ---------------------------------------------------------------------------

export async function listRevenueReconciliationReports(
  collegeId: string,
  page: number,
  limit: number,
) {
  return paginate(
    RevenueReconciliationReport,
    { collegeId: new mongoose.Types.ObjectId(collegeId) },
    page,
    limit,
  );
}

export async function getRevenueReconciliationReport(collegeId: string, id: string) {
  const report = await RevenueReconciliationReport.findOne({
    _id: new mongoose.Types.ObjectId(id),
    collegeId: new mongoose.Types.ObjectId(collegeId),
  });
  if (!report) {
    throw new AppError(404, 'Revenue reconciliation report not found');
  }
  return report;
}

export async function deleteRevenueReconciliationReport(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const report = await RevenueReconciliationReport.findOne({
    _id: new mongoose.Types.ObjectId(id),
    collegeId: new mongoose.Types.ObjectId(collegeId),
  });

  if (!report) {
    throw new AppError(404, 'Revenue reconciliation report not found');
  }

  if (report.status === 'final') {
    throw new AppError(400, 'Cannot delete a finalized report');
  }

  await RevenueReconciliationReport.deleteOne({ _id: report._id });

  await createAuditLog({
    collegeId,
    entityType: 'RevenueReconciliationReport',
    entityId: String(report._id),
    entityName: `Revenue Reconciliation ${String(report.academicYearId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return report;
}
