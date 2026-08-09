/**
 * 007 · T8 — FINANCE_ENFORCE_FEE_GUARDIAN flag.
 *
 * The guardian requirement is a real production rule (payer-of-record for receipts,
 * dunning, refunds) but blocks minimally-imported demo students. It is flag-gated OFF
 * for the demo. Critically (G2-M1) the existence + college-match check is NOT gated —
 * it runs regardless, so the flag can never open a cross-tenant write.
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
import { createPayment } from '../service';

const COLLEGE = new Types.ObjectId();
const cid = String(COLLEGE);

/** A student with NO feeResponsibleParentId — the minimally-imported case. */
async function guardianlessStudent() {
  const s = await Student.create({
    collegeId: COLLEGE, personId: new Types.ObjectId(), admissionYear: 2025, status: 'active',
  });
  return String(s._id);
}

beforeAll(async () => { await setupMongo(); }, 90_000);
afterAll(async () => { await teardownMongo(); }, 30_000);
afterEach(async () => {
  await clearCollections();
  delete process.env.FINANCE_ENFORCE_FEE_GUARDIAN;
});

describe('007 T8 — guardian flag', () => {
  it('flag OFF (demo default): a guardianless student can be paid', async () => {
    delete process.env.FINANCE_ENFORCE_FEE_GUARDIAN;
    const studentId = await guardianlessStudent();
    const r = await createPayment(cid, { studentId, amount: 1000, paymentMode: 'cash' }, 'admin');
    expect(r.status).toBe('success');
  });

  it('flag ON: a guardianless student is rejected', async () => {
    process.env.FINANCE_ENFORCE_FEE_GUARDIAN = 'true';
    const studentId = await guardianlessStudent();
    await expect(
      createPayment(cid, { studentId, amount: 1000, paymentMode: 'cash' }, 'admin'),
    ).rejects.toThrow(/guardian/i);
  });

  it('existence/college check runs even with the flag OFF: unknown student → 404', async () => {
    delete process.env.FINANCE_ENFORCE_FEE_GUARDIAN;
    await expect(
      createPayment(cid, { studentId: String(new Types.ObjectId()), amount: 1000, paymentMode: 'cash' }, 'admin'),
    ).rejects.toThrow(/not found/i);
  });
});
