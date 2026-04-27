/**
 * Task A3 — situation-candidates (fee-analytics-ai-native).
 *
 * Eight deterministic heuristics that scan the existing finance
 * collections and surface "things a Finance Officer should look at
 * today". Each candidate carries enough narrativeContext for the LLM
 * (in A4) to write a one-sentence narrative + action buttons. NO LLM
 * calls happen here.
 *
 * Spec: .captain/specs/fee-analytics-ai-native/spec.md (§Journey 4, §AC Proactive situation cards)
 * Plan: .captain/specs/fee-analytics-ai-native/plan.md §1.4
 * Tasks: .captain/specs/fee-analytics-ai-native/tasks.md §Task A3
 *
 * Heuristics (all college-scoped):
 *   1. partial-payment-stale       — Invoice partially_paid AND dueDate < now-15d
 *   2. concession-spike            — concessions(7d) > 2x trailing 30d daily avg
 *   3. holds-without-review        — FinancialHold pending_approval > 48h
 *   4. welfare-referrals-unactioned — DefaulterRecord welfareReferralStatus='pending' > 7d
 *   5. stage4-transitions-today    — exam_debarment holds created today >= 3
 *   6. payment-mode-anomaly        — UPI share last 7d < 80% of trailing 30d avg
 *   7. holds-waived-without-reason — released hold with releaseReason.length < 10 in last 7d
 *   8. near-miss-target            — MTD collection / (collected + outstanding) < 0.65
 */

import { createHash } from 'crypto';
import { Types, PipelineStage } from 'mongoose';

import { Invoice } from '../../../models/finance/Invoice';
import { Payment } from '../../../models/finance/Payment';
import { DefaulterRecord } from '../../../models/finance/DefaulterRecord';
import { Concession } from '../../../models/finance/Concession';
import { FinancialHold } from '../../../models/finance/FinancialHold';

import { startOfToday, daysAgo } from './time-helpers';

// ── Types ────────────────────────────────────────────────────────────

export interface SituationCandidate {
  id: string;
  kind: string;
  severity: 'low' | 'medium' | 'high';
  narrativeContext: Record<string, unknown>;
  studentIds: string[];
  fingerprint: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function fingerprintFor(kind: string, studentIds: string[]): string {
  const sorted = [...studentIds].sort();
  return createHash('sha256')
    .update(`${kind}:${sorted.join(',')}`)
    .digest('hex');
}

function toIdString(x: unknown): string {
  if (x === null || x === undefined) return '';
  if (typeof x === 'string') return x;
  if (x instanceof Types.ObjectId) return x.toHexString();
  return String(x);
}

// ── Individual heuristics ───────────────────────────────────────────

/**
 * 1. partial-payment-stale: students whose invoices are partially paid
 *    AND the dueDate is more than 15 days in the past. Severity is
 *    `high` if > 5 students, `medium` otherwise.
 */
async function detectPartialPaymentStale(
  cId: Types.ObjectId,
): Promise<SituationCandidate | null> {
  const cutoff = daysAgo(15);
  const invoices = await Invoice.find({
    collegeId: cId,
    status: 'partially_paid',
    dueDate: { $lt: cutoff },
  })
    .select({ studentId: 1 })
    .lean();
  const studentIds = invoices
    .map((i) => toIdString(i.studentId))
    .filter((s) => s !== '');
  if (studentIds.length === 0) return null;
  const unique = Array.from(new Set(studentIds));
  const severity: 'low' | 'medium' | 'high' = unique.length > 5 ? 'high' : 'medium';
  return {
    id: `partial-payment-stale-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'partial-payment-stale',
    severity,
    narrativeContext: {
      count: unique.length,
      cutoffDays: 15,
    },
    studentIds: unique,
    fingerprint: fingerprintFor('partial-payment-stale', unique),
  };
}

/**
 * 2. concession-spike: concessions created in last 7d > 2x trailing
 *    30d daily average. Severity always `medium`.
 */
async function detectConcessionSpike(
  cId: Types.ObjectId,
): Promise<SituationCandidate | null> {
  const last7Cutoff = daysAgo(7);
  const last37Cutoff = daysAgo(37);
  const recent = await Concession.find({
    collegeId: cId,
    createdAt: { $gte: last7Cutoff },
  })
    .select({ studentId: 1 })
    .lean();
  const trailing = await Concession.countDocuments({
    collegeId: cId,
    createdAt: { $gte: last37Cutoff, $lt: last7Cutoff },
  });
  const recentDaily = recent.length / 7;
  // Trailing window is 30 days (37 - 7).
  const trailingDaily = trailing / 30;
  // 2x rule. If trailing is 0 and recent > 0, spike triggers.
  const spike =
    (trailingDaily === 0 && recentDaily > 0) ||
    (trailingDaily > 0 && recentDaily > 2 * trailingDaily);
  if (!spike) return null;
  const studentIds = Array.from(
    new Set(
      recent.map((r) => toIdString(r.studentId)).filter((s) => s !== ''),
    ),
  );
  return {
    id: `concession-spike-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'concession-spike',
    severity: 'medium',
    narrativeContext: {
      recentCount: recent.length,
      trailingDailyAverage: trailingDaily,
      recentDailyAverage: recentDaily,
    },
    studentIds,
    fingerprint: fingerprintFor('concession-spike', studentIds),
  };
}

/**
 * 3. holds-without-review: FinancialHold with holdStatus='pending_approval'
 *    that has been pending > 48h. Severity high if > 3, medium otherwise.
 */
async function detectHoldsWithoutReview(
  cId: Types.ObjectId,
): Promise<SituationCandidate | null> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const holds = await FinancialHold.find({
    collegeId: cId,
    holdStatus: 'pending_approval',
    createdAt: { $lt: cutoff },
  })
    .select({ studentId: 1 })
    .lean();
  if (holds.length === 0) return null;
  const studentIds = Array.from(
    new Set(holds.map((h) => toIdString(h.studentId)).filter((s) => s !== '')),
  );
  const severity: 'low' | 'medium' | 'high' = holds.length > 3 ? 'high' : 'medium';
  return {
    id: `holds-without-review-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'holds-without-review',
    severity,
    narrativeContext: {
      count: holds.length,
      olderThanHours: 48,
    },
    studentIds,
    fingerprint: fingerprintFor('holds-without-review', studentIds),
  };
}

/**
 * 4. welfare-referrals-unactioned: DefaulterRecord with
 *    welfareReferralStatus='pending' for more than 7 days. Severity high.
 */
async function detectWelfareReferralsUnactioned(
  cId: Types.ObjectId,
): Promise<SituationCandidate | null> {
  const cutoff = daysAgo(7);
  const records = await DefaulterRecord.find({
    collegeId: cId,
    welfareReferralStatus: 'pending',
    updatedAt: { $lt: cutoff },
  })
    .select({ studentId: 1 })
    .lean();
  if (records.length === 0) return null;
  const studentIds = Array.from(
    new Set(records.map((r) => toIdString(r.studentId)).filter((s) => s !== '')),
  );
  return {
    id: `welfare-referrals-unactioned-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'welfare-referrals-unactioned',
    severity: 'high',
    narrativeContext: {
      count: records.length,
      olderThanDays: 7,
    },
    studentIds,
    fingerprint: fingerprintFor('welfare-referrals-unactioned', studentIds),
  };
}

/**
 * 5. stage4-transitions-today: FinancialHold with holdType='exam_debarment'
 *    AND createdAt >= startOfToday count >= 3. Severity high.
 */
async function detectStage4TransitionsToday(
  cId: Types.ObjectId,
): Promise<SituationCandidate | null> {
  const start = startOfToday();
  const holds = await FinancialHold.find({
    collegeId: cId,
    holdType: 'exam_debarment',
    createdAt: { $gte: start },
  })
    .select({ studentId: 1 })
    .lean();
  if (holds.length < 3) return null;
  const studentIds = Array.from(
    new Set(holds.map((h) => toIdString(h.studentId)).filter((s) => s !== '')),
  );
  return {
    id: `stage4-transitions-today-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'stage4-transitions-today',
    severity: 'high',
    narrativeContext: {
      count: holds.length,
    },
    studentIds,
    fingerprint: fingerprintFor('stage4-transitions-today', studentIds),
  };
}

/**
 * 6. payment-mode-anomaly: UPI share of payments last 7d < 80% of
 *    trailing 30d UPI share. Severity medium.
 */
async function detectPaymentModeAnomaly(
  cId: Types.ObjectId,
): Promise<SituationCandidate | null> {
  const last7Cutoff = daysAgo(7);
  const last37Cutoff = daysAgo(37);

  const pipeline = (from: Date, to?: Date): PipelineStage[] => [
    {
      $match: {
        collegeId: cId,
        status: 'success',
        createdAt: to ? { $gte: from, $lt: to } : { $gte: from },
      },
    },
    {
      $group: {
        _id: '$paymentMode',
        count: { $sum: 1 },
      },
    },
  ];

  const recentRows = await Payment.aggregate<{ _id: string; count: number }>(
    pipeline(last7Cutoff),
  );
  const trailingRows = await Payment.aggregate<{ _id: string; count: number }>(
    pipeline(last37Cutoff, last7Cutoff),
  );

  const recentTotal = recentRows.reduce((a, r) => a + r.count, 0);
  const trailingTotal = trailingRows.reduce((a, r) => a + r.count, 0);
  if (recentTotal === 0 || trailingTotal === 0) return null;
  const recentUpi =
    (recentRows.find((r) => r._id === 'upi')?.count ?? 0) / recentTotal;
  const trailingUpi =
    (trailingRows.find((r) => r._id === 'upi')?.count ?? 0) / trailingTotal;
  // < 80% of trailing UPI share triggers
  if (recentUpi >= 0.8 * trailingUpi) return null;
  return {
    id: `payment-mode-anomaly-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'payment-mode-anomaly',
    severity: 'medium',
    narrativeContext: {
      recentUpiShare: recentUpi,
      trailingUpiShare: trailingUpi,
      thresholdRatio: 0.8,
    },
    studentIds: [],
    fingerprint: fingerprintFor('payment-mode-anomaly', []),
  };
}

/**
 * 7. holds-waived-without-reason: holdStatus='released' with
 *    releaseReason of length < 10 in the last 7 days. Severity medium.
 */
async function detectHoldsWaivedWithoutReason(
  cId: Types.ObjectId,
): Promise<SituationCandidate | null> {
  const cutoff = daysAgo(7);
  const holds = await FinancialHold.find({
    collegeId: cId,
    holdStatus: 'released',
    releaseDate: { $gte: cutoff },
  })
    .select({ studentId: 1, releaseReason: 1 })
    .lean();
  const trivial = holds.filter((h) => {
    const r = h.releaseReason ?? '';
    return r.length < 10;
  });
  if (trivial.length === 0) return null;
  const studentIds = Array.from(
    new Set(trivial.map((h) => toIdString(h.studentId)).filter((s) => s !== '')),
  );
  return {
    id: `holds-waived-without-reason-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'holds-waived-without-reason',
    severity: 'medium',
    narrativeContext: {
      count: trivial.length,
      reasonMinLength: 10,
    },
    studentIds,
    fingerprint: fingerprintFor('holds-waived-without-reason', studentIds),
  };
}

/**
 * 8. near-miss-target: MTD collection / (collected + outstanding) < 0.65.
 *    Severity high.
 */
async function detectNearMissTarget(
  cId: Types.ObjectId,
): Promise<SituationCandidate | null> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [paymentsAgg, invoicesAgg] = await Promise.all([
    Payment.aggregate<{ _id: null; total: number }>([
      {
        $match: {
          collegeId: cId,
          status: 'success',
          paymentDate: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Invoice.aggregate<{ _id: null; total: number }>([
      {
        $match: {
          collegeId: cId,
          status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
  ]);

  const collected = paymentsAgg[0]?.total ?? 0;
  const outstanding = invoicesAgg[0]?.total ?? 0;
  const denom = collected + outstanding;
  if (denom === 0) return null;
  const ratio = collected / denom;
  if (ratio >= 0.65) return null;
  return {
    id: `near-miss-target-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: 'near-miss-target',
    severity: 'high',
    narrativeContext: {
      collected,
      outstanding,
      ratio,
      threshold: 0.65,
    },
    studentIds: [],
    fingerprint: fingerprintFor('near-miss-target', []),
  };
}

// ── Public entry point ──────────────────────────────────────────────

/**
 * Scan all 8 heuristics in parallel and return the candidates that
 * fired. Empty array if none triggered. Always college-scoped.
 */
export async function gatherCandidates(
  collegeId: string,
): Promise<SituationCandidate[]> {
  if (!Types.ObjectId.isValid(collegeId)) return [];
  const cId = new Types.ObjectId(collegeId);

  const detections = await Promise.all([
    detectPartialPaymentStale(cId),
    detectConcessionSpike(cId),
    detectHoldsWithoutReview(cId),
    detectWelfareReferralsUnactioned(cId),
    detectStage4TransitionsToday(cId),
    detectPaymentModeAnomaly(cId),
    detectHoldsWaivedWithoutReason(cId),
    detectNearMissTarget(cId),
  ]);

  return detections.filter((c): c is SituationCandidate => c !== null);
}
