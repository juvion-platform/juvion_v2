/**
 * The recurring account-deletion sweep (011 §3.5, §6).
 *
 * The public web form only *schedules* a deletion: it can prove the password and nothing else, and
 * that password is the shared ERP credential, so a single stuffed one would otherwise be an
 * unauthenticated, irreversible account destruction. The sweep is what actually runs it, once the
 * seven-day grace period has passed.
 *
 * Two query shapes here are load-bearing and each has a test that fails if it drifts:
 *
 *  - **No `status` predicate.** A person scheduled for deletion may be `exiting`, `suspended`, or in
 *    any other state the account lifecycle happens to be in; the request itself is the authorisation.
 *    Adding a status filter would silently strand those rows forever.
 *  - **`deletionClaimedAt` is written, never filtered on.** It exists so a second sweep that starts
 *    while the first is still running cannot delete the same row twice, and nothing more. Making it a
 *    scan or claim predicate would strand a row whose executor crashed mid-deletion with no way back.
 */

import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { registerQueue, getQueue, QUEUE_NAMES } from '../../../shared/queue';
import { DELETION_GRACE_DAYS, runAccountDeletion } from './deletion-service';

/** Stable id of the sweep schedule: re-registering with a new interval replaces it, never duplicates it. */
export const JUVI_ACCOUNT_DELETION_SWEEP_ID = 'juvi-account-deletion-sweep';
/** Hourly. The deadline is measured in days, so the resolution costs the requester nothing. */
export const SWEEP_EVERY_MS = 3_600_000;
const BATCH_SIZE = 500;

export interface DeletionSweepResult {
  deleted: number;
}

/**
 * Core sweep. Exported so tests can invoke it directly without bringing up BullMQ's Redis
 * connection — the `expireProposals` precedent (`shared/jobs/proposal-expiry-worker.ts:29`).
 *
 * `now` is a parameter so a test can place a row past its deadline without waiting seven days.
 */
export async function sweepAccountDeletions(now: Date = new Date()): Promise<DeletionSweepResult> {
  const result: DeletionSweepResult = { deleted: 0 };
  const deadline = new Date(now.getTime() - DELETION_GRACE_DAYS * 86_400_000);

  // `$ne: null` matches the sibling sweep (`shared/jobs/proposal-expiry-worker.ts:37`) and states the
  // intent, but it is not what keeps never-requested accounts out of the result: a range predicate
  // already excludes a missing or null field here (measured, not assumed). The *sparse* index
  // (`models/juvi/JuviAccount.ts:114`) is what keeps them out of the index.
  const due = await JuviAccount.find({ deletionRequestedAt: { $lte: deadline, $ne: null } })
    .limit(BATCH_SIZE)
    .lean();

  for (const row of due) {
    try {
      // The claim is the row's, not the scan's: a row cancelled, or completed by another sweep,
      // between the two statements no longer matches and is left alone.
      const claimed = await JuviAccount.findOneAndUpdate(
        { _id: row._id, deletionRequestedAt: { $lte: deadline, $ne: null } },
        { $set: { deletionClaimedAt: new Date() } },
        { new: true },
      );
      if (!claimed) continue;

      await runAccountDeletion(claimed);
      result.deleted += 1;
    } catch (err) {
      // One person's failed deletion must not stop the batch, and must not be retried forever by
      // this pass: the next hourly sweep re-scans the same row, and the claim predicate is open, so
      // it gets another attempt there.
      console.error('[juvi-app] account-deletion sweep failed for', String(row._id), err);
    }
  }

  return result;
}

async function processor(): Promise<DeletionSweepResult> {
  const result = await sweepAccountDeletions();
  if (result.deleted > 0) console.log(`[juvi-app] account-deletion sweep deleted ${result.deleted}`);
  return result;
}

/**
 * Registers the queue and the hourly sweep. Called from `server.ts` inside the
 * `DISABLE_BACKGROUND_JOBS !== 'true'` gate; concurrency 1 so two passes never interleave.
 */
export async function registerJuviAccountDeletionQueue(): Promise<void> {
  registerQueue({ name: QUEUE_NAMES.JUVI_ACCOUNT_DELETION, processor, concurrency: 1 });
  const queue = getQueue(QUEUE_NAMES.JUVI_ACCOUNT_DELETION);
  await queue.upsertJobScheduler(JUVI_ACCOUNT_DELETION_SWEEP_ID, { every: SWEEP_EVERY_MS }, {
    name: 'sweep',
    data: {},
    opts: { removeOnComplete: true, removeOnFail: true },
  });
}
