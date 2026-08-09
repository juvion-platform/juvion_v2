/**
 * 007 · T7 — createPayment applies to the invoice + student balance.
 *
 * The payment→AR link: recording a payment against an invoice settles that invoice and
 * drops StudentFeeAccount.balance, so the dashboard's net AR falls live (incl. partials).
 * Overpayment is rejected BEFORE any write. A bare payment (no invoiceId) still records.
 *
 * NB: this runs before T8, so the guardian gate still enforces — fixtures set
 * feeResponsibleParentId so createPayment isn't blocked at the door.
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
import { Student } from '../../../models/people/Student';
import { Payment } from '../../../models/finance/Payment';
import { Invoice } from '../../../models/finance/Invoice';
import { StudentFeeAccount } from '../../../models/finance/StudentFeeAccount';
import { createPayment } from '../service';

const COLLEGE = new Types.ObjectId();
const cid = String(COLLEGE);

async function seedBilledStudent(net = 45000) {
  const student = await Student.create({
    collegeId: COLLEGE, personId: new Types.ObjectId(), admissionYear: 2025,
    status: 'active', feeResponsibleParentId: new Types.ObjectId(),
  });
  const invoice = await Invoice.create({
    collegeId: COLLEGE, invoiceNumber: `INV-${String(student._id).slice(-6)}`, type: 'fee',
    isSemesterInstallment: true, totalAmount: net, netPayable: net, dueDate: new Date(),
    status: 'generated', studentId: student._id, semesterId: new Types.ObjectId(),
  });
  await StudentFeeAccount.create({ collegeId: COLLEGE, studentId: student._id, totalDue: net, totalPaid: 0, balance: net });
  return { studentId: String(student._id), invoiceId: String(invoice._id) };
}

beforeAll(async () => { await setupMongo(); }, 90_000);
afterAll(async () => { await teardownMongo(); }, 30_000);
afterEach(async () => { await clearCollections(); });

describe('007 T7 — createPayment invoice application', () => {
  it('partial payment → invoice partially_paid, balance drops by the amount', async () => {
    const { studentId, invoiceId } = await seedBilledStudent(45000);
    await createPayment(cid, { studentId, amount: 20000, paymentMode: 'cash', invoiceId }, 'admin');

    const inv = await Invoice.findById(invoiceId).lean();
    expect(inv?.status).toBe('partially_paid');
    const acct = await StudentFeeAccount.findOne({ collegeId: COLLEGE, studentId }).lean();
    expect(acct?.balance).toBe(25000);
    expect(acct?.totalPaid).toBe(20000);
    const pay = await Payment.findOne({ studentId, invoiceId }).lean();
    expect(pay?.status).toBe('success');
  });

  it('full payment → invoice paid, balance zero', async () => {
    const { studentId, invoiceId } = await seedBilledStudent(45000);
    await createPayment(cid, { studentId, amount: 45000, paymentMode: 'cash', invoiceId }, 'admin');

    const inv = await Invoice.findById(invoiceId).lean();
    expect(inv?.status).toBe('paid');
    const acct = await StudentFeeAccount.findOne({ collegeId: COLLEGE, studentId }).lean();
    expect(acct?.balance).toBe(0);
  });

  it('two payments settle the invoice cumulatively', async () => {
    const { studentId, invoiceId } = await seedBilledStudent(45000);
    await createPayment(cid, { studentId, amount: 20000, paymentMode: 'cash', invoiceId }, 'admin');
    await createPayment(cid, { studentId, amount: 25000, paymentMode: 'cash', invoiceId }, 'admin');

    const inv = await Invoice.findById(invoiceId).lean();
    expect(inv?.status).toBe('paid');
    const acct = await StudentFeeAccount.findOne({ collegeId: COLLEGE, studentId }).lean();
    expect(acct?.balance).toBe(0);
  });

  it('rejects overpayment BEFORE writing the Payment', async () => {
    const { studentId, invoiceId } = await seedBilledStudent(45000);
    await expect(
      createPayment(cid, { studentId, amount: 50000, paymentMode: 'cash', invoiceId }, 'admin'),
    ).rejects.toThrow(/exceeds/i);
    expect(await Payment.countDocuments({ studentId })).toBe(0); // guard fired before write
    const acct = await StudentFeeAccount.findOne({ collegeId: COLLEGE, studentId }).lean();
    expect(acct?.balance).toBe(45000); // untouched
  });

  it('rejects an overpayment against remaining balance after a partial', async () => {
    const { studentId, invoiceId } = await seedBilledStudent(45000);
    await createPayment(cid, { studentId, amount: 30000, paymentMode: 'cash', invoiceId }, 'admin');
    await expect(
      createPayment(cid, { studentId, amount: 20000, paymentMode: 'cash', invoiceId }, 'admin'),
    ).rejects.toThrow(/exceeds/i); // only 15000 remains
  });

  it('bare payment (no invoiceId) still records and touches no balance', async () => {
    const student = await Student.create({
      collegeId: COLLEGE, personId: new Types.ObjectId(), admissionYear: 2025,
      status: 'active', feeResponsibleParentId: new Types.ObjectId(),
    });
    const r = await createPayment(cid, { studentId: String(student._id), amount: 5000, paymentMode: 'cash' }, 'admin');
    expect(r.status).toBe('success');
    expect(await StudentFeeAccount.countDocuments({ studentId: student._id })).toBe(0);
  });
});
