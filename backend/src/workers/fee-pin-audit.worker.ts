/**
 * T17 — Nightly `fee-pin-audit` BullMQ worker.
 *
 * Scope (plan §5, tasks.md Task 17 AC):
 *   - Compute pin-coverage + invariant mismatches per college (via
 *     existing `fee-pin-audit-service` read model from T12).
 *   - Aggregate deferred-pin + commitment-sheet-failure counts off the
 *     embedded `Student.feePins[]` array.
 *   - Persist a `FeePinAuditSnapshot` per college per run.
 *   - Prune snapshots older than 90 days.
 *   - Emit a best-effort EMAIL alert to Principal + Finance Officer if
 *     coverage < 100% or invariant mismatches > 0.
 *
 * Scheduling: callers schedule this via BullMQ repeat pattern
 * `'0 2 * * *'` (daily at 02:00). `registerFeePinAuditWorker()` registers
 * the queue + worker and returns the Queue so the caller can do
 * `queue.add('fee-pin-audit-nightly', {}, { repeat: { pattern: FEE_PIN_AUDIT_JOB_OPTS.cronPattern } })`
 * at server start.
 *
 * Partial-failure tolerance: one college's exception must never poison
 * the whole run. We log + continue with the next college. BullMQ's
 * stock retry policy still applies if the whole worker throws (e.g.
 * Mongo down before we can iterate any colleges).
 */

import type { Job } from 'bullmq';

import * as feePinAuditService from '../modules/finance/fee-pin-audit-service';
import { FeePinAuditSnapshot } from '../models/finance/FeePinAuditSnapshot';
import { College } from '../models/College';
import { Student } from '../models/people/Student';
import {
  addJob,
  registerQueue,
  QUEUE_NAMES,
} from '../shared/queue/QueueManager';

/**
 * Payload shape for `fee-pin-audit` jobs. If `collegeId` is provided,
 * the worker runs only for that college (useful for ad-hoc admin
 * triggers). Otherwise it iterates over every `status='active'` college.
 */
export interface FeePinAuditJobData {
  collegeId?: string;
}

/**
 * Concurrency = 1. The audit is sequential by design — running multiple
 * colleges in parallel buys little and makes Mongo contention worse
 * during the daily burst. Individual colleges finish in seconds.
 */
export const FEE_PIN_AUDIT_CONCURRENCY = 1;

/**
 * Default job options. The worker itself doesn't carry cron metadata —
 * that's set on the repeat key when the job is added. We still expose
 * `cronPattern` here so the server-startup code has a single source of
 * truth.
 *
 * Retry policy: 3 attempts, exponential backoff starting at 5 minutes.
 * The 5-minute initial delay gives a transient Mongo outage time to
 * clear before we retry a job that otherwise takes seconds.
 */
export const FEE_PIN_AUDIT_JOB_OPTS: {
  attempts: number;
  backoff: { type: 'exponential' | 'fixed'; delay: number };
  cronPattern: string;
} = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5 * 60 * 1000 },
  cronPattern: '0 2 * * *',
};

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Compute deferred-pin and commitment-sheet-failure counts by scanning
 * active pins on each Student in the college.
 *
 * Definitions:
 *   - Deferred pin: `feePins[].staleSince` populated AND the pin is not
 *     archived. These are the pins flagged by T11's rebind hooks as
 *     "the structure drifted from the student's attributes".
 *   - Commitment-sheet failure: `feePins[].commitmentSheetStatus ===
 *     'failed'`. Counted whether or not the pin is archived — a failed
 *     PDF on an archived pin is still a signal Finance wants to see.
 */
async function computeAdditionalCounts(collegeId: string): Promise<{
  deferredPinsCount: number;
  commitmentSheetFailureCount: number;
}> {
  const studentsWithFlags = await Student.find({
    collegeId,
    $or: [
      { 'feePins.staleSince': { $ne: null } },
      { 'feePins.commitmentSheetStatus': 'failed' },
    ],
  })
    .select({ feePins: 1 })
    .lean();

  let deferredPinsCount = 0;
  let commitmentSheetFailureCount = 0;

  for (const s of studentsWithFlags) {
    const pins = (s.feePins ?? []) as Array<{
      staleSince?: Date | null;
      archivedAt?: Date | null;
      commitmentSheetStatus?: string;
    }>;
    for (const p of pins) {
      if (p.staleSince && !p.archivedAt) deferredPinsCount += 1;
      if (p.commitmentSheetStatus === 'failed') commitmentSheetFailureCount += 1;
    }
  }

  return { deferredPinsCount, commitmentSheetFailureCount };
}

/**
 * Best-effort email alert. We never let an email failure fail the audit
 * job — emails are a notification, not an invariant. If the EMAIL queue
 * isn't registered (e.g. in tests) we swallow the error.
 */
async function emitAlert(
  collegeId: string,
  payload: {
    coveragePercent: number;
    mismatchCount: number;
  },
): Promise<void> {
  try {
    await addJob(QUEUE_NAMES.EMAIL, 'fee-pin-audit-alert', {
      collegeId,
      subject: `[Juvion] Fee-pin audit alert for ${collegeId}`,
      body:
        `Coverage: ${payload.coveragePercent}%\n` +
        `Invariant mismatches: ${payload.mismatchCount}\n` +
        `Investigate from the Finance dashboard → Fee Pin Audit tab.`,
      recipients: ['principal', 'finance_officer'],
    });
  } catch (err) {
    // Don't fail the audit run if emailing is down.
    // eslint-disable-next-line no-console
    console.warn(
      `[fee-pin-audit] email alert enqueue failed for college ${collegeId}`,
      err,
    );
  }
}

/**
 * Main entry. Iterates over the target colleges (or the single one
 * provided) and writes a `FeePinAuditSnapshot` per college. On
 * per-college exception, logs and moves on — the whole job is only
 * considered failed if it throws synchronously before the loop.
 */
export async function feePinAuditWorker(
  job: Job<FeePinAuditJobData>,
): Promise<void> {
  const data = job.data ?? {};
  let collegeIds: string[];

  if (data.collegeId) {
    collegeIds = [data.collegeId];
  } else {
    const activeColleges = await College.find({ status: 'active' })
      .select({ _id: 1 })
      .lean();
    collegeIds = activeColleges.map((c) => String(c._id));
  }

  for (const collegeId of collegeIds) {
    try {
      // Only the reasons that mean "no usable pin" — the coverage report also
      // flags students who ARE pinned but have no fee-responsible guardian,
      // and this snapshot field is specifically about missing pins.
      const coverage = await feePinAuditService.getCoverage(collegeId, {
        limit: 50,
        reason: feePinAuditService.PIN_MISSING_REASONS,
      });
      const invariants = await feePinAuditService.getInvariants(collegeId);
      const { deferredPinsCount, commitmentSheetFailureCount } =
        await computeAdditionalCounts(collegeId);

      await FeePinAuditSnapshot.create({
        collegeId,
        runAt: new Date(),
        coverage: {
          totalActiveStudents: coverage.totalActiveStudents,
          studentsWithActivePinForCurrentYear:
            coverage.studentsWithActivePinForCurrentYear,
          coveragePercent: coverage.coveragePercent,
          // Sliced here as well as limited in the query: 50 is what this
          // snapshot field promises, whatever the service is asked for.
          missingSample: coverage.students.slice(0, 50).map((m) => ({
            studentId: m.studentId,
            rollNumber: m.rollNumber ?? '',
            programmeId: m.programmeId,
            currentYearOfStudy: m.yearOfStudy,
          })),
        },
        invariants: {
          totalInvoicesChecked: invariants.totalInvoicesChecked,
          mismatches: invariants.mismatches,
        },
        deferredPinsCount,
        commitmentSheetFailureCount,
      });

      // Prune snapshots older than 90 days for this college.
      const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
      await FeePinAuditSnapshot.deleteMany({
        collegeId,
        runAt: { $lt: cutoff },
      });

      // Alert if invariants broken or coverage incomplete.
      if (coverage.coveragePercent < 100 || invariants.mismatches.length > 0) {
        await emitAlert(collegeId, {
          coveragePercent: coverage.coveragePercent,
          mismatchCount: invariants.mismatches.length,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[fee-pin-audit] failed for college ${collegeId}`,
        err,
      );
      // Swallow — other colleges must still be audited.
    }
  }
}

/**
 * Register the `fee-pin-audit` queue + worker with the central
 * QueueManager. Call once at server start. The caller is responsible
 * for scheduling the recurring job via BullMQ's repeat pattern:
 *
 *   const queue = registerFeePinAuditWorker();
 *   await queue.add('nightly', {}, {
 *     repeat: { pattern: FEE_PIN_AUDIT_JOB_OPTS.cronPattern },
 *     attempts: FEE_PIN_AUDIT_JOB_OPTS.attempts,
 *     backoff: FEE_PIN_AUDIT_JOB_OPTS.backoff,
 *   });
 *
 * Idempotent: `registerQueue` returns the existing queue on a second
 * call.
 */
export function registerFeePinAuditWorker() {
  return registerQueue({
    name: QUEUE_NAMES.FEE_PIN_AUDIT,
    processor: feePinAuditWorker as unknown as (job: Job) => Promise<unknown>,
    concurrency: FEE_PIN_AUDIT_CONCURRENCY,
  });
}
