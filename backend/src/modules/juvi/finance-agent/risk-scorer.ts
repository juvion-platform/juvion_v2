/**
 * Task A3 — risk-scorer (fee-analytics-ai-native).
 *
 * Deterministic, transparent, rule-based 0-100 risk score for a single
 * student's collection risk. NO LLM calls — this is a pure function +
 * a Mongo-backed feature assembler that reads from existing finance
 * collections.
 *
 * Spec: .captain/specs/fee-analytics-ai-native/spec.md (§Journey 3, §AC Per-student risk score)
 * Plan: .captain/specs/fee-analytics-ai-native/plan.md §1.4 (Risk score flow)
 * Tasks: .captain/specs/fee-analytics-ai-native/tasks.md §Task A3
 *
 * Design contract:
 *   - Public surface = `RiskFeatures`, `RiskScore`, `computeRiskScore`,
 *     `assembleFeatures`. Nothing else.
 *   - Insufficient data path returns `{ score: null, factors: [],
 *     tier: 'insufficient-data' }` and never throws.
 *   - Every Mongo query filters by `collegeId` first (multi-tenancy).
 *   - Weights are documented inline; LLM downstream (A4) explains them
 *     to the user, but the scoring math itself never needs an LLM.
 */

import { Types } from 'mongoose';

import { DefaulterRecord } from '../../../models/finance/DefaulterRecord';
import { Payment } from '../../../models/finance/Payment';
import { FeeReminder } from '../../../models/finance/FeeReminder';
import { Student } from '../../../models/people/Student';

import { MS_PER_DAY_CONST, stddev } from './time-helpers';

// ── Types ────────────────────────────────────────────────────────────

export interface RiskFeatures {
  /** Days the student's outstanding invoice is past due. < 0 → unknown. */
  daysOverdue: number;
  /** Acknowledged / sent reminder ratio in [0, 1]. Defaults to 0.5 (neutral). */
  reminderResponseRate: number;
  /** Stddev of inter-payment gap in days. */
  paymentCadenceVariance: number;
  /** Set when guardian moved to a lower income band recently. */
  guardianIncomeBandDropFlag: boolean;
  /** Set when at least one sibling at the college is paying on time. */
  siblingOnTimeFlag: boolean;
  /** Avg days between escalation-stage advances (informational). */
  stageAdvanceVelocityDays: number;
  /** Set when DefaulterRecord.welfareReferralStatus !== 'none'. */
  welfareReferralActive: boolean;
  /** Set when the student's auto-escalation is paused (officer involved). */
  autoEscalationPaused: boolean;
}

export interface RiskFactor {
  name: string;
  weight: number;
  value: number | boolean;
}

export type RiskTier =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'insufficient-data';

export interface RiskScore {
  /** 0-100; null when daysOverdue is unknown. */
  score: number | null;
  factors: RiskFactor[];
  tier: RiskTier;
}

// ── Algorithm constants ─────────────────────────────────────────────
// All numbers documented inline. Treat this as the SPEC for the scorer.

/**
 * Piecewise breakpoints for daysOverdue → contribution:
 *   0d → 0, 7d → 10, 14d → 25, 30d → 40, 60d → 55, 90d+ → 65
 *
 * Linearly interpolated between breakpoints. The curve is gentle for
 * the first week (most overdues self-resolve) and steepens through 14
 * days, where the realistic "are they ever going to pay?" tipping
 * point sits per the original fee-collection spec.
 */
const DAYS_OVERDUE_BREAKPOINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [7, 10],
  [14, 25],
  [30, 40],
  [60, 55],
  [90, 65],
];

/** +15 when reminderResponseRate < 0.3 (stop-responding is a red flag). */
const REMINDER_LOW_RESPONSE_THRESHOLD = 0.3;
const REMINDER_LOW_RESPONSE_WEIGHT = 15;

/** +10 when paymentCadenceVariance > 20 (erratic payer). */
const CADENCE_VARIANCE_THRESHOLD = 20;
const CADENCE_VARIANCE_WEIGHT = 10;

/** +10 when guardian moved to a lower income band recently. */
const GUARDIAN_INCOME_DROP_WEIGHT = 10;

/** -6 when a sibling is paying on time (positive household signal). */
const SIBLING_ON_TIME_WEIGHT = -6;

/** +5 when welfare referral is active (more attention needed). */
const WELFARE_REFERRAL_WEIGHT = 5;

/**
 * -30 when auto-escalation is paused. Officer is already managing this
 * student manually; the agent should not double-flag them.
 */
const AUTO_ESCALATION_PAUSED_WEIGHT = -30;

/** Tier thresholds. */
const TIER_CRITICAL = 70;
const TIER_HIGH = 40;
const TIER_MEDIUM = 15;

// ── Pure scoring function ───────────────────────────────────────────

function interpolateDaysOverdueWeight(daysOverdue: number): number {
  // Anything ≥ last breakpoint clamps to that value.
  const last = DAYS_OVERDUE_BREAKPOINTS[DAYS_OVERDUE_BREAKPOINTS.length - 1];
  if (last && daysOverdue >= last[0]) return last[1];
  // Walk segments and linearly interpolate within the first matching pair.
  for (let i = 0; i < DAYS_OVERDUE_BREAKPOINTS.length - 1; i++) {
    const a = DAYS_OVERDUE_BREAKPOINTS[i];
    const b = DAYS_OVERDUE_BREAKPOINTS[i + 1];
    if (!a || !b) continue;
    const [x0, y0] = a;
    const [x1, y1] = b;
    if (daysOverdue >= x0 && daysOverdue <= x1) {
      const span = x1 - x0;
      if (span === 0) return y0;
      const t = (daysOverdue - x0) / span;
      return y0 + t * (y1 - y0);
    }
  }
  return 0;
}

function bucketTier(score: number): RiskTier {
  if (score >= TIER_CRITICAL) return 'critical';
  if (score >= TIER_HIGH) return 'high';
  if (score >= TIER_MEDIUM) return 'medium';
  return 'low';
}

export function computeRiskScore(f: RiskFeatures): RiskScore {
  // Insufficient-data sentinel: < 0 means we couldn't compute it.
  if (f.daysOverdue < 0 || !Number.isFinite(f.daysOverdue)) {
    return { score: null, factors: [], tier: 'insufficient-data' };
  }

  const factors: RiskFactor[] = [];
  let score = 0;

  // 1. daysOverdue (always included even if 0, so the factor breakdown
  //    surfaces the fact the model considered it).
  const overdueWeight = Math.round(interpolateDaysOverdueWeight(f.daysOverdue));
  score += overdueWeight;
  factors.push({
    name: 'daysOverdue',
    weight: overdueWeight,
    value: f.daysOverdue,
  });

  // 2. reminderResponseRate: stop-responding adds risk
  if (f.reminderResponseRate < REMINDER_LOW_RESPONSE_THRESHOLD) {
    score += REMINDER_LOW_RESPONSE_WEIGHT;
    factors.push({
      name: 'reminderResponseRate',
      weight: REMINDER_LOW_RESPONSE_WEIGHT,
      value: f.reminderResponseRate,
    });
  }

  // 3. paymentCadenceVariance > 20 days: erratic
  if (f.paymentCadenceVariance > CADENCE_VARIANCE_THRESHOLD) {
    score += CADENCE_VARIANCE_WEIGHT;
    factors.push({
      name: 'paymentCadenceVariance',
      weight: CADENCE_VARIANCE_WEIGHT,
      value: f.paymentCadenceVariance,
    });
  }

  // 4. Guardian income band drop
  if (f.guardianIncomeBandDropFlag) {
    score += GUARDIAN_INCOME_DROP_WEIGHT;
    factors.push({
      name: 'guardianIncomeBandDropFlag',
      weight: GUARDIAN_INCOME_DROP_WEIGHT,
      value: true,
    });
  }

  // 5. Sibling paying on time: positive household signal
  if (f.siblingOnTimeFlag) {
    score += SIBLING_ON_TIME_WEIGHT;
    factors.push({
      name: 'siblingOnTimeFlag',
      weight: SIBLING_ON_TIME_WEIGHT,
      value: true,
    });
  }

  // 6. Welfare referral active
  if (f.welfareReferralActive) {
    score += WELFARE_REFERRAL_WEIGHT;
    factors.push({
      name: 'welfareReferralActive',
      weight: WELFARE_REFERRAL_WEIGHT,
      value: true,
    });
  }

  // 7. Auto-escalation paused
  if (f.autoEscalationPaused) {
    score += AUTO_ESCALATION_PAUSED_WEIGHT;
    factors.push({
      name: 'autoEscalationPaused',
      weight: AUTO_ESCALATION_PAUSED_WEIGHT,
      value: true,
    });
  }

  // Clamp [0, 100]
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  const finalScore = Math.round(score);

  return { score: finalScore, factors, tier: bucketTier(finalScore) };
}

// ── Feature assembler (Mongo-backed) ────────────────────────────────

/**
 * Pulls features from Mongo for a single (collegeId, studentId).
 *
 * Defaults when a feature can't be computed:
 *   - daysOverdue: -1 (insufficient-data sentinel) when no active
 *     DefaulterRecord exists
 *   - reminderResponseRate: 0.5 (neutral) when no reminders sent
 *   - paymentCadenceVariance: 0 (no signal) when < 2 payments
 *   - guardianIncomeBandDropFlag: false (not yet wired; deferred to A4)
 *   - siblingOnTimeFlag: true iff the student's primaryParent has at
 *     least one other student who has no active overdue DefaulterRecord
 *   - stageAdvanceVelocityDays: 0 when no escalation history
 *   - welfareReferralActive: from DefaulterRecord.welfareReferralStatus
 *   - autoEscalationPaused: from DefaulterRecord.autoEscalationPaused
 */
export async function assembleFeatures(
  collegeId: string,
  studentId: string,
): Promise<RiskFeatures> {
  // Defensive: invalid ObjectId strings should not throw — yield
  // insufficient-data instead.
  if (
    !Types.ObjectId.isValid(collegeId) ||
    !Types.ObjectId.isValid(studentId)
  ) {
    return {
      daysOverdue: -1,
      reminderResponseRate: 0.5,
      paymentCadenceVariance: 0,
      guardianIncomeBandDropFlag: false,
      siblingOnTimeFlag: false,
      stageAdvanceVelocityDays: 0,
      welfareReferralActive: false,
      autoEscalationPaused: false,
    };
  }

  const cId = new Types.ObjectId(collegeId);
  const sId = new Types.ObjectId(studentId);

  // 1. DefaulterRecord — primary source for daysOverdue + welfare flag
  //    + autoEscalationPaused. We only consider active stages (paying
  //    students who are currently overdue — not resolved or exited).
  const defaulter = await DefaulterRecord.findOne({
    collegeId: cId,
    studentId: sId,
    escalationStage: {
      $nin: ['resolved', 'exited_hardship', 'exited_write_off'],
    },
  })
    .sort({ daysOverdue: -1 })
    .lean();

  const daysOverdue = defaulter ? defaulter.daysOverdue : -1;
  const welfareReferralActive = defaulter
    ? defaulter.welfareReferralStatus !== undefined &&
      defaulter.welfareReferralStatus !== 'none'
    : false;
  const autoEscalationPaused = !!(
    defaulter?.autoEscalationPaused &&
    defaulter.autoEscalationPaused.getTime() > Date.now()
  );

  // 2. Reminder response rate — delivered / sent.
  const reminders = await FeeReminder.find({
    collegeId: cId,
    studentId: sId,
  })
    .select({ deliveryStatus: 1, status: 1 })
    .lean();

  let reminderResponseRate = 0.5; // neutral default
  if (reminders.length > 0) {
    const delivered = reminders.filter(
      (r) => r.deliveryStatus === 'delivered' || r.status === 'delivered',
    ).length;
    reminderResponseRate = delivered / reminders.length;
  }

  // 3. Payment cadence variance — stddev of inter-payment gap (days).
  const payments = await Payment.find({
    collegeId: cId,
    studentId: sId,
    status: 'success',
  })
    .select({ paymentDate: 1 })
    .sort({ paymentDate: 1 })
    .lean();

  let paymentCadenceVariance = 0;
  if (payments.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < payments.length; i++) {
      const prev = payments[i - 1];
      const cur = payments[i];
      if (!prev?.paymentDate || !cur?.paymentDate) continue;
      const diffDays =
        (cur.paymentDate.getTime() - prev.paymentDate.getTime()) /
        MS_PER_DAY_CONST;
      gaps.push(diffDays);
    }
    paymentCadenceVariance = stddev(gaps);
  }

  // 4. Sibling on-time flag — does the student's primaryParent have any
  //    OTHER student with no active overdue DefaulterRecord?
  let siblingOnTimeFlag = false;
  const me = await Student.findOne({ collegeId: cId, _id: sId })
    .select({ primaryParentId: 1 })
    .lean();
  if (me?.primaryParentId) {
    const siblings = await Student.find({
      collegeId: cId,
      primaryParentId: me.primaryParentId,
      _id: { $ne: sId },
    })
      .select({ _id: 1 })
      .lean();
    if (siblings.length > 0) {
      const siblingIds = siblings.map((s) => s._id);
      // Sibling has an active defaulter? If at least one sibling is
      // clean (no active defaulter row), set the flag true.
      const overdueSiblings = await DefaulterRecord.find({
        collegeId: cId,
        studentId: { $in: siblingIds },
        escalationStage: {
          $nin: ['resolved', 'exited_hardship', 'exited_write_off'],
        },
      })
        .select({ studentId: 1 })
        .lean();
      const overdueSet = new Set(overdueSiblings.map((d) => String(d.studentId)));
      const cleanSibling = siblings.find(
        (s) => !overdueSet.has(String(s._id)),
      );
      siblingOnTimeFlag = !!cleanSibling;
    }
  }

  return {
    daysOverdue,
    reminderResponseRate,
    paymentCadenceVariance,
    // Income-band drop is deferred — Person.demographics doesn't carry
    // a dated history yet. A4 may pipe this in if a richer signal lands.
    guardianIncomeBandDropFlag: false,
    siblingOnTimeFlag,
    // Stage-advance velocity needs a transition log; not yet on
    // DefaulterRecord. Default to 0 (neutral).
    stageAdvanceVelocityDays: 0,
    welfareReferralActive,
    autoEscalationPaused,
  };
}
