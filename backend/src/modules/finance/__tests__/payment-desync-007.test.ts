/**
 * 007 · T6 — payment desync closure.
 *
 * Two guarantees: (1) the schemas make `status`/`amount`/`invoiceId` unreachable via the
 * API (create strips status; update is standalone-strict), and (2) deletePayment REVERSES
 * a settled invoice-linked payment — the correction path once the UI status controls are
 * gone. Removing the UI closed the convenient path; this closes the vector.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Types } from 'mongoose';

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock' }),
}));

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Payment } from '../../../models/finance/Payment';
import { Invoice } from '../../../models/finance/Invoice';
import { StudentFeeAccount } from '../../../models/finance/StudentFeeAccount';
import { deletePayment } from '../service';
import { createPaymentSchema, updatePaymentSchema } from '../validation';

// ── Schema lockdown (no DB) ───────────────────────────────────────────
describe('007 T6 — payment schema lockdown', () => {
  it('createPaymentSchema strips status (default success is the only reachable value)', () => {
    const r = createPaymentSchema.safeParse({ studentId: 's', amount: 100, paymentMode: 'cash', status: 'pending', invoiceId: 'inv1' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect('status' in r.data).toBe(false);
    expect(r.data.invoiceId).toBe('inv1');
  });

  it('updatePaymentSchema accepts only remarks/transactionRef and rejects financial fields', () => {
    expect(updatePaymentSchema.safeParse({ remarks: 'x', transactionRef: 't' }).success).toBe(true);
    expect(updatePaymentSchema.safeParse({ amount: 100 }).success).toBe(false);
    expect(updatePaymentSchema.safeParse({ status: 'reversed' }).success).toBe(false);
    expect(updatePaymentSchema.safeParse({ invoiceId: 'x' }).success).toBe(false);
  });
});

// ── Reversing delete (DB) ─────────────────────────────────────────────
describe('007 T6 — deletePayment reverses a settled invoice-linked payment', () => {
  const COLLEGE = new Types.ObjectId();
  const cid = String(COLLEGE);

  beforeAll(async () => { await setupMongo(); }, 90_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  async function seed(opts: { payments: Array<{ amount: number }>; invoiceStatus: string; acct: { totalPaid: number; balance: number } }) {
    const studentId = new Types.ObjectId();
    const invoice = await Invoice.create({
      collegeId: COLLEGE, invoiceNumber: `INV-${Math.floor(Number(String(Date.now()).slice(-6)))}-${opts.invoiceStatus}`,
      type: 'fee', isSemesterInstallment: true, totalAmount: 45000, netPayable: 45000,
      dueDate: new Date(), status: opts.invoiceStatus, studentId, semesterId: new Types.ObjectId(),
    });
    await StudentFeeAccount.create({ collegeId: COLLEGE, studentId, totalDue: 45000, totalPaid: opts.acct.totalPaid, balance: opts.acct.balance });
    const payments = [];
    let n = 0;
    for (const p of opts.payments) {
      payments.push(await Payment.create({
        collegeId: COLLEGE, studentId, receiptNumber: `RCP-${opts.invoiceStatus}-${n++}`,
        amount: p.amount, paymentMode: 'cash', status: 'success', invoiceId: invoice._id,
      }));
    }
    return { studentId, invoice, payments };
  }

  it('full reversal: deleting the only payment restores balance and sets invoice to generated', async () => {
    const { studentId, invoice, payments } = await seed({
      payments: [{ amount: 20000 }], invoiceStatus: 'partially_paid', acct: { totalPaid: 20000, balance: 25000 },
    });
    await deletePayment(cid, String(payments[0]!._id), 'admin');

    expect(await Payment.countDocuments({ _id: payments[0]!._id })).toBe(0);
    const acct = await StudentFeeAccount.findOne({ collegeId: COLLEGE, studentId }).lean();
    expect(acct?.balance).toBe(45000);
    expect(acct?.totalPaid).toBe(0);
    const inv = await Invoice.findById(invoice._id).lean();
    expect(inv?.status).toBe('generated');
  });

  it('partial reversal: deleting one of two payments reverts paid→partially_paid', async () => {
    const { studentId, invoice, payments } = await seed({
      payments: [{ amount: 20000 }, { amount: 25000 }], invoiceStatus: 'paid', acct: { totalPaid: 45000, balance: 0 },
    });
    await deletePayment(cid, String(payments[0]!._id), 'admin'); // remove the 20000

    const acct = await StudentFeeAccount.findOne({ collegeId: COLLEGE, studentId }).lean();
    expect(acct?.balance).toBe(20000);
    expect(acct?.totalPaid).toBe(25000);
    const inv = await Invoice.findById(invoice._id).lean();
    expect(inv?.status).toBe('partially_paid');
  });

  it('bare payment (no invoiceId) delete does not touch any balance', async () => {
    const studentId = new Types.ObjectId();
    await StudentFeeAccount.create({ collegeId: COLLEGE, studentId, totalDue: 10000, totalPaid: 0, balance: 10000 });
    const bare = await Payment.create({
      collegeId: COLLEGE, studentId, receiptNumber: 'RCP-BARE', amount: 5000, paymentMode: 'cash', status: 'success',
    });
    await deletePayment(cid, String(bare._id), 'admin');

    const acct = await StudentFeeAccount.findOne({ collegeId: COLLEGE, studentId }).lean();
    expect(acct?.balance).toBe(10000); // untouched
  });
});
