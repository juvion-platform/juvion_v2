import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../../__tests__/helpers/mongoMemory';

import { Invoice } from '../../../../models/finance/Invoice';
import { Payment } from '../../../../models/finance/Payment';
import { DefaulterRecord } from '../../../../models/finance/DefaulterRecord';
import { Concession } from '../../../../models/finance/Concession';
import { FinancialHold } from '../../../../models/finance/FinancialHold';

import { gatherCandidates } from '../situation-candidates';

/**
 * Task A3 — situation-candidates (fee-analytics-ai-native).
 *
 * Eight deterministic heuristics. Each is independently triggerable.
 * This suite asserts each one in isolation, then verifies fingerprint
 * stability + uniqueness across runs.
 */

const oid = () => new mongoose.Types.ObjectId();
const day = 24 * 60 * 60 * 1000;
const hour = 60 * 60 * 1000;

describe('gatherCandidates', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  it('returns [] when nothing triggers any heuristic', async () => {
    const collegeId = oid();
    const out = await gatherCandidates(String(collegeId));
    expect(out).toEqual([]);
  });

  it('partial-payment-stale: triggers when partial invoice is > 15d past due', async () => {
    const collegeId = oid();
    const studentId = oid();
    await Invoice.create({
      collegeId,
      invoiceNumber: 'INV-1',
      studentId,
      type: 'fee',
      totalAmount: 5000,
      dueDate: new Date(Date.now() - 30 * day),
      status: 'partially_paid',
      issuedDate: new Date(Date.now() - 60 * day),
      items: [],
    });
    const out = await gatherCandidates(String(collegeId));
    const c = out.find((s) => s.kind === 'partial-payment-stale');
    expect(c).toBeDefined();
    expect(c?.studentIds).toContain(String(studentId));
  });

  it('concession-spike: triggers when last 7d concession count > 2x trailing 30d daily avg', async () => {
    const collegeId = oid();
    const academicYearId = oid();
    // Trailing 30d (excluding last 7d): 1 concession total → daily avg ≈ 1/23
    await Concession.create({
      collegeId,
      studentId: oid(),
      type: 'merit',
      reason: 'old',
      academicYearId,
      status: 'approved',
      createdAt: new Date(Date.now() - 20 * day),
    });
    // Last 7d: 5 concessions → 5 / 7 ≈ 0.71/day. ratio = 0.71 / 0.043 ≈ 16x → spike
    for (let i = 0; i < 5; i++) {
      await Concession.create({
        collegeId,
        studentId: oid(),
        type: 'merit',
        reason: 'recent',
        academicYearId,
        status: 'approved',
        createdAt: new Date(Date.now() - i * day),
      });
    }
    const out = await gatherCandidates(String(collegeId));
    const c = out.find((s) => s.kind === 'concession-spike');
    expect(c).toBeDefined();
  });

  it('holds-without-review: triggers on FinancialHold pending_approval > 48h old', async () => {
    const collegeId = oid();
    const studentId = oid();
    const old = new Date(Date.now() - 60 * hour);
    await FinancialHold.create({
      collegeId,
      studentId,
      defaulterRecordId: oid(),
      holdType: 'exam_debarment',
      holdStatus: 'pending_approval',
      effectiveDate: old,
      createdAt: old,
    });
    const out = await gatherCandidates(String(collegeId));
    const c = out.find((s) => s.kind === 'holds-without-review');
    expect(c).toBeDefined();
    expect(c?.studentIds).toContain(String(studentId));
  });

  it('welfare-referrals-unactioned: triggers on DefaulterRecord welfareReferralStatus=pending > 7d', async () => {
    const collegeId = oid();
    const studentId = oid();
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 5000,
      daysOverdue: 90,
      escalationStage: 'welfare_referred',
      welfareReferralStatus: 'pending',
      createdAt: new Date(Date.now() - 10 * day),
      updatedAt: new Date(Date.now() - 10 * day),
    });
    const out = await gatherCandidates(String(collegeId));
    const c = out.find((s) => s.kind === 'welfare-referrals-unactioned');
    expect(c).toBeDefined();
    expect(c?.severity).toBe('high');
    expect(c?.studentIds).toContain(String(studentId));
  });

  it('stage4-transitions-today: triggers when ≥ 3 exam_debarment holds created today', async () => {
    const collegeId = oid();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const studentIds = [oid(), oid(), oid()];
    for (const studentId of studentIds) {
      await FinancialHold.create({
        collegeId,
        studentId,
        defaulterRecordId: oid(),
        holdType: 'exam_debarment',
        holdStatus: 'pending_approval',
        effectiveDate: new Date(),
        createdAt: new Date(startOfToday.getTime() + 2 * hour),
      });
    }
    const out = await gatherCandidates(String(collegeId));
    const c = out.find((s) => s.kind === 'stage4-transitions-today');
    expect(c).toBeDefined();
  });

  it('payment-mode-anomaly: triggers when last 7d UPI share < 80% of trailing 30d UPI share', async () => {
    const collegeId = oid();
    const studentId = oid();
    // Trailing 30d (older): 30 UPI payments → 100% UPI
    for (let i = 0; i < 30; i++) {
      await Payment.create({
        collegeId,
        studentId,
        receiptNumber: `R-old-${i}`,
        amount: 100,
        paymentMode: 'upi',
        paymentDate: new Date(Date.now() - (10 + i) * day),
        createdAt: new Date(Date.now() - (10 + i) * day),
        status: 'success',
        allocations: [],
      });
    }
    // Last 7d: only 1 of 10 UPI → 10% (way below 80% of 100%)
    for (let i = 0; i < 9; i++) {
      await Payment.create({
        collegeId,
        studentId,
        receiptNumber: `R-new-${i}`,
        amount: 100,
        paymentMode: 'cash',
        paymentDate: new Date(Date.now() - i * hour),
        createdAt: new Date(Date.now() - i * hour),
        status: 'success',
        allocations: [],
      });
    }
    await Payment.create({
      collegeId,
      studentId,
      receiptNumber: 'R-new-upi',
      amount: 100,
      paymentMode: 'upi',
      paymentDate: new Date(),
      createdAt: new Date(),
      status: 'success',
      allocations: [],
    });
    const out = await gatherCandidates(String(collegeId));
    const c = out.find((s) => s.kind === 'payment-mode-anomaly');
    expect(c).toBeDefined();
  });

  it('holds-waived-without-reason: triggers when released hold has releaseReason < 10 chars in last 7d', async () => {
    const collegeId = oid();
    const studentId = oid();
    await FinancialHold.create({
      collegeId,
      studentId,
      defaulterRecordId: oid(),
      holdType: 'exam_debarment',
      holdStatus: 'released',
      effectiveDate: new Date(Date.now() - 5 * day),
      releaseDate: new Date(Date.now() - 1 * day),
      releaseReason: 'ok',
      createdAt: new Date(Date.now() - 5 * day),
    });
    const out = await gatherCandidates(String(collegeId));
    const c = out.find((s) => s.kind === 'holds-waived-without-reason');
    expect(c).toBeDefined();
    expect(c?.studentIds).toContain(String(studentId));
  });

  it('near-miss-target: triggers when MTD collection ratio < 0.65', async () => {
    const collegeId = oid();
    const studentId = oid();
    // Outstanding (unpaid invoice) = 100k; Collected = 30k → ratio = 0.23 < 0.65
    await Invoice.create({
      collegeId,
      invoiceNumber: 'INV-out',
      studentId,
      type: 'fee',
      totalAmount: 100000,
      dueDate: new Date(),
      status: 'generated',
      issuedDate: new Date(),
      items: [],
    });
    await Payment.create({
      collegeId,
      studentId,
      receiptNumber: 'R-mtd',
      amount: 30000,
      paymentMode: 'upi',
      paymentDate: new Date(),
      createdAt: new Date(),
      status: 'success',
      allocations: [],
    });
    const out = await gatherCandidates(String(collegeId));
    const c = out.find((s) => s.kind === 'near-miss-target');
    expect(c).toBeDefined();
    expect(c?.severity).toBe('high');
  });

  it('cross-college isolation: heuristics only fire for the queried college', async () => {
    const collegeA = oid();
    const collegeB = oid();
    // Triggering condition lives in college B
    await Invoice.create({
      collegeId: collegeB,
      invoiceNumber: 'INV-B',
      studentId: oid(),
      type: 'fee',
      totalAmount: 5000,
      dueDate: new Date(Date.now() - 30 * day),
      status: 'partially_paid',
      issuedDate: new Date(Date.now() - 60 * day),
      items: [],
    });
    const out = await gatherCandidates(String(collegeA));
    expect(out).toEqual([]);
  });

  it('fingerprint stability: same trigger across two runs yields identical fingerprint', async () => {
    const collegeId = oid();
    const studentId = oid();
    await Invoice.create({
      collegeId,
      invoiceNumber: 'INV-S',
      studentId,
      type: 'fee',
      totalAmount: 5000,
      dueDate: new Date(Date.now() - 30 * day),
      status: 'partially_paid',
      issuedDate: new Date(Date.now() - 60 * day),
      items: [],
    });
    const r1 = await gatherCandidates(String(collegeId));
    const r2 = await gatherCandidates(String(collegeId));
    const f1 = r1.find((c) => c.kind === 'partial-payment-stale')?.fingerprint;
    const f2 = r2.find((c) => c.kind === 'partial-payment-stale')?.fingerprint;
    expect(f1).toBeDefined();
    expect(f1).toBe(f2);
  });

  it('fingerprint variance: different student sets yield different fingerprints', async () => {
    const collegeId = oid();
    const studentA = oid();
    const studentB = oid();
    // run 1: only A triggers
    await Invoice.create({
      collegeId,
      invoiceNumber: 'INV-A',
      studentId: studentA,
      type: 'fee',
      totalAmount: 5000,
      dueDate: new Date(Date.now() - 30 * day),
      status: 'partially_paid',
      issuedDate: new Date(Date.now() - 60 * day),
      items: [],
    });
    const r1 = await gatherCandidates(String(collegeId));
    const f1 = r1.find((c) => c.kind === 'partial-payment-stale')?.fingerprint;

    // add a second student (B) → student set is now {A, B}
    await Invoice.create({
      collegeId,
      invoiceNumber: 'INV-B',
      studentId: studentB,
      type: 'fee',
      totalAmount: 5000,
      dueDate: new Date(Date.now() - 30 * day),
      status: 'partially_paid',
      issuedDate: new Date(Date.now() - 60 * day),
      items: [],
    });
    const r2 = await gatherCandidates(String(collegeId));
    const f2 = r2.find((c) => c.kind === 'partial-payment-stale')?.fingerprint;

    expect(f1).toBeDefined();
    expect(f2).toBeDefined();
    expect(f1).not.toBe(f2);
  });

  it('every candidate has a stable id and a non-empty kind', async () => {
    const collegeId = oid();
    await Invoice.create({
      collegeId,
      invoiceNumber: 'INV-1',
      studentId: oid(),
      type: 'fee',
      totalAmount: 5000,
      dueDate: new Date(Date.now() - 30 * day),
      status: 'partially_paid',
      issuedDate: new Date(Date.now() - 60 * day),
      items: [],
    });
    const out = await gatherCandidates(String(collegeId));
    for (const c of out) {
      expect(c.id).toBeTruthy();
      expect(c.kind).toBeTruthy();
      expect(['low', 'medium', 'high']).toContain(c.severity);
    }
  });
});
