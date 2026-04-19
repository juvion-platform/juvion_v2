import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import * as service from '../service';
import * as fl from '../fee-lifecycle-service';
import { PaymentTransaction } from '../../../models/finance/PaymentTransaction';
import { Invoice } from '../../../models/finance/Invoice';
import { DefaulterRecord } from '../../../models/finance/DefaulterRecord';
import { FinancialHold } from '../../../models/finance/FinancialHold';
import { ScholarshipReceivable } from '../../../models/finance/ScholarshipReceivable';
import { ReconciliationEntry } from '../../../models/finance/ReconciliationEntry';
import { FinePenalty } from '../../../models/finance/FinePenalty';
import { StudentFeeAccount } from '../../../models/finance/StudentFeeAccount';
import { AuditLog } from '../../../shared/audit';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * Expanded finance unit-test coverage — Option C of the P1-2 plan.
 *
 * Focus: the "silent zero" bug pattern surfaced by PR #23 (raw string
 * collegeId passed into .aggregate($match) never matches because
 * Mongoose does not auto-cast inside the aggregation pipeline).
 * Six more aggregation sites in finance/service.ts had the same issue;
 * they're fixed in this PR too and the tests below lock the fix.
 *
 * Also adds tests for two money-mutation functions that had no coverage:
 *   - writeOffInvoice  (zeros student liability; writes to SFA)
 *   - handleBounce     (reverses a payment; creates bounce + penalty;
 *                       reverses SFA; recomputes invoice status)
 */

const oid = () => new mongoose.Types.ObjectId();

// ─────────────────────────────────────────────────────────────
// Dashboard aggregations (bug-fix lock-down)
// ─────────────────────────────────────────────────────────────

describe('finance.getReconciliationStatus', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('groups PaymentTransactions by reconciliationStatus for the college', async () => {
    const cid = String(oid());
    const studentId = oid();
    const invoiceId = oid();
    // 3 received, 1 matched, 1 reversed
    await PaymentTransaction.create([
      { collegeId: cid, studentId, invoiceId, amount: 100, channel: 'cash', paymentMode: 'cash', reconciliationStatus: 'received', paymentDate: new Date() },
      { collegeId: cid, studentId, invoiceId, amount: 100, channel: 'cash', paymentMode: 'cash', reconciliationStatus: 'received', paymentDate: new Date() },
      { collegeId: cid, studentId, invoiceId, amount: 100, channel: 'cash', paymentMode: 'cash', reconciliationStatus: 'received', paymentDate: new Date() },
      { collegeId: cid, studentId, invoiceId, amount: 100, channel: 'cash', paymentMode: 'cash', reconciliationStatus: 'matched', paymentDate: new Date() },
      { collegeId: cid, studentId, invoiceId, amount: 100, channel: 'cash', paymentMode: 'cash', reconciliationStatus: 'reversed', paymentDate: new Date() },
    ]);

    const status = await service.getReconciliationStatus(cid);
    // Count buckets correctly — pre-fix this returned all zeros.
    expect(status.transactions.received).toBe(3);
    expect(status.transactions.matched).toBe(1);
    expect(status.transactions.reversed).toBe(1);
  });

  it('is college-scoped — other colleges do not leak in', async () => {
    const cidA = String(oid());
    const cidB = String(oid());
    await PaymentTransaction.create({
      collegeId: cidA, studentId: oid(), invoiceId: oid(),
      amount: 100, channel: 'cash', paymentMode: 'cash',
      reconciliationStatus: 'received', paymentDate: new Date(),
    });
    await PaymentTransaction.create({
      collegeId: cidB, studentId: oid(), invoiceId: oid(),
      amount: 100, channel: 'cash', paymentMode: 'cash',
      reconciliationStatus: 'received', paymentDate: new Date(),
    });

    const statusA = await service.getReconciliationStatus(cidA);
    const statusB = await service.getReconciliationStatus(cidB);
    expect(statusA.transactions.received).toBe(1);
    expect(statusB.transactions.received).toBe(1);
  });

  it('returns empty buckets for a college with no data', async () => {
    const status = await service.getReconciliationStatus(String(oid()));
    expect(Object.keys(status.transactions).length).toBe(0);
  });

  it('groups ReconciliationEntry by status', async () => {
    const cid = String(oid());
    await ReconciliationEntry.create([
      { collegeId: cid, paymentTransactionId: oid(), matchedAmount: 100, status: 'matched' },
      { collegeId: cid, paymentTransactionId: oid(), matchedAmount: 100, status: 'matched' },
      { collegeId: cid, paymentTransactionId: oid(), matchedAmount: 100, status: 'discrepancy_flagged' },
    ]);
    const status = await service.getReconciliationStatus(cid);
    expect(status.entries.matched).toBe(2);
    expect(status.entries.discrepancy_flagged).toBe(1);
  });
});

describe('finance.getRevenueDashboard', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  async function seedInvoice(cid: string, opts: { status: string; total: number; net?: number }) {
    return Invoice.create({
      collegeId: cid,
      invoiceNumber: `INV-${Math.random().toString(36).slice(2, 7)}`,
      studentId: oid(),
      type: 'fee',
      totalAmount: opts.total,
      netPayable: opts.net,
      dueDate: new Date(),
      issuedDate: new Date(),
      status: opts.status,
    });
  }

  it('sums totalInvoiced / totalCollected / totalOverdue from Invoices', async () => {
    const cid = String(oid());
    // generated — counted in totalInvoiced only
    await seedInvoice(cid, { status: 'generated', total: 10000 });
    // paid — counted in totalInvoiced + totalCollected
    await seedInvoice(cid, { status: 'paid', total: 20000 });
    // overdue — counted in totalInvoiced + totalOverdue
    await seedInvoice(cid, { status: 'overdue', total: 5000 });

    const dash = await service.getRevenueDashboard(cid);
    // totalInvoiced sums all (generated + paid + overdue) = 35000
    // totalCollected = 20000; totalOverdue = 5000
    expect(dash.totalInvoiced).toBe(35000);
    expect(dash.totalCollected).toBe(20000);
    expect(dash.totalOverdue).toBe(5000);
    // collectionRate = 20000/35000 * 100 ≈ 57.14
    expect(dash.collectionRate).toBeCloseTo(57.14, 1);
    // overdueRate = 5000/35000 * 100 ≈ 14.29
    expect(dash.overdueRate).toBeCloseTo(14.29, 1);
  });

  it('uses netPayable when present, falls back to totalAmount', async () => {
    const cid = String(oid());
    await seedInvoice(cid, { status: 'paid', total: 10000, net: 8000 }); // discount applied

    const dash = await service.getRevenueDashboard(cid);
    expect(dash.totalInvoiced).toBe(8000);
    expect(dash.totalCollected).toBe(8000);
  });

  it('breaks down receivedByChannel from PaymentTransaction', async () => {
    const cid = String(oid());
    await PaymentTransaction.create([
      { collegeId: cid, studentId: oid(), invoiceId: oid(), amount: 1000, channel: 'gateway', paymentMode: 'upi', reconciliationStatus: 'received', paymentDate: new Date() },
      { collegeId: cid, studentId: oid(), invoiceId: oid(), amount: 500, channel: 'gateway', paymentMode: 'upi', reconciliationStatus: 'received', paymentDate: new Date() },
      { collegeId: cid, studentId: oid(), invoiceId: oid(), amount: 2000, channel: 'cash', paymentMode: 'cash', reconciliationStatus: 'received', paymentDate: new Date() },
    ]);
    const dash = await service.getRevenueDashboard(cid);
    expect(dash.receivedByChannel.gateway).toBe(1500);
    expect(dash.receivedByChannel.cash).toBe(2000);
  });

  it('breaks down defaultersByStage from DefaulterRecord', async () => {
    const cid = String(oid());
    await DefaulterRecord.create([
      { collegeId: cid, studentId: oid(), invoiceId: oid(), overdueAmount: 1000, daysOverdue: 10, escalationStage: 'stage_1', welfareReferralStatus: 'none', distressSignals: [] },
      { collegeId: cid, studentId: oid(), invoiceId: oid(), overdueAmount: 2000, daysOverdue: 30, escalationStage: 'stage_1', welfareReferralStatus: 'none', distressSignals: [] },
      { collegeId: cid, studentId: oid(), invoiceId: oid(), overdueAmount: 3000, daysOverdue: 60, escalationStage: 'stage_2', welfareReferralStatus: 'none', distressSignals: [] },
    ]);
    const dash = await service.getRevenueDashboard(cid);
    expect(dash.defaultersByStage.stage_1).toBe(2);
    expect(dash.defaultersByStage.stage_2).toBe(1);
  });

  it('counts activeHolds from FinancialHold', async () => {
    const cid = String(oid());
    await FinancialHold.create([
      { collegeId: cid, studentId: oid(), defaulterRecordId: oid(), holdType: 'transcript_hold', holdStatus: 'active', effectiveDate: new Date(), approvedBy: oid() },
      { collegeId: cid, studentId: oid(), defaulterRecordId: oid(), holdType: 'transcript_hold', holdStatus: 'released', effectiveDate: new Date(), approvedBy: oid() },
    ]);
    const dash = await service.getRevenueDashboard(cid);
    expect(dash.activeHolds).toBe(1);
  });

  it('sums scholarship receivable totals', async () => {
    const cid = String(oid());
    await ScholarshipReceivable.create([
      { collegeId: cid, scholarshipClaimId: oid(), studentId: oid(), expectedAmount: 10000, status: 'pending' },
      { collegeId: cid, scholarshipClaimId: oid(), studentId: oid(), expectedAmount: 5000, disbursedAmount: 5000, status: 'disbursed' },
    ]);
    const dash = await service.getRevenueDashboard(cid);
    expect(dash.scholarshipPending).toBe(10000);
    expect(dash.scholarshipDisbursed).toBe(5000);
  });

  it('returns zeros for empty college (proves the fix — would have been zeros even with data pre-fix)', async () => {
    const dash = await service.getRevenueDashboard(String(oid()));
    expect(dash.totalInvoiced).toBe(0);
    expect(dash.totalCollected).toBe(0);
    expect(dash.collectionRate).toBe(0);
  });

  it('scopes across colleges — tenant A data does not bleed into B', async () => {
    const cidA = String(oid());
    const cidB = String(oid());
    await seedInvoice(cidA, { status: 'paid', total: 10000 });
    await seedInvoice(cidB, { status: 'paid', total: 99999 });

    const dashA = await service.getRevenueDashboard(cidA);
    const dashB = await service.getRevenueDashboard(cidB);
    expect(dashA.totalCollected).toBe(10000);
    expect(dashB.totalCollected).toBe(99999);
  });
});

describe('finance.getDefaulterTrendAnalysis', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('groups new-defaulter counts by {year, month} within the window', async () => {
    const cid = String(oid());
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 5);
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 5); // outside 6-month window

    async function makeDR(when: Date) {
      const d = await DefaulterRecord.create({
        collegeId: cid, studentId: oid(), invoiceId: oid(),
        overdueAmount: 1000, daysOverdue: 10, escalationStage: 'stage_1',
        welfareReferralStatus: 'none', distressSignals: [],
      });
      // Mongoose 8 guards the managed `createdAt` via schema timestamps —
      // $set doesn't actually rewrite it. Drop to the raw driver to force
      // a backdated timestamp for the windowing test.
      await DefaulterRecord.collection.updateOne(
        { _id: d._id },
        { $set: { createdAt: when, updatedAt: when } },
      );
    }

    await makeDR(thisMonth);
    await makeDR(thisMonth);
    await makeDR(lastMonth);
    await makeDR(yearAgo);

    const trend = await service.getDefaulterTrendAnalysis(cid, 6);
    // Return shape: { trends: [{ month, newDefaulters, resolved, netChange }], ... }
    // Sum the newDefaulters across the 6-month window — should be 3 (this
    // month + this month + last month; year-old record excluded).
    const total = trend.trends.reduce((s, t) => s + t.newDefaulters, 0);
    expect(total).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// writeOffInvoice (fee-lifecycle-service.ts)
// ─────────────────────────────────────────────────────────────

describe('fee-lifecycle.writeOffInvoice', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  async function seedOverdueInvoice(cid: string, studentId: mongoose.Types.ObjectId, outstanding: number) {
    return Invoice.create({
      collegeId: cid,
      invoiceNumber: `INV-W-${Math.random().toString(36).slice(2, 7)}`,
      studentId,
      type: 'fee',
      totalAmount: outstanding,
      dueDate: new Date('2020-01-01'),
      status: 'overdue',
    });
  }

  it('transitions invoice status to written_off', async () => {
    const cid = String(oid());
    const studentId = oid();
    const inv = await seedOverdueInvoice(cid, studentId, 10000);

    const result = await fl.writeOffInvoice(cid, String(inv._id), {
      reason: 'uncollectable after 2 years',
      approvedBy: String(oid()),
    }, 'finance-admin');

    expect(result.status).toBe('written_off');
    const reloaded = await Invoice.findById(inv._id);
    expect(reloaded?.status).toBe('written_off');
  });

  it('increments StudentFeeAccount.totalWaived and decrements balance', async () => {
    const cid = String(oid());
    const studentId = oid();
    // Pre-existing SFA with balance
    await StudentFeeAccount.create({
      collegeId: cid, studentId, totalDue: 10000, totalPaid: 0,
      totalWaived: 0, totalRefunded: 0, balance: 10000,
    });
    const inv = await seedOverdueInvoice(cid, studentId, 10000);

    await fl.writeOffInvoice(cid, String(inv._id), { reason: 'uncollectable', approvedBy: String(oid()) }, 'u');

    const sfa = await StudentFeeAccount.findOne({ collegeId: cid, studentId });
    expect(sfa?.totalWaived).toBe(10000);
    expect(sfa?.balance).toBe(0);
  });

  it('uses netPayable over totalAmount when present', async () => {
    const cid = String(oid());
    const studentId = oid();
    await StudentFeeAccount.create({
      collegeId: cid, studentId, totalDue: 0, totalPaid: 0,
      totalWaived: 0, totalRefunded: 0, balance: 8000,
    });
    const inv = await Invoice.create({
      collegeId: cid, invoiceNumber: 'INV-W2', studentId,
      type: 'fee', totalAmount: 10000, netPayable: 8000,
      dueDate: new Date('2020-01-01'), status: 'overdue',
    });

    await fl.writeOffInvoice(cid, String(inv._id), { reason: 'uncollectable', approvedBy: String(oid()) }, 'u');

    const sfa = await StudentFeeAccount.findOne({ collegeId: cid, studentId });
    expect(sfa?.totalWaived).toBe(8000); // netPayable, not totalAmount
  });

  it('rejects 404 when invoice not found', async () => {
    const cid = String(oid());
    await expect(
      fl.writeOffInvoice(cid, String(oid()), { reason: 'x', approvedBy: String(oid()) }, 'u'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('writes an audit log entry with the old→new status change', async () => {
    const cid = String(oid());
    const studentId = oid();
    const inv = await seedOverdueInvoice(cid, studentId, 1000);
    await fl.writeOffInvoice(cid, String(inv._id), { reason: 'writeoff', approvedBy: String(oid()) }, 'auditor');

    const audits = await AuditLog.find({ collegeId: cid, entityType: 'Invoice' });
    expect(audits.length).toBe(1);
    expect(audits[0]!.performedBy).toBe('auditor');
    const statusChange = audits[0]!.changes.find((c) => c.field === 'status');
    expect(statusChange?.oldValue).toBe('overdue');
    expect(statusChange?.newValue).toBe('written_off');
  });
});

// ─────────────────────────────────────────────────────────────
// handleBounce (fee-lifecycle-service.ts)
// ─────────────────────────────────────────────────────────────

describe('fee-lifecycle.handleBounce', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  async function seedPaidInvoice(cid: string, studentId: mongoose.Types.ObjectId, amount = 10000) {
    const invoice = await Invoice.create({
      collegeId: cid, invoiceNumber: `INV-B-${Math.random().toString(36).slice(2, 6)}`,
      studentId, type: 'fee', totalAmount: amount, dueDate: new Date(), status: 'paid',
    });
    const txn = await PaymentTransaction.create({
      collegeId: cid, studentId, invoiceId: invoice._id,
      amount, channel: 'dd', paymentMode: 'dd',
      reconciliationStatus: 'matched', paymentDate: new Date(),
    });
    return { invoice, txn };
  }

  it('reverses the payment transaction and flags it reversed', async () => {
    const cid = String(oid());
    const studentId = oid();
    const { txn } = await seedPaidInvoice(cid, studentId);

    await fl.handleBounce(cid, String(txn._id), { reason: 'insufficient funds' }, 'bank-ops');
    const reloaded = await PaymentTransaction.findById(txn._id);
    expect(reloaded?.reconciliationStatus).toBe('reversed');
  });

  it('creates a BounceRecord linked to the reversed payment', async () => {
    const cid = String(oid());
    const studentId = oid();
    const { txn } = await seedPaidInvoice(cid, studentId);

    const bounce = await fl.handleBounce(cid, String(txn._id), { reason: 'signature mismatch' }, 'u');
    expect(String(bounce.paymentTransactionId)).toBe(String(txn._id));
    expect(bounce.reason).toBe('signature mismatch');
    expect(bounce.penaltyAmount).toBe(500);
  });

  it('creates a FinePenalty for the bounce penalty', async () => {
    const cid = String(oid());
    const studentId = oid();
    const { txn } = await seedPaidInvoice(cid, studentId);

    await fl.handleBounce(cid, String(txn._id), { reason: 'bounce' }, 'u');
    const penalty = await FinePenalty.findOne({ collegeId: cid, studentId, type: 'other' });
    expect(penalty).toBeTruthy();
    expect(penalty?.amount).toBe(500);
    expect(penalty?.status).toBe('pending');
  });

  it('recomputes invoice to generated/overdue when no other payments remain', async () => {
    const cid = String(oid());
    const studentId = oid();
    const { invoice, txn } = await seedPaidInvoice(cid, studentId, 10000);
    // Backdate the dueDate to make 'overdue' the expected branch
    invoice.dueDate = new Date('2020-01-01');
    await invoice.save();

    await fl.handleBounce(cid, String(txn._id), { reason: 'bounce' }, 'u');

    const reloaded = await Invoice.findById(invoice._id);
    expect(reloaded?.status).toBe('overdue');
  });

  it('recomputes invoice to partially_paid when some valid payments remain', async () => {
    const cid = String(oid());
    const studentId = oid();
    const invoice = await Invoice.create({
      collegeId: cid, invoiceNumber: 'INV-B2', studentId,
      type: 'fee', totalAmount: 10000, dueDate: new Date(), status: 'paid',
    });
    // Bounce txn (5000) + a valid residual txn (3000)
    const bouncingTxn = await PaymentTransaction.create({
      collegeId: cid, studentId, invoiceId: invoice._id,
      amount: 5000, channel: 'dd', paymentMode: 'dd',
      reconciliationStatus: 'matched', paymentDate: new Date(),
    });
    await PaymentTransaction.create({
      collegeId: cid, studentId, invoiceId: invoice._id,
      amount: 3000, channel: 'cash', paymentMode: 'cash',
      reconciliationStatus: 'matched', paymentDate: new Date(),
    });

    await fl.handleBounce(cid, String(bouncingTxn._id), { reason: 'bounce' }, 'u');

    const reloaded = await Invoice.findById(invoice._id);
    expect(reloaded?.status).toBe('partially_paid');
  });

  it('reverses StudentFeeAccount totals', async () => {
    const cid = String(oid());
    const studentId = oid();
    await StudentFeeAccount.create({
      collegeId: cid, studentId, totalDue: 10000, totalPaid: 10000,
      totalWaived: 0, totalRefunded: 0, balance: 0,
    });
    const { txn } = await seedPaidInvoice(cid, studentId, 10000);

    await fl.handleBounce(cid, String(txn._id), { reason: 'bounce' }, 'u');

    const sfa = await StudentFeeAccount.findOne({ collegeId: cid, studentId });
    expect(sfa?.totalPaid).toBe(0);
    expect(sfa?.balance).toBe(10000);
  });

  it('rejects 404 when paymentId not found', async () => {
    const cid = String(oid());
    await expect(
      fl.handleBounce(cid, String(oid()), { reason: 'x' }, 'u'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
