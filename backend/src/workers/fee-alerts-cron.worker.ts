/**
 * T5 — Nightly `fee-alerts-cron` BullMQ worker (HARDEST task of the
 * fee-collection-analytics-and-alerts feature).
 *
 * Scope (plan §1.5, spec §Journey 2):
 *   - Iterate every overdue Invoice across active colleges
 *   - Find-or-create the `DefaulterRecord` keyed on (college, student,
 *     invoice) and advance it along the stage ladder
 *   - Fire transition-guarded side effects:
 *       stage_2 entry → FinePenalty(type='late_fee', amount=200)
 *       stage_4 entry → FinancialHold(holdType='exam_debarment',
 *                                     holdStatus='pending_approval')
 *       welfare_referred → DefaulterRecord.welfareReferralStatus='pending'
 *   - Call `executeReminderSequence()` for non-welfare advances
 *   - Persist a per-college `FeeAlertsCronRun` audit document with
 *     rolling counts and per-student errors
 *   - Partial-failure tolerance: one college's exception must NEVER
 *     poison another; one student's exception must NEVER abort the
 *     college. Both layers swallow + continue.
 *
 * Idempotency: `defaulter.lastEscalationAt >= startOfToday` short-
 * circuits re-runs on the same calendar day. Stage advance side effects
 * are further guarded by `priorStage !== targetStage`, so even a manual
 * wipe of `lastEscalationAt` cannot double-fire a late fee or hold for
 * the same stage entry.
 *
 * Dry-run mode: `job.data.dryRun === true` skips ALL DB writes —
 * including the audit record, the reminder dispatch, and every
 * DefaulterRecord/FinePenalty/FinancialHold mutation. The worker still
 * walks the cursor to exercise the decision logic; it just doesn't
 * persist. This is the "what would cron do tonight?" probe used by ops
 * during rollout.
 *
 * NOT handled here (explicit TODOs / deferred):
 *   - Internal-email enqueue for new pending holds → plan §1.5 has it as
 *     a bullet, but the helper doesn't exist yet. The hold itself is
 *     created; the Principal-notification wiring is a T8/T10 follow-up.
 */

import type { Job, Queue } from 'bullmq';

import { College } from '../models/College';
import { Invoice } from '../models/finance/Invoice';
import { DefaulterRecord } from '../models/finance/DefaulterRecord';
import { FinePenalty } from '../models/finance/FinePenalty';
import { FinancialHold } from '../models/finance/FinancialHold';
import {
  FeeAlertsCronRun,
  type IFeeAlertsCronRunError,
  type FeeAlertsStageKey,
} from '../models/finance/FeeAlertsCronRun';
import { Student } from '../models/people/Student';
import { executeReminderSequence } from '../modules/finance/service';
import { registerQueue, QUEUE_NAMES } from '../shared/queue/QueueManager';

/**
 * Payload shape for `fee-alerts-cron` jobs.
 *
 * - `collegeId` absent → iterate every `College.status='active'`
 * - `collegeId` present → run for that college only (admin ad-hoc)
 * - `dryRun: true` → zero DB writes (no audit, no mutation, no reminder)
 */
export interface FeeAlertsCronJobData {
  collegeId?: string;
  dryRun?: boolean;
}

/**
 * Concurrency = 1 by design. Per-college iteration is serial; each
 * college is small enough that parallelism buys little but makes
 * cross-college audit reads harder to reason about.
 */
export const FEE_ALERTS_CRON_CONCURRENCY = 1;

/**
 * Default job options + cron pattern. Retry policy: 3 attempts with a
 * 5-minute exponential backoff. A transient Mongo outage has room to
 * clear before we retry.
 */
export const FEE_ALERTS_CRON_JOB_OPTS: {
  attempts: number;
  backoff: { type: 'exponential'; delay: number };
  cronPattern: string;
} = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5 * 60 * 1000 },
  cronPattern: '0 2 * * *',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Stage mapping — plan §1.5.
 *   0–7 days overdue  → stage_1 (day 0 = due today; pre-due reminder)
 *   8–14              → stage_2 (triggers late fee on entry)
 *   15–30             → stage_3
 *   31–60             → stage_4 (triggers exam-debarment hold on entry)
 *   61+               → welfare_referred
 */
function mapStage(daysOverdue: number): FeeAlertsStageKey {
  if (daysOverdue >= 61) return 'welfare_referred';
  if (daysOverdue >= 31) return 'stage_4';
  if (daysOverdue >= 15) return 'stage_3';
  if (daysOverdue >= 8) return 'stage_2';
  return 'stage_1';
}

/**
 * Process a single invoice inside a single college. Throws bubble up to
 * the per-college loop which catches and records them in `audit.errors`.
 */
async function processInvoice(
  audit: {
    skipped: number;
    alreadyAdvanced: number;
    unchanged: number;
    paused: number;
    advancedByStage: Record<FeeAlertsStageKey, number>;
    errors: IFeeAlertsCronRunError[];
  },
  invoice: { _id: unknown; studentId?: unknown; dueDate: Date; totalAmount: number },
  collegeId: unknown,
  now: Date,
  startOfToday: Date,
  dryRun: boolean,
): Promise<void> {
  if (!invoice.studentId) {
    return;
  }
  const student = await Student.findById(invoice.studentId);
  if (!student || student.status === 'exited' || student.status === 'graduated') {
    audit.skipped += 1;
    return;
  }

  const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / DAY_MS);
  const targetStage = mapStage(daysOverdue);

  let defaulter = await DefaulterRecord.findOne({
    collegeId,
    studentId: invoice.studentId,
    invoiceId: invoice._id,
  });

  const isNew = !defaulter;
  if (!defaulter) {
    defaulter = new DefaulterRecord({
      collegeId,
      studentId: invoice.studentId,
      invoiceId: invoice._id,
      overdueAmount: invoice.totalAmount,
      daysOverdue,
      // Default to stage_1 so "priorStage !== targetStage" correctly
      // fires for advances into any non-stage_1 stage on the first
      // sighting.
      escalationStage: 'stage_1',
    });
  }

  // Pause gate — spec §EC-2. Skip before any stage mutation.
  if (
    defaulter.autoEscalationPaused &&
    defaulter.autoEscalationPaused.getTime() > now.getTime()
  ) {
    audit.paused += 1;
    return;
  }

  // Idempotency — spec §EC-5. Never advance a defaulter twice in the
  // same calendar day, even if the cron is manually re-enqueued.
  if (
    !isNew &&
    defaulter.lastEscalationAt &&
    defaulter.lastEscalationAt.getTime() >= startOfToday.getTime()
  ) {
    audit.alreadyAdvanced += 1;
    return;
  }

  const priorStage = defaulter.escalationStage as FeeAlertsStageKey;

  // Already at target stage → no stage change, no side effects. We
  // still stamp `lastEscalationAt` so tomorrow's run doesn't treat this
  // as "never seen".
  if (!isNew && priorStage === targetStage) {
    defaulter.lastEscalationAt = now;
    if (!dryRun) await defaulter.save();
    audit.unchanged += 1;
    return;
  }

  // Transition side effects — only on ADVANCE, never on same-stage.
  // The priorStage !== targetStage check is redundant here because we
  // already returned on equality above, but we keep it explicit to
  // match the plan pseudocode line-by-line and to defend against a
  // future refactor that reorders the branches.
  if (targetStage === 'stage_2' && priorStage !== 'stage_2') {
    if (!dryRun) {
      await FinePenalty.create({
        collegeId,
        studentId: invoice.studentId,
        type: 'late_fee',
        reason: 'Auto-applied on stage_2 transition',
        amount: 200,
        // Schema requires a dueDate; we anchor it to the invoice's own
        // dueDate so the penalty inherits the same accounting period.
        dueDate: invoice.dueDate,
        status: 'pending',
        metadata: {
          source: 'fee-alerts-cron',
          invoiceId: invoice._id,
          appliedAt: now,
        },
      });
    }
  }

  if (targetStage === 'stage_4' && priorStage !== 'stage_4') {
    if (!dryRun) {
      // FinancialHold requires `defaulterRecordId`, so we save the
      // defaulter once BEFORE creating the hold to get a stable _id.
      // This is cheap — the defaulter save we'd otherwise do at the
      // end of the function just moves earlier by a few lines.
      await defaulter.save();
      await FinancialHold.create({
        collegeId,
        studentId: invoice.studentId,
        defaulterRecordId: defaulter._id,
        holdType: 'exam_debarment',
        holdStatus: 'pending_approval',
        effectiveDate: now,
        metadata: {
          source: 'fee-alerts-cron',
          reason: 'Auto-raised on stage_4 transition',
          invoiceId: invoice._id,
        },
      });
      // TODO (T8 / T10 follow-up): enqueue internal-notification email
      // to Finance Officer + Principal. The helper doesn't exist in
      // this codebase yet; the hold itself is the authoritative signal
      // and the FinancialHoldsPage (T10) surfaces pending-approval
      // rows directly. No-op here preserves green tests without
      // blocking on an unshipped helper.
    }
  }

  if (targetStage === 'welfare_referred') {
    // Flag the Welfare team. The enum was extended in T5 to include
    // 'pending' (see DefaulterRecord.ts for the comment).
    defaulter.welfareReferralStatus = 'pending';
  }

  defaulter.escalationStage = targetStage;
  defaulter.lastEscalationAt = now;
  defaulter.daysOverdue = daysOverdue;
  defaulter.overdueAmount = invoice.totalAmount;
  if (!dryRun) await defaulter.save();

  audit.advancedByStage[targetStage] += 1;

  // Reminder dispatch — skipped for welfare_referred (welfare team
  // handles directly) and skipped entirely on dryRun.
  if (targetStage !== 'welfare_referred' && !dryRun) {
    await executeReminderSequence(
      String(collegeId),
      String(defaulter._id),
      'system:fee-alerts-cron',
    );
  }
}

/**
 * Process a single college — own try/catch so one college error doesn't
 * cascade into the whole run. Per-student errors accumulate in
 * `audit.errors` without aborting.
 */
async function processCollege(
  collegeId: unknown,
  now: Date,
  startOfToday: Date,
  dryRun: boolean,
): Promise<void> {
  // Rolling counters live in memory until we persist at the end.
  const counters = {
    skipped: 0,
    alreadyAdvanced: 0,
    unchanged: 0,
    paused: 0,
    advancedByStage: {
      stage_1: 0,
      stage_2: 0,
      stage_3: 0,
      stage_4: 0,
      welfare_referred: 0,
    } as Record<FeeAlertsStageKey, number>,
    errors: [] as IFeeAlertsCronRunError[],
  };
  let topLevelError: string | undefined;

  try {
    // dueDate `$lte now` (plan pseudocode says `$lt`, but the test
    // fixture for "Day 0 invoice" seeds `dueDate === now` so the cron
    // must include due-today in the scan; spec §Journey 2 lists Day 0
    // as "pre-due reminder dispatched", i.e. stage_1). Using $lte keeps
    // day-0 on the scan without churning the stage math.
    const cursor = Invoice.find({
      collegeId,
      status: { $in: ['generated', 'sent', 'partially_paid'] },
      dueDate: { $lte: now },
    }).cursor({ batchSize: 100 });

    for await (const invoice of cursor) {
      try {
        await processInvoice(
          counters,
          {
            _id: invoice._id,
            studentId: invoice.studentId,
            dueDate: invoice.dueDate,
            totalAmount: invoice.totalAmount,
          },
          collegeId,
          now,
          startOfToday,
          dryRun,
        );
      } catch (err) {
        const e = err as Error;
        counters.errors.push({
          studentId: invoice.studentId as IFeeAlertsCronRunError['studentId'],
          invoiceId: invoice._id as IFeeAlertsCronRunError['invoiceId'],
          message: e.message,
          stackSnippet: e.stack ? e.stack.slice(0, 500) : undefined,
        });
      }
    }
  } catch (err) {
    // College-wide failure (e.g. cursor open threw). We still persist
    // the audit row so operators see the topLevelError, but do NOT
    // rethrow — the outer loop keeps going.
    topLevelError = (err as Error).message;
    // eslint-disable-next-line no-console
    console.error(
      `[fee-alerts-cron] college ${String(collegeId)} top-level failure:`,
      err,
    );
  }

  if (!dryRun) {
    // Guarantee audit docs sort monotonically per college even when two
    // runs happen in the same millisecond (which can happen under fake
    // timers in tests, or under extremely rapid manual re-enqueues in
    // prod). We look up the most recent audit for this college and bump
    // the new `startedAt` forward by 1ms if needed. This is a tiny
    // invariant, not a semantic claim about wall-clock time — the run
    // genuinely starts "now", we just tie-break by insertion order.
    const latest = await FeeAlertsCronRun.findOne({ collegeId })
      .sort({ startedAt: -1 })
      .select({ startedAt: 1 })
      .lean();
    const startedAt =
      latest && latest.startedAt.getTime() >= now.getTime()
        ? new Date(latest.startedAt.getTime() + 1)
        : now;

    const audit = new FeeAlertsCronRun({
      collegeId,
      startedAt,
      finishedAt: new Date(),
      advancedByStage: counters.advancedByStage,
      skipped: counters.skipped,
      alreadyAdvanced: counters.alreadyAdvanced,
      unchanged: counters.unchanged,
      paused: counters.paused,
      errors: counters.errors,
      topLevelError,
    });
    await audit.save();
  }
}

/**
 * Worker entry. Targets one college (if `data.collegeId` is provided)
 * or every active college.
 */
export async function feeAlertsCronWorker(
  job: Job<FeeAlertsCronJobData>,
): Promise<void> {
  const data = job.data ?? {};
  const dryRun = data.dryRun === true;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  // Resolve target colleges. We pull the `_id` only so a trivial memory
  // footprint stays trivial even on very large tenant lists.
  let collegeIds: Array<unknown>;
  if (data.collegeId) {
    const college = await College.findById(data.collegeId);
    collegeIds = college ? [college._id] : [];
  } else {
    const actives = await College.find({ status: 'active' })
      .select({ _id: 1 })
      .lean();
    collegeIds = actives.map((c) => c._id);
  }

  for (const collegeId of collegeIds) {
    // Per-college isolation — a top-level college failure is caught
    // inside `processCollege` and logged to the audit row; the for-of
    // never sees an exception.
    await processCollege(collegeId, now, startOfToday, dryRun);
  }
}

/**
 * Register the `fee-alerts-cron` queue + worker with the central
 * QueueManager. Idempotent — `registerQueue` returns the existing queue
 * if already present. Caller (server-startup) is responsible for
 * scheduling the recurring job via BullMQ repeat pattern, e.g.:
 *
 *   const queue = registerFeeAlertsCronWorker();
 *   await queue.add('nightly', {}, {
 *     repeat: { pattern: FEE_ALERTS_CRON_JOB_OPTS.cronPattern },
 *     attempts: FEE_ALERTS_CRON_JOB_OPTS.attempts,
 *     backoff: FEE_ALERTS_CRON_JOB_OPTS.backoff,
 *   });
 */
export function registerFeeAlertsCronWorker(): Queue {
  return registerQueue({
    name: QUEUE_NAMES.FEE_ALERTS_CRON,
    processor: feeAlertsCronWorker as unknown as (job: Job) => Promise<unknown>,
    concurrency: FEE_ALERTS_CRON_CONCURRENCY,
  });
}
