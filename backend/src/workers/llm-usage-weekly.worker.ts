/**
 * Task L5 — `llm-usage-weekly` BullMQ cron worker
 * (llm-spend-limits feature, plan §1.9, tasks.md §L5).
 *
 * Scope:
 *   - Runs Mon 06:00 UTC (`'0 6 * * 1'`).
 *   - Iterates every active `College`, bounded concurrency 10.
 *   - Per-college: aggregates last completed week's `AgentAction` by
 *     `type` and persists one `LLMUsageSnapshot` row capturing totals,
 *     per-type call counts, and the limit/threshold AT TIME OF SNAPSHOT
 *     (so retroactive limit changes never rewrite history — see plan
 *     §1.3 for the audit-grade rationale).
 *   - Per-college try/catch: a single college's failure NEVER aborts
 *     the others.
 *   - Always writes a snapshot — including for "zero-week" colleges
 *     with no AgentActions — so admins see the explicit zero row, not a
 *     missing one.
 *
 * NOT covered here (deferred to follow-up tasks):
 *   - Email digest / Slack post for the snapshot (plan §1.9 mentions it
 *     as a future hook; not in tasks.md §L5 ACs).
 *   - Backfill / retroactive recompute endpoint (admin-only utility,
 *     out of scope for the cron).
 */

import type { Job, Queue } from 'bullmq';

import { College } from '../models/College';
import { AgentAction } from '../models/juvi/AgentAction';
import { LLMUsageSnapshot } from '../models/juvi/LLMUsageSnapshot';
import { withBoundedConcurrency } from '../modules/juvi/finance-agent/orchestrator-helpers';
import { registerQueue, QUEUE_NAMES } from '../shared/queue/QueueManager';

// ─── Tunables / contract ───────────────────────────────────────────────

/**
 * Bounded fan-out across active colleges. 10 is a deliberate cap:
 *   - large enough to amortize Mongo round-trip latency on big tenants
 *     (we have one aggregate + one insert per college);
 *   - small enough that we don't saturate the connection pool when a
 *     tenant has 100s of colleges.
 */
export const LLM_USAGE_WEEKLY_CONCURRENCY = 10;

/**
 * Default job options + cron pattern.
 *   - 3 attempts with exponential backoff: a transient Mongo blip during
 *     the Mon 06:00 run has room to clear before BullMQ retries.
 *   - `cronPattern: '0 6 * * 1'` = Monday 06:00 UTC. The week we
 *     aggregate is the COMPLETED week (Mon..Sun) ending the day before,
 *     so by 06:00 Mon all writes for that window have settled.
 */
export const LLM_USAGE_WEEKLY_JOB_OPTS: {
  attempts: number;
  backoff: { type: 'exponential'; delay: number };
  cronPattern: string;
} = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5 * 60 * 1000 },
  cronPattern: '0 6 * * 1',
};

// ─── Time helpers — last completed UTC week ────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mon 00:00:00.000 UTC of the last COMPLETED week (i.e. the Monday
 * before the most recent Sunday). Reads `Date.now()` lazily so callers
 * (including BullMQ's repeat scheduler) always get the current run's
 * window — and so unit tests can freeze time via `vi.setSystemTime`.
 *
 * Algorithm (UTC throughout to avoid TZ-dependent flakiness):
 *   1. Walk back from `now` to the most recent Monday 00:00 UTC.
 *   2. If today IS Monday, that's the IN-PROGRESS week — step back one
 *      more week to land on the COMPLETED week's Monday.
 *   3. Otherwise (Tue..Sun), the just-found Monday IS the completed
 *      week's Monday.
 */
export function startOfLastWeek(now: Date = new Date()): Date {
  const utc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // Date.getUTCDay: Sunday=0, Monday=1, ... Saturday=6.
  // We want Monday-anchored weeks, so map to: Mon=0, Tue=1, ..., Sun=6.
  const dayOfWeekMon = (utc.getUTCDay() + 6) % 7;
  // Walk back to "this week's Monday".
  const thisMonday = new Date(utc.getTime() - dayOfWeekMon * DAY_MS);
  // The COMPLETED week is the one BEFORE the Monday we just landed on.
  return new Date(thisMonday.getTime() - 7 * DAY_MS);
}

/**
 * Sun 23:59:59.999 UTC of the last completed week. Mirror of
 * `startOfLastWeek` — exactly `+7 days - 1 ms`.
 */
export function endOfLastWeek(now: Date = new Date()): Date {
  const start = startOfLastWeek(now);
  return new Date(start.getTime() + 7 * DAY_MS - 1);
}

// ─── Per-college worker (private) ──────────────────────────────────────

interface ActiveCollege {
  _id: unknown;
  weeklyInr: number;
  alertThresholdPct: number;
}

/**
 * Process a single college. Owns its own try/catch above the call site
 * (in `withBoundedConcurrency`), so this function only needs to
 * propagate; the caller logs + continues.
 */
async function processCollege(
  college: ActiveCollege,
  weekStart: Date,
  weekEnd: Date,
): Promise<void> {
  // Aggregate by type. The pipeline is shaped per plan §1.9.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups: Array<{ _id: string; count: number; cost: number }> =
    (await AgentAction.aggregate([
      {
        $match: {
          collegeId: college._id,
          createdAt: { $gte: weekStart, $lte: weekEnd },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          cost: { $sum: '$costInr' },
        },
      },
    ])) as Array<{ _id: string; count: number; cost: number }>;

  let totalCalls = 0;
  let totalCostInr = 0;
  const byType: Record<string, number> = {};
  for (const row of groups) {
    byType[row._id] = row.count;
    totalCalls += row.count;
    totalCostInr += row.cost;
  }

  await LLMUsageSnapshot.create({
    collegeId: college._id,
    weekStart,
    weekEnd,
    totalCostInr,
    totalCalls,
    byType,
    limitAtTime: college.weeklyInr,
    alertThresholdAtTime: college.alertThresholdPct,
  });

  // Structured log line — admin/SRE-greppable. Matches plan §1.9 exactly
  // ("[llm-budget:weekly] college=<id> spent=<n> limit=<m> pct=<p>"). We
  // guard the divide-by-zero pct math by emitting `pct=0` when the limit
  // is 0 (the bypass case).
  const pct =
    college.weeklyInr > 0 ? (totalCostInr / college.weeklyInr) * 100 : 0;
  // eslint-disable-next-line no-console
  console.log(
    `[llm-budget:weekly] college=${String(college._id)} spent=${totalCostInr} limit=${college.weeklyInr} pct=${pct}`,
  );
}

// ─── Worker entry ──────────────────────────────────────────────────────

/**
 * BullMQ entry. Reads `College.find({ status: 'active' })` then fans out
 * via `withBoundedConcurrency` (cap = 10). Per-college errors are caught
 * inside the worker callback and surface as `console.error` lines — the
 * `withBoundedConcurrency` helper would otherwise return a `rejected`
 * settled-result, but we want the BullMQ job to succeed so the next
 * Monday's run isn't blocked by retries on a since-fixed transient
 * failure.
 */
export async function llmUsageWeeklyCronWorker(_job: Job): Promise<void> {
  const weekStart = startOfLastWeek();
  const weekEnd = endOfLastWeek();

  // Pull only the fields we need, lean — keeps memory footprint trivial
  // even on very large tenant lists.
  const colleges = await College.find({ status: 'active' })
    .select({ _id: 1, aiSpendLimits: 1 })
    .lean();

  // Coerce to the simple shape `processCollege` expects. Defaults
  // populated in case any (older) row lacks `aiSpendLimits`.
  const work: ActiveCollege[] = colleges.map((c) => ({
    _id: c._id,
    weeklyInr: c.aiSpendLimits?.weeklyInr ?? 0,
    alertThresholdPct: c.aiSpendLimits?.alertThresholdPct ?? 80,
  }));

  await withBoundedConcurrency(
    work,
    LLM_USAGE_WEEKLY_CONCURRENCY,
    async (college) => {
      try {
        await processCollege(college, weekStart, weekEnd);
      } catch (err) {
        // Per-college isolation — one college's failure must not stop
        // other colleges. We log a structured error line and swallow.
        // BullMQ retries are governed by the JOB-level options; a
        // single-college failure inside the bounded fan-out should not
        // trigger a whole-job retry.
        // eslint-disable-next-line no-console
        console.error(
          `[llm-budget:weekly] college=${String(college._id)} error:`,
          (err as Error).message,
        );
      }
    },
  );
}

// ─── Registration ──────────────────────────────────────────────────────

/**
 * Register the `llm-usage-weekly` queue + worker with the central
 * QueueManager. Idempotent — `registerQueue` returns the existing queue
 * if already present. Caller (server-startup) is responsible for
 * scheduling the recurring job via BullMQ repeat pattern, e.g.:
 *
 *   const queue = registerLLMUsageWeeklyCronWorker();
 *   await queue.add('weekly', {}, {
 *     repeat: { pattern: LLM_USAGE_WEEKLY_JOB_OPTS.cronPattern },
 *     attempts: LLM_USAGE_WEEKLY_JOB_OPTS.attempts,
 *     backoff: LLM_USAGE_WEEKLY_JOB_OPTS.backoff,
 *   });
 */
export function registerLLMUsageWeeklyCronWorker(): Queue {
  return registerQueue({
    name: QUEUE_NAMES.LLM_USAGE_WEEKLY,
    processor: llmUsageWeeklyCronWorker as unknown as (
      job: Job,
    ) => Promise<unknown>,
    concurrency: LLM_USAGE_WEEKLY_CONCURRENCY,
  });
}
