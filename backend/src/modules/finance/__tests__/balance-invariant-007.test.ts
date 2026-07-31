/**
 * 007 · T10 — the StudentFeeAccount balance invariant verifier.
 *
 * Proves the verifier (a) accepts a well-formed installment account, incl. the
 * +totalRefunded sign (G2-H1), (b) catches a drifted one, and (c) is scoped to
 * 007-billed students so seed/admissions accounts with off-formula balances don't
 * false-flag.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Invoice } from '../../../models/finance/Invoice';
import { StudentFeeAccount } from '../../../models/finance/StudentFeeAccount';
import { verifyFeeBalanceInvariant } from '../../../scripts/verify-fee-balance-invariant';

const COLLEGE = new Types.ObjectId();
let seq = 0;

/** Bring a student into 007 scope by giving them an installment invoice. */
async function billed(studentId: Types.ObjectId) {
  await Invoice.create({
    collegeId: COLLEGE, invoiceNumber: `INV-INV-${seq++}`, type: 'fee',
    isSemesterInstallment: true, totalAmount: 45000, netPayable: 45000, dueDate: new Date(),
    status: 'generated', studentId, semesterId: new Types.ObjectId(),
  });
}

beforeAll(async () => { await setupMongo(); }, 90_000);
afterAll(async () => { await teardownMongo(); }, 30_000);
afterEach(async () => { await clearCollections(); });

describe('007 T10 — balance invariant verifier', () => {
  it('passes a well-formed installment account (incl. +totalRefunded)', async () => {
    const s = new Types.ObjectId();
    await billed(s);
    // 45000 due − 20000 paid − 5000 waived + 2000 refunded = 22000
    await StudentFeeAccount.create({ collegeId: COLLEGE, studentId: s, totalDue: 45000, totalPaid: 20000, totalWaived: 5000, totalRefunded: 2000, balance: 22000 });

    const r = await verifyFeeBalanceInvariant(String(COLLEGE));
    expect(r.checked).toBe(1);
    expect(r.violations).toHaveLength(0);
  });

  it('flags a drifted installment account', async () => {
    const s = new Types.ObjectId();
    await billed(s);
    await StudentFeeAccount.create({ collegeId: COLLEGE, studentId: s, totalDue: 45000, totalPaid: 20000, balance: 30000 }); // should be 25000

    const r = await verifyFeeBalanceInvariant(String(COLLEGE));
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]).toMatchObject({ studentId: String(s), balance: 30000, expected: 25000 });
  });

  it('ignores accounts of students the 007 flow never billed', async () => {
    // A seed/admissions-style account with an off-formula balance, but NO installment invoice.
    const s = new Types.ObjectId();
    await StudentFeeAccount.create({ collegeId: COLLEGE, studentId: s, totalDue: 10000, totalPaid: 0, balance: 999 });

    const r = await verifyFeeBalanceInvariant(String(COLLEGE));
    expect(r.checked).toBe(0); // out of scope — not flagged
    expect(r.violations).toHaveLength(0);
  });
});
