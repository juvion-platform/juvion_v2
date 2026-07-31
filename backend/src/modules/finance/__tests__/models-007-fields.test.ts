/**
 * 007-fee-billing-payment-ar · T1 — model foundation fields.
 *
 * Two additive, backward-compatible fields underpin the whole feature:
 *   - Payment.invoiceId          — links a counter payment to the invoice it settles.
 *   - Invoice.isSemesterInstallment — the POSITIVE discriminator (G2-C1) that separates
 *     our tuition-installment invoices from the exam-fee invoices that are ALSO
 *     type:'fee' with a semesterId. Idempotency keys on this, never on type:'fee'.
 *
 * These tests assert both persist when set and are absent when omitted — the absence
 * case is the backward-compatibility guarantee for the 9+ existing invoice/payment
 * creation sites.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Payment } from '../../../models/finance/Payment';
import { Invoice } from '../../../models/finance/Invoice';

const oid = () => new mongoose.Types.ObjectId();

describe('007 T1 — Payment.invoiceId + Invoice.isSemesterInstallment', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('Payment persists invoiceId when provided', async () => {
    const invoiceId = oid();
    const p = await Payment.create({
      collegeId: oid(), studentId: oid(), receiptNumber: 'RCP-2026-001',
      amount: 45000, paymentMode: 'cash', invoiceId,
    });
    const found = await Payment.findById(p._id).lean();
    expect(found?.invoiceId).toBeDefined();
    expect(String(found?.invoiceId)).toBe(String(invoiceId));
  });

  it('Payment omits invoiceId when not provided (backward compatible)', async () => {
    const p = await Payment.create({
      collegeId: oid(), studentId: oid(), receiptNumber: 'RCP-2026-002',
      amount: 5000, paymentMode: 'cash',
    });
    const found = await Payment.findById(p._id).lean();
    expect(found?.invoiceId).toBeUndefined();
  });

  it('Invoice persists isSemesterInstallment when set true', async () => {
    const inv = await Invoice.create({
      collegeId: oid(), invoiceNumber: 'INV-A', type: 'fee',
      totalAmount: 45000, dueDate: new Date('2026-08-30'), isSemesterInstallment: true,
    });
    const found = await Invoice.findById(inv._id).lean();
    expect(found?.isSemesterInstallment).toBe(true);
  });

  it('Invoice omits isSemesterInstallment for non-installment (e.g. exam-fee) invoices', async () => {
    const inv = await Invoice.create({
      collegeId: oid(), invoiceNumber: 'INV-B', type: 'fee',
      totalAmount: 1200, dueDate: new Date('2026-08-30'),
    });
    const found = await Invoice.findById(inv._id).lean();
    expect(found?.isSemesterInstallment).toBeUndefined();
  });
});
