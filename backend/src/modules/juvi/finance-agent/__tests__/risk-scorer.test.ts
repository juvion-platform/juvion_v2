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
import { FeeReminder } from '../../../../models/finance/FeeReminder';
import { Student } from '../../../../models/people/Student';
import { Person } from '../../../../models/people/Person';

import {
  computeRiskScore,
  assembleFeatures,
  type RiskFeatures,
} from '../risk-scorer';

/**
 * Task A3 — risk-scorer (fee-analytics-ai-native).
 *
 * Tests cover both the pure function `computeRiskScore` (transparent
 * weighted sum + tier bucketing) and the `assembleFeatures` integration
 * that pulls features from Mongo. All Mongo queries must be
 * `collegeId`-scoped (multi-tenancy).
 */

const oid = () => new mongoose.Types.ObjectId();
const day = 24 * 60 * 60 * 1000;

const baseFeatures: RiskFeatures = {
  daysOverdue: 0,
  reminderResponseRate: 0.5,
  paymentCadenceVariance: 5,
  guardianIncomeBandDropFlag: false,
  siblingOnTimeFlag: false,
  stageAdvanceVelocityDays: 30,
  welfareReferralActive: false,
  autoEscalationPaused: false,
};

describe('computeRiskScore (pure)', () => {
  it('low tier: zero-day overdue baseline returns score 0 → low', () => {
    const r = computeRiskScore({ ...baseFeatures, daysOverdue: 0 });
    expect(r.score).toBe(0);
    expect(r.tier).toBe('low');
  });

  it('medium tier: 14d overdue + neutral reminder rate → score in [15, 39]', () => {
    const r = computeRiskScore({ ...baseFeatures, daysOverdue: 14 });
    expect(r.score).toBe(25);
    expect(r.tier).toBe('medium');
  });

  it('high tier: 30d overdue + low reminder response → score in [40, 69]', () => {
    const r = computeRiskScore({
      ...baseFeatures,
      daysOverdue: 30,
      reminderResponseRate: 0.1,
    });
    // 40 (overdue) + 15 (reminder) = 55
    expect(r.score).toBe(55);
    expect(r.tier).toBe('high');
  });

  it('critical tier: 90d overdue + low response + cadence variance → score >= 70', () => {
    const r = computeRiskScore({
      ...baseFeatures,
      daysOverdue: 90,
      reminderResponseRate: 0.05,
      paymentCadenceVariance: 30,
      guardianIncomeBandDropFlag: true,
    });
    // 65 + 15 + 10 + 10 = 100; clamps to 100
    expect(r.score).toBe(100);
    expect(r.tier).toBe('critical');
  });

  it('clamps the final score at 100 (sum > 100 collapses)', () => {
    const r = computeRiskScore({
      ...baseFeatures,
      daysOverdue: 200,
      reminderResponseRate: 0.0,
      paymentCadenceVariance: 50,
      guardianIncomeBandDropFlag: true,
      welfareReferralActive: true,
    });
    expect(r.score).toBe(100);
    expect(r.tier).toBe('critical');
  });

  it('autoEscalationPaused subtracts 30 (clamped at 0 if negative)', () => {
    const r = computeRiskScore({
      ...baseFeatures,
      daysOverdue: 30,
      autoEscalationPaused: true,
    });
    // 40 (overdue) - 30 (paused) = 10 → low
    expect(r.score).toBe(10);
    expect(r.tier).toBe('low');
  });

  it('clamps at 0 when negative-weight factors dominate', () => {
    const r = computeRiskScore({
      ...baseFeatures,
      daysOverdue: 0,
      autoEscalationPaused: true,
      siblingOnTimeFlag: true,
    });
    expect(r.score).toBe(0);
    expect(r.tier).toBe('low');
  });

  it('siblingOnTimeFlag subtracts 6 from the running score', () => {
    const r = computeRiskScore({
      ...baseFeatures,
      daysOverdue: 14, // +25
      siblingOnTimeFlag: true, // -6
    });
    expect(r.score).toBe(19);
    expect(r.tier).toBe('medium');
  });

  it('factors array enumerates every active factor with weight + value', () => {
    const r = computeRiskScore({
      ...baseFeatures,
      daysOverdue: 30,
      reminderResponseRate: 0.1,
      paymentCadenceVariance: 25,
      guardianIncomeBandDropFlag: true,
      siblingOnTimeFlag: true,
      welfareReferralActive: true,
    });
    const names = r.factors.map((f) => f.name);
    expect(names).toContain('daysOverdue');
    expect(names).toContain('reminderResponseRate');
    expect(names).toContain('paymentCadenceVariance');
    expect(names).toContain('guardianIncomeBandDropFlag');
    expect(names).toContain('siblingOnTimeFlag');
    expect(names).toContain('welfareReferralActive');
    // every factor row has both weight + value
    for (const f of r.factors) {
      expect(typeof f.weight).toBe('number');
      expect(['number', 'boolean']).toContain(typeof f.value);
    }
  });

  it('insufficient-data: daysOverdue < 0 returns score=null and tier=insufficient-data', () => {
    const r = computeRiskScore({ ...baseFeatures, daysOverdue: -1 });
    expect(r.score).toBeNull();
    expect(r.tier).toBe('insufficient-data');
    expect(r.factors).toEqual([]);
  });

  it('piecewise interpolation: 7d overdue → 10', () => {
    const r = computeRiskScore({ ...baseFeatures, daysOverdue: 7 });
    expect(r.score).toBe(10);
  });

  it('piecewise interpolation: 60d overdue → 55', () => {
    const r = computeRiskScore({ ...baseFeatures, daysOverdue: 60 });
    expect(r.score).toBe(55);
  });

  it('piecewise interpolation: linear between breakpoints (10d ≈ 16)', () => {
    // between 7 (10) and 14 (25), 10d should land at ~16.43, rounded
    const r = computeRiskScore({ ...baseFeatures, daysOverdue: 10 });
    expect(r.score).toBeGreaterThanOrEqual(15);
    expect(r.score).toBeLessThanOrEqual(18);
  });
});

describe('assembleFeatures (integration)', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  it('returns insufficient-data shape when no DefaulterRecord exists', async () => {
    const collegeId = oid();
    const studentId = oid();
    const f = await assembleFeatures(String(collegeId), String(studentId));
    expect(f.daysOverdue).toBeLessThan(0);
    // verify the round-trip: pure function rejects this input
    const r = computeRiskScore(f);
    expect(r.tier).toBe('insufficient-data');
  });

  it('computes daysOverdue from active DefaulterRecord', async () => {
    const collegeId = oid();
    const studentId = oid();
    const invoiceId = oid();
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId,
      overdueAmount: 5000,
      daysOverdue: 45,
      escalationStage: 'stage_3',
      welfareReferralStatus: 'none',
    });
    const f = await assembleFeatures(String(collegeId), String(studentId));
    expect(f.daysOverdue).toBe(45);
  });

  it('default reminderResponseRate is neutral (0.5) when no reminders sent', async () => {
    const collegeId = oid();
    const studentId = oid();
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 1000,
      daysOverdue: 5,
      escalationStage: 'stage_1',
    });
    const f = await assembleFeatures(String(collegeId), String(studentId));
    expect(f.reminderResponseRate).toBe(0.5);
  });

  it('reminderResponseRate = delivered / sent when reminders exist', async () => {
    const collegeId = oid();
    const studentId = oid();
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 1000,
      daysOverdue: 5,
      escalationStage: 'stage_1',
    });
    // 4 reminders sent, 1 delivered (≈25%)
    await FeeReminder.create([
      {
        collegeId,
        studentId,
        channel: 'sms',
        dueAmount: 1000,
        status: 'sent',
        deliveryStatus: 'pending',
      },
      {
        collegeId,
        studentId,
        channel: 'sms',
        dueAmount: 1000,
        status: 'sent',
        deliveryStatus: 'pending',
      },
      {
        collegeId,
        studentId,
        channel: 'sms',
        dueAmount: 1000,
        status: 'sent',
        deliveryStatus: 'pending',
      },
      {
        collegeId,
        studentId,
        channel: 'sms',
        dueAmount: 1000,
        status: 'delivered',
        deliveryStatus: 'delivered',
      },
    ]);
    const f = await assembleFeatures(String(collegeId), String(studentId));
    expect(f.reminderResponseRate).toBeCloseTo(0.25, 2);
  });

  it('autoEscalationPaused reflects DefaulterRecord.autoEscalationPaused future date', async () => {
    const collegeId = oid();
    const studentId = oid();
    const future = new Date(Date.now() + 7 * day);
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 1000,
      daysOverdue: 5,
      escalationStage: 'stage_1',
      autoEscalationPaused: future,
    });
    const f = await assembleFeatures(String(collegeId), String(studentId));
    expect(f.autoEscalationPaused).toBe(true);
  });

  it('welfareReferralActive when DefaulterRecord.welfareReferralStatus !== "none"', async () => {
    const collegeId = oid();
    const studentId = oid();
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 1000,
      daysOverdue: 70,
      escalationStage: 'welfare_referred',
      welfareReferralStatus: 'pending',
    });
    const f = await assembleFeatures(String(collegeId), String(studentId));
    expect(f.welfareReferralActive).toBe(true);
  });

  it('paymentCadenceVariance computed from inter-payment gaps (stddev in days)', async () => {
    const collegeId = oid();
    const studentId = oid();
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 1000,
      daysOverdue: 5,
      escalationStage: 'stage_1',
    });
    const now = Date.now();
    // payments roughly 30, 30, 60, 90 days apart → high variance
    await Payment.create([
      {
        collegeId,
        studentId,
        receiptNumber: 'R1',
        amount: 1000,
        paymentMode: 'upi',
        paymentDate: new Date(now - 210 * day),
        status: 'success',
        allocations: [],
      },
      {
        collegeId,
        studentId,
        receiptNumber: 'R2',
        amount: 1000,
        paymentMode: 'upi',
        paymentDate: new Date(now - 180 * day),
        status: 'success',
        allocations: [],
      },
      {
        collegeId,
        studentId,
        receiptNumber: 'R3',
        amount: 1000,
        paymentMode: 'upi',
        paymentDate: new Date(now - 150 * day),
        status: 'success',
        allocations: [],
      },
      {
        collegeId,
        studentId,
        receiptNumber: 'R4',
        amount: 1000,
        paymentMode: 'upi',
        paymentDate: new Date(now - 90 * day),
        status: 'success',
        allocations: [],
      },
      {
        collegeId,
        studentId,
        receiptNumber: 'R5',
        amount: 1000,
        paymentMode: 'upi',
        paymentDate: new Date(now - 0 * day),
        status: 'success',
        allocations: [],
      },
    ]);
    const f = await assembleFeatures(String(collegeId), String(studentId));
    expect(f.paymentCadenceVariance).toBeGreaterThan(20);
  });

  it('cross-college isolation: DefaulterRecord under college B not visible to college A', async () => {
    const collegeA = oid();
    const collegeB = oid();
    const studentId = oid();
    await DefaulterRecord.create({
      collegeId: collegeB,
      studentId,
      invoiceId: oid(),
      overdueAmount: 1000,
      daysOverdue: 30,
      escalationStage: 'stage_3',
    });
    const f = await assembleFeatures(String(collegeA), String(studentId));
    expect(f.daysOverdue).toBeLessThan(0); // insufficient data signal
  });

  it('siblingOnTimeFlag false when no sibling found', async () => {
    const collegeId = oid();
    const studentId = oid();
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 1000,
      daysOverdue: 5,
      escalationStage: 'stage_1',
    });
    const f = await assembleFeatures(String(collegeId), String(studentId));
    expect(f.siblingOnTimeFlag).toBe(false);
  });

  it('siblingOnTimeFlag true when sibling student has clean record', async () => {
    const collegeId = oid();
    const parentPersonId = oid();

    // Two sibling students sharing the same primaryParentId
    const studentA = await Student.create({
      collegeId,
      personId: oid(),
      admissionYear: 2024,
      rollNumber: 'A1',
      primaryParentId: parentPersonId,
      status: 'active',
    });
    const studentB = await Student.create({
      collegeId,
      personId: oid(),
      admissionYear: 2024,
      rollNumber: 'A2',
      primaryParentId: parentPersonId,
      status: 'active',
    });
    // A has a defaulter record; B has no overdue → siblingOnTime = true
    await DefaulterRecord.create({
      collegeId,
      studentId: studentA._id,
      invoiceId: oid(),
      overdueAmount: 1000,
      daysOverdue: 30,
      escalationStage: 'stage_3',
    });
    // B is clean — no defaulter record. Use B's perspective so we ask
    // "are A's siblings clean" (yes, B has no overdue) — but we need
    // assembleFeatures(A) to look up B and find B clean. Let's make A's
    // record point to studentA.
    const f = await assembleFeatures(
      String(collegeId),
      String(studentA._id),
    );
    expect(f.siblingOnTimeFlag).toBe(true);
    // ensure both fixtures landed
    expect(studentB).toBeDefined();
  });
});

// quiet vitest about unused Person/Invoice imports; both used by future
// extensions (guardian income band signal, stage-advance velocity).
void Person;
void Invoice;
