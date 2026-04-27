/**
 * Task A4 — ContextAssembler (fee-analytics-ai-native).
 *
 * Per-feature context bundles consumed by the orchestrator in `service.ts`.
 * Every assembler is college-scoped and read-only.
 *
 * Contract intent (plan §1.8):
 *   - `forChat`           → dashboard state + masked top-20 defaulters +
 *                           7-day collection trend
 *   - `forForecast`       → recent anomaly signals (7d-vs-30d delta,
 *                           new stage_4 holds today, payment-mode shifts)
 *   - `forRiskNarrative`  → factor list passthrough (caller has features)
 *   - `forReminderDraft`  → guardian (with PII pre-mask), tone, history
 *
 * The assemblers DO NOT call the LLM and DO NOT mask PII. Masking is the
 * orchestrator's responsibility (`service.ts`) so it owns the token map.
 */

import { Types } from 'mongoose';

import { Payment } from '../../../models/finance/Payment';
import { DefaulterRecord } from '../../../models/finance/DefaulterRecord';
import { FeeReminder } from '../../../models/finance/FeeReminder';
import { FinancialHold } from '../../../models/finance/FinancialHold';
import { Student } from '../../../models/people/Student';
import { Person } from '../../../models/people/Person';
import { Parent } from '../../../models/people/Parent';

import { startOfToday, daysAgo, MS_PER_DAY_CONST } from './time-helpers';

// ── Types exposed to the orchestrator ───────────────────────────────────

export interface ChatContextFilters {
  from?: Date;
  to?: Date;
  programmeIds?: string[];
}

export interface ChatDefaulterEntry {
  studentId: string;
  rollNumber?: string;
  programme?: string;
  daysOverdue: number;
  escalationStage: string;
  overdueAmount: number;
  /** Guardian object included so the masker can transform it before LLM. */
  guardian?: { name?: string; phone?: string; email?: string };
}

export interface ChatContextBundle {
  filters: ChatContextFilters;
  defaulters: ChatDefaulterEntry[];
  trailing7DayCollection: number;
  trailing30DayCollection: number;
  newStage4HoldsToday: number;
}

export interface ForecastSignals {
  /** 7-day collection minus prior 23-day daily-average × 7. Negative means decline. */
  collectionDeltaInr: number;
  newStage4HoldsToday: number;
  upiShareLast7Days: number;
  upiShareTrailing30Days: number;
}

export interface ReminderDraftContext {
  studentId: string;
  rollNumber?: string;
  guardian: {
    name?: string;
    phone?: string;
    email?: string;
    preferredLanguage?: string;
  };
  /** Daily-overdue snapshot for the prompt narrative. */
  daysOverdue: number;
  overdueAmount: number;
  /** Count of reminders already sent (drives tone ladder). */
  priorReminderCount: number;
  /** Welfare flag drives the 'empathetic' branch of the tone ladder. */
  welfareReferralActive: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────

function toIdString(x: unknown): string {
  if (x === null || x === undefined) return '';
  if (typeof x === 'string') return x;
  if (x instanceof Types.ObjectId) return x.toHexString();
  return String(x);
}

async function sumPayments(
  cId: Types.ObjectId,
  from: Date,
  to: Date,
): Promise<number> {
  const rows = await Payment.aggregate<{ _id: null; total: number }>([
    {
      $match: {
        collegeId: cId,
        status: 'success',
        paymentDate: { $gte: from, $lt: to },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return rows[0]?.total ?? 0;
}

async function countNewStage4HoldsToday(cId: Types.ObjectId): Promise<number> {
  const start = startOfToday();
  return FinancialHold.countDocuments({
    collegeId: cId,
    holdType: 'exam_debarment',
    createdAt: { $gte: start },
  });
}

// ── Public assemblers ──────────────────────────────────────────────────

/**
 * Assemble the context bundle for the chat endpoint.
 *
 * Returns a denormalised snapshot the LLM can reason over: filters,
 * top-20 defaulters by daysOverdue, last 7-day collection vs trailing
 * 30-day baseline, and today's stage-4 hold count.
 *
 * Guardian PII is included raw — `service.ts` masks before LLM.
 */
export async function forChat(
  collegeId: string,
  ctx?: { filters?: ChatContextFilters; visibleDefaulterIds?: string[] },
): Promise<ChatContextBundle> {
  if (!Types.ObjectId.isValid(collegeId)) {
    return {
      filters: ctx?.filters ?? {},
      defaulters: [],
      trailing7DayCollection: 0,
      trailing30DayCollection: 0,
      newStage4HoldsToday: 0,
    };
  }
  const cId = new Types.ObjectId(collegeId);

  // 1. Top-20 defaulters by daysOverdue desc; if visibleDefaulterIds was
  //    supplied, use that as the exact filter (verify ownership).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseFilter: Record<string, any> = {
    collegeId: cId,
    escalationStage: {
      $nin: ['resolved', 'exited_hardship', 'exited_write_off'],
    },
  };
  if (ctx?.visibleDefaulterIds && ctx.visibleDefaulterIds.length > 0) {
    const validIds = ctx.visibleDefaulterIds
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s));
    baseFilter['studentId'] = { $in: validIds };
  }
  const records = await DefaulterRecord.find(baseFilter)
    .sort({ daysOverdue: -1 })
    .limit(20)
    .lean();

  const defaulters: ChatDefaulterEntry[] = [];
  for (const r of records) {
    const student = await Student.findOne({
      _id: r.studentId,
      collegeId: cId,
    })
      .select({ rollNumber: 1, programmeId: 1, primaryParentId: 1, personId: 1 })
      .lean();
    if (!student) continue;

    let guardian: ChatDefaulterEntry['guardian'] | undefined;
    if (student.primaryParentId) {
      const parent = await Parent.findOne({
        _id: student.primaryParentId,
        collegeId: cId,
      })
        .select({ personId: 1 })
        .lean();
      if (parent) {
        const person = await Person.findOne({
          _id: parent.personId,
          collegeId: cId,
        })
          .select({ name: 1, phone: 1, email: 1 })
          .lean();
        if (person) {
          guardian = {
            name: person.name,
            phone: person.phone,
            email: person.email,
          };
        }
      }
    }

    defaulters.push({
      studentId: toIdString(r.studentId),
      rollNumber: student.rollNumber,
      programme: student.programmeId
        ? toIdString(student.programmeId)
        : undefined,
      daysOverdue: r.daysOverdue,
      escalationStage: r.escalationStage,
      overdueAmount: r.overdueAmount,
      guardian,
    });
  }

  // 2. Trailing 7-day vs 30-day collection sums
  const now = new Date();
  const start7 = daysAgo(7, now);
  const start30 = daysAgo(30, now);
  const [t7, t30, holds4] = await Promise.all([
    sumPayments(cId, start7, now),
    sumPayments(cId, start30, now),
    countNewStage4HoldsToday(cId),
  ]);

  return {
    filters: ctx?.filters ?? {},
    defaulters,
    trailing7DayCollection: t7,
    trailing30DayCollection: t30,
    newStage4HoldsToday: holds4,
  };
}

/**
 * Assemble forecast-narrative anomaly signals.
 */
export async function forForecast(collegeId: string): Promise<ForecastSignals> {
  if (!Types.ObjectId.isValid(collegeId)) {
    return {
      collectionDeltaInr: 0,
      newStage4HoldsToday: 0,
      upiShareLast7Days: 0,
      upiShareTrailing30Days: 0,
    };
  }
  const cId = new Types.ObjectId(collegeId);
  const now = new Date();
  const start7 = daysAgo(7, now);
  const start30 = daysAgo(30, now);

  const [t7, t30, newHolds] = await Promise.all([
    sumPayments(cId, start7, now),
    sumPayments(cId, start30, start7),
    countNewStage4HoldsToday(cId),
  ]);

  // Mode share — only successful payments.
  const recentRows = await Payment.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        collegeId: cId,
        status: 'success',
        paymentDate: { $gte: start7, $lt: now },
      },
    },
    { $group: { _id: '$paymentMode', count: { $sum: 1 } } },
  ]);
  const trailingRows = await Payment.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        collegeId: cId,
        status: 'success',
        paymentDate: { $gte: start30, $lt: start7 },
      },
    },
    { $group: { _id: '$paymentMode', count: { $sum: 1 } } },
  ]);
  const recentTotal = recentRows.reduce((a, r) => a + r.count, 0) || 1;
  const trailingTotal = trailingRows.reduce((a, r) => a + r.count, 0) || 1;
  const recentUpi =
    (recentRows.find((r) => r._id === 'upi')?.count ?? 0) / recentTotal;
  const trailingUpi =
    (trailingRows.find((r) => r._id === 'upi')?.count ?? 0) / trailingTotal;

  // Project trailing-30 average to a 7-day equivalent for delta math
  const trailing7Equivalent = (t30 / 23) * 7;
  const collectionDeltaInr = t7 - trailing7Equivalent;

  return {
    collectionDeltaInr,
    newStage4HoldsToday: newHolds,
    upiShareLast7Days: recentUpi,
    upiShareTrailing30Days: trailingUpi,
  };
}

/**
 * Per-student reminder-draft context. Pulls guardian PII raw — masking
 * happens in `service.ts`.
 */
export async function forReminderDraft(
  collegeId: string,
  studentId: string,
): Promise<ReminderDraftContext | null> {
  if (
    !Types.ObjectId.isValid(collegeId) ||
    !Types.ObjectId.isValid(studentId)
  ) {
    return null;
  }
  const cId = new Types.ObjectId(collegeId);
  const sId = new Types.ObjectId(studentId);

  const student = await Student.findOne({ _id: sId, collegeId: cId })
    .select({ rollNumber: 1, primaryParentId: 1, personId: 1 })
    .lean();
  if (!student) return null;

  let guardian: ReminderDraftContext['guardian'] = {};
  if (student.primaryParentId) {
    const parent = await Parent.findOne({
      _id: student.primaryParentId,
      collegeId: cId,
    })
      .select({ personId: 1 })
      .lean();
    if (parent) {
      const person = await Person.findOne({
        _id: parent.personId,
        collegeId: cId,
      })
        .select({ name: 1, phone: 1, email: 1, preferredLanguage: 1 })
        .lean();
      if (person) {
        guardian = {
          name: person.name,
          phone: person.phone,
          email: person.email,
          preferredLanguage: person.preferredLanguage,
        };
      }
    }
  }
  if (!guardian.preferredLanguage) {
    // Fall back to student's own person (in case guardian isn't set).
    const studentPerson = await Person.findOne({
      _id: student.personId,
      collegeId: cId,
    })
      .select({ preferredLanguage: 1 })
      .lean();
    if (studentPerson?.preferredLanguage) {
      guardian.preferredLanguage = studentPerson.preferredLanguage;
    }
  }

  const defaulter = await DefaulterRecord.findOne({
    collegeId: cId,
    studentId: sId,
    escalationStage: {
      $nin: ['resolved', 'exited_hardship', 'exited_write_off'],
    },
  })
    .sort({ daysOverdue: -1 })
    .lean();

  const priorReminderCount = await FeeReminder.countDocuments({
    collegeId: cId,
    studentId: sId,
  });

  return {
    studentId,
    rollNumber: student.rollNumber,
    guardian,
    daysOverdue: defaulter?.daysOverdue ?? 0,
    overdueAmount: defaulter?.overdueAmount ?? 0,
    priorReminderCount,
    welfareReferralActive:
      !!defaulter &&
      defaulter.welfareReferralStatus !== undefined &&
      defaulter.welfareReferralStatus !== 'none',
  };
}

/**
 * Re-export of the MS_PER_DAY constant for orchestrator math (e.g. snooze
 * snoozedUntil calculation in handleDismissSituation).
 */
export const MS_PER_DAY = MS_PER_DAY_CONST;
